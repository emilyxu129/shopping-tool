# Supabase Setup

Shopping Tool uses Supabase/Postgres as the hosted database for the deployed Vercel app. SQLite remains available for local development, while Supabase is used for persistent hosted data.

## 1. Create The Supabase Project

1. Go to [Supabase](https://supabase.com).
2. Create a new project.
3. Save the database password somewhere private.
4. Wait for the project to finish provisioning.

## 2. Create The Tables

In Supabase:

1. Open your project.
2. Go to **SQL Editor**.
3. Open this project file:

   ```text
   supabase/schema.sql
   ```

4. Copy the SQL into the Supabase SQL Editor.
5. Run it.

This creates the hosted tables used by the app:

- `tracked_products`
- `product_snapshots`
- `product_events`
- `app_settings`

If your Supabase tables already existed before the flexible tracking-specs field
was added, also run:

```text
supabase/add-variant-specs.sql
```

## 3. Add Environment Variables

In Supabase, open **Project Settings** and find your API values.

For this app, use server-side environment variables:

```bash
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

Do not put the service role key in frontend code. It is powerful and should only live in `.env.local` locally and in Vercel environment variables.

Locally, add these to `.env.local`.

In Vercel, add the same values under:

```text
Project Settings -> Environment Variables
```

## 4. Database Layer

The API routes call `lib/db.js`, which chooses Supabase when these environment variables are available:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

If those variables are missing, the app can still use the local SQLite helper for development.

## 5. Why This Matters

SQLite is a local file. It works well for local testing, but Vercel deployments should not rely on local file storage for important app data.

Supabase gives the deployed app a real hosted database, so saved products and refresh history can persist after deployments and across serverless function runs.
