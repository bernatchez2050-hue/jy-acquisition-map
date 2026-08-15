import { loadAcquisitionData } from "@/lib/store";

export const dynamic = "force-dynamic";

function csvCell(value: unknown) {
  const text = value == null ? "" : String(value).replace(/\r?\n|\r/g, " ");
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET() {
  const { properties } = await loadAcquisitionData();
  const headers = [
    "Name",
    "Area",
    "Location",
    "Status",
    "Kind",
    "Tenure",
    "Rooms",
    "Price",
    "Price value",
    "Price per room",
    "Fit score",
    "Confidence",
    "Source",
    "URL",
    "Notes"
  ];

  const rows = properties.map((property) => [
    property.name,
    property.areaName,
    property.location,
    property.status,
    property.kind,
    property.tenure,
    property.rooms,
    property.price,
    property.priceValue,
    property.pricePerRoom,
    property.fitScore,
    property.confidence,
    property.source,
    property.url,
    property.note
  ]);

  const csv = `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="jy-acquisition-properties.csv"`
    }
  });
}
