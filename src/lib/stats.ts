import type { AcquisitionSummary, Area, PropertyRecord } from "./types";

function average(values: number[]) {
  if (!values.length) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[mid];
  return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

export function buildSummary(areas: Area[], properties: PropertyRecord[]): AcquisitionSummary {
  const priced = properties.filter((property) => property.priceValue != null);
  const pricePerRoom = properties
    .map((property) => property.pricePerRoom)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  return {
    total: properties.length,
    live: properties.filter((property) => property.status === "live").length,
    underOffer: properties.filter((property) => property.status === "under_offer").length,
    unconfirmed: properties.filter((property) => property.status === "unconfirmed").length,
    priced: priced.length,
    averagePrice: average(priced.map((property) => property.priceValue ?? 0)),
    medianPricePerRoom: median(pricePerRoom),
    averageFitScore: average(properties.map((property) => property.fitScore)) ?? 0,
    areas: areas.map((area) => {
      const areaProperties = properties.filter((property) => property.areaId === area.id);
      return {
        id: area.id,
        name: area.name,
        shortName: area.shortName,
        color: area.color,
        count: areaProperties.length,
        live: areaProperties.filter((property) => property.status === "live").length,
        averageFitScore: average(areaProperties.map((property) => property.fitScore)) ?? 0
      };
    })
  };
}

export function formatCurrency(value: number | null | undefined) {
  if (value == null) return "POA";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0
  }).format(value);
}
