#!/usr/bin/env node
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const dbPath = path.join(process.cwd(), "data", "shopping-tool.sqlite");
const db = new DatabaseSync(dbPath);

const editableColumns = new Map([
  ["title", "title"],
  ["price", "current_price"],
  ["previousPrice", "previous_price"],
  ["stock", "stock_status"],
  ["size", "size_label"],
  ["trackedSize", "tracked_size"],
]);

function printUsage() {
  console.log(`
Usage:
  node scripts/edit-product.js list
  node scripts/edit-product.js update <product-id> <field> <value>

Fields:
  title, price, previousPrice, stock, size, trackedSize

Examples:
  node scripts/edit-product.js list
  node scripts/edit-product.js update 11 price '$1'
  node scripts/edit-product.js update 11 stock 'Out of stock'
`);
}

function listProducts() {
  const products = db
    .prepare(
      `SELECT
        id,
        title,
        current_price,
        stock_status,
        tracked_size,
        url
      FROM tracked_products
      ORDER BY id DESC`,
    )
    .all();

  console.table(
    products.map((product) => ({
      id: product.id,
      title: product.title,
      price: product.current_price,
      stock: product.stock_status,
      trackedSize: product.tracked_size,
      url: product.url,
    })),
  );
}

function updateProduct([id, field, ...valueParts]) {
  const column = editableColumns.get(field);
  const value = valueParts.join(" ").trim();

  if (!id || !column || !value) {
    printUsage();
    process.exit(1);
  }

  const result = db
    .prepare(
      `UPDATE tracked_products
       SET ${column} = $value,
           latest_change = $latest_change,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $id`,
    )
    .run({
      id: Number(id),
      value,
      latest_change: `Manual database edit: ${field} set to ${value}.`,
    });

  if (result.changes === 0) {
    console.error(`No product found with id ${id}.`);
    process.exit(1);
  }

  console.log(`Updated product ${id}: ${field} = ${value}`);
}

const [command, ...args] = process.argv.slice(2);

if (command === "list") {
  listProducts();
} else if (command === "update") {
  updateProduct(args);
} else {
  printUsage();
  process.exit(command ? 1 : 0);
}
