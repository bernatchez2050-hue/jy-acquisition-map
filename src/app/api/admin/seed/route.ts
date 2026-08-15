import { seedDatabase } from "@/lib/seed-database";
import { isAdminRequestAuthorized } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!isAdminRequestAuthorized(request)) {
    return Response.json({ ok: false, message: "Unauthorized seed request." }, { status: 401 });
  }

  const result = await seedDatabase();
  return Response.json(result, { status: result.ok ? 200 : 400 });
}
