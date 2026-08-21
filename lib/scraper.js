function decodeHtml(value) {
  return value
    ?.replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .trim();
}

function getFirstMatch(html, pattern) {
  return decodeHtml(html.match(pattern)?.[1]);
}

function getMetaContent(html, names) {
  for (const name of names) {
    const escapedName = name.replaceAll(":", "\\:");
    const propertyPattern = new RegExp(
      `<meta[^>]+(?:property|name)=["']${escapedName}["'][^>]+content=["']([^"']+)["'][^>]*>`,
      "i",
    );
    const contentPattern = new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escapedName}["'][^>]*>`,
      "i",
    );
    const value = getFirstMatch(html, propertyPattern) || getFirstMatch(html, contentPattern);

    if (value) {
      return value;
    }
  }

  return null;
}

function parseJsonLdBlocks(html) {
  const blocks = [];
  const pattern =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match = pattern.exec(html);

  while (match) {
    const text = match[1].trim();

    try {
      blocks.push(JSON.parse(text));
    } catch {
      // Some sites include invalid JSON-LD. Ignore those blocks for now.
    }

    match = pattern.exec(html);
  }

  return blocks.flatMap(flattenJsonLd);
}

function flattenJsonLd(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap(flattenJsonLd);
  }

  if (value["@graph"]) {
    return [value, ...flattenJsonLd(value["@graph"])];
  }

  return [value];
}

function typeMatches(item, targetType) {
  const type = item?.["@type"];

  if (Array.isArray(type)) {
    return type.some((entry) => String(entry).toLowerCase() === targetType);
  }

  return String(type || "").toLowerCase() === targetType;
}

function getProductJsonLd(html) {
  return parseJsonLdBlocks(html).find((item) => typeMatches(item, "product"));
}

function getProductGroupJsonLd(html) {
  return parseJsonLdBlocks(html).find((item) =>
    typeMatches(item, "productgroup"),
  );
}

function getOffer(product) {
  const offers = product?.offers;

  if (Array.isArray(offers)) {
    return offers[0];
  }

  return offers || null;
}

function getImage(product, html) {
  const image = product?.image;

  if (Array.isArray(image)) {
    return image[0]?.url || image[0];
  }

  if (typeof image === "object") {
    return image.url;
  }

  return image || getMetaContent(html, ["og:image", "twitter:image"]);
}

function formatPrice(price, currency) {
  if (!price) {
    return null;
  }

  if (typeof price === "number") {
    const formattedPrice = Number.isInteger(price) ? String(price) : price.toFixed(2);
    return currency === "USD" ? `$${formattedPrice}` : formattedPrice;
  }

  const cleanPrice = String(price).trim();

  if (currency === "USD" && !cleanPrice.startsWith("$")) {
    return `$${cleanPrice}`;
  }

  return cleanPrice;
}

function getAvailability(availability) {
  const text = String(availability || "").toLowerCase();

  if (text.includes("outofstock") || text.includes("out of stock")) {
    return "Out of stock";
  }

  if (text.includes("instock") || text.includes("in stock")) {
    return "In stock";
  }

  if (text.includes("limited") || text.includes("lowstock")) {
    return "Low stock";
  }

  return availability ? String(availability).split("/").pop() : null;
}

function getConfiguredHosts(envKey) {
  return String(process.env[envKey] || "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
}

function matchesConfiguredHost(hostname, envKey) {
  const cleanHostname = String(hostname || "").toLowerCase();

  return getConfiguredHosts(envKey).some(
    (configuredHost) =>
      cleanHostname === configuredHost || cleanHostname.endsWith(`.${configuredHost}`),
  );
}

function normalizeSizeValue(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replaceAll(/\s+/g, "");
}

function sizeMatches(left, right) {
  return normalizeSizeValue(left) === normalizeSizeValue(right);
}

function parseVariantSpecs(value) {
  return String(value || "")
    .split(/[,\n;]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const separatorIndex = entry.indexOf(":");

      if (separatorIndex === -1) {
        return { key: "", value: entry };
      }

      return {
        key: entry.slice(0, separatorIndex).trim().toLowerCase(),
        value: entry.slice(separatorIndex + 1).trim(),
      };
    })
    .filter((entry) => entry.value);
}

function normalizeSpecValue(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replaceAll(/[\s_-]+/g, "");
}

function getVariantFieldText(variant, key) {
  const colorKeys = ["color", "colour", "colorname", "color_name"];
  const sizeKeys = ["size", "sizes", "size_name", "sizename"];
  const knownKeys = {
    color: colorKeys,
    colour: colorKeys,
    size: sizeKeys,
    name: ["name"],
    sku: ["sku"],
    mpn: ["mpn"],
  };
  const fields = knownKeys[key] || [key];

  return fields
    .flatMap((field) => {
      const value = variant?.[field];

      if (Array.isArray(value)) {
        return value;
      }

      return value ? [value] : [];
    })
    .join(" ");
}

function getVariantSearchText(variant) {
  return [
    variant?.name,
    variant?.sku,
    variant?.mpn,
    variant?.size,
    variant?.color,
    variant?.colour,
    variant?.colorName,
    variant?.color_name,
  ]
    .filter(Boolean)
    .join(" ");
}

function variantMatchesSpecs(variant, specs) {
  return specs.every((spec) => {
    const targetText = spec.key
      ? getVariantFieldText(variant, spec.key)
      : getVariantSearchText(variant);

    return normalizeSpecValue(targetText).includes(normalizeSpecValue(spec.value));
  });
}

function getVariantIdFromOffer(variant) {
  const offer = getOffer(variant);
  const offerUrl = offer?.url;

  if (!offerUrl) {
    return null;
  }

  try {
    return new URL(offerUrl).searchParams.get("variant");
  } catch {
    return String(offerUrl).match(/[?&]variant=([^&]+)/)?.[1] || null;
  }
}

function parseProductGroupSchema(html, url, options = {}) {
  const productGroup = getProductGroupJsonLd(html);

  if (!productGroup) {
    return null;
  }

  const variants = Array.isArray(productGroup.hasVariant)
    ? productGroup.hasVariant
    : [];
  const trackedSize = options.trackedSize?.trim() || "";
  const variantSpecs = parseVariantSpecs(options.variantSpecs);
  let urlVariantId = null;

  try {
    urlVariantId = new URL(url).searchParams.get("variant");
  } catch {
    urlVariantId = null;
  }

  const sizeVariant = trackedSize
    ? variants.find((variant) => sizeMatches(variant.size, trackedSize))
    : null;
  const urlVariant = urlVariantId
    ? variants.find((variant) => getVariantIdFromOffer(variant) === urlVariantId)
    : null;
  const specsVariant = variantSpecs.length
    ? variants.find((variant) => variantMatchesSpecs(variant, variantSpecs))
    : null;
  const shouldUseDefaultVariant = !trackedSize && variantSpecs.length === 0;
  const selectedVariant =
    specsVariant || sizeVariant || urlVariant || (shouldUseDefaultVariant ? variants[0] : null);
  const fallbackVariant = selectedVariant || variants[0] || null;
  const offer = getOffer(selectedVariant) || getOffer(fallbackVariant);
  const wantsSpecificVariant = Boolean(trackedSize || variantSpecs.length);
  const stockStatus = selectedVariant
    ? getAvailability(offer?.availability) || "Unknown"
    : wantsSpecificVariant
      ? "Unknown"
      : getAvailability(offer?.availability) || "Unknown";
  const selectedSize = selectedVariant?.size || trackedSize || null;

  return {
    title: productGroup.name || selectedVariant?.name || "Untitled product",
    imageUrl: getImage(selectedVariant || productGroup, html) || null,
    price: formatPrice(offer?.price || offer?.lowPrice, offer?.priceCurrency) || "Unknown",
    currency: offer?.priceCurrency || null,
    stockStatus,
    trackedSize: selectedSize,
    stockScope: selectedVariant
      ? variantSpecs.length
        ? "variant-specific"
        : "size-specific"
      : "general",
    rawSource: selectedVariant
      ? variantSpecs.length
        ? "json-ld:product-group-variant"
        : "json-ld:product-group-size"
      : wantsSpecificVariant
        ? "json-ld:product-group-variant-not-found"
        : "json-ld:product-group",
  };
}

function getBrandTwoStockStatus(stock) {
  const statusCode = stock?.statusCode;
  const localizedStatus = stock?.statusLocalized;

  if (statusCode === "STOCK_OUT") {
    return "Out of stock";
  }

  if (statusCode === "LOW_STOCK") {
    return "Low stock";
  }

  if (statusCode === "IN_STOCK") {
    return "In stock";
  }

  return localizedStatus || "Unknown";
}

function normalizeBrandOneSizeCode(sizeCode) {
  if (!sizeCode) {
    return null;
  }

  const trimmed = String(sizeCode).trim();

  if (/^\d+$/.test(trimmed)) {
    return String(Number(trimmed));
  }

  return trimmed;
}

function getBrandOneSelectedSize(url) {
  try {
    const productUrl = new URL(url);

    if (!matchesConfiguredHost(productUrl.hostname, "BRAND_ONE_HOSTS")) {
      return null;
    }

    for (const [key, value] of productUrl.searchParams.entries()) {
      if (key.includes("size")) {
        return normalizeBrandOneSizeCode(value);
      }
    }
  } catch {
    return null;
  }

  return null;
}

function extractBalancedJsonAfter(html, marker) {
  const markerIndex = html.indexOf(marker);

  if (markerIndex === -1) {
    return null;
  }

  let index = markerIndex + marker.length;
  let depth = 0;
  let isInsideString = false;
  let isEscaped = false;
  let startIndex = -1;

  for (; index < html.length; index += 1) {
    const character = html[index];

    if (startIndex === -1) {
      if (character === "{") {
        startIndex = index;
        depth = 1;
      }

      continue;
    }

    if (isInsideString) {
      if (isEscaped) {
        isEscaped = false;
      } else if (character === "\\") {
        isEscaped = true;
      } else if (character === '"') {
        isInsideString = false;
      }

      continue;
    }

    if (character === '"') {
      isInsideString = true;
    } else if (character === "{") {
      depth += 1;
    } else if (character === "}") {
      depth -= 1;

      if (depth === 0) {
        return html.slice(startIndex, index + 1);
      }
    }
  }

  return null;
}

function getBrandTwoSelectedProductKey(state, productId, colorDisplayCode) {
  const pdpEntity = state?.entity?.pdpEntity || {};
  const exactKey = `${productId}-${colorDisplayCode}`;

  if (pdpEntity[exactKey]) {
    return exactKey;
  }

  return Object.keys(pdpEntity).find((key) => key.startsWith(`${productId}-`));
}

async function getBrandTwoSelectedL2Stock(productUrl, productId, priceGroup, selection) {
  const stockUrl = new URL(
    `/us/api/commerce/v5/en/products/${productId}/price-groups/${priceGroup}/l2s`,
    productUrl.origin,
  );
  stockUrl.searchParams.set("withPrices", "true");
  stockUrl.searchParams.set("withStocks", "true");
  stockUrl.searchParams.set("includePreviousPrice", "false");
  stockUrl.searchParams.set("httpFailure", "true");

  const brandTwoHeaders = {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ShoppingTool/0.1",
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  const clientId = process.env.BRAND_TWO_CLIENT_ID;

  if (clientId) {
    brandTwoHeaders["x-fr-clientid"] = clientId;
    brandTwoHeaders["x-fr-client-version"] = process.env.BRAND_TWO_CLIENT_VERSION || "unknown";
  }

  const response = await fetch(stockUrl, {
    headers: brandTwoHeaders,
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    return null;
  }

  const stockData = await response.json();

  if (stockData.status !== "ok") {
    return null;
  }

  const l2 = stockData.result?.l2s?.find(
    (entry) =>
      entry.color?.displayCode === selection.colorDisplayCode &&
      entry.size?.displayCode === selection.sizeDisplayCode,
  );

  if (!l2) {
    return null;
  }

  return {
    l2,
    stock: stockData.result?.stocks?.[l2.l2Id],
    price: stockData.result?.prices?.[l2.l2Id],
  };
}

async function parseBrandTwoPreloadedState(html, url) {
  let productUrl;

  try {
    productUrl = new URL(url);
  } catch {
    return null;
  }

  if (!matchesConfiguredHost(productUrl.hostname, "BRAND_TWO_HOSTS")) {
    return null;
  }

  const productId = productUrl.pathname.match(/\/products\/([^/]+)/)?.[1];
  const colorDisplayCode =
    productUrl.searchParams.get("colorDisplayCode") ||
    productUrl.pathname.match(/\/products\/[^/]+\/([^/?]+)/)?.[1];
  const sizeDisplayCode = productUrl.searchParams.get("sizeDisplayCode");
  const jsonText = extractBalancedJsonAfter(html, "window.__PRELOADED_STATE__ = ");

  if (!jsonText || !productId) {
    return null;
  }

  try {
    const state = JSON.parse(jsonText);
    const selectedProductKey = getBrandTwoSelectedProductKey(
      state,
      productId,
      colorDisplayCode,
    );
    const product = selectedProductKey
      ? state.entity?.pdpEntity?.[selectedProductKey]?.product
      : null;

    if (!product) {
      return null;
    }

    const selection = state.selection?.[productId] || {};
    const selectedColorDisplayCode = colorDisplayCode || selection.colorDisplayCode;
    const selectedSizeDisplayCode = sizeDisplayCode || selection.sizeDisplayCode;
    const selectedSize = product.sizes?.find(
      (size) => size.displayCode === selectedSizeDisplayCode,
    );
    const selectedSelection = {
      colorDisplayCode: selectedColorDisplayCode,
      sizeDisplayCode: selectedSizeDisplayCode,
    };
    const selectedImage =
      product.images?.main?.[selectedColorDisplayCode]?.image ||
      Object.values(product.images?.main || {})[0]?.image;
    const selectedL2Stock = await getBrandTwoSelectedL2Stock(
      productUrl,
      productId,
      product.priceGroup || selectedProductKey.split("-").pop() || "00",
      selectedSelection,
    );
    const price =
      selectedL2Stock?.price?.promo ||
      selectedL2Stock?.price?.base ||
      product.prices?.promo ||
      product.prices?.base;
    const currencyCode = price?.currency?.code;
    const stockStatus = selectedL2Stock
      ? getBrandTwoStockStatus(selectedL2Stock.stock)
      : "Unknown";

    return {
      title: product.name || "Untitled product",
      imageUrl: selectedImage || null,
      price: formatPrice(price?.value, currencyCode) || "Unknown",
      currency: currencyCode || null,
      stockStatus,
      trackedSize: selectedSize?.name || selectedSizeDisplayCode || null,
      stockScope: selectedL2Stock ? "size-specific" : "general",
      rawSource: selectedL2Stock
        ? "brand-two-preloaded-state:l2-stock"
        : selectedSize
          ? "brand-two-preloaded-state:size-code"
          : "brand-two-preloaded-state",
    };
  } catch {
    return null;
  }
}

export async function scrapeProductUrl(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ShoppingTool/0.1",
      Accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`The product page returned HTTP ${response.status}.`);
  }

  const html = await response.text();
  const brandTwoProduct = await parseBrandTwoPreloadedState(html, url);

  if (brandTwoProduct) {
    return brandTwoProduct;
  }

  const productGroup = parseProductGroupSchema(html, url, options);

  if (productGroup) {
    return productGroup;
  }

  const product = getProductJsonLd(html);
  const offer = getOffer(product);
  const title =
    product?.name ||
    getMetaContent(html, ["og:title", "twitter:title"]) ||
    getFirstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const currency = offer?.priceCurrency || getMetaContent(html, ["product:price:currency"]);
  const price =
    formatPrice(offer?.price || offer?.lowPrice, currency) ||
    getMetaContent(html, ["product:price:amount"]);
  const availability =
    getAvailability(offer?.availability) ||
    getMetaContent(html, ["product:availability"]) ||
    "Unknown";
  const brandOneSelectedSize = getBrandOneSelectedSize(url);

  return {
    title: title || "Untitled product",
    imageUrl: getImage(product, html) || null,
    price: price || "Unknown",
    currency: currency || null,
    stockStatus: availability,
    trackedSize: brandOneSelectedSize,
    stockScope: brandOneSelectedSize ? "size-specific" : "general",
    rawSource: brandOneSelectedSize
      ? "json-ld:brand-one-size"
      : product
        ? "json-ld"
        : "meta-tags",
  };
}
