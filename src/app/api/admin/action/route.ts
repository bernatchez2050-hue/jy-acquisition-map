import { NextRequest, NextResponse } from "next/server";
import { adminActionSecret, isAdminRequestAuthorized } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const adminActions = {
  dryRun: "/api/refresh?import=false&maxQueries=12&resultsPerQuery=8",
  migrate: "/api/admin/migrate",
  refresh: "/api/refresh?maxQueries=12&resultsPerQuery=8",
  seed: "/api/admin/seed"
} as const;

type AdminAction = keyof typeof adminActions;

function isAdminAction(value: unknown): value is AdminAction {
  return typeof value === "string" && value in adminActions;
}

export async function POST(request: NextRequest) {
  if (!isAdminRequestAuthorized(request)) {
    return NextResponse.json({ ok: false, message: "Admin login required." }, { status: 401 });
  }

  const secret = adminActionSecret();
  if (!secret) {
    return NextResponse.json({ ok: false, message: "Admin action secret is not configured." }, { status: 503 });
  }

  let body: { action?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid admin action request." }, { status: 400 });
  }

  if (!isAdminAction(body.action)) {
    return NextResponse.json({ ok: false, message: "Unknown admin action." }, { status: 400 });
  }

  const target = new URL(adminActions[body.action], request.url);
  const response = await fetch(target, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`
    }
  });
  const text = await response.text();

  return new Response(text, {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") ?? "application/json"
    }
  });
}
