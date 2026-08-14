import { databaseEnabled, getPool, getSeedProperties } from "./store";

export async function seedDatabase() {
  if (!databaseEnabled()) {
    return {
      ok: false,
      imported: 0,
      message: "Database mode is not enabled. Set USE_DATABASE=true and DATABASE_URL."
    };
  }

  const pool = await getPool();
  const properties = getSeedProperties();

  for (const property of properties) {
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

  return {
    ok: true,
    imported: properties.length,
    message: `Seeded ${properties.length} properties.`
  };
}
