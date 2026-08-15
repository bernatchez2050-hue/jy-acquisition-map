# JY Hotels Acquisition Map - User Manual

Prepared: August 15, 2026

Live app: https://jy-hotels-tracker.vercel.app

## 1. Purpose

The JY Hotels Acquisition Map is a working acquisition desk for UK hospitality property scouting. It helps users review hotel, inn, pub-with-rooms, guest house, and hospitality listings on a map, filter them by acquisition criteria, shortlist targets, and identify newly discovered listings after a refresh.

The app currently contains:

- 300 original baseline property records.
- 12 imported discovery records from the first live search refresh.
- A shared database-backed property list.
- Browser-local workflow tools for each user.

## 2. Important Concepts

### Baseline entries

The original imported dataset contains 300 properties. These are treated as the baseline list.

### New imports

Any property imported after the baseline is treated as a new import. The app uses the baseline count and each property's `sourceIndex` to distinguish the original 300 from later discoveries.

### Shared vs local data

Shared in the database:

- Properties shown on the map.
- Discovery candidates found by refresh.
- Refresh run history.
- Property price/status snapshots.

Stored only in the current browser:

- Shortlist.
- Workflow stage.
- User notes.
- Theme preference.
- Which listings have been marked as seen.

This means two people will see the same property data, but their shortlist, notes, workflow stages, and seen/unseen state are personal to their browser.

## 3. Main Screen

The app has four main areas:

- Top bar: high-level metrics and action buttons.
- Left panel: filters.
- Map: property pins and area clusters.
- Bottom list and right detail panel: property review and workflow.

## 4. Top Bar Metrics

The top bar shows:

- Shown: number of properties matching current filters.
- New imports: number of properties imported after the original 300.
- Live: number of shown properties with live status.
- Median p/rm: median price per room for the full dataset.
- Avg score: average fit score for the shown properties.

The buttons on the right are:

- Toggle filters: opens or closes the left filter panel.
- Refresh: runs the discovery search.
- Download CSV: exports the current property dataset.
- Theme: switches between light and dark mode.

## 5. Freshness Filters

The Freshness section helps users find entries added after a refresh.

Available filters:

- All: shows every property.
- New since visit: shows entries this browser has not marked as seen.
- Latest imports: shows all properties imported after the original 300.
- Latest 12: shows the 12 highest `sourceIndex` records.
- Today: shows entries added on the current local date.
- 7 days: shows entries added within the last seven days.

When a refresh imports new properties, the app automatically switches to New since visit.

Use Mark shown seen after reviewing the currently filtered list. This marks the visible properties as seen in your browser only.

## 6. Search and Filters

### Text search

Use the search box to search:

- Property name.
- Area.
- Location.
- Broker/source.
- Property type.
- Broker note.

### Thresholds

Use thresholds to narrow the list:

- Max price: hides properties above the selected maximum price.
- Min rooms: hides properties with fewer rooms than the selected value.
- Min score: hides properties below the selected fit score.

### Sort options

Available sort modes:

- Fit score: highest acquisition fit first.
- Price: lowest asking price first.
- Price per room: lowest price per room first.
- Room count: largest room count first.
- Date added: newest imported/listed entries first.

Choosing a Freshness filter automatically switches sorting to Date added.

### Status

Status filters:

- Live.
- Under offer.
- Unverified.

Newly imported properties are imported as Unverified until manually reviewed.

### Tenure

Tenure filters:

- Freehold.
- Leasehold.
- Unknown.

### Asset type

Asset type filters include:

- Hotel.
- Inn.
- Pub.
- Guest house.
- Holiday accommodation.
- Hospitality.

## 7. Map

Each pin represents a property.

Pin letter:

- A: score 80 or higher.
- B: score 65 to 79.
- C: score 50 to 64.
- D: score below 50.

Pin styling:

- Solid pin: live or active-looking listing.
- Orange ring: under offer.
- Muted/dashed styling: unconfirmed/unverified.

Click a pin to open the property details in the right panel.

## 8. Property List

The bottom list shows all properties matching the active filters.

Each row shows:

- Property name.
- New/import badge where relevant.
- Added date where available.
- Area.
- Rooms.
- Price.
- Fit score.
- Status.
- Workflow stage.
- Shortlist star.

Click a row to focus the map and open the property details.

## 9. Detail Panel

The right detail panel shows:

- Property area and name.
- New import and added-date badges.
- Listing button.
- Price.
- Rooms.
- Fit score.
- Confidence.
- Property type.
- Kind.
- Tenure.
- Price per room.
- Source.
- Last seen date.
- Added date.
- Broker note.
- Workflow controls.
- User notes.

## 10. Listing Button

The Listing button opens the source URL found for the property.

Known limitation: discovery results may currently point to a broker search/category page instead of an exact property detail page. Those records are still useful leads, but they should be reviewed before being treated as confirmed acquisition targets.

This scraping quality issue is logged for later tuning.

## 11. Workflow Stages

Workflow stages are browser-local and help a user organize their own diligence.

Stages:

- New.
- Reviewing.
- Broker contacted.
- NDA.
- Financials.
- Offer candidate.
- Rejected.

Changing a workflow stage affects only the current browser.

## 12. Shortlist and Compare

Click the star on a property row or in the detail panel to shortlist a property.

Shortlisted properties appear in the compare strip at the bottom. This lets a user quickly compare selected targets.

The shortlist is stored in the current browser only.

## 13. Notes

Use the Notes box in the detail panel for diligence notes, broker call outcomes, next actions, or internal observations.

Notes are stored in the current browser only.

## 14. Refreshing the Search

Click Refresh in the top bar to search for new hotel/property leads.

What happens:

1. The app calls the refresh API.
2. The backend searches the configured search provider.
3. Search results are converted into discovery candidates.
4. Candidates are stored in the database.
5. New candidates are imported into the map as unverified properties.
6. The app reloads the property list.
7. If new properties were imported, the Freshness filter switches to New since visit.

The refresh is capped for browser users so it does not run too long.

## 15. Exporting Data

Click the download button in the top bar to export the property data as CSV.

The CSV can be opened in Excel and includes the current property dataset stored by the app.

## 16. Scoring Explained

The Fit score is a 1 to 100 ranking that estimates acquisition fit. It is not a valuation and should not replace human review.

Higher score means the listing looks more aligned with the target acquisition profile.

The score favors:

- Freehold tenure.
- 6 to 22 rooms.
- Price between GBP 250,000 and GBP 1,250,000.
- Lower price per room.
- Priority regions.
- Notes mentioning financial information such as turnover, profit, EBITDA, or net profit.

The score penalizes:

- Under-offer or unconfirmed status.
- Leasehold tenure.
- Very small properties.
- Very expensive properties.
- Missing price.
- High price per room.
- Notes suggesting required works, closure, upgrading, vacancy, or development potential.

Score bands in the UI:

- 75 to 100: strong.
- 58 to 74: watch/review.
- Below 58: low fit or incomplete data.

## 17. Confidence Explained

Confidence is also shown as a percentage. It estimates how complete and reliable the extracted record looks.

Confidence improves when the app has:

- Price.
- Room count.
- Source URL.
- Recognized source.
- Usable coordinates.
- Known broker/source patterns.

Confidence drops when:

- Price is missing.
- Room count is missing.
- URL is missing.
- The note suggests sold, under offer, or let agreed.
- The listing was imported from broad search results and remains unverified.

## 18. Practical Review Process

Recommended user workflow:

1. Open the app.
2. Use Freshness > New since visit or Latest imports.
3. Review each new import.
4. Open Listing to inspect the source.
5. Use workflow stage Reviewing for promising leads.
6. Add notes.
7. Shortlist serious targets.
8. Mark shown seen after reviewing the batch.
9. Use Export CSV if needed.

## 19. Known Limitations

- New discovery links may point to broad broker/search pages rather than exact listing pages.
- Newly discovered listings are marked Unverified until reviewed.
- Workflow stages, notes, shortlist, and seen state are browser-local.
- The score is heuristic, not financial advice or formal valuation.
- The app does not currently validate whether a listing is still live beyond the source/search result text.

## 20. Troubleshooting

### The map shows too many properties

Use Freshness, area, status, price, rooms, and score filters.

### I cannot see the latest entries

Use Freshness > Latest imports or Freshness > Latest 12.

### I reviewed the latest entries and want them out of New since visit

Click Mark shown seen while the relevant entries are visible.

### Listing opens a general broker page

This is expected for some discovered records. Treat those as leads needing manual verification.

### Refresh says no new imports

This usually means the search found candidates already stored in the database, or no matching candidates were found during that run.

