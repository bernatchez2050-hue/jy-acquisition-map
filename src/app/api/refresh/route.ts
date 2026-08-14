import { runDiscoveryWithLog } from "@/lib/discovery";
import { loadAcquisitionData } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
  const maxQueries = Number(url.searchParams.get("maxQueries") ?? process.env.DISCOVERY_MAX_QUERIES ?? 12);
  const resultsPerQuery = Number(url.searchParams.get("resultsPerQuery") ?? process.env.DISCOVERY_RESULTS_PER_QUERY ?? 8);

  try {
    const result = await runDiscoveryWithLog({
      importDiscovered: shouldImport,
      maxQueries,
      resultsPerQuery
    });
    const data = await loadAcquisitionData();
    return Response.json({
      ok: true,
      queued: false,
      mode: "discovery",
      configured: result.configured,
      provider: result.provider,
      runId: result.runId,
      queriesRun: result.queriesRun,
      candidatesFound: result.candidates.length,
      candidatesNew: result.candidatesNew,
      propertiesImported: result.propertiesImported,
      message: result.configured
        ? `${result.message} Imported ${result.propertiesImported} into the review map.`
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
