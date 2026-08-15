import crypto from "node:crypto";
import { databaseEnabled, getPool, getSeedAreas, getSeedClusters, getSeedProperties } from "./store";
import type { Area, DiscoveryCandidate, ListingStatus, PropertyKind, PropertyRecord, Tenure } from "./types";

type SearchQuery = {
  areaId: number;
  query: string;
};

type SearchResult = {
  title: string;
  url: string;
  snippet: string;
  provider: string;
  query: string;
  areaId: number;
};

type DiscoveryRunOptions = {
  importDiscovered?: boolean;
  includePageFetch?: boolean;
  maxQueries?: number;
  resultsPerQuery?: number;
  timeBudgetMs?: number;
};

type DiscoveryRunResult = {
  configured: boolean;
  provider: string;
  queriesRun: number;
  candidates: DiscoveryCandidate[];
  candidatesNew: number;
  propertiesImported: number;
  stoppedEarly: boolean;
  warnings: string[];
  message: string;
};

const USER_AGENT =
  "JYHotelsAcquisitionBot/1.0 (+https://vercel.app; property acquisition research; contact owner)";

const RESULT_LIMIT = Number(process.env.DISCOVERY_RESULTS_PER_QUERY ?? 8);
const QUERY_LIMIT = Number(process.env.DISCOVERY_MAX_QUERIES ?? 12);
const SEARCH_TIMEOUT_MS = Number(process.env.DISCOVERY_SEARCH_TIMEOUT_MS ?? 10_000);
const PAGE_FETCH_TIMEOUT_MS = Number(process.env.DISCOVERY_PAGE_FETCH_TIMEOUT_MS ?? 2_500);
const DEFAULT_TIME_BUDGET_MS = Number(process.env.DISCOVERY_TIME_BUDGET_MS ?? 45_000);

function stableId(prefix: string, value: string) {
  return `${prefix}-${crypto.createHash("sha1").update(value).digest("hex").slice(0, 16)}`;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function canonicalUrl(value: string) {
  try {
    const url = new URL(value);
    url.hash = "";
    for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid"]) {
      url.searchParams.delete(key);
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    return value.trim();
  }
}

function hostname(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "Unknown";
  }
}

function stripHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&pound;/g, "£")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function parsePrice(text: string) {
  const lower = text.toLowerCase();
  if (lower.includes("poa") || lower.includes("price on application")) return null;
  const match = lower.match(/£\s*([0-9][0-9,.]*)(?:\s*(m|million))?/i);
  if (!match) return null;
  const value = Number(match[1].replace(/,/g, ""));
  if (!Number.isFinite(value)) return null;
  return match[2] ? Math.round(value * 1_000_000) : Math.round(value);
}

function parseRooms(text: string) {
  const matches = [...text.toLowerCase().matchAll(/(\d{1,3})\s*(?:[- ]?(?:en[- ]?suite|bed(?:room)?s?|letting bedrooms?|rooms?|keys?|lodges?|suites?))/g)]
    .map((match) => Number(match[1]))
    .filter((num) => num > 0 && num < 140);
  return matches.length ? Math.max(...matches) : null;
}

function parseTenure(text: string): Tenure {
  const lower = text.toLowerCase();
  if (/\bfreehold\b|\bfh\b/.test(lower)) return "freehold";
  if (/\bleasehold\b|\blh\b/.test(lower)) return "leasehold";
  return "unknown";
}

function parseKind(text: string): PropertyKind {
  const lower = text.toLowerCase();
  if (/guest\s*house|bed\s*&\s*breakfast|\bb&b\b/.test(lower)) return "guest_house";
  if (/\bpub\b|public house|freehouse|bar/.test(lower)) return "pub";
  if (/\binn\b/.test(lower)) return "inn";
  if (/\bhotel\b/.test(lower)) return "hotel";
  if (/hostel|holiday|self-catering|cottage/.test(lower)) return "holiday_accommodation";
  return "hospitality";
}

function scoreCandidate(candidate: {
  status: PropertyRecord["status"];
  tenure: Tenure;
  rooms: number | null;
  priceValue: number | null;
  pricePerRoom: number | null;
  areaId: number;
  note: string;
}) {
  let score = 42;
  if (candidate.status === "live") score += 6;
  if (candidate.tenure === "freehold") score += 11;
  if (candidate.tenure === "leasehold") score -= 4;
  if (candidate.rooms != null) {
    if (candidate.rooms >= 6 && candidate.rooms <= 22) score += 12;
    else if (candidate.rooms > 22 && candidate.rooms <= 35) score += 6;
    else if (candidate.rooms < 4) score -= 5;
  }
  if (candidate.priceValue != null) {
    if (candidate.priceValue >= 250_000 && candidate.priceValue <= 1_250_000) score += 11;
    if (candidate.priceValue > 2_000_000) score -= 9;
  } else {
    score -= 7;
  }
  if (candidate.pricePerRoom != null) {
    if (candidate.pricePerRoom <= 80_000) score += 10;
    else if (candidate.pricePerRoom <= 120_000) score += 5;
    else if (candidate.pricePerRoom > 180_000) score -= 8;
  }
  if ([4, 6, 7, 13, 14, 15].includes(candidate.areaId)) score += 5;
  if (/turnover|profit|ebitda|net profit/i.test(candidate.note)) score += 4;
  if (/requires|closed|upgrading|vacant|development potential/i.test(candidate.note)) score -= 3;
  return Math.max(1, Math.min(100, Math.round(score)));
}

function candidateConfidence(candidate: {
  priceValue: number | null;
  rooms: number | null;
  url: string;
  source: string;
  lat: number;
  lng: number;
  note: string;
}) {
  let score = 58;
  if (candidate.priceValue != null) score += 11;
  if (candidate.rooms != null) score += 8;
  if (candidate.url) score += 9;
  if (candidate.source !== "Unknown") score += 4;
  if (Number.isFinite(candidate.lat) && Number.isFinite(candidate.lng)) score += 5;
  if (/rightmove|christie|fleurets|colliers|savills|sidney phillips|graham/i.test(candidate.source)) score += 5;
  if (/under offer|sold|let agreed/i.test(candidate.note)) score -= 10;
  return Math.max(1, Math.min(100, score));
}

function areaCentroids() {
  const properties = getSeedProperties();
  const byArea = new Map<number, { lat: number; lng: number; count: number }>();
  for (const property of properties) {
    const current = byArea.get(property.areaId) ?? { lat: 0, lng: 0, count: 0 };
    current.lat += property.lat;
    current.lng += property.lng;
    current.count += 1;
    byArea.set(property.areaId, current);
  }
  return new Map([...byArea.entries()].map(([id, value]) => [id, { lat: value.lat / value.count, lng: value.lng / value.count }]));
}

function deterministicJitter(url: string) {
  const hash = crypto.createHash("sha1").update(url).digest();
  const lat = ((hash[0] / 255) - 0.5) * 0.24;
  const lng = ((hash[1] / 255) - 0.5) * 0.32;
  return { lat, lng };
}

function inferArea(text: string, queryAreaId: number) {
  const areas = getSeedAreas();
  const lower = text.toLowerCase();
  const matched = areas.find((area) => {
    const names = [area.name, area.shortName, area.slug].filter(Boolean).map((item) => item.toLowerCase());
    return names.some((name) => name.length > 3 && lower.includes(name.replace(/-/g, " ")));
  });
  return matched ?? areas.find((area) => area.id === queryAreaId) ?? areas[0];
}

function defaultQueries(): SearchQuery[] {
  const preferred = [
    13, // Highlands
    14, // Argyll
    6, // Lake District
    4, // North Yorkshire Coast
    15, // Northumberland
    7, // Borders
    11, // Perthshire
    8, // Dumfries & Galloway
    3, // Dales
    5, // Peak District
    10, // Loch Lomond
    1 // Yorkshire NE
  ];
  const areas = getSeedAreas();
  return preferred
    .map((areaId) => areas.find((area) => area.id === areaId))
    .filter((area): area is Area => Boolean(area))
    .flatMap((area) => [
      { areaId: area.id, query: `"hotel for sale" "${area.name}" freehold` },
      { areaId: area.id, query: `"guest house for sale" "${area.name}"` }
    ]);
}

function configuredQueries() {
  const raw = process.env.SCRAPER_QUERIES_JSON;
  if (!raw) return defaultQueries();
  try {
    const parsed = JSON.parse(raw) as SearchQuery[];
    return parsed.filter((item) => item.query && item.areaId);
  } catch {
    return defaultQueries();
  }
}

async function fetchJson<T>(url: string, init?: RequestInit, timeoutMs = SEARCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal
    });
    if (!response.ok) {
      const detail = (await response.text().catch(() => "")).replace(/\s+/g, " ").trim().slice(0, 180);
      throw new Error(`Search provider returned ${response.status}${detail ? `: ${detail}` : ""}`);
    }
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Search provider request timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function searchSerpApi(query: SearchQuery, limit: number): Promise<SearchResult[]> {
  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) return [];
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google");
  url.searchParams.set("q", query.query);
  url.searchParams.set("num", String(limit));
  url.searchParams.set("api_key", apiKey);
  const data = await fetchJson<{ organic_results?: Array<{ title?: string; link?: string; snippet?: string }> }>(url.toString());
  return (data.organic_results ?? [])
    .filter((item) => item.link && item.title)
    .slice(0, limit)
    .map((item) => ({
      title: item.title ?? "",
      url: item.link ?? "",
      snippet: item.snippet ?? "",
      provider: "serpapi",
      query: query.query,
      areaId: query.areaId
    }));
}

async function searchBrave(query: SearchQuery, limit: number): Promise<SearchResult[]> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) return [];
  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", query.query);
  url.searchParams.set("count", String(limit));
  const data = await fetchJson<{ web?: { results?: Array<{ title?: string; url?: string; description?: string }> } }>(url.toString(), {
    headers: {
      Accept: "application/json",
      "X-Subscription-Token": apiKey
    }
  });
  return (data.web?.results ?? [])
    .filter((item) => item.url && item.title)
    .slice(0, limit)
    .map((item) => ({
      title: item.title ?? "",
      url: item.url ?? "",
      snippet: item.description ?? "",
      provider: "brave",
      query: query.query,
      areaId: query.areaId
    }));
}

async function searchBing(query: SearchQuery, limit: number): Promise<SearchResult[]> {
  const apiKey = process.env.BING_SEARCH_API_KEY;
  if (!apiKey) return [];
  const url = new URL("https://api.bing.microsoft.com/v7.0/search");
  url.searchParams.set("q", query.query);
  url.searchParams.set("count", String(limit));
  url.searchParams.set("responseFilter", "Webpages");
  const data = await fetchJson<{ webPages?: { value?: Array<{ name?: string; url?: string; snippet?: string }> } }>(url.toString(), {
    headers: {
      "Ocp-Apim-Subscription-Key": apiKey
    }
  });
  return (data.webPages?.value ?? [])
    .filter((item) => item.url && item.name)
    .slice(0, limit)
    .map((item) => ({
      title: item.name ?? "",
      url: item.url ?? "",
      snippet: item.snippet ?? "",
      provider: "bing",
      query: query.query,
      areaId: query.areaId
    }));
}

function configuredProvider() {
  if (process.env.SERPAPI_API_KEY) return "serpapi";
  if (process.env.BRAVE_SEARCH_API_KEY) return "brave";
  if (process.env.BING_SEARCH_API_KEY) return "bing";
  return "none";
}

async function searchWeb(query: SearchQuery, limit: number) {
  if (process.env.SERPAPI_API_KEY) return searchSerpApi(query, limit);
  if (process.env.BRAVE_SEARCH_API_KEY) return searchBrave(query, limit);
  if (process.env.BING_SEARCH_API_KEY) return searchBing(query, limit);
  return [];
}

async function fetchPageText(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PAGE_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml"
      },
      signal: controller.signal
    });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("html") && !contentType.includes("text")) return null;
    return await response.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function extractMeta(html: string, property: string) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i");
  return decodeHtml(html.match(pattern)?.[1] ?? "");
}

function titleFromHtml(html: string) {
  return decodeHtml(extractMeta(html, "og:title") || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
}

function listingName(title: string) {
  return title
    .replace(/\s*\|\s*Rightmove.*$/i, "")
    .replace(/\s*-\s*Rightmove.*$/i, "")
    .replace(/\s*for sale.*$/i, "")
    .replace(/\s*\|\s*Commercial.*$/i, "")
    .trim()
    .slice(0, 110);
}

function looksLikeHospitality(result: SearchResult, pageText: string) {
  const text = `${result.title} ${result.snippet} ${pageText}`.toLowerCase();
  if (!/(hotel|guest house|bed and breakfast|b&b|inn|pub|hospitality|licensed|rooms|letting bedrooms)/.test(text)) return false;
  if (!/(for sale|freehold|leasehold|offers over|guide price|commercial property|business for sale|hotel property)/.test(text)) return false;
  return true;
}

async function resultToCandidate(
  result: SearchResult,
  centroids: Map<number, { lat: number; lng: number }>,
  includePageFetch: boolean
) {
  const pageHtml = includePageFetch ? await fetchPageText(result.url) : null;
  const pageText = pageHtml ? stripHtml(decodeHtml(pageHtml)).slice(0, 12_000) : "";
  if (!looksLikeHospitality(result, pageText)) return null;

  const title = pageHtml ? titleFromHtml(pageHtml) || result.title : result.title;
  const combined = `${title} ${result.snippet} ${pageText}`;
  const area = inferArea(combined, result.areaId);
  const centroid = centroids.get(area.id) ?? { lat: 55.4, lng: -3.2 };
  const jitter = deterministicJitter(result.url);
  const priceValue = parsePrice(combined);
  const rooms = parseRooms(combined);
  const pricePerRoom = priceValue != null && rooms ? Math.round(priceValue / rooms) : null;
  const source = hostname(result.url);
  const status: ListingStatus = /under offer|sold subject|sold stc|sale agreed/i.test(combined) ? "under_offer" : "unconfirmed";
  const note = result.snippet || pageText.slice(0, 240);
  const base = {
    id: stableId("disc", canonicalUrl(result.url)),
    name: listingName(title) || result.title || source,
    areaId: area.id,
    areaName: area.name,
    areaSlug: area.slug,
    lat: Number((centroid.lat + jitter.lat).toFixed(5)),
    lng: Number((centroid.lng + jitter.lng).toFixed(5)),
    kind: parseKind(combined),
    type: rooms ? `${rooms} rooms` : "Hospitality listing",
    tenure: parseTenure(combined),
    rooms,
    price: priceValue == null ? "POA / not parsed" : new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(priceValue),
    priceValue,
    pricePerRoom,
    source,
    location: area.name,
    url: canonicalUrl(result.url),
    status,
    note,
    provider: result.provider,
    query: result.query,
    discoveredAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    reviewStatus: "new" as const,
    promotedPropertyId: null,
    raw: {
      title: result.title,
      snippet: result.snippet,
      fetched: Boolean(pageHtml)
    }
  };

  return {
    ...base,
    fitScore: scoreCandidate(base),
    confidence: candidateConfidence(base)
  } satisfies DiscoveryCandidate;
}

function dedupeCandidates(candidates: DiscoveryCandidate[]) {
  const seen = new Set<string>();
  const output: DiscoveryCandidate[] = [];
  for (const candidate of candidates) {
    const key = canonicalUrl(candidate.url) || `${candidate.name}-${candidate.areaName}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(candidate);
  }
  return output;
}

async function existingCandidateIds(ids: string[]) {
  if (!databaseEnabled() || !ids.length) return new Set<string>();
  const pool = await getPool();
  const result = await pool.query<{ id: string }>("select id from discovery_candidates where id = any($1)", [ids]);
  return new Set(result.rows.map((row) => row.id));
}

export async function runDiscovery(options: DiscoveryRunOptions = {}): Promise<DiscoveryRunResult> {
  const provider = configuredProvider();
  const importDiscovered = options.importDiscovered ?? process.env.AUTO_IMPORT_DISCOVERED !== "false";
  if (provider === "none") {
    return {
      configured: false,
      provider,
      queriesRun: 0,
      candidates: [],
      candidatesNew: 0,
      propertiesImported: 0,
      stoppedEarly: false,
      warnings: [],
      message: "No search provider is configured. Set SERPAPI_API_KEY, BRAVE_SEARCH_API_KEY, or BING_SEARCH_API_KEY in Vercel."
    };
  }

  const queries = configuredQueries().slice(0, options.maxQueries ?? QUERY_LIMIT);
  const resultsPerQuery = options.resultsPerQuery ?? RESULT_LIMIT;
  const includePageFetch = options.includePageFetch ?? process.env.DISCOVERY_FETCH_PAGES === "true";
  const deadline = Date.now() + (options.timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS);
  const centroids = areaCentroids();
  const candidates: DiscoveryCandidate[] = [];
  const warnings: string[] = [];
  let queriesRun = 0;
  let stoppedEarly = false;

  function hasTimeRemaining() {
    return Date.now() < deadline - 2_000;
  }

  for (const query of queries) {
    if (!hasTimeRemaining()) {
      stoppedEarly = true;
      break;
    }

    let results: SearchResult[] = [];
    try {
      results = await searchWeb(query, resultsPerQuery);
      queriesRun += 1;
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : "Search query failed.");
      continue;
    }

    for (const result of results) {
      if (!hasTimeRemaining()) {
        stoppedEarly = true;
        break;
      }
      const candidate = await resultToCandidate(result, centroids, includePageFetch);
      if (candidate) candidates.push(candidate);
    }

    if (stoppedEarly) break;
  }

  if (!queriesRun && warnings.length) {
    throw new Error(warnings[0]);
  }

  const deduped = dedupeCandidates(candidates);
  const existing = await existingCandidateIds(deduped.map((candidate) => candidate.id));
  const candidatesNew = deduped.filter((candidate) => !existing.has(candidate.id)).length;
  let propertiesImported = 0;

  if (databaseEnabled()) {
    await upsertDiscoveryCandidates(deduped);
    if (importDiscovered) {
      propertiesImported = await importCandidatesAsProperties(deduped);
    }
  }

  return {
    configured: true,
    provider,
    queriesRun,
    candidates: deduped,
    candidatesNew,
    propertiesImported,
    stoppedEarly,
    warnings,
    message: stoppedEarly
      ? `Discovery stopped before the time limit with ${deduped.length} candidates (${candidatesNew} new).`
      : `Discovery finished with ${deduped.length} candidates (${candidatesNew} new).`
  };
}

export async function runDiscoveryWithLog(options: DiscoveryRunOptions = {}) {
  const runId = await startRefreshRun();
  try {
    const result = await runDiscovery(options);
    await finishRefreshRun(runId, {
      status: "success",
      provider: result.provider,
      queriesRun: result.queriesRun,
      propertiesSeen: result.candidates.length,
      candidatesFound: result.candidates.length,
      candidatesNew: result.candidatesNew,
      propertiesImported: result.propertiesImported,
      message: result.warnings.length ? `${result.message} ${result.warnings.join(" ")}` : result.message
    });
    return { runId, ...result };
  } catch (error) {
    await finishRefreshRun(runId, {
      status: "error",
      provider: configuredProvider(),
      queriesRun: 0,
      propertiesSeen: 0,
      candidatesFound: 0,
      candidatesNew: 0,
      propertiesImported: 0,
      message: error instanceof Error ? error.message : "Discovery failed."
    });
    throw error;
  }
}

async function startRefreshRun() {
  if (!databaseEnabled()) return null;
  const pool = await getPool();
  const result = await pool.query<{ id: number }>(
    "insert into refresh_runs (status, source, provider) values ('running', 'discovery', $1) returning id",
    [configuredProvider()]
  );
  return result.rows[0]?.id ?? null;
}

async function finishRefreshRun(
  runId: number | null,
  values: {
    status: "success" | "error";
    provider: string;
    queriesRun: number;
    propertiesSeen: number;
    candidatesFound: number;
    candidatesNew: number;
    propertiesImported: number;
    message: string;
  }
) {
  if (!databaseEnabled() || runId == null) return;
  const pool = await getPool();
  await pool.query(
    `
    update refresh_runs
    set finished_at = now(),
        status = $2,
        provider = $3,
        queries_run = $4,
        properties_seen = $5,
        candidates_found = $6,
        candidates_new = $7,
        properties_imported = $8,
        message = $9
    where id = $1
    `,
    [
      runId,
      values.status,
      values.provider,
      values.queriesRun,
      values.propertiesSeen,
      values.candidatesFound,
      values.candidatesNew,
      values.propertiesImported,
      values.message
    ]
  );
}

export async function upsertDiscoveryCandidates(candidates: DiscoveryCandidate[]) {
  if (!databaseEnabled() || !candidates.length) return;
  const pool = await getPool();
  for (const candidate of candidates) {
    await pool.query(
      `
      insert into discovery_candidates (
        id, provider, query, name, area_id, area_name, area_slug, lat, lng, kind, type, tenure, rooms,
        price, price_value, price_per_room, source, location, url, status, note, fit_score, confidence, raw
      )
      values (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24
      )
      on conflict (id) do update set
        last_seen_at = now(),
        provider = excluded.provider,
        query = excluded.query,
        name = excluded.name,
        area_id = excluded.area_id,
        area_name = excluded.area_name,
        area_slug = excluded.area_slug,
        lat = excluded.lat,
        lng = excluded.lng,
        kind = excluded.kind,
        type = excluded.type,
        tenure = excluded.tenure,
        rooms = excluded.rooms,
        price = excluded.price,
        price_value = excluded.price_value,
        price_per_room = excluded.price_per_room,
        source = excluded.source,
        location = excluded.location,
        url = excluded.url,
        status = excluded.status,
        note = excluded.note,
        fit_score = excluded.fit_score,
        confidence = excluded.confidence,
        raw = excluded.raw
      `,
      [
        candidate.id,
        candidate.provider,
        candidate.query,
        candidate.name,
        candidate.areaId,
        candidate.areaName,
        candidate.areaSlug,
        candidate.lat,
        candidate.lng,
        candidate.kind,
        candidate.type,
        candidate.tenure,
        candidate.rooms,
        candidate.price,
        candidate.priceValue,
        candidate.pricePerRoom,
        candidate.source,
        candidate.location,
        candidate.url,
        candidate.status,
        candidate.note,
        candidate.fitScore,
        candidate.confidence,
        JSON.stringify(candidate.raw)
      ]
    );
  }
}

export async function importCandidatesAsProperties(candidates: DiscoveryCandidate[]) {
  if (!databaseEnabled() || !candidates.length) return 0;
  const pool = await getPool();
  let imported = 0;
  for (const candidate of candidates) {
    const existing = await pool.query<{ id: string }>("select id from properties where url = $1 or id = $2 limit 1", [
      candidate.url,
      candidate.id
    ]);
    const propertyId = existing.rows[0]?.id ?? candidate.id;
    if (!existing.rows.length) {
      const indexResult = await pool.query<{ next_index: number }>("select coalesce(max(source_index), 0) + 1 as next_index from properties");
      const sourceIndex = indexResult.rows[0]?.next_index ?? 1;
      await pool.query(
        `
        insert into properties (
          id, source_index, name, area_id, area_name, area_slug, lat, lng, kind, type, tenure, rooms,
          price, price_value, price_per_room, source, location, url, status, note, last_seen, fit_score, confidence
        )
        values (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,current_date,$21,$22
        )
        `,
        [
          propertyId,
          sourceIndex,
          candidate.name,
          candidate.areaId,
          candidate.areaName,
          candidate.areaSlug,
          candidate.lat,
          candidate.lng,
          candidate.kind,
          candidate.type,
          candidate.tenure,
          candidate.rooms,
          candidate.price,
          candidate.priceValue,
          candidate.pricePerRoom,
          candidate.source,
          candidate.location,
          candidate.url,
          candidate.status,
          candidate.note,
          candidate.fitScore,
          candidate.confidence
        ]
      );
      imported += 1;
    } else {
      await pool.query(
        `
        update properties
        set price = $2,
            price_value = $3,
            price_per_room = $4,
            status = $5,
            note = $6,
            last_seen = current_date,
            updated_at = now()
        where id = $1
        `,
        [propertyId, candidate.price, candidate.priceValue, candidate.pricePerRoom, candidate.status, candidate.note]
      );
    }
    await pool.query(
      `
      insert into property_snapshots (property_id, price, price_value, status, source, url, raw)
      values ($1,$2,$3,$4,$5,$6,$7)
      `,
      [propertyId, candidate.price, candidate.priceValue, candidate.status, candidate.source, candidate.url, JSON.stringify(candidate.raw)]
    );
    await pool.query(
      "update discovery_candidates set review_status = 'promoted', promoted_property_id = $2 where id = $1",
      [candidate.id, propertyId]
    );
  }
  return imported;
}

export async function listDiscoveryCandidates(limit = 100) {
  if (!databaseEnabled()) return [];
  const pool = await getPool();
  const result = await pool.query(
    `
    select *
    from discovery_candidates
    order by last_seen_at desc
    limit $1
    `,
    [limit]
  );
  return result.rows;
}

export async function listRefreshRuns(limit = 25) {
  if (!databaseEnabled()) return [];
  const pool = await getPool();
  const result = await pool.query(
    `
    select
      id,
      started_at,
      finished_at,
      status,
      source,
      provider,
      queries_run,
      candidates_found,
      candidates_new,
      properties_imported,
      message
    from refresh_runs
    order by started_at desc
    limit $1
    `,
    [limit]
  );
  return result.rows;
}
