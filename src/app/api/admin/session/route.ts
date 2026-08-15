import { NextRequest, NextResponse } from "next/server";
import { configuredAdminUsername, readAdminSession } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = readAdminSession(request);
  return NextResponse.json({
    ok: true,
    authenticated: Boolean(session),
    username: session?.sub ?? configuredAdminUsername()
  });
}
