import seed from "@/data/seed.json";
import { buildSummary } from "./stats";
import type { AcquisitionData, Area, Cluster, PropertyRecord } from "./types";

type SeedData = {
  metadata: AcquisitionData["metadata"];
  areas: Area[];
  clusters: Cluster[];
  properties: PropertyRecord[];
};

const seedData = seed as SeedData;

let poolPromise: Promise<import("pg").Pool> | null = null;

function configuredDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL ?? process.env.DATABASE_POSTGRES_URL;
  if (!databaseUrl) return null;

  try {
    const url = new URL(databaseUrl);
    if (url.searchParams.get("sslmode") === "require") {
      url.searchParams.set("sslmode", "verify-full");
      return url.toString();
    }
  } catch {
    return databaseUrl;
  }

  return databaseUrl;
}

export function databaseEnabled() {
  return process.env.USE_DATABASE === "true" && Boolean(configuredDatabaseUrl());
}

export async function getPool() {
  const connectionString = configuredDatabaseUrl();
  if (!connectionString) throw new Error("Database mode is not configured.");

  if (!poolPromise) {
    poolPromise = import("pg").then(({ Pool }) => new Pool({ connectionString }));
  }
  return poolPromise;
}

function rowToProperty(row: Record<string, unknown>): PropertyRecord {
  return {
    id: String(row.id),
    sourceIndex: Number(row.source_index),
    name: String(row.name),
    areaId: Number(row.area_id),
    areaName: String(row.area_name),
    areaSlug: String(row.area_slug),
    lat: Number(row.lat),
    lng: Number(row.lng),
    kind: row.kind as PropertyRecord["kind"],
    type: String(row.type),
    tenure: row.tenure as PropertyRecord["tenure"],
    rooms: row.rooms == null ? null : Number(row.rooms),
    price: String(row.price),
    priceValue: row.price_value == null ? null : Number(row.price_value),
    pricePerRoom: row.price_per_room == null ? null : Number(row.price_per_room),
    source: String(row.source),
    location: String(row.location),
    url: String(row.url),
    status: row.status as PropertyRecord["status"],
    note: String(row.note ?? ""),
    lastSeen: String(row.last_seen),
    fitScore: Number(row.fit_score),
    confidence: Number(row.confidence)
  };
}

async function loadPropertiesFromDatabase() {
  if (!databaseEnabled()) return null;

  const pool = await getPool();
  const result = await pool.query(`
    select
      id,
      source_index,
      name,
      area_id,
      area_name,
      area_slug,
      lat,
      lng,
      kind,
      type,
      tenure,
      rooms,
      price,
      price_value,
      price_per_room,
      source,
      location,
      url,
      status,
      note,
      last_seen,
      fit_score,
      confidence
    from properties
    order by source_index asc
  `);

  return result.rows.map(rowToProperty);
}

export async function loadAcquisitionData(): Promise<AcquisitionData> {
  const properties = (await loadPropertiesFromDatabase()) ?? seedData.properties;

  return {
    metadata: {
      ...seedData.metadata,
      propertyCount: properties.length
    },
    areas: seedData.areas,
    clusters: seedData.clusters,
    properties,
    summary: buildSummary(seedData.areas, properties)
  };
}

export function getSeedAreas() {
  return seedData.areas;
}

export function getSeedClusters() {
  return seedData.clusters;
}

export function getSeedProperties() {
  return seedData.properties;
}
