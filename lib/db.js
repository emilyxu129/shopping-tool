function hasSupabaseConfig() {
  return Boolean(
    process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

async function database() {
  if (hasSupabaseConfig()) {
    return import("./db-supabase");
  }

  return import("./db-sqlite");
}

export async function getProducts() {
  return (await database()).getProducts();
}

export async function createProduct(url, trackedSize = "", variantSpecs = "") {
  return (await database()).createProduct(url, trackedSize, variantSpecs);
}

export async function getProduct(id) {
  return (await database()).getProduct(id);
}

export async function deleteProduct(id) {
  return (await database()).deleteProduct(id);
}

export async function updateProductTrackedSize(id, trackedSize, variantSpecs) {
  return (await database()).updateProductTrackedSize(id, trackedSize, variantSpecs);
}

export async function markLatestProductEventEmailed(productId) {
  return (await database()).markLatestProductEventEmailed(productId);
}

export async function refreshProduct(id) {
  return (await database()).refreshProduct(id);
}

export async function scrapeAndRefreshProduct(id, scrapedProduct) {
  return (await database()).scrapeAndRefreshProduct(id, scrapedProduct);
}

export async function refreshAllProducts() {
  return (await database()).refreshAllProducts();
}

export async function getDatabaseSummary() {
  return (await database()).getDatabaseSummary();
}

export async function getDatabaseTables() {
  return (await database()).getDatabaseTables();
}

export function getDatabaseMode() {
  return hasSupabaseConfig() ? "supabase" : "sqlite";
}
