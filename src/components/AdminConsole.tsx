"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type AdminResult = {
  ok?: boolean;
  message?: string;
  [key: string]: unknown;
};

const ADMIN_SECRET_KEY = "jy-admin-secret";

async function readJsonResponse(response: Response) {
  const text = await response.text();
  if (!text.trim()) return { ok: response.ok, message: response.statusText } as AdminResult;
  try {
    return JSON.parse(text) as AdminResult;
  } catch {
    return {
      ok: false,
      message: text.replace(/\s+/g, " ").trim().slice(0, 240)
    };
  }
}

export function AdminConsole({ loginOnly = false }: { loginOnly?: boolean }) {
  const router = useRouter();
  const [secret, setSecret] = useState("");
  const [inputSecret, setInputSecret] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [result, setResult] = useState<AdminResult | null>(null);

  useEffect(() => {
    const stored = window.sessionStorage.getItem(ADMIN_SECRET_KEY) ?? "";
    setSecret(stored);
    if (!loginOnly && !stored) {
      router.replace("/login");
    }
  }, [loginOnly, router]);

  function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = inputSecret.trim();
    if (!trimmed) return;
    window.sessionStorage.setItem(ADMIN_SECRET_KEY, trimmed);
    setSecret(trimmed);
    setResult({ ok: true, message: "Admin session unlocked for this browser tab." });
    router.replace("/admin");
  }

  function signOut() {
    window.sessionStorage.removeItem(ADMIN_SECRET_KEY);
    setSecret("");
    setInputSecret("");
    setResult(null);
    router.replace("/login");
  }

  async function runAction(action: string, url: string) {
    if (!secret) {
      setResult({ ok: false, message: "Enter the admin secret first." });
      return;
    }

    setBusyAction(action);
    setResult(null);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secret}`
        }
      });
      const body = await readJsonResponse(response);
      setResult({
        ...body,
        ok: response.ok && body.ok !== false,
        status: response.status,
        action
      });
    } catch (error) {
      setResult({
        ok: false,
        action,
        message: error instanceof Error ? error.message : "Admin request failed."
      });
    } finally {
      setBusyAction(null);
    }
  }

  const showLogin = loginOnly || !secret;

  return (
    <main className="admin-shell">
      <section className="admin-panel">
        <div className="admin-header">
          <div className="admin-mark">JY</div>
          <div>
            <p className="admin-eyebrow">Admin</p>
            <h1>{showLogin ? "Admin Login" : "Admin Console"}</h1>
            <span>JY Hotels Acquisition Map</span>
          </div>
        </div>

        {showLogin ? (
          <form className="admin-login-form" onSubmit={signIn}>
            <label>
              <span>Admin secret</span>
              <input
                autoComplete="current-password"
                autoFocus
                type="password"
                value={inputSecret}
                onChange={(event) => setInputSecret(event.target.value)}
                placeholder="Enter REFRESH_WEBHOOK_SECRET"
              />
            </label>
            <button className="admin-primary" type="submit">
              Sign in
            </button>
            <p>
              Use the same secret configured in Vercel as <strong>REFRESH_WEBHOOK_SECRET</strong>. The secret is kept in this browser tab only.
            </p>
          </form>
        ) : (
          <>
            <div className="admin-actions">
              <button
                type="button"
                onClick={() => runAction("Refresh and import", "/api/refresh?maxQueries=12&resultsPerQuery=8")}
                disabled={busyAction !== null}
              >
                Refresh and import
              </button>
              <button
                type="button"
                onClick={() => runAction("Dry-run discovery", "/api/refresh?import=false&maxQueries=12&resultsPerQuery=8")}
                disabled={busyAction !== null}
              >
                Dry-run discovery
              </button>
              <button type="button" onClick={() => runAction("Run migration", "/api/admin/migrate")} disabled={busyAction !== null}>
                Run migration
              </button>
              <button type="button" onClick={() => runAction("Seed database", "/api/admin/seed")} disabled={busyAction !== null}>
                Seed database
              </button>
            </div>

            <div className="admin-links">
              <a href="/">Back to map</a>
              <a href="/api/refresh-runs" target="_blank" rel="noopener">
                Refresh runs
              </a>
              <a href="/api/discoveries" target="_blank" rel="noopener">
                Discoveries
              </a>
              <button type="button" onClick={signOut}>
                Sign out
              </button>
            </div>
          </>
        )}

        {busyAction && <div className="admin-status">Running {busyAction}...</div>}
        {result && (
          <pre className={`admin-result ${result.ok ? "ok" : "error"}`}>{JSON.stringify(result, null, 2)}</pre>
        )}
      </section>
    </main>
  );
}
