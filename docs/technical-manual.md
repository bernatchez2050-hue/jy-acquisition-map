# JY Hotels Acquisition Map - Technical Manual

Prepared: August 15, 2026

Production URL: https://jy-hotels-tracker.vercel.app

Repository: https://github.com/bernatchez2050-hue/jy-acquisition-map

## 1. System Overview

The JY Hotels Acquisition Map is a Next.js App Router application deployed on Vercel. It combines a Leaflet map frontend with server-side API routes for property data, CSV export, discovery refresh, admin setup, and technical inspection.

At the time this manual was prepared:

- Baseline properties: 300.
- Current production properties: 312.
- Imported discovery properties: 12.
- Hosting: Vercel.
- Database: Vercel-managed Neon/Postgres.
- Search provider: SerpApi.

## 2. Application Structure

Key files:

- `src/components/AcquisitionDesk.tsx`: main client UI, map, filters, workflow, shortlist, refresh button.
- `src/lib/store.ts`: loads data from Postgres when database mode is enabled; falls back to bundled seed data.
- `src/lib/discovery.ts`: search provider integration, candidate extraction, discovery scoring, refresh logging, candidate import.
- `src/lib/seed-database.ts`: seeds the baseline property table.
- `src/lib/schema-sql.ts`: SQL schema used by the admin migration route.
- `database/schema.sql`: database schema reference.
- `src/app/api/properties/route.ts`: property data API.
- `src/app/api/export/route.ts`: CSV export API.
- `src/app/api/refresh/route.ts`: refresh/discovery API.
- `src/app/api/admin/migrate/route.ts`: protected schema setup API.
- `src/app/api/admin/seed/route.ts`: protected seed setup API.
- `src/app/api/discoveries/route.ts`: discovery candidate inspection API.
- `src/app/api/refresh-runs/route.ts`: refresh run inspection API.
- `vercel.json`: Vercel cron schedule.

## 3. Runtime Architecture

Frontend:

- React client component.
- Leaflet map.
- CARTO tile layers.
- Browser-local state through `localStorage`.

Backend:

- Next.js route handlers.
- Node.js runtime on Vercel.
- Postgres connection through `pg`.
- Search provider calls through SerpApi, Brave, or Bing depending on configured environment variables.

Database mode:

- Enabled when `USE_DATABASE=true` and `DATABASE_URL` or `DATABASE_POSTGRES_URL` is present.
- If database mode is disabled, the app serves bundled seed data from `src/data/seed.json`.

## 4. Data Storage

Database tables:

- `properties`: map-visible properties.
- `property_snapshots`: price/status observations created during discovery imports.
- `refresh_runs`: refresh execution log.
- `discovery_candidates`: candidates returned by search/discovery before or during promotion to map properties.

Browser-local state:

- `jy-shortlist`: user's shortlist.
- `jy-workflow`: user's workflow stage selections.
- `jy-notes`: user's notes.
- `jy-theme`: theme preference.
- `jy-seen-property-ids`: listings this browser has marked as seen.

Important: shortlist, workflow, notes, theme, and seen state are not shared across users.

## 5. Environment Variables

Required for database mode:

```text
DATABASE_URL=postgres://...
USE_DATABASE=true
```

Required for protected admin functions:

```text
REFRESH_WEBHOOK_SECRET=long-random-secret
CRON_SECRET=long-random-secret
```

Search providers, at least one:

```text
SERPAPI_API_KEY=...
BRAVE_SEARCH_API_KEY=...
BING_SEARCH_API_KEY=...
```

Discovery behavior:

```text
AUTO_IMPORT_DISCOVERED=true
DISCOVERY_RESULTS_PER_QUERY=8
DISCOVERY_MAX_QUERIES=12
DISCOVERY_SEARCH_TIMEOUT_MS=10000
DISCOVERY_PAGE_FETCH_TIMEOUT_MS=2500
DISCOVERY_TIME_BUDGET_MS=45000
DISCOVERY_FETCH_PAGES=false
SCRAPER_QUERIES_JSON=
```

Public browser refresh caps:

```text
PUBLIC_REFRESH_ENABLED=true
PUBLIC_DISCOVERY_MAX_QUERIES=3
PUBLIC_DISCOVERY_RESULTS_PER_QUERY=4
```

Security note: do not expose secret variables with `NEXT_PUBLIC_`.

## 6. API Routes

### `GET /api/properties`

Returns the acquisition data used by the map:

- metadata.
- areas.
- clusters.
- properties.
- summary.

Response headers include `Cache-Control: no-store`.

### `GET /api/export`

Exports property data as CSV for Excel or spreadsheet use.

### `POST /api/refresh`

Runs discovery search and optional import.

Browser/public refresh:

- Allowed when `PUBLIC_REFRESH_ENABLED=true` or no secret is configured.
- Capped to a small number of queries/results.
- Page fetching is disabled for public refresh.

Private refresh:

- Uses `Authorization: Bearer <REFRESH_WEBHOOK_SECRET>` or `x-refresh-secret`.
- Supports higher internal caps.
- Can use `deep=true` to fetch page HTML when enabled.

Useful query parameters:

```text
import=false
deep=true
maxQueries=3
resultsPerQuery=4
timeBudgetMs=25000
```

### `GET /api/discoveries`

Returns saved discovery candidates. This is a technical inspection endpoint, not normal user testing.

Optional:

```text
?limit=100
```

### `GET /api/refresh-runs`

Returns recent refresh execution logs. This is a technical inspection endpoint.

Optional:

```text
?limit=25
```

### `POST /api/admin/migrate`

Protected admin function. Creates the database schema from `src/lib/schema-sql.ts`.

Requires:

```text
Authorization: Bearer <REFRESH_WEBHOOK_SECRET>
```

Expected success:

```json
{ "ok": true, "message": "Database schema is ready." }
```

### `POST /api/admin/seed`

Protected admin function. Loads the 300 baseline seed records into the `properties` table.

Requires:

```text
Authorization: Bearer <REFRESH_WEBHOOK_SECRET>
```

Expected success:

```json
{ "ok": true, "imported": 300, "message": "Seeded 300 properties." }
```

## 7. Admin Runbook

### Initial database setup

1. Create/connect a Postgres database in Vercel.
2. Ensure Vercel has `DATABASE_URL`.
3. Set `USE_DATABASE=true`.
4. Set `REFRESH_WEBHOOK_SECRET` and `CRON_SECRET`.
5. Deploy production.
6. Run:

```bash
curl -X POST "$APP_URL/api/admin/migrate" \
  -H "Authorization: Bearer $REFRESH_WEBHOOK_SECRET"

curl -X POST "$APP_URL/api/admin/seed" \
  -H "Authorization: Bearer $REFRESH_WEBHOOK_SECRET"
```

7. Confirm:

```text
GET /api/properties
```

The response should include 300 or more properties.

### Manual refresh

Public/browser:

```text
Click Refresh in the app
```

Private/admin:

```bash
curl -X POST "$APP_URL/api/refresh?maxQueries=12&resultsPerQuery=8" \
  -H "Authorization: Bearer $REFRESH_WEBHOOK_SECRET"
```

Dry-run/no import:

```bash
curl -X POST "$APP_URL/api/refresh?import=false" \
  -H "Authorization: Bearer $REFRESH_WEBHOOK_SECRET"
```

### Verify refresh

```text
GET /api/refresh-runs
GET /api/discoveries
GET /api/properties
```

## 8. Vercel Cron

`vercel.json` configures:

```json
{
  "crons": [
    {
      "path": "/api/refresh",
      "schedule": "0 6 * * *"
    }
  ]
}
```

This schedules `/api/refresh` daily at 06:00 UTC.

The refresh route allows Vercel cron requests when `CRON_SECRET` is configured and the request is authenticated.

## 9. Discovery Pipeline

Discovery runs through these steps:

1. Choose provider: SerpApi, Brave, or Bing.
2. Build query list from default priority areas or `SCRAPER_QUERIES_JSON`.
3. Search web results.
4. Optionally fetch page HTML for deeper extraction.
5. Reject results that do not look like hospitality property listings.
6. Infer area from text and query area.
7. Parse kind, tenure, rooms, price, and price per room.
8. Assign approximate coordinates near the area's baseline centroid with deterministic jitter.
9. Score and confidence-rank the candidate.
10. Deduplicate by canonical URL.
11. Store candidates in `discovery_candidates`.
12. Import new candidates into `properties` if `AUTO_IMPORT_DISCOVERED` is not false.
13. Insert a property snapshot.
14. Log the run in `refresh_runs`.

## 10. Known Discovery Limitation

Current discovery is search-provider based. Search engines sometimes return broad broker/category pages rather than exact listing detail pages.

Example: a listing may point to a Daltonsbusiness or OnTheMarket search results page containing many listings. These are valid leads but not confirmed exact property URLs.

Future tuning should:

- Prefer exact detail-page URL patterns.
- Penalize or reject broad search/category pages.
- Parse listing cards from category pages.
- Add source-quality flags.
- Keep broad matches as candidates rather than auto-promoting them.

## 11. Scoring Model

There are two related scoring formulas:

- Original seed score for the first 300 records.
- Discovery candidate score for new imports.

Both are heuristic acquisition-fit scores from 1 to 100.

### Seed property score

Seed score starts at 46.

Status:

- Live: +8.
- Under offer: -9.
- Unconfirmed: -16.

Tenure:

- Freehold: +11.
- Leasehold: -4.

Rooms:

- 6 to 22 rooms: +12.
- 23 to 35 rooms: +6.
- Fewer than 4 rooms: -5.

Price:

- GBP 250,000 to GBP 1,250,000: +11.
- Greater than GBP 2,000,000: -9.
- Missing price: -5.

Price per room:

- GBP 80,000 or less: +10.
- GBP 80,001 to GBP 120,000: +5.
- Greater than GBP 180,000: -8.

Priority areas:

- Area IDs 4, 6, 7, 13, 14, 15: +5.

Broker note:

- Contains turnover, profit, EBITDA, or net profit: +4.
- Contains requires, closed, upgrading, vacant, or development potential: -3.

Final score is rounded and clamped between 1 and 100.

### Discovery candidate score

Discovery score starts at 42.

Status:

- Live: +6.

Tenure:

- Freehold: +11.
- Leasehold: -4.

Rooms:

- 6 to 22 rooms: +12.
- 23 to 35 rooms: +6.
- Fewer than 4 rooms: -5.

Price:

- GBP 250,000 to GBP 1,250,000: +11.
- Greater than GBP 2,000,000: -9.
- Missing price: -7.

Price per room:

- GBP 80,000 or less: +10.
- GBP 80,001 to GBP 120,000: +5.
- Greater than GBP 180,000: -8.

Priority areas:

- Area IDs 4, 6, 7, 13, 14, 15: +5.

Broker note:

- Contains turnover, profit, EBITDA, or net profit: +4.
- Contains requires, closed, upgrading, vacant, or development potential: -3.

Final score is rounded and clamped between 1 and 100.

### UI score bands

- 75 to 100: strong.
- 58 to 74: watch/review.
- Below 58: low or incomplete fit.

Map pin letters:

- A: score 80 or higher.
- B: score 65 to 79.
- C: score 50 to 64.
- D: below 50.

## 12. Confidence Model

Confidence estimates record completeness and reliability. It is not the same as fit score.

### Seed confidence

Seed confidence starts at 72.

- Live: +8.
- Unconfirmed: -26.
- Missing price: -11.
- Missing rooms: -7.
- Missing URL: -14.

Final confidence is clamped between 1 and 100.

### Discovery confidence

Discovery confidence starts at 58.

- Price parsed: +11.
- Rooms parsed: +8.
- URL present: +9.
- Source recognized: +4.
- Coordinates are finite: +5.
- Source includes trusted broker/source pattern: +5.
- Note suggests under offer, sold, or let agreed: -10.

Final confidence is clamped between 1 and 100.

## 13. Freshness Logic

The app exposes freshness filters in the UI.

Baseline count:

- `metadata.baselinePropertyCount`, currently 300.

Imported property:

- `sourceIndex > baselinePropertyCount`, or id starts with `disc-`.

Added date:

- For baseline records, `addedAt` is the original seed refresh date.
- For imported records, `addedAt` is the database `inserted_at` timestamp.

Seen/unseen:

- Stored in browser `localStorage` under `jy-seen-property-ids`.
- Mark shown seen only affects the current browser.

## 14. Deployment

Common commands:

```bash
npm run build
vercel deploy --prod --yes --scope claude-bernatchezs-projects --project jy-hotels-tracker
```

In this environment the Vercel CLI was run through the local pinned package path. In a normal developer setup, using the installed Vercel CLI is sufficient.

After deployment, verify:

```text
GET https://jy-hotels-tracker.vercel.app/
GET https://jy-hotels-tracker.vercel.app/api/properties
GET https://jy-hotels-tracker.vercel.app/api/discoveries
```

## 15. Technical Verification vs UAT

The following are technical checks, not user acceptance tests:

- `/api/discoveries` returns candidates.
- `/api/refresh-runs` returns refresh history.
- Admin migrate returns schema-ready.
- Admin seed imports baseline records.
- Vercel logs are clean.

True user testing should focus on:

- User can find latest imports.
- User can filter and review properties.
- User understands score/confidence.
- User can shortlist, stage, and add notes.
- User can export CSV.

## 16. Troubleshooting

### `/api/properties` returns 500

Likely causes:

- Database schema not created.
- `USE_DATABASE=true` but database connection string is invalid.
- Database credentials changed.

Fix:

- Check Vercel environment variables.
- Run `/api/admin/migrate`.
- Check Vercel logs.

### Refresh returns 401

Likely causes:

- `PUBLIC_REFRESH_ENABLED` is not true.
- Missing or incorrect bearer secret for private refresh.

Fix:

- Use the browser Refresh button if public refresh is enabled.
- For admin refresh, pass `Authorization: Bearer <REFRESH_WEBHOOK_SECRET>`.

### Refresh returns zero imports

Likely causes:

- Candidates already exist.
- Search provider found no matching candidates.
- Results are too broad or not hospitality sale listings.

Check:

- `/api/refresh-runs`
- `/api/discoveries`

### Listings point to broad pages

This is a known discovery quality limitation. Keep imported records as unverified and tune the scraping/detail-page rules later.

### Vercel timeout

The refresh route has time budgets and query caps to avoid long serverless executions.

Reduce:

- `DISCOVERY_MAX_QUERIES`
- `DISCOVERY_RESULTS_PER_QUERY`
- `DISCOVERY_TIME_BUDGET_MS`

Avoid enabling deep page fetch for public refresh.

## 17. Safe Admin Practices

- Keep secrets in Vercel environment variables only.
- Do not paste API keys into browser URLs.
- Do not expose secrets with `NEXT_PUBLIC_`.
- Treat `/api/admin/migrate` and `/api/admin/seed` as setup/admin-only functions.
- Review discovery quality before relying on imported candidates.
- Keep a record of deployment IDs after production changes.

