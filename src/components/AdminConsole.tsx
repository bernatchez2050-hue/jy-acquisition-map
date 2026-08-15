"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Area, ListingStatus, PropertyKind, PropertyRecord, Tenure } from "@/lib/types";

type AdminResult = {
  authenticated?: boolean;
  ok?: boolean;
  message?: string;
  username?: string;
  properties?: PropertyRecord[];
  areas?: Area[];
  databaseEnabled?: boolean;
  count?: number;
  property?: PropertyRecord;
  [key: string]: unknown;
};

type AdminAction = "refresh" | "dryRun" | "migrate" | "seed";

type PropertyDraft = {
  areaId: string;
  confidence: string;
  fitScore: string;
  id: string;
  kind: PropertyKind;
  lastSeen: string;
  lat: string;
  lng: string;
  location: string;
  name: string;
  note: string;
  price: string;
  priceValue: string;
  rooms: string;
  source: string;
  status: ListingStatus;
  tenure: Tenure;
  type: string;
  url: string;
};

const statusOptions: Array<{ label: string; value: ListingStatus }> = [
  { label: "Live", value: "live" },
  { label: "Under offer", value: "under_offer" },
  { label: "Unverified", value: "unconfirmed" }
];

const kindOptions: Array<{ label: string; value: PropertyKind }> = [
  { label: "Hotel", value: "hotel" },
  { label: "Inn", value: "inn" },
  { label: "Pub", value: "pub" },
  { label: "Guest house", value: "guest_house" },
  { label: "Holiday accommodation", value: "holiday_accommodation" },
  { label: "Hospitality", value: "hospitality" }
];

const tenureOptions: Array<{ label: string; value: Tenure }> = [
  { label: "Freehold", value: "freehold" },
  { label: "Leasehold", value: "leasehold" },
  { label: "Unknown", value: "unknown" }
];

const actionLabels: Record<AdminAction, string> = {
  dryRun: "Dry-run discovery",
  migrate: "Run migration",
  refresh: "Refresh and import",
  seed: "Seed database"
};

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

function formatMoney(value: number | null) {
  if (value == null) return "POA";
  return `GBP ${Math.round(value / 1000)}k`;
}

function displayStatus(status: ListingStatus) {
  return statusOptions.find((option) => option.value === status)?.label ?? status;
}

function propertyToDraft(property: PropertyRecord): PropertyDraft {
  return {
    areaId: String(property.areaId),
    confidence: String(property.confidence),
    fitScore: String(property.fitScore),
    id: property.id,
    kind: property.kind,
    lastSeen: property.lastSeen,
    lat: String(property.lat),
    lng: String(property.lng),
    location: property.location,
    name: property.name,
    note: property.note,
    price: property.price,
    priceValue: property.priceValue == null ? "" : String(property.priceValue),
    rooms: property.rooms == null ? "" : String(property.rooms),
    source: property.source,
    status: property.status,
    tenure: property.tenure,
    type: property.type,
    url: property.url
  };
}

function nullableNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed.replace(/,/g, ""));
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function requiredNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function AdminConsole({ loginOnly = false }: { loginOnly?: boolean }) {
  const router = useRouter();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [loadingProperties, setLoadingProperties] = useState(false);
  const [properties, setProperties] = useState<PropertyRecord[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [databaseEnabled, setDatabaseEnabled] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PropertyDraft | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ListingStatus | "all">("all");
  const [kindFilter, setKindFilter] = useState<PropertyKind | "all">("all");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [result, setResult] = useState<AdminResult | null>(null);

  const selectedProperty = useMemo(
    () => properties.find((property) => property.id === selectedId) ?? properties[0] ?? null,
    [properties, selectedId]
  );

  const filteredProperties = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return properties.filter((property) => {
      const matchesQuery =
        !needle ||
        [property.name, property.location, property.areaName, property.source, property.type, property.url]
          .join(" ")
          .toLowerCase()
          .includes(needle);
      const matchesStatus = statusFilter === "all" || property.status === statusFilter;
      const matchesKind = kindFilter === "all" || property.kind === kindFilter;
      return matchesQuery && matchesStatus && matchesKind;
    });
  }, [kindFilter, properties, query, statusFilter]);

  const loadProperties = useCallback(async (quiet = false) => {
    setLoadingProperties(true);
    try {
      const response = await fetch("/api/admin/properties", { cache: "no-store" });
      const body = await readJsonResponse(response);

      if (response.status === 401) {
        setAuthenticated(false);
        router.replace("/login");
        return;
      }

      if (!response.ok || body.ok === false) {
        setResult({ ...body, ok: false, status: response.status });
        return;
      }

      const nextProperties = Array.isArray(body.properties) ? body.properties : [];
      setProperties(nextProperties);
      setAreas(Array.isArray(body.areas) ? body.areas : []);
      setDatabaseEnabled(Boolean(body.databaseEnabled));
      setSelectedId((current) =>
        current && nextProperties.some((property) => property.id === current) ? current : nextProperties[0]?.id ?? null
      );
      if (!quiet) setResult({ ok: true, message: `Loaded ${nextProperties.length} properties.` });
    } catch (error) {
      setResult({
        ok: false,
        message: error instanceof Error ? error.message : "Could not load admin properties."
      });
    } finally {
      setLoadingProperties(false);
    }
  }, [router]);

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      try {
        const response = await fetch("/api/admin/session", { cache: "no-store" });
        const body = await readJsonResponse(response);
        if (cancelled) return;

        const isAuthenticated = response.ok && body.authenticated === true;
        setAuthenticated(isAuthenticated);
        if (typeof body.username === "string") setUsername(body.username);
        if (!loginOnly && !isAuthenticated) router.replace("/login");
        if (loginOnly && isAuthenticated) router.replace("/admin");
      } catch {
        if (!cancelled && !loginOnly) router.replace("/login");
      } finally {
        if (!cancelled) setCheckingSession(false);
      }
    }

    checkSession();
    return () => {
      cancelled = true;
    };
  }, [loginOnly, router]);

  useEffect(() => {
    if (authenticated && !loginOnly) {
      void loadProperties();
    }
  }, [authenticated, loadProperties, loginOnly]);

  useEffect(() => {
    if (selectedProperty) setDraft(propertyToDraft(selectedProperty));
  }, [selectedProperty]);

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!username.trim() || !password) return;

    setBusyAction("Sign in");
    setResult(null);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ username, password })
      });
      const body = await readJsonResponse(response);
      if (!response.ok || body.ok === false) {
        setResult({ ...body, ok: false, status: response.status });
        return;
      }

      setAuthenticated(true);
      setPassword("");
      setResult({ ok: true, message: "Signed in." });
      router.replace("/admin");
    } catch (error) {
      setResult({
        ok: false,
        message: error instanceof Error ? error.message : "Sign in failed."
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function signOut() {
    await fetch("/api/admin/logout", { method: "POST" }).catch(() => null);
    setAuthenticated(false);
    setPassword("");
    setProperties([]);
    setDraft(null);
    setResult(null);
    router.replace("/login");
  }

  async function runAction(action: AdminAction) {
    setBusyAction(actionLabels[action]);
    setResult(null);

    try {
      const response = await fetch("/api/admin/action", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ action })
      });
      const body = await readJsonResponse(response);
      setResult({
        ...body,
        ok: response.ok && body.ok !== false,
        status: response.status,
        action: actionLabels[action]
      });
      if (response.ok && body.ok !== false) void loadProperties(true);
    } catch (error) {
      setResult({
        ok: false,
        action: actionLabels[action],
        message: error instanceof Error ? error.message : "Admin request failed."
      });
    } finally {
      setBusyAction(null);
    }
  }

  function updateDraft<K extends keyof PropertyDraft>(field: K, value: PropertyDraft[K]) {
    setDraft((current) => (current ? { ...current, [field]: value } : current));
  }

  async function saveDraft(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;

    const lat = requiredNumber(draft.lat);
    const lng = requiredNumber(draft.lng);
    if (lat == null || lng == null) {
      setResult({ ok: false, message: "Latitude and longitude must be valid numbers." });
      return;
    }

    setBusyAction("Save property");
    setResult(null);

    try {
      const response = await fetch("/api/admin/properties", {
        method: "PATCH",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          id: draft.id,
          changes: {
            areaId: Number(draft.areaId),
            confidence: nullableNumber(draft.confidence),
            fitScore: nullableNumber(draft.fitScore),
            kind: draft.kind,
            lastSeen: draft.lastSeen,
            lat,
            lng,
            location: draft.location,
            name: draft.name,
            note: draft.note,
            price: draft.price,
            priceValue: nullableNumber(draft.priceValue),
            rooms: nullableNumber(draft.rooms),
            source: draft.source,
            status: draft.status,
            tenure: draft.tenure,
            type: draft.type,
            url: draft.url
          }
        })
      });
      const body = await readJsonResponse(response);
      if (!response.ok || body.ok === false) {
        setResult({ ...body, ok: false, status: response.status });
        return;
      }

      const nextProperties = Array.isArray(body.properties) ? body.properties : properties;
      setProperties(nextProperties);
      if (body.property && typeof body.property === "object" && "id" in body.property) {
        setSelectedId(String((body.property as PropertyRecord).id));
      }
      setResult({
        ok: true,
        status: response.status,
        message: typeof body.message === "string" ? body.message : "Property saved."
      });
    } catch (error) {
      setResult({
        ok: false,
        message: error instanceof Error ? error.message : "Could not save property."
      });
    } finally {
      setBusyAction(null);
    }
  }

  if (loginOnly || !authenticated) {
    return (
      <main className="admin-shell">
        <section className="admin-panel">
          <div className="admin-header">
            <div className="admin-mark">JY</div>
            <div>
              <p className="admin-eyebrow">Admin</p>
              <h1>Admin Login</h1>
              <span>JY Hotels Acquisition Map</span>
            </div>
          </div>

          <form className="admin-login-form" onSubmit={signIn}>
            <label>
              <span>Username</span>
              <input
                autoComplete="username"
                autoFocus
                disabled={checkingSession}
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="admin"
              />
            </label>
            <label>
              <span>Password</span>
              <input
                autoComplete="current-password"
                disabled={checkingSession}
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter admin password"
              />
            </label>
            <button className="admin-primary" type="submit" disabled={busyAction !== null || checkingSession}>
              {busyAction === "Sign in" ? "Signing in..." : "Sign in"}
            </button>
          </form>

          {result && (
            <pre className={`admin-result ${result.ok ? "ok" : "error"}`}>{JSON.stringify(result, null, 2)}</pre>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="admin-shell admin-workspace-shell">
      <section className="admin-workspace">
        <header className="admin-workspace-header">
          <div className="admin-header">
            <div className="admin-mark">JY</div>
            <div>
              <p className="admin-eyebrow">Admin</p>
              <h1>Property Database</h1>
              <span>
                {properties.length} properties {databaseEnabled ? "from database" : "from seed fallback"}
              </span>
            </div>
          </div>
          <div className="admin-top-actions">
            <button type="button" onClick={() => loadProperties()} disabled={loadingProperties || busyAction !== null}>
              {loadingProperties ? "Loading..." : "Reload data"}
            </button>
            <a href="/">Back to map</a>
            <button type="button" onClick={signOut}>
              Sign out
            </button>
          </div>
        </header>

        <div className="admin-data-layout">
          <section className="admin-data-panel">
            <div className="admin-data-controls">
              <label>
                <span>Search</span>
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Name, area, source, URL"
                />
              </label>
              <label>
                <span>Status</span>
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as ListingStatus | "all")}>
                  <option value="all">All statuses</option>
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Kind</span>
                <select value={kindFilter} onChange={(event) => setKindFilter(event.target.value as PropertyKind | "all")}>
                  <option value="all">All kinds</option>
                  {kindOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="admin-count">
                <strong>{filteredProperties.length}</strong>
                <span>shown</span>
              </div>
            </div>

            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Area</th>
                    <th>Price</th>
                    <th>Rooms</th>
                    <th>Status</th>
                    <th>Score</th>
                    <th>Confidence</th>
                    <th>Last seen</th>
                    <th>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProperties.map((property) => (
                    <tr
                      className={property.id === selectedProperty?.id ? "selected" : ""}
                      key={property.id}
                      onClick={() => setSelectedId(property.id)}
                    >
                      <td>
                        <strong>{property.name}</strong>
                        <span>{property.location}</span>
                      </td>
                      <td>{property.areaName}</td>
                      <td>{formatMoney(property.priceValue)}</td>
                      <td>{property.rooms ?? "-"}</td>
                      <td>{displayStatus(property.status)}</td>
                      <td>{property.fitScore}</td>
                      <td>{property.confidence}%</td>
                      <td>{property.lastSeen}</td>
                      <td>{property.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!filteredProperties.length && <div className="admin-empty">No properties match the current filters.</div>}
            </div>
          </section>

          <aside className="admin-edit-panel">
            {draft ? (
              <form onSubmit={saveDraft}>
                <div className="admin-edit-head">
                  <div>
                    <p className="admin-eyebrow">Edit Selected</p>
                    <h2>{draft.name || "Untitled property"}</h2>
                  </div>
                  <button type="submit" disabled={busyAction !== null || !databaseEnabled}>
                    {busyAction === "Save property" ? "Saving..." : "Save"}
                  </button>
                </div>

                {!databaseEnabled && (
                  <div className="admin-status">
                    Database mode is off, so this table is read-only until USE_DATABASE=true and DATABASE_URL are configured.
                  </div>
                )}

                <label>
                  <span>Name</span>
                  <input value={draft.name} onChange={(event) => updateDraft("name", event.target.value)} />
                </label>
                <label>
                  <span>Location</span>
                  <input value={draft.location} onChange={(event) => updateDraft("location", event.target.value)} />
                </label>
                <label>
                  <span>Area</span>
                  <select value={draft.areaId} onChange={(event) => updateDraft("areaId", event.target.value)}>
                    {areas.map((area) => (
                      <option key={area.id} value={area.id}>
                        {area.name}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="admin-form-row">
                  <label>
                    <span>Price label</span>
                    <input value={draft.price} onChange={(event) => updateDraft("price", event.target.value)} />
                  </label>
                  <label>
                    <span>Price value</span>
                    <input inputMode="numeric" value={draft.priceValue} onChange={(event) => updateDraft("priceValue", event.target.value)} />
                  </label>
                </div>

                <div className="admin-form-row">
                  <label>
                    <span>Rooms</span>
                    <input inputMode="numeric" value={draft.rooms} onChange={(event) => updateDraft("rooms", event.target.value)} />
                  </label>
                  <label>
                    <span>Last seen</span>
                    <input type="date" value={draft.lastSeen} onChange={(event) => updateDraft("lastSeen", event.target.value)} />
                  </label>
                </div>

                <div className="admin-form-row">
                  <label>
                    <span>Status</span>
                    <select value={draft.status} onChange={(event) => updateDraft("status", event.target.value as ListingStatus)}>
                      {statusOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Tenure</span>
                    <select value={draft.tenure} onChange={(event) => updateDraft("tenure", event.target.value as Tenure)}>
                      {tenureOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="admin-form-row">
                  <label>
                    <span>Kind</span>
                    <select value={draft.kind} onChange={(event) => updateDraft("kind", event.target.value as PropertyKind)}>
                      {kindOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Type</span>
                    <input value={draft.type} onChange={(event) => updateDraft("type", event.target.value)} />
                  </label>
                </div>

                <div className="admin-form-row">
                  <label>
                    <span>Fit score</span>
                    <input inputMode="numeric" value={draft.fitScore} onChange={(event) => updateDraft("fitScore", event.target.value)} />
                  </label>
                  <label>
                    <span>Confidence</span>
                    <input inputMode="numeric" value={draft.confidence} onChange={(event) => updateDraft("confidence", event.target.value)} />
                  </label>
                </div>

                <div className="admin-form-row">
                  <label>
                    <span>Latitude</span>
                    <input value={draft.lat} onChange={(event) => updateDraft("lat", event.target.value)} />
                  </label>
                  <label>
                    <span>Longitude</span>
                    <input value={draft.lng} onChange={(event) => updateDraft("lng", event.target.value)} />
                  </label>
                </div>

                <label>
                  <span>Source</span>
                  <input value={draft.source} onChange={(event) => updateDraft("source", event.target.value)} />
                </label>
                <label>
                  <span>Listing URL</span>
                  <input value={draft.url} onChange={(event) => updateDraft("url", event.target.value)} />
                </label>
                <label>
                  <span>Broker note</span>
                  <textarea value={draft.note} onChange={(event) => updateDraft("note", event.target.value)} />
                </label>
              </form>
            ) : (
              <div className="admin-empty">Select a property to edit its database fields.</div>
            )}
          </aside>
        </div>

        <section className="admin-ops-panel">
          <div>
            <p className="admin-eyebrow">Operations</p>
            <h2>Database and discovery tools</h2>
          </div>
          <div className="admin-actions">
            <button type="button" onClick={() => runAction("refresh")} disabled={busyAction !== null}>
              Refresh and import
            </button>
            <button type="button" onClick={() => runAction("dryRun")} disabled={busyAction !== null}>
              Dry-run discovery
            </button>
            <button type="button" onClick={() => runAction("migrate")} disabled={busyAction !== null}>
              Run migration
            </button>
            <button type="button" onClick={() => runAction("seed")} disabled={busyAction !== null}>
              Seed database
            </button>
          </div>
          <div className="admin-links">
            <a href="/api/refresh-runs" target="_blank" rel="noopener">
              Refresh runs
            </a>
            <a href="/api/discoveries" target="_blank" rel="noopener">
              Discoveries
            </a>
          </div>
        </section>

        {busyAction && <div className="admin-status">Running {busyAction}...</div>}
        {result && (
          <pre className={`admin-result ${result.ok ? "ok" : "error"}`}>{JSON.stringify(result, null, 2)}</pre>
        )}
      </section>
    </main>
  );
}
