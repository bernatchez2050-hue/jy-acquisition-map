export type ListingStatus = "live" | "under_offer" | "unconfirmed";

export type Tenure = "freehold" | "leasehold" | "unknown";

export type PropertyKind =
  | "hotel"
  | "inn"
  | "pub"
  | "guest_house"
  | "holiday_accommodation"
  | "hospitality";

export type WorkflowStage =
  | "new"
  | "reviewing"
  | "broker_contacted"
  | "nda"
  | "financials"
  | "offer_candidate"
  | "rejected";

export type Area = {
  id: number;
  slug: string;
  name: string;
  shortName: string;
  color: string;
};

export type Cluster = {
  id: string;
  title: string;
  properties: string;
  detail: string;
  lat: number;
  lng: number;
  zoom: number;
  priority: "high" | "standard";
};

export type PropertyRecord = {
  id: string;
  sourceIndex: number;
  name: string;
  areaId: number;
  areaName: string;
  areaSlug: string;
  lat: number;
  lng: number;
  kind: PropertyKind;
  type: string;
  tenure: Tenure;
  rooms: number | null;
  price: string;
  priceValue: number | null;
  pricePerRoom: number | null;
  source: string;
  location: string;
  url: string;
  status: ListingStatus;
  note: string;
  lastSeen: string;
  fitScore: number;
  confidence: number;
};

export type AcquisitionMetadata = {
  title: string;
  sourceUrl: string;
  refreshedAt: string;
  extractedAt: string;
  propertyCount: number;
};

export type AcquisitionSummary = {
  total: number;
  live: number;
  underOffer: number;
  unconfirmed: number;
  priced: number;
  averagePrice: number | null;
  medianPricePerRoom: number | null;
  averageFitScore: number;
  areas: Array<{
    id: number;
    name: string;
    shortName: string;
    color: string;
    count: number;
    live: number;
    averageFitScore: number;
  }>;
};

export type AcquisitionData = {
  metadata: AcquisitionMetadata;
  areas: Area[];
  clusters: Cluster[];
  properties: PropertyRecord[];
  summary: AcquisitionSummary;
};

export type DiscoveryCandidate = Omit<PropertyRecord, "sourceIndex" | "lastSeen"> & {
  discoveredAt: string;
  lastSeenAt: string;
  provider: string;
  query: string;
  reviewStatus: "new" | "promoted" | "ignored";
  promotedPropertyId: string | null;
  raw: Record<string, unknown>;
};

export type RefreshRun = {
  id: number;
  startedAt: string;
  finishedAt: string | null;
  status: "queued" | "running" | "success" | "error";
  source: string | null;
  provider: string | null;
  queriesRun: number;
  candidatesFound: number;
  candidatesNew: number;
  propertiesImported: number;
  message: string | null;
};
