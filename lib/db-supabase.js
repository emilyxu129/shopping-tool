const SUPABASE_REST_PATH = "/rest/v1";

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase is not configured.");
  }

  return { url, serviceRoleKey };
}

async function supabaseRequest(table, { method = "GET", query = "", body, prefer } = {}) {
  const { url, serviceRoleKey } = getSupabaseConfig();
  const separator = query ? `?${query}` : "";
  const response = await fetch(`${url}${SUPABASE_REST_PATH}/${table}${separator}`, {
    method,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const error = new Error(data?.message || `Supabase request failed: ${response.status}`);
    error.code = data?.code;
    error.details = data;
    throw error;
  }

  return data;
}

function encodeQueryValue(value) {
  return encodeURIComponent(value);
}

function normalizeBadges(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (!value) {
    return [];
  }

  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}

function mapProduct(row) {
  return {
    id: row.id,
    url: row.url,
    imageType: row.image_type,
    imageLabel: row.image_label,
    imageUrl: row.image_url,
    shop: row.shop,
    title: row.title,
    currentPrice: row.current_price,
    previousPrice: row.previous_price,
    trackedSize: row.tracked_size,
    variantSpecs: row.variant_specs,
    size: row.size_label,
    stock: row.stock_status,
    stockScope: row.stock_scope,
    checkedAt: row.last_checked_at,
    badges: normalizeBadges(row.badges_json),
    change: row.latest_change,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getDomainFromUrl(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "new-shop.test";
  }
}

export async function getProducts() {
  const rows = await supabaseRequest("tracked_products", {
    query: "select=*&order=created_at.desc,id.desc",
  });

  return rows.map(mapProduct);
}

export async function createProduct(url, trackedSize = "", variantSpecs = "") {
  const trimmedUrl = url.trim();
  const trimmedSize = trackedSize.trim();
  const trimmedSpecs = variantSpecs.trim();
  const rows = await supabaseRequest("tracked_products", {
    method: "POST",
    prefer: "return=representation",
    body: {
      url: trimmedUrl,
      shop: getDomainFromUrl(trimmedUrl),
      title: "New tracked product",
      tracked_size: trimmedSize,
      variant_specs: trimmedSpecs,
      size_label: trimmedSize || "Unknown",
      latest_change:
        "Saved. Stock is general page stock until this store supports detail-specific parsing.",
      badges_json: [{ label: "Newly tracked", tone: "green" }],
    },
  });

  return mapProduct(rows[0]);
}

export async function getProduct(id) {
  const rows = await supabaseRequest("tracked_products", {
    query: `select=*&id=eq.${encodeQueryValue(id)}&limit=1`,
  });

  return rows[0] ? mapProduct(rows[0]) : null;
}

export async function deleteProduct(id) {
  const rows = await supabaseRequest("tracked_products", {
    method: "DELETE",
    query: `id=eq.${encodeQueryValue(id)}`,
    prefer: "return=representation",
  });

  return rows.length > 0;
}

export async function updateProductTrackedSize(id, trackedSize, variantSpecs) {
  const trimmedSize = trackedSize.trim();
  const trimmedSpecs = variantSpecs?.trim();
  const rows = await supabaseRequest("tracked_products", {
    method: "PATCH",
    query: `id=eq.${encodeQueryValue(id)}`,
    prefer: "return=representation",
    body: {
      tracked_size: trimmedSize,
      ...(trimmedSpecs !== undefined ? { variant_specs: trimmedSpecs } : {}),
      ...(trimmedSize ? { size_label: trimmedSize } : {}),
      latest_change:
        [trimmedSize ? `Size: ${trimmedSize}` : "", trimmedSpecs ? `Specs: ${trimmedSpecs}` : ""]
          .filter(Boolean)
          .join(". ") || "Tracking preferences updated.",
    },
  });

  return rows[0] ? mapProduct(rows[0]) : null;
}

export async function markLatestProductEventEmailed(productId) {
  const rows = await supabaseRequest("product_events", {
    query: `select=id&product_id=eq.${encodeQueryValue(productId)}&order=created_at.desc,id.desc&limit=1`,
  });

  if (!rows[0]) {
    return false;
  }

  await supabaseRequest("product_events", {
    method: "PATCH",
    query: `id=eq.${encodeQueryValue(rows[0].id)}`,
    body: { emailed_at: new Date().toISOString() },
  });

  return true;
}

export async function refreshProduct(id) {
  return refreshProductWithScrape(id, null);
}

export async function scrapeAndRefreshProduct(id, scrapedProduct) {
  return refreshProductWithScrape(id, scrapedProduct);
}

function buildChangeMessage(product, scrapedProduct) {
  const changes = [];

  if (scrapedProduct.price && scrapedProduct.price !== product.currentPrice) {
    changes.push(`Price changed from ${product.currentPrice} to ${scrapedProduct.price}.`);
  }

  if (scrapedProduct.stockStatus && scrapedProduct.stockStatus !== product.stock) {
    changes.push(`Stock changed from ${product.stock} to ${scrapedProduct.stockStatus}.`);
  }

  if (scrapedProduct.title && scrapedProduct.title !== product.title) {
    changes.push("Product title changed.");
  }

  if (!product.trackedSize && scrapedProduct.trackedSize) {
    changes.push(`Tracked size copied from URL: ${scrapedProduct.trackedSize}.`);
  }

  if (
    product.trackedSize &&
    scrapedProduct.trackedSize &&
    product.trackedSize !== scrapedProduct.trackedSize
  ) {
    changes.push(
      `Tracking size updated from ${product.trackedSize} to URL-selected size ${scrapedProduct.trackedSize}.`,
    );
  }

  if (["size-specific", "variant-specific"].includes(scrapedProduct.stockScope)) {
    changes.push("Stock is specific to the tracked product details.");
  }

  return changes.length
    ? changes.join(" ")
    : "Manual refresh checked the page. No product changes detected.";
}

function buildBadges(product, scrapedProduct) {
  const badges = [];
  const stockStatus = scrapedProduct.stockStatus || product.stock;

  if (stockStatus === "Out of stock") {
    badges.push({ label: "Out of stock", tone: "red" });
  } else if (stockStatus === "Low stock") {
    badges.push({ label: "Low stock", tone: "amber" });
  } else if (stockStatus === "In stock") {
    badges.push({ label: "In stock", tone: "green" });
  }

  if (scrapedProduct.price && scrapedProduct.price !== product.currentPrice) {
    badges.unshift({ label: "Price changed", tone: "green" });
  }

  return badges.length ? badges : product.badges;
}

async function refreshProductWithScrape(id, scrapedProduct) {
  const product = await getProduct(id);

  if (!product) {
    return null;
  }

  const refreshMessage = scrapedProduct
    ? buildChangeMessage(product, scrapedProduct)
    : "Manual refresh recorded. Scraping will be added in the next phase.";
  const nextPrice = scrapedProduct?.price || product.currentPrice;
  const nextStockStatus = scrapedProduct?.stockStatus || product.stock;
  const nextTrackedSize = scrapedProduct?.trackedSize || product.trackedSize || "";
  const nextSizeLabel = nextTrackedSize || product.size;
  const nextStockScope = scrapedProduct?.stockScope || product.stockScope || "general";
  const nextTitle = scrapedProduct?.title || product.title;
  const nextImageUrl = scrapedProduct?.imageUrl || product.imageUrl;
  const nextCurrency = scrapedProduct?.currency || null;
  const nextSource = scrapedProduct?.rawSource || null;
  const nextBadges = scrapedProduct ? buildBadges(product, scrapedProduct) : product.badges;

  const rows = await supabaseRequest("tracked_products", {
    method: "PATCH",
    query: `id=eq.${encodeQueryValue(id)}`,
    prefer: "return=representation",
    body: {
      title: nextTitle,
      image_url: nextImageUrl,
      previous_price: product.currentPrice,
      current_price: nextPrice,
      currency: nextCurrency,
      tracked_size: nextTrackedSize,
      size_label: nextSizeLabel,
      stock_status: nextStockStatus,
      stock_scope: nextStockScope,
      last_checked_at: "Checked just now",
      latest_change: refreshMessage,
      badges_json: nextBadges,
      last_scrape_source: nextSource,
    },
  });

  await supabaseRequest("product_snapshots", {
    method: "POST",
    body: {
      product_id: Number(id),
      price: nextPrice,
      stock_status: nextStockStatus,
      size_label: nextSizeLabel,
      title: nextTitle,
      image_url: nextImageUrl,
      raw_source: nextSource,
      stock_scope: nextStockScope,
    },
  });

  await supabaseRequest("product_events", {
    method: "POST",
    body: {
      product_id: Number(id),
      event_type: "manual_refresh",
      message: refreshMessage,
    },
  });

  return rows[0] ? mapProduct(rows[0]) : null;
}

export async function refreshAllProducts() {
  const products = await getProducts();

  for (const product of products) {
    await refreshProduct(product.id);
  }

  return getProducts();
}

async function getCount(table) {
  const rows = await supabaseRequest(table, {
    query: "select=id",
  });

  return rows.length;
}

export async function getDatabaseSummary() {
  return {
    products: await getCount("tracked_products"),
    snapshots: await getCount("product_snapshots"),
    events: await getCount("product_events"),
  };
}

export async function getDatabaseTables() {
  const [products, snapshots, events, settings] = await Promise.all([
    supabaseRequest("tracked_products", {
      query:
        "select=id,title,shop,url,current_price,previous_price,tracked_size,size_label,stock_status,stock_scope,latest_change,last_checked_at,updated_at&order=updated_at.desc,id.desc",
    }),
    supabaseRequest("product_snapshots", {
      query:
        "select=id,product_id,price,stock_status,size_label,title,raw_source,stock_scope,checked_at&order=checked_at.desc,id.desc&limit=50",
    }),
    supabaseRequest("product_events", {
      query:
        "select=id,product_id,event_type,message,created_at,emailed_at&order=created_at.desc,id.desc&limit=50",
    }),
    supabaseRequest("app_settings", {
      query: "select=key,value,updated_at&order=key.asc",
    }),
  ]);

  return { products, snapshots, events, settings };
}
