"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

function getTimeLabel() {
  return new Date().toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function ProductCard({ product, onDelete, onRefresh, onUpdateTracking }) {
  const [isEditingTracking, setIsEditingTracking] = useState(false);
  const [draftSize, setDraftSize] = useState(product.trackedSize || "");
  const [draftSpecs, setDraftSpecs] = useState(product.variantSpecs || "");

  useEffect(() => {
    if (!isEditingTracking) {
      setDraftSize(product.trackedSize || "");
      setDraftSpecs(product.variantSpecs || "");
    }
  }, [isEditingTracking, product.trackedSize, product.variantSpecs]);

  function cancelTrackingEdit() {
    setDraftSize(product.trackedSize || "");
    setDraftSpecs(product.variantSpecs || "");
    setIsEditingTracking(false);
  }

  function saveTracking() {
    onUpdateTracking(product.id, draftSize, draftSpecs);
    setIsEditingTracking(false);
  }

  return (
    <article className="product-card">
      <div
        className={`product-art ${product.imageType}`}
        aria-label="Mock product image"
      >
        {product.imageUrl ? (
          <img alt="" src={product.imageUrl} />
        ) : (
          <span>{product.imageLabel}</span>
        )}
      </div>
      <div className="product-main">
        <div className="product-topline">
          <span className="shop">{product.shop}</span>
          {product.badges.map((badge) => (
            <span className={`pill ${badge.tone}`} key={badge.label}>
              {badge.label}
            </span>
          ))}
        </div>
        <h3 className="product-title">
          <a href={product.url} rel="noreferrer" target="_blank">
            {product.title}
          </a>
        </h3>
        <div className="meta-row">
          <div className="metric">
            <div className="metric-label">Current price</div>
            <div className="metric-value price-down">{product.currentPrice}</div>
          </div>
          <div className="metric">
            <div className="metric-label">Previous price</div>
            <div className="metric-value">{product.previousPrice}</div>
          </div>
          <div className="metric tracking-metric">
            <div className="metric-label">Tracking size</div>
            {isEditingTracking ? (
              <div className="inline-edit">
                <input
                  className="size-edit-input"
                  onChange={(event) => setDraftSize(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      saveTracking();
                    }

                    if (event.key === "Escape") {
                      cancelTrackingEdit();
                    }
                  }}
                  placeholder="4, S, M, 8.5"
                  type="text"
                  value={draftSize}
                />
                <button className="mini-btn" type="button" onClick={saveTracking}>
                  Save
                </button>
                <button className="mini-btn" type="button" onClick={cancelTrackingEdit}>
                  Cancel
                </button>
              </div>
            ) : (
              <div className="metric-value with-action">
                <span>{product.trackedSize || product.size || "Any size"}</span>
                <button
                  className="text-btn"
                  type="button"
                  onClick={() => setIsEditingTracking(true)}
                >
                  Edit
                </button>
              </div>
            )}
          </div>
          <div className="metric specs-metric">
            <div className="metric-label">Tracking specs</div>
            {isEditingTracking ? (
              <input
                className="specs-edit-input"
                onChange={(event) => setDraftSpecs(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    saveTracking();
                  }

                  if (event.key === "Escape") {
                    cancelTrackingEdit();
                  }
                }}
                placeholder="Color: Black"
                type="text"
                value={draftSpecs}
              />
            ) : (
              <div className="metric-value">
                {product.variantSpecs || "No extra specs"}
              </div>
            )}
          </div>
          <div className="metric">
            <div className="metric-label">Stock</div>
            <div className="metric-value">{product.stock}</div>
          </div>
        </div>
        <div className="stock-note">
          {["size-specific", "variant-specific"].includes(product.stockScope)
            ? "Stock is specific to the tracked product details."
            : "General page stock. Detail-specific stock will depend on store support."}
        </div>
        <div className="change-box">{product.change}</div>
      </div>
      <div className="product-actions">
        <button className="btn" type="button" onClick={() => onRefresh(product.id)}>
          Refresh
        </button>
        <button
          className="btn danger"
          type="button"
          onClick={() => onDelete(product.id)}
        >
          Delete
        </button>
        <div className="status-line">{product.checkedAt}</div>
      </div>
    </article>
  );
}

export default function Home() {
  const [products, setProducts] = useState([]);
  const [productUrl, setProductUrl] = useState("");
  const [trackedSize, setTrackedSize] = useState("");
  const [variantSpecs, setVariantSpecs] = useState("");
  const [lastRefresh, setLastRefresh] = useState("Not yet");
  const [serverStatus, setServerStatus] = useState("Checking");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshingAll, setIsRefreshingAll] = useState(false);
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [toast, setToast] = useState("");

  const summary = useMemo(
    () => ({
      tracked: products.length,
      priceDrops: products.filter((product) =>
        product.badges.some((badge) => badge.label === "Price drop"),
      ).length,
      stockAlerts: products.filter((product) =>
        product.badges.some((badge) =>
          ["Low stock", "Out of stock"].includes(badge.label),
        ),
      ).length,
    }),
    [products],
  );

  useEffect(() => {
    checkServer();
    loadProducts();
  }, []);

  function showToast(message) {
    setToast(message);
    window.setTimeout(() => setToast(""), 1800);
  }

  async function checkServer() {
    try {
      const response = await fetch("/api/health");
      const data = await response.json();
      setServerStatus(data.status === "ok" ? "Connected" : "Unknown");
    } catch {
      setServerStatus("Unavailable");
    }
  }

  async function loadProducts() {
    setIsLoading(true);

    try {
      const response = await fetch("/api/products");
      const data = await response.json();
      setProducts(data.products);
    } catch {
      showToast("Could not load products from the database.");
    } finally {
      setIsLoading(false);
    }
  }

  async function addProduct() {
    const trimmedUrl = productUrl.trim();

    if (!trimmedUrl) {
      showToast("Paste a product URL first.");
      return;
    }

    try {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: trimmedUrl, trackedSize, variantSpecs }),
      });
      const data = await response.json();

      if (!response.ok) {
        showToast(data.error || "Could not save product.");
        return;
      }

      setProducts((currentProducts) => [data.product, ...currentProducts]);
      setProductUrl("");
      setTrackedSize("");
      setVariantSpecs("");
      showToast("Product saved.");
    } catch {
      showToast("Could not save product.");
    }
  }

  async function refreshProduct(productId) {
    try {
      const response = await fetch(`/api/products/${productId}/refresh`, {
        method: "POST",
      });
      const data = await response.json();

      if (!response.ok) {
        showToast(data.error || "Could not refresh product.");
        return;
      }

      setProducts((currentProducts) =>
        currentProducts.map((product) =>
          product.id === productId ? data.product : product,
        ),
      );
      showToast("Refresh saved.");
    } catch {
      showToast("Could not refresh product.");
    }
  }

  async function refreshAllProducts() {
    setIsRefreshingAll(true);

    try {
      const response = await fetch("/api/products/refresh-all", {
        method: "POST",
      });
      const data = await response.json();

      if (!response.ok) {
        showToast(data.error || "Could not refresh products.");
        return;
      }

      setProducts(data.products);
      setLastRefresh(getTimeLabel());
      showToast("All refreshes saved.");
    } catch {
      showToast("Could not refresh products.");
    } finally {
      setIsRefreshingAll(false);
    }
  }

  async function deleteProduct(productId) {
    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!response.ok) {
        showToast(data.error || "Could not delete product.");
        return;
      }

      setProducts((currentProducts) =>
        currentProducts.filter((product) => product.id !== productId),
      );
      showToast("Product deleted.");
    } catch {
      showToast("Could not delete product.");
    }
  }

  async function updateTracking(productId, nextTrackedSize, nextVariantSpecs) {
    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          trackedSize: nextTrackedSize,
          variantSpecs: nextVariantSpecs,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        showToast(data.error || "Could not update tracking details.");
        return;
      }

      setProducts((currentProducts) =>
        currentProducts.map((product) =>
          product.id === productId ? data.product : product,
        ),
      );
      showToast("Tracking details updated.");
    } catch {
      showToast("Could not update tracking details.");
    }
  }

  async function sendTestEmail() {
    setIsSendingTestEmail(true);

    try {
      const response = await fetch("/api/email/test", {
        method: "POST",
      });
      const data = await response.json();

      if (!response.ok) {
        showToast(data.error || "Could not send test email.");
        return;
      }

      showToast("Test email sent.");
    } catch {
      showToast("Could not send test email.");
    } finally {
      setIsSendingTestEmail(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", {
      method: "POST",
    });
    window.location.href = "/login";
  }

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Main navigation">
        <div className="brand">
          <div className="brand-mark">ST</div>
          <div>Shopping Tool</div>
        </div>
        <nav className="nav">
          <Link className="active" href="/">
            Tracked products
          </Link>
          <Link href="/database">Database</Link>
          <a href="#">Email settings</a>
          <a href="#">Parser tests</a>
          <button type="button" onClick={logout}>
            Log out
          </button>
        </nav>
        <div className="sidebar-note">
          Product records load from the connected database.
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h1>Tracked products</h1>
            <p className="subtle">
              Paste a product link, track price and stock changes, and keep the
              latest update visible inside the dashboard.
            </p>
          </div>
          <div className="toolbar" aria-label="Product actions">
            <button
              className="btn"
              disabled={isSendingTestEmail}
              type="button"
              onClick={sendTestEmail}
            >
              {isSendingTestEmail ? "Sending" : "Send test email"}
            </button>
            <button
              className="btn primary"
              disabled={isRefreshingAll}
              type="button"
              onClick={refreshAllProducts}
            >
              {isRefreshingAll ? "Refreshing" : "Refresh all"}
            </button>
          </div>
        </header>

        <section className="add-panel" aria-label="Add a product">
          <input
            className="url-input"
            onChange={(event) => setProductUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                addProduct();
              }
            }}
            placeholder="Paste a product URL, like https://shop.example.com/product-name"
            type="url"
            value={productUrl}
          />
          <input
            className="url-input"
            onChange={(event) => setTrackedSize(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                addProduct();
              }
            }}
            placeholder="Size to track, like 8.5, M, 28, or One size"
            type="text"
            value={trackedSize}
          />
          <input
            className="url-input"
            onChange={(event) => setVariantSpecs(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                addProduct();
              }
            }}
            placeholder="Other specs, like Color: Black"
            type="text"
            value={variantSpecs}
          />
          <button className="btn primary" type="button" onClick={addProduct}>
            Track product
          </button>
        </section>

        <section className="summary-grid" aria-label="Tracking summary">
          <div className="summary">
            <div className="label">Tracked</div>
            <div className="value">{summary.tracked}</div>
          </div>
          <div className="summary">
            <div className="label">Price drops</div>
            <div className="value">{summary.priceDrops}</div>
          </div>
          <div className="summary">
            <div className="label">Stock alerts</div>
            <div className="value">{summary.stockAlerts}</div>
          </div>
          <div className="summary">
            <div className="label">Last refresh</div>
            <div className="value">{lastRefresh}</div>
          </div>
          <div className="summary">
            <div className="label">Server</div>
            <div className="value">{serverStatus}</div>
          </div>
        </section>

        <div className="list-header">
          <h2>Product list</h2>
          <div className="filter-tabs" aria-label="Product filters">
            <button className="active" type="button">
              All
            </button>
            <button type="button">Price drops</button>
            <button type="button">Stock</button>
          </div>
        </div>

        <section className="product-list" aria-label="Tracked products">
          {isLoading ? (
            <div className="empty-state">Loading products...</div>
          ) : null}

          {!isLoading && products.length === 0 ? (
            <div className="empty-state">No products tracked yet.</div>
          ) : null}

          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onDelete={deleteProduct}
              onRefresh={refreshProduct}
              onUpdateTracking={updateTracking}
            />
          ))}
        </section>
      </main>

      <div className={`toast ${toast ? "show" : ""}`} role="status">
        {toast}
      </div>
    </div>
  );
}
