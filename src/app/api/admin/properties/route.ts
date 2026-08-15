import { NextRequest, NextResponse } from "next/server";
import { isAdminRequestAuthorized } from "@/lib/admin-auth";
import { databaseEnabled, getPool, getSeedAreas, loadAcquisitionData } from "@/lib/store";
import type { ListingStatus, PropertyKind, Tenure } from "@/lib/types";

export const dynamic = "force-dynamic";

const listingStatuses = new Set<ListingStatus>(["live", "under_offer", "unconfirmed"]);
const propertyKinds = new Set<PropertyKind>([
  "hotel",
  "inn",
  "pub",
  "guest_house",
  "holiday_accommodation",
  "hospitality"
]);
const tenures = new Set<Tenure>(["freehold", "leasehold", "unknown"]);

type PropertyChanges = Record<string, unknown>;

function asText(value: unknown, fallback = "") {
  if (typeof value !== "string") return fallback;
  return value.trim();
}

function asNullableInteger(value: unknown) {
  if (value === null || value === "" || value === undefined) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.trunc(parsed);
}

function asRequiredNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asBoundedScore(value: unknown) {
  const parsed = asNullableInteger(value);
  if (parsed == null) return null;
  return Math.min(100, Math.max(0, parsed));
}

function asDateOnly(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString().slice(0, 10);
}

async function loadAdminProperties() {
  const data = await loadAcquisitionData();
  return {
    ok: true,
    databaseEnabled: databaseEnabled(),
    count: data.properties.length,
    areas: data.areas,
    properties: data.properties
  };
}

export async function GET(request: NextRequest) {
  if (!isAdminRequestAuthorized(request)) {
    return NextResponse.json({ ok: false, message: "Admin login required." }, { status: 401 });
  }

  return NextResponse.json(await loadAdminProperties(), {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}

export async function PATCH(request: NextRequest) {
  if (!isAdminRequestAuthorized(request)) {
    return NextResponse.json({ ok: false, message: "Admin login required." }, { status: 401 });
  }

  if (!databaseEnabled()) {
    return NextResponse.json(
      { ok: false, message: "Database mode is not enabled, so properties are read-only." },
      { status: 400 }
    );
  }

  let body: { id?: unknown; changes?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid property update request." }, { status: 400 });
  }

  const id = asText(body.id);
  if (!id || !body.changes || typeof body.changes !== "object" || Array.isArray(body.changes)) {
    return NextResponse.json({ ok: false, message: "Property id and changes are required." }, { status: 400 });
  }

  const changes = body.changes as PropertyChanges;
  const pool = await getPool();
  const current = await pool.query<{ price_value: number | null; rooms: number | null }>(
    "select price_value, rooms from properties where id = $1",
    [id]
  );

  if (!current.rowCount) {
    return NextResponse.json({ ok: false, message: "Property was not found." }, { status: 404 });
  }

  const sets: string[] = [];
  const values: unknown[] = [];

  function setColumn(column: string, value: unknown) {
    values.push(value);
    sets.push(`${column} = $${values.length}`);
  }

  const textColumns = {
    location: "location",
    name: "name",
    note: "note",
    price: "price",
    source: "source",
    type: "type",
    url: "url"
  } as const;

  for (const [field, column] of Object.entries(textColumns)) {
    if (field in changes) {
      const value = asText(changes[field]);
      if (field !== "note" && !value) {
        return NextResponse.json({ ok: false, message: `${field} cannot be empty.` }, { status: 400 });
      }
      setColumn(column, value);
    }
  }

  if ("status" in changes) {
    const value = changes.status;
    if (!listingStatuses.has(value as ListingStatus)) {
      return NextResponse.json({ ok: false, message: "Status is invalid." }, { status: 400 });
    }
    setColumn("status", value);
  }

  if ("kind" in changes) {
    const value = changes.kind;
    if (!propertyKinds.has(value as PropertyKind)) {
      return NextResponse.json({ ok: false, message: "Property kind is invalid." }, { status: 400 });
    }
    setColumn("kind", value);
  }

  if ("tenure" in changes) {
    const value = changes.tenure;
    if (!tenures.has(value as Tenure)) {
      return NextResponse.json({ ok: false, message: "Tenure is invalid." }, { status: 400 });
    }
    setColumn("tenure", value);
  }

  if ("areaId" in changes) {
    const areaId = asNullableInteger(changes.areaId);
    const area = getSeedAreas().find((item) => item.id === areaId);
    if (!area) {
      return NextResponse.json({ ok: false, message: "Area is invalid." }, { status: 400 });
    }
    setColumn("area_id", area.id);
    setColumn("area_name", area.name);
    setColumn("area_slug", area.slug);
  }

  if ("lat" in changes) {
    const value = asRequiredNumber(changes.lat);
    if (value == null) {
      return NextResponse.json({ ok: false, message: "Latitude is invalid." }, { status: 400 });
    }
    setColumn("lat", value);
  }

  if ("lng" in changes) {
    const value = asRequiredNumber(changes.lng);
    if (value == null) {
      return NextResponse.json({ ok: false, message: "Longitude is invalid." }, { status: 400 });
    }
    setColumn("lng", value);
  }

  if ("rooms" in changes) {
    setColumn("rooms", asNullableInteger(changes.rooms));
  }

  if ("priceValue" in changes) {
    setColumn("price_value", asNullableInteger(changes.priceValue));
  }

  if ("fitScore" in changes) {
    const value = asBoundedScore(changes.fitScore);
    if (value == null) {
      return NextResponse.json({ ok: false, message: "Fit score is invalid." }, { status: 400 });
    }
    setColumn("fit_score", value);
  }

  if ("confidence" in changes) {
    const value = asBoundedScore(changes.confidence);
    if (value == null) {
      return NextResponse.json({ ok: false, message: "Confidence is invalid." }, { status: 400 });
    }
    setColumn("confidence", value);
  }

  if ("lastSeen" in changes) {
    const value = asDateOnly(changes.lastSeen);
    if (!value) {
      return NextResponse.json({ ok: false, message: "Last seen date is invalid." }, { status: 400 });
    }
    setColumn("last_seen", value);
  }

  const nextPriceValue =
    "priceValue" in changes ? asNullableInteger(changes.priceValue) : current.rows[0].price_value;
  const nextRooms = "rooms" in changes ? asNullableInteger(changes.rooms) : current.rows[0].rooms;
  const pricePerRoom = nextPriceValue != null && nextRooms != null && nextRooms > 0 ? Math.round(nextPriceValue / nextRooms) : null;
  setColumn("price_per_room", pricePerRoom);
  sets.push("updated_at = now()");

  if (sets.length <= 2 && !("priceValue" in changes) && !("rooms" in changes)) {
    return NextResponse.json({ ok: false, message: "No editable fields were supplied." }, { status: 400 });
  }

  values.push(id);
  await pool.query(`update properties set ${sets.join(", ")} where id = $${values.length}`, values);

  const data = await loadAdminProperties();
  const property = data.properties.find((item) => item.id === id);

  return NextResponse.json({
    ...data,
    ok: true,
    property,
    message: property ? `Saved ${property.name}.` : "Property saved."
  });
}
