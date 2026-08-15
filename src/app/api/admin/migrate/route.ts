import { schemaSql } from "@/lib/schema-sql";
import { databaseEnabled, getPool } from "@/lib/store";
import { isAdminRequestAuthorized } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!isAdminRequestAuthorized(request)) {
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
