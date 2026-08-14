import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const { Pool } = pg;
const root = process.cwd();
const seedPath = path.join(root, "src", "data", "seed.json");

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to import seed data.");
}

const seed = JSON.parse(fs.readFileSync(seedPath, "utf8"));
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

try {
  await pool.query("begin");

  for (const property of seed.properties) {
    await pool.query(
      `
      insert into properties (
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
      )
      values (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23
      )
      on conflict (id) do update set
        source_index = excluded.source_index,
        name = excluded.name,
        area_id = excluded.area_id,
        area_name = excluded.area_name,
        area_slug = excluded.area_slug,
        lat = excluded.lat,
        lng = excluded.lng,
        kind = excluded.kind,
        type = excluded.type,
        tenure = excluded.tenure,
        rooms = excluded.rooms,
        price = excluded.price,
        price_value = excluded.price_value,
        price_per_room = excluded.price_per_room,
        source = excluded.source,
        location = excluded.location,
        url = excluded.url,
        status = excluded.status,
        note = excluded.note,
        last_seen = excluded.last_seen,
        fit_score = excluded.fit_score,
        confidence = excluded.confidence,
        updated_at = now()
      `,
      [
        property.id,
        property.sourceIndex,
        property.name,
        property.areaId,
        property.areaName,
        property.areaSlug,
        property.lat,
        property.lng,
        property.kind,
        property.type,
        property.tenure,
        property.rooms,
        property.price,
        property.priceValue,
        property.pricePerRoom,
        property.source,
        property.location,
        property.url,
        property.status,
        property.note,
        property.lastSeen,
        property.fitScore,
        property.confidence
      ]
    );
  }

  await pool.query("commit");
  console.log(`Imported ${seed.properties.length} properties.`);
} catch (error) {
  await pool.query("rollback");
  throw error;
} finally {
  await pool.end();
}
