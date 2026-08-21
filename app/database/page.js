import Link from "next/link";
import { getDatabaseSummary, getDatabaseTables } from "../../lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function DatabaseTable({ title, rows }) {
  const columns = rows[0] ? Object.keys(rows[0]) : [];

  return (
    <section className="database-section">
      <div className="database-section-header">
        <h2>{title}</h2>
        <span>{rows.length} rows shown</span>
      </div>

      {rows.length === 0 ? (
        <div className="empty-state">No rows yet.</div>
      ) : (
        <div className="table-wrap">
          <table className="database-table">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${title}-${index}`}>
                  {columns.map((column) => (
                    <td key={column}>{row[column] ?? ""}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default async function DatabasePage() {
  const summary = await getDatabaseSummary();
  const tables = await getDatabaseTables();

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Main navigation">
        <div className="brand">
          <div className="brand-mark">ST</div>
          <div>Shopping Tool</div>
        </div>
        <nav className="nav">
          <Link href="/">Tracked products</Link>
          <Link className="active" href="/database">
            Database
          </Link>
          <a href="#">Email settings</a>
          <a href="#">Parser tests</a>
        </nav>
        <div className="sidebar-note">
          Read-only database view for inspecting saved product records.
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h1>Database</h1>
            <p className="subtle">
              A read-only view of products, snapshots, events, and settings
              saved by the app.
            </p>
          </div>
          <div className="toolbar">
            <Link className="btn primary" href="/">
              Back to products
            </Link>
          </div>
        </header>

        <section className="summary-grid" aria-label="Database summary">
          <div className="summary">
            <div className="label">Products</div>
            <div className="value">{summary.products}</div>
          </div>
          <div className="summary">
            <div className="label">Snapshots</div>
            <div className="value">{summary.snapshots}</div>
          </div>
          <div className="summary">
            <div className="label">Events</div>
            <div className="value">{summary.events}</div>
          </div>
        </section>

        <div className="database-stack">
          <DatabaseTable title="tracked_products" rows={tables.products} />
          <DatabaseTable title="product_snapshots" rows={tables.snapshots} />
          <DatabaseTable title="product_events" rows={tables.events} />
          <DatabaseTable title="app_settings" rows={tables.settings} />
        </div>
      </main>
    </div>
  );
}
