#!/usr/bin/env node
const { existsSync, readFileSync } = require("node:fs");
const { DatabaseSync } = require("node:sqlite");

function loadLocalEnv() {
  if (!existsSync(".env.local")) {
    return;
  }

  const lines = readFileSync(".env.local", "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const [key, ...valueParts] = trimmed.split("=");

    if (!process.env[key]) {
      process.env[key] = valueParts.join("=");
    }
  }
}

loadLocalEnv();

const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local.");
  process.exit(1);
}

const db = new DatabaseSync("data/shopping-tool.sqlite");

async function supabaseRequest(table, { method = "GET", query = "", body, prefer } = {}) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}${query ? `?${query}` : ""}`, {
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
    throw new Error(data?.message || `Supabase request failed: ${response.status}`);
  }

  return data;
}

function parseBadges(value) {
  try {
    return JSON.parse(value || "[]");
  } catch {
    return [];
  }
}

function productPayload(row) {
  return {
    url: row.url,
    shop: row.shop,
    title: row.title,
    image_type: row.image_type,
    image_label: row.image_label,
    image_url: row.image_url,
    current_price: row.current_price,
    previous_price: row.previous_price,
    currency: row.currency,
    tracked_size: row.tracked_size,
    size_label: row.size_label,
    stock_status: row.stock_status,
    stock_scope: row.stock_scope,
    latest_change: row.latest_change,
    badges_json: parseBadges(row.badges_json),
    last_checked_at: row.last_checked_at,
    last_scrape_source: row.last_scrape_source,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function migrate() {
  const products = db.prepare("SELECT * FROM tracked_products ORDER BY id").all();
  const snapshots = db.prepare("SELECT * FROM product_snapshots ORDER BY id").all();
  const events = db.prepare("SELECT * FROM product_events ORDER BY id").all();
  const settings = db.prepare("SELECT * FROM app_settings ORDER BY key").all();
  const productIdMap = new Map();

  for (const product of products) {
    const rows = await supabaseRequest("tracked_products", {
      method: "POST",
      query: "on_conflict=url",
      prefer: "resolution=merge-duplicates,return=representation",
      body: productPayload(product),
    });
    productIdMap.set(product.id, rows[0].id);
  }

  for (const snapshot of snapshots) {
    const productId = productIdMap.get(snapshot.product_id);

    if (!productId) {
      continue;
    }

    await supabaseRequest("product_snapshots", {
      method: "POST",
      body: {
        product_id: productId,
        price: snapshot.price,
        stock_status: snapshot.stock_status,
        size_label: snapshot.size_label,
        title: snapshot.title,
        image_url: snapshot.image_url,
        raw_source: snapshot.raw_source,
        stock_scope: snapshot.stock_scope,
        checked_at: snapshot.checked_at,
      },
    });
  }

  for (const event of events) {
    const productId = productIdMap.get(event.product_id);

    if (!productId) {
      continue;
    }

    await supabaseRequest("product_events", {
      method: "POST",
      body: {
        product_id: productId,
        event_type: event.event_type,
        message: event.message,
        created_at: event.created_at,
        emailed_at: event.emailed_at,
      },
    });
  }

  for (const setting of settings) {
    await supabaseRequest("app_settings", {
      method: "POST",
      query: "on_conflict=key",
      prefer: "resolution=merge-duplicates",
      body: {
        key: setting.key,
        value: setting.value,
        updated_at: setting.updated_at,
      },
    });
  }

  console.log(`Migrated ${products.length} products.`);
  console.log(`Migrated ${snapshots.length} snapshots.`);
  console.log(`Migrated ${events.length} events.`);
  console.log(`Migrated ${settings.length} settings.`);
}

migrate().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
