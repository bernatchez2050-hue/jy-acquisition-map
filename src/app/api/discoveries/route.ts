import { listDiscoveryCandidates } from "@/lib/discovery";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? 100);
  const rows = await listDiscoveryCandidates(limit);
  return Response.json({
    ok: true,
    count: rows.length,
    discoveries: rows
  }, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
