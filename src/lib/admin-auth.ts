import { createHash, createHmac, timingSafeEqual } from "crypto";
import type { NextResponse } from "next/server";

export const ADMIN_SESSION_COOKIE = "jy_admin_session";

const SESSION_TTL_SECONDS = 60 * 60 * 12;

type AdminSessionPayload = {
  exp: number;
  iat: number;
  sub: string;
};

export function configuredAdminUsername() {
  return process.env.ADMIN_USERNAME?.trim() || "admin";
}

function configuredAdminPassword() {
  return process.env.ADMIN_PASSWORD?.trim();
}

export function adminActionSecret() {
  return process.env.REFRESH_WEBHOOK_SECRET?.trim() || process.env.CRON_SECRET?.trim() || configuredAdminPassword();
}

function configuredCredentials() {
  return [configuredAdminPassword(), process.env.REFRESH_WEBHOOK_SECRET?.trim(), process.env.CRON_SECRET?.trim()].filter(
    (value): value is string => Boolean(value)
  );
}

function sessionSecret() {
  return process.env.ADMIN_SESSION_SECRET?.trim() || adminActionSecret();
}

function safeEqual(left: string, right: string) {
  const leftDigest = createHash("sha256").update(left).digest();
  const rightDigest = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftDigest, rightDigest);
}

function sign(value: string) {
  const secret = sessionSecret();
  if (!secret) return null;
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function readCookie(request: Request, name: string) {
  const header = request.headers.get("cookie");
  if (!header) return null;

  for (const pair of header.split(";")) {
    const [rawKey, ...rawValue] = pair.trim().split("=");
    if (rawKey === name) return decodeURIComponent(rawValue.join("="));
  }

  return null;
}

export function verifyAdminCredentials(_username: string, password: string) {
  const credentials = configuredCredentials();
  if (!credentials.length) {
    return {
      ok: false,
      status: 503,
      message: "Admin password is not configured. Add ADMIN_PASSWORD in Vercel environment variables."
    };
  }

  const expectedUsername = configuredAdminUsername();
  const cleanedPassword = password.trim();
  const ok = credentials.some((credential) => safeEqual(cleanedPassword, credential));

  return {
    ok,
    status: ok ? 200 : 401,
    message: ok ? "Signed in." : "Invalid username or password.",
    username: expectedUsername
  };
}

export function createAdminSession(username: string) {
  const now = Math.floor(Date.now() / 1000);
  const payload: AdminSessionPayload = {
    exp: now + SESSION_TTL_SECONDS,
    iat: now,
    sub: username
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(encodedPayload);
  if (!signature) return null;
  return `${encodedPayload}.${signature}`;
}

export function readAdminSession(request: Request) {
  const token = readCookie(request, ADMIN_SESSION_COOKIE);
  if (!token) return null;

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;

  const expectedSignature = sign(encodedPayload);
  if (!expectedSignature || !safeEqual(signature, expectedSignature)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as AdminSessionPayload;
    if (!payload.sub || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function isAdminRequestAuthorized(request: Request) {
  if (readAdminSession(request)) return true;

  const headerSecret = request.headers.get("x-refresh-secret");
  const auth = request.headers.get("authorization");
  return configuredCredentials().some(
    (credential) => headerSecret === credential || auth === `Bearer ${credential}`
  );
}

export function setAdminSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
    sameSite: "strict",
    secure: process.env.VERCEL === "1"
  });
}

export function clearAdminSessionCookie(response: NextResponse) {
  response.cookies.set(ADMIN_SESSION_COOKIE, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "strict",
    secure: process.env.VERCEL === "1"
  });
}
