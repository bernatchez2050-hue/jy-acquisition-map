import { listRefreshRuns } from "@/lib/discovery";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? 25);
  const rows = await listRefreshRuns(limit);
  return Response.json({
    ok: true,
    count: rows.length,
    runs: rows
  }, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
