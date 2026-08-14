import { schemaSql } from "@/lib/schema-sql";
import { databaseEnabled, getPool } from "@/lib/store";

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
    return Response.json({ ok: false, message: "Unauthorized migration request." }, { status: 401 });
  }

  if (!databaseEnabled()) {
    return Response.json({
      ok: false,
      message: "Database mode is not enabled. Set USE_DATABASE=true and DATABASE_URL."
    }, { status: 400 });
  }

  const pool = await getPool();
  await pool.query(schemaSql);

  return Response.json({
    ok: true,
    message: "Database schema is ready."
  });
}
