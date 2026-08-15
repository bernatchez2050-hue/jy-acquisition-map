import { NextRequest, NextResponse } from "next/server";
import { createAdminSession, setAdminSessionCookie, verifyAdminCredentials } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: { username?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid login request." }, { status: 400 });
  }

  const username = typeof body.username === "string" && body.username.trim() ? body.username.trim() : "admin";
  const password = typeof body.password === "string" ? body.password : "";
  const result = verifyAdminCredentials(username, password);

  if (!result.ok) {
    return NextResponse.json(result, { status: result.status });
  }

  const sessionUsername = result.username ?? username;
  const token = createAdminSession(sessionUsername);
  if (!token) {
    return NextResponse.json(
      { ok: false, message: "Admin session secret is not configured." },
      { status: 503 }
    );
  }

  const response = NextResponse.json({ ok: true, authenticated: true, username: sessionUsername });
  setAdminSessionCookie(response, token);
  return response;
}
