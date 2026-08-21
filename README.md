# Shopping Tool

Shopping Tool is a private product-tracking web app for monitoring price and stock changes across online stores. A user can paste a product URL, optionally choose tracking details such as size or color, and save the item to a personal dashboard. The app scrapes product details, stores refresh history, shows changes inline, and sends email alerts when meaningful product changes are detected.

Shopping Tool is implemented as a full-stack Next.js application with server-side scraping, database persistence, email notifications, and app-level password protection.

## Features

- Track products by pasting a product URL into the dashboard.
- Store product title, image, shop, current price, previous price, tracked size, extra tracking specs, stock status, and latest change message.
- Refresh one product or refresh all tracked products at once.
- Detect product changes by comparing newly scraped data against the last saved state.
- Send email alerts through Resend when price or stock changes are detected.
- Support variant-aware tracking for stores that expose size, color, or other structured product details.
- View database tables through a read-only database page.
- Protect the deployed app with a private app password.

## How It Works

When a product URL is added, the frontend sends it to a backend API route. The backend saves the product, fetches the product page, extracts product metadata, stores a snapshot in the database, and returns the saved product to the UI.

On refresh, the app scrapes the product page again and compares the new result with the saved product state. If the price or stock status changed, the app updates the dashboard, records a product event, and sends an email alert.

```text
Product URL
-> Next.js API route
-> scraper
-> database
-> product dashboard
-> optional Resend email alert
```

## Tech Stack

- **Next.js** for the full-stack web application
- **React** for the interactive dashboard UI
- **Supabase/Postgres** for hosted database persistence
- **SQLite** for local development
- **Resend** for transactional email alerts
- **Vercel** for deployment
- **GitHub** for source control

## Scraping Approach

The scraper prioritizes structured product metadata when available, including JSON-LD and store-specific product data. This makes the scraper more reliable than trying to visually parse page text.

Current parsing support includes:

- General product metadata from common product pages
- Brand 1 size parameters and structured product data
- Brand 2 structured product and stock API data
- Brand 3 `ProductGroup` variant data for size- and color-specific stock

Because ecommerce sites structure product pages differently, the scraper is designed so store-specific parsers can be added as needed.

## Email Alerts

The app uses Resend to send notification emails. Email alerts are sent only when the app detects a meaningful change, such as a price or stock-status update. First-time scrape values like `Unknown` becoming a real price are intentionally filtered out to avoid noisy setup emails.

Required environment variables:

```bash
RESEND_API_KEY=
ALERT_EMAIL_TO=
ALERT_EMAIL_FROM=
APP_PASSWORD=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
BRAND_ONE_HOSTS=
BRAND_TWO_HOSTS=
BRAND_TWO_CLIENT_ID=
BRAND_TWO_CLIENT_VERSION=
```

## Local Development

Install dependencies and run the local development server:

```bash
pnpm install
pnpm run dev
```

Build the app:

```bash
pnpm run build
```

When Supabase environment variables are not configured, the local SQLite database is created automatically at:

```text
data/shopping-tool.sqlite
```

That database file is ignored by Git so local product data is not uploaded to GitHub.

## Project Structure

```text
app/
  api/                  Backend API routes
  database/             Read-only database viewer
  login/                Password login page
  page.js               Main product dashboard
lib/
  db.js                 Database adapter used by the API routes
  scraper.js            Product scraping and parsing logic
  email.js              Resend email sender
  notifications.js      Product-change email logic
scripts/
  edit-product.js       Local utility for testing product-change detection
```

## Privacy And Security

This is designed as a private personal app. The deployed app is protected by an app password, and secret values are stored in environment variables rather than committed to the repository.

The repository intentionally excludes:

- `.env.local`
- local SQLite database files
- dependency folders
- build output
- logs

The Supabase schema and setup notes live in:

```text
supabase/schema.sql
docs/supabase-setup.md
```

## Screenshot

To be uploaded
