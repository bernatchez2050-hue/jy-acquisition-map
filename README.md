# JY Hotels Acquisition Map

Vercel-ready acquisition desk for UK hospitality property scouting. It rebuilds the original static map as a Next.js app with API routes, richer filters, shortlist workflow state, CSV export, and optional Postgres storage.

## Documentation

- [User manual](docs/user-manual.md)
- [Technical manual](docs/technical-manual.md)

## What is included

- Next.js app with Leaflet/CARTO map rendering.
- Seed data extracted from the original `twystukaugust.pplx.app` snapshot.
- Filters for area, status, tenure, source, rooms, price, score, and free text.
- Local shortlist, workflow stage, notes, and compare table.
- API routes for properties, CSV export, and refresh triggering.
- Optional Postgres backend via `DATABASE_URL` and `USE_DATABASE=true`.
- Search-backed discovery scraper for new hotel/guesthouse/inn/pub listings.
- Discovery candidate table, refresh log, and protected seed/migration routes.
- Vercel Cron config for `/api/refresh`.

## Run locally

```bash
pnpm install
pnpm generate:seed
pnpm dev
```

`pnpm generate:seed` expects the original inspected HTML at `work/twystukaugust.html`. The repository already includes the generated seed JSON, so this step is only needed when rebuilding the seed from a new captured source file.

## Database mode

Create the schema in Postgres:

```bash
psql "$DATABASE_URL" -f database/schema.sql
pnpm import:seed
```

Then set these Vercel environment variables:

```bash
DATABASE_URL=...
USE_DATABASE=true
REFRESH_WEBHOOK_SECRET=...
CRON_SECRET=...
SERPAPI_API_KEY=...
# or BRAVE_SEARCH_API_KEY=...
# or BING_SEARCH_API_KEY=...
AUTO_IMPORT_DISCOVERED=true
```

Without those variables, the app serves the bundled seed JSON and still deploys normally.

## Refresh pipeline

The Refresh button and Vercel Cron call:

```text
POST /api/refresh
```

The route searches the web through the configured provider, fetches candidate pages when possible, extracts property details, stores candidates, logs the run, and imports new candidates into the map as `unconfirmed`.

Protected setup routes:

```bash
curl -X POST "$APP_URL/api/admin/migrate" -H "Authorization: Bearer $REFRESH_WEBHOOK_SECRET"
curl -X POST "$APP_URL/api/admin/seed" -H "Authorization: Bearer $REFRESH_WEBHOOK_SECRET"
```

Browser admin login:

```text
GET /login
GET /admin
```

The login page asks for the admin password used for protected admin functions. It is kept in browser session storage for the current tab and sent as a bearer token to the admin API routes.

Inspection routes:

```text
GET /api/discoveries
GET /api/refresh-runs
```

The scraper is search-provider based. Broker sites often block raw scraping and may have terms that limit automated collection, so new records are imported as unverified until reviewed.
