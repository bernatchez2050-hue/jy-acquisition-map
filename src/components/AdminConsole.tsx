"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type AdminResult = {
  ok?: boolean;
  message?: string;
  [key: string]: unknown;
};

const ADMIN_PASSWORD_KEY = "jy-admin-password";

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
  const [password, setPassword] = useState("");
  const [inputPassword, setInputPassword] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [result, setResult] = useState<AdminResult | null>(null);

  useEffect(() => {
    const stored = window.sessionStorage.getItem(ADMIN_PASSWORD_KEY) ?? "";
    setPassword(stored);
    if (!loginOnly && !stored) {
      router.replace("/login");
    }
  }, [loginOnly, router]);

  function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = inputPassword.trim();
    if (!trimmed) return;
    window.sessionStorage.setItem(ADMIN_PASSWORD_KEY, trimmed);
    setPassword(trimmed);
    setInputPassword("");
    setResult({ ok: true, message: "Admin session unlocked for this browser tab." });
    router.replace("/admin");
  }

  function signOut() {
    window.sessionStorage.removeItem(ADMIN_PASSWORD_KEY);
    setPassword("");
    setInputPassword("");
    setResult(null);
    router.replace("/login");
  }

  async function runAction(label: string, url: string) {
    if (!password) {
      setResult({ ok: false, message: "Sign in with the admin password first." });
      return;
    }

    setBusyAction(label);
    setResult(null);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${password}`
        }
      });
      const body = await readJsonResponse(response);
      setResult({
        ...body,
        ok: response.ok && body.ok !== false,
        status: response.status,
        action: label
      });
    } catch (error) {
      setResult({
        ok: false,
        action: label,
        message: error instanceof Error ? error.message : "Admin request failed."
      });
    } finally {
      setBusyAction(null);
    }
  }

  const showLogin = loginOnly || !password;

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
              <span>Password</span>
              <input
                autoComplete="current-password"
                autoFocus
                type="password"
                value={inputPassword}
                onChange={(event) => setInputPassword(event.target.value)}
                placeholder="Enter admin password"
              />
            </label>
            <button className="admin-primary" type="submit">
              Sign in
            </button>
            <p>Use the admin password configured for protected admin functions.</p>
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
