import { runDiscoveryWithLog } from "@/lib/discovery";
import { databaseEnabled } from "@/lib/store";
import { loadAcquisitionData } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function boundedNumber(value: string | null | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

function isAuthorized(request: Request) {
  const secret = process.env.REFRESH_WEBHOOK_SECRET ?? process.env.CRON_SECRET;
  if (!secret) return true;
  const headerSecret = request.headers.get("x-refresh-secret");
  const auth = request.headers.get("authorization");
  const cronAuth = request.headers.get("x-vercel-cron") ?? request.headers.get("user-agent");
  if (cronAuth?.includes("vercel-cron") && process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`) return true;
  return headerSecret === secret || auth === `Bearer ${secret}`;
}

async function triggerRefresh(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ ok: false, message: "Unauthorized refresh request." }, { status: 401 });
  }

  const url = new URL(request.url);
  const shouldImport = url.searchParams.get("import") !== "false" && process.env.AUTO_IMPORT_DISCOVERED !== "false";
  const includePageFetch = url.searchParams.get("deep") === "true" || process.env.DISCOVERY_FETCH_PAGES === "true";
  const maxQueries = boundedNumber(url.searchParams.get("maxQueries") ?? process.env.DISCOVERY_MAX_QUERIES, 3, 1, 24);
  const resultsPerQuery = boundedNumber(url.searchParams.get("resultsPerQuery") ?? process.env.DISCOVERY_RESULTS_PER_QUERY, 4, 1, 10);
  const timeBudgetMs = boundedNumber(
    url.searchParams.get("timeBudgetMs") ?? process.env.DISCOVERY_TIME_BUDGET_MS,
    includePageFetch ? 50_000 : 25_000,
    5_000,
    55_000
  );

  try {
    const result = await runDiscoveryWithLog({
      importDiscovered: shouldImport,
      includePageFetch,
      maxQueries,
      resultsPerQuery,
      timeBudgetMs
    });
    const data = await loadAcquisitionData();
    const hasDatabase = databaseEnabled();
    const importMessage =
      result.propertiesImported > 0
        ? ` Imported ${result.propertiesImported} into the review map.`
        : result.candidates.length > 0 && !hasDatabase
          ? " No candidates were imported; enable database mode to persist them on the map."
          : result.candidates.length > 0 && !shouldImport
            ? " No candidates were imported because auto-import is disabled for this run."
            : result.candidates.length > 0
              ? " No new properties were imported; matching candidates were already on the map."
              : "";
    return Response.json({
      ok: true,
      queued: false,
      mode: "discovery",
      configured: result.configured,
      provider: result.provider,
      runId: result.runId,
      queriesRun: result.queriesRun,
      maxQueries,
      candidatesFound: result.candidates.length,
      candidatesNew: result.candidatesNew,
      propertiesImported: result.propertiesImported,
      stoppedEarly: result.stoppedEarly,
      warnings: result.warnings,
      message: result.configured
        ? `${result.message}${importMessage}`
        : result.message,
      refreshedAt: data.metadata.refreshedAt,
      propertyCount: data.properties.length
    });
  } catch (error) {
    return Response.json({
      ok: false,
      queued: false,
      mode: "discovery",
      message: error instanceof Error ? error.message : "Discovery refresh failed."
    }, {
      status: 500
    })
  }
}

export async function GET(request: Request) {
  return triggerRefresh(request);
}

export async function POST(request: Request) {
  return triggerRefresh(request);
}
