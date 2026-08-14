import { seedDatabase } from "@/lib/seed-database";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(request: Request) {
  const secret = process.env.REFRESH_WEBHOOK_SECRET ?? process.env.CRON_SECRET;
  if (!secret) return false;
  const headerSecret = request.headers.get("x-refresh-secret");
  const auth = request.headers.get("authorization");
  return headerSecret === secret || auth === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ ok: false, message: "Unauthorized seed request." }, { status: 401 });
  }

  const result = await seedDatabase();
  return Response.json(result, { status: result.ok ? 200 : 400 });
}
