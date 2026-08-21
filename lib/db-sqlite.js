import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const dataDir = path.join(process.cwd(), "data");
const dbPath = path.join(dataDir, "shopping-tool.sqlite");

let database;

const sampleProducts = [
  {
    url: "https://shop.example.com/products/everyday-leather-tote",
    shop: "shop.example.com",
    title: "Everyday Leather Tote - Cognac",
    image_type: "bag",
    image_label: "Bag",
    current_price: "$118.00",
    previous_price: "$148.00",
    size_label: "Medium",
    stock_status: "Only 3 left",
    latest_change:
      "Price dropped from $148.00 to $118.00. Stock changed from in stock to low stock.",
    badges_json: JSON.stringify([
      { label: "Price drop", tone: "green" },
      { label: "Low stock", tone: "amber" },
    ]),
    last_checked_at: "Checked 18 min ago",
  },
  {
    url: "https://another-shop.test/products/cloud-runner-sneaker",
    shop: "another-shop.test",
    title: "Cloud Runner Sneaker - Bone / Silver",
    image_type: "shoe",
    image_label: "Shoe",
    current_price: "$96.00",
    previous_price: "$96.00",
    size_label: "8.5",
    stock_status: "Out of stock",
    latest_change: "Stock changed from available to out of stock. Email alert queued.",
    badges_json: JSON.stringify([{ label: "Out of stock", tone: "red" }]),
    last_checked_at: "Checked 1 hr ago",
  },
  {
    url: "https://home-store.test/products/dome-table-lamp",
    shop: "home-store.test",
    title: "Dome Table Lamp - Brushed Steel",
    image_type: "lamp",
    image_label: "Lamp",
    current_price: "$72.00",
    previous_price: "$79.00",
    size_label: "One size",
    stock_status: "In stock",
    latest_change: "Price dropped by $7.00 since the last saved snapshot.",
    badges_json: JSON.stringify([{ label: "In stock", tone: "green" }]),
    last_checked_at: "Checked yesterday",
  },
];

function getDatabase() {
  if (database) {
    return database;
  }

  mkdirSync(dataDir, { recursive: true });
  database = new DatabaseSync(dbPath);
  database.exec("PRAGMA foreign_keys = ON");
  database.exec(`
    CREATE TABLE IF NOT EXISTS tracked_products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL UNIQUE,
      shop TEXT NOT NULL,
      title TEXT NOT NULL,
      image_type TEXT NOT NULL DEFAULT 'bag',
      image_label TEXT NOT NULL DEFAULT 'New',
      current_price TEXT NOT NULL DEFAULT 'Waiting for scraper',
      previous_price TEXT NOT NULL DEFAULT 'None yet',
      tracked_size TEXT NOT NULL DEFAULT '',
      variant_specs TEXT NOT NULL DEFAULT '',
      size_label TEXT NOT NULL DEFAULT 'Unknown',
      stock_status TEXT NOT NULL DEFAULT 'Unknown',
      stock_scope TEXT NOT NULL DEFAULT 'general',
      latest_change TEXT NOT NULL DEFAULT '',
      badges_json TEXT NOT NULL DEFAULT '[]',
      last_checked_at TEXT NOT NULL DEFAULT 'Not checked yet',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS product_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      price TEXT,
      stock_status TEXT,
      size_label TEXT,
      title TEXT,
      image_url TEXT,
      raw_source TEXT,
      stock_scope TEXT NOT NULL DEFAULT 'general',
      checked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES tracked_products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS product_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      emailed_at TEXT,
      FOREIGN KEY (product_id) REFERENCES tracked_products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  ensureColumn(database, "tracked_products", "image_url", "TEXT");
  ensureColumn(database, "tracked_products", "currency", "TEXT");
  ensureColumn(database, "tracked_products", "last_scrape_source", "TEXT");
  ensureColumn(database, "tracked_products", "tracked_size", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(database, "tracked_products", "variant_specs", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(database, "tracked_products", "stock_scope", "TEXT NOT NULL DEFAULT 'general'");
  ensureColumn(database, "product_snapshots", "stock_scope", "TEXT NOT NULL DEFAULT 'general'");

  seedProductsIfNeeded(database);
  return database;
}

function ensureColumn(db, tableName, columnName, definition) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  const hasColumn = columns.some((column) => column.name === columnName);

  if (!hasColumn) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

function seedProductsIfNeeded(db) {
  const row = db.prepare("SELECT COUNT(*) AS count FROM tracked_products").get();

  if (row.count > 0) {
    return;
  }

  const insertProduct = db.prepare(`
    INSERT INTO tracked_products (
      url,
      shop,
      title,
      image_type,
      image_label,
      current_price,
      previous_price,
      size_label,
      stock_status,
      latest_change,
      badges_json,
      last_checked_at
    ) VALUES (
      $url,
      $shop,
      $title,
      $image_type,
      $image_label,
      $current_price,
      $previous_price,
      $size_label,
      $stock_status,
      $latest_change,
      $badges_json,
      $last_checked_at
    )
  `);

  const insertSnapshot = db.prepare(`
    INSERT INTO product_snapshots (
      product_id,
      price,
      stock_status,
      size_label,
      title
    ) VALUES (
      $product_id,
      $price,
      $stock_status,
      $size_label,
      $title
    )
  `);

  const insertEvent = db.prepare(`
    INSERT INTO product_events (
      product_id,
      event_type,
      message
    ) VALUES (
      $product_id,
      $event_type,
      $message
    )
  `);

  try {
    db.exec("BEGIN");

    for (const product of sampleProducts) {
      const result = insertProduct.run(product);
      insertSnapshot.run({
        product_id: result.lastInsertRowid,
        price: product.current_price,
        stock_status: product.stock_status,
        size_label: product.size_label,
        title: product.title,
      });
      insertEvent.run({
        product_id: result.lastInsertRowid,
        event_type: "seed",
        message: product.latest_change,
      });
    }

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
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
    badges: JSON.parse(row.badges_json || "[]"),
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

export function getProducts() {
  const db = getDatabase();
  const rows = db
    .prepare("SELECT * FROM tracked_products ORDER BY created_at DESC, id DESC")
    .all();

  return rows.map(mapProduct);
}

export function createProduct(url, trackedSize = "", variantSpecs = "") {
  const trimmedUrl = url.trim();
  const trimmedSize = trackedSize.trim();
  const trimmedSpecs = variantSpecs.trim();
  const db = getDatabase();
  const result = db
    .prepare(`
      INSERT INTO tracked_products (
        url,
        shop,
        title,
        tracked_size,
        variant_specs,
        size_label,
        latest_change,
        badges_json
      ) VALUES (
        $url,
        $shop,
        $title,
        $tracked_size,
        $variant_specs,
        $size_label,
        $latest_change,
        $badges_json
      )
    `)
    .run({
      url: trimmedUrl,
      shop: getDomainFromUrl(trimmedUrl),
      title: "New tracked product",
      tracked_size: trimmedSize,
      variant_specs: trimmedSpecs,
      size_label: trimmedSize || "Unknown",
      latest_change:
        "Saved. Stock is general page stock until this store supports detail-specific parsing.",
      badges_json: JSON.stringify([{ label: "Newly tracked", tone: "green" }]),
    });

  return getProduct(result.lastInsertRowid);
}

export function getProduct(id) {
  const db = getDatabase();
  const row = db
    .prepare("SELECT * FROM tracked_products WHERE id = $id")
    .get({ id: Number(id) });

  return row ? mapProduct(row) : null;
}

export function deleteProduct(id) {
  const db = getDatabase();
  const result = db
    .prepare("DELETE FROM tracked_products WHERE id = $id")
    .run({ id: Number(id) });

  return result.changes > 0;
}

export function updateProductTrackedSize(id, trackedSize, variantSpecs) {
  const trimmedSize = trackedSize.trim();
  const trimmedSpecs = variantSpecs?.trim();
  const db = getDatabase();
  const result = db
    .prepare(`
      UPDATE tracked_products
      SET
        tracked_size = $tracked_size,
        variant_specs = CASE
          WHEN $variant_specs IS NULL THEN variant_specs
          ELSE $variant_specs
        END,
        size_label = CASE
          WHEN $tracked_size = '' THEN size_label
          ELSE $tracked_size
        END,
        latest_change = $latest_change,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $id
    `)
    .run({
      id: Number(id),
      tracked_size: trimmedSize,
      variant_specs: trimmedSpecs ?? null,
      latest_change:
        [trimmedSize ? `Size: ${trimmedSize}` : "", trimmedSpecs ? `Specs: ${trimmedSpecs}` : ""]
          .filter(Boolean)
          .join(". ") || "Tracking preferences updated.",
    });

  if (result.changes === 0) {
    return null;
  }

  return getProduct(id);
}

export function markLatestProductEventEmailed(productId) {
  const db = getDatabase();
  const latestEvent = db
    .prepare(
      `SELECT id
       FROM product_events
       WHERE product_id = $product_id
       ORDER BY created_at DESC, id DESC
       LIMIT 1`,
    )
    .get({ product_id: Number(productId) });

  if (!latestEvent) {
    return false;
  }

  db.prepare(
    `UPDATE product_events
     SET emailed_at = CURRENT_TIMESTAMP
     WHERE id = $id`,
  ).run({ id: latestEvent.id });

  return true;
}

export function refreshProduct(id) {
  return refreshProductWithScrape(id, null);
}

export async function scrapeAndRefreshProduct(id, scrapeProduct) {
  return refreshProductWithScrape(id, scrapeProduct);
}

function buildChangeMessage(product, scrapedProduct) {
  const changes = [];

  if (scrapedProduct.price && scrapedProduct.price !== product.currentPrice) {
    changes.push(`Price changed from ${product.currentPrice} to ${scrapedProduct.price}.`);
  }

  if (
    scrapedProduct.stockStatus &&
    scrapedProduct.stockStatus !== product.stock
  ) {
    changes.push(
      `Stock changed from ${product.stock} to ${scrapedProduct.stockStatus}.`,
    );
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

  if (changes.length === 0) {
    return "Manual refresh checked the page. No product changes detected.";
  }

  return changes.join(" ");
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

function refreshProductWithScrape(id, scrapedProduct) {
  const db = getDatabase();
  const product = getProduct(id);

  if (!product) {
    return null;
  }

  const refreshMessage = scrapedProduct
    ? buildChangeMessage(product, scrapedProduct)
    : "Manual refresh recorded. Scraping will be added in the next phase.";
  const nextPrice = scrapedProduct?.price || product.currentPrice;
  const nextStockStatus = scrapedProduct?.stockStatus || product.stock;
  const nextTrackedSize =
    scrapedProduct?.trackedSize || product.trackedSize || "";
  const nextSizeLabel = nextTrackedSize || product.size;
  const nextStockScope = scrapedProduct?.stockScope || product.stockScope || "general";
  const nextTitle = scrapedProduct?.title || product.title;
  const nextImageUrl = scrapedProduct?.imageUrl || product.imageUrl;
  const nextCurrency = scrapedProduct?.currency || null;
  const nextSource = scrapedProduct?.rawSource || null;
  const nextBadges = scrapedProduct
    ? buildBadges(product, scrapedProduct)
    : product.badges;

  try {
    db.exec("BEGIN");

    db.prepare(`
      UPDATE tracked_products
      SET
        title = $title,
        image_url = $image_url,
        previous_price = current_price,
        current_price = $current_price,
        currency = $currency,
        tracked_size = $tracked_size,
        size_label = $size_label,
        stock_status = $stock_status,
        stock_scope = $stock_scope,
        last_checked_at = 'Checked just now',
        latest_change = $latest_change,
        badges_json = $badges_json,
        last_scrape_source = $last_scrape_source,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $id
    `).run({
      id: Number(id),
      title: nextTitle,
      image_url: nextImageUrl,
      current_price: nextPrice,
      currency: nextCurrency,
      tracked_size: nextTrackedSize,
      size_label: nextSizeLabel,
      stock_status: nextStockStatus,
      stock_scope: nextStockScope,
      latest_change: refreshMessage,
      badges_json: JSON.stringify(nextBadges),
      last_scrape_source: nextSource,
    });

    db.prepare(`
      INSERT INTO product_snapshots (
        product_id,
        price,
        stock_status,
        size_label,
        title
        , image_url
        , raw_source
        , stock_scope
      ) VALUES (
        $product_id,
        $price,
        $stock_status,
        $size_label,
        $title,
        $image_url,
        $raw_source,
        $stock_scope
      )
    `).run({
      product_id: Number(id),
      price: nextPrice,
      stock_status: nextStockStatus,
      size_label: nextSizeLabel,
      title: nextTitle,
      image_url: nextImageUrl,
      raw_source: nextSource,
      stock_scope: nextStockScope,
    });

    db.prepare(`
      INSERT INTO product_events (
        product_id,
        event_type,
        message
      ) VALUES (
        $product_id,
        'manual_refresh',
        $message
      )
    `).run({
      product_id: Number(id),
      message: refreshMessage,
    });

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return getProduct(id);
}

export function refreshAllProducts() {
  const products = getProducts();

  for (const product of products) {
    refreshProduct(product.id);
  }

  return getProducts();
}

export function getDatabaseSummary() {
  const db = getDatabase();

  return {
    products: db.prepare("SELECT COUNT(*) AS count FROM tracked_products").get()
      .count,
    snapshots: db.prepare("SELECT COUNT(*) AS count FROM product_snapshots").get()
      .count,
    events: db.prepare("SELECT COUNT(*) AS count FROM product_events").get().count,
  };
}

export function getDatabaseTables() {
  const db = getDatabase();

  return {
    products: db
      .prepare(
        `SELECT
          id,
          title,
          shop,
          url,
          current_price,
          previous_price,
          tracked_size,
          size_label,
          stock_status,
          stock_scope,
          latest_change,
          last_checked_at,
          updated_at
        FROM tracked_products
        ORDER BY updated_at DESC, id DESC`,
      )
      .all(),
    snapshots: db
      .prepare(
        `SELECT
          id,
          product_id,
          price,
          stock_status,
          size_label,
          title,
          raw_source,
          stock_scope,
          checked_at
        FROM product_snapshots
        ORDER BY checked_at DESC, id DESC
        LIMIT 50`,
      )
      .all(),
    events: db
      .prepare(
        `SELECT
          id,
          product_id,
          event_type,
          message,
          created_at,
          emailed_at
        FROM product_events
        ORDER BY created_at DESC, id DESC
        LIMIT 50`,
      )
      .all(),
    settings: db
      .prepare("SELECT key, value, updated_at FROM app_settings ORDER BY key")
      .all(),
  };
}
