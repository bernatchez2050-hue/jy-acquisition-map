"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BedDouble,
  CheckCircle2,
  CircleDollarSign,
  Database,
  Download,
  ExternalLink,
  Filter,
  LocateFixed,
  MapPin,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Star,
  Sun,
  Table2,
  Target,
  X
} from "lucide-react";
import { formatCurrency } from "@/lib/stats";
import type {
  AcquisitionData,
  Area,
  Cluster,
  ListingStatus,
  PropertyKind,
  PropertyRecord,
  Tenure,
  WorkflowStage
} from "@/lib/types";

type Theme = "light" | "dark";
type SortMode = "fit" | "price" | "pricePerRoom" | "rooms";
type FocusTarget = { lat: number; lng: number; zoom: number; nonce: number };

type LeafletModule = typeof import("leaflet");
type LeafletMap = import("leaflet").Map;
type LeafletLayerGroup = import("leaflet").LayerGroup;
type LeafletTileLayer = import("leaflet").TileLayer;

const STATUS_LABELS: Record<ListingStatus, string> = {
  live: "Live",
  under_offer: "Under offer",
  unconfirmed: "Unverified"
};

const TENURE_LABELS: Record<Tenure, string> = {
  freehold: "Freehold",
  leasehold: "Leasehold",
  unknown: "Unknown"
};

const KIND_LABELS: Record<PropertyKind, string> = {
  hotel: "Hotel",
  inn: "Inn",
  pub: "Pub",
  guest_house: "Guest house",
  holiday_accommodation: "Holiday",
  hospitality: "Hospitality"
};

const STAGE_LABELS: Record<WorkflowStage, string> = {
  new: "New",
  reviewing: "Reviewing",
  broker_contacted: "Broker contacted",
  nda: "NDA",
  financials: "Financials",
  offer_candidate: "Offer candidate",
  rejected: "Rejected"
};

const WORKFLOW_STAGES: WorkflowStage[] = [
  "new",
  "reviewing",
  "broker_contacted",
  "nda",
  "financials",
  "offer_candidate",
  "rejected"
];

function useStoredState<T>(key: string, initialValue: T) {
  const [state, setState] = useState<T>(initialValue);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) setState(JSON.parse(raw) as T);
    } catch {
      // Local workflow state is best-effort; a corrupt value should not block the desk.
    } finally {
      setReady(true);
    }
  }, [key]);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(key, JSON.stringify(state));
  }, [key, ready, state]);

  return [state, setState] as const;
}

function compactCurrency(value: number | null | undefined) {
  if (value == null) return "POA";
  if (value >= 1_000_000) return `GBP ${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}m`;
  return `GBP ${Math.round(value / 1_000)}k`;
}

function numberFormat(value: number | null | undefined) {
  if (value == null) return "-";
  return new Intl.NumberFormat("en-GB").format(value);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toggleSetValue<T>(set: Set<T>, value: T) {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function parseBoundedNumber(value: string, min: number, max: number) {
  if (!value.trim()) return min;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return min;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

function scoreTone(score: number) {
  if (score >= 75) return "strong";
  if (score >= 58) return "watch";
  return "low";
}

function statusTone(status: ListingStatus) {
  if (status === "live") return "live";
  if (status === "under_offer") return "offer";
  return "quiet";
}

function sourceKey(source: string) {
  const clean = source.trim();
  if (!clean) return "Unknown";
  return clean
    .replace(/\s*,?\s*(Hotels|Pubs & Restaurants|Commercial|Limited|Ltd|LLP).*$/i, "")
    .replace(/\s*\(Rightmove\)$/i, "")
    .trim();
}

function buildPinIcon(L: LeafletModule, property: PropertyRecord, area: Area | undefined, selected: boolean) {
  const color = area?.color ?? "#01696f";
  const ring =
    property.status === "under_offer"
      ? '<circle cx="16" cy="15" r="12" fill="none" stroke="#d9822b" stroke-width="2.5"/>'
      : property.status === "unconfirmed"
        ? '<circle cx="16" cy="15" r="12" fill="none" stroke="#77736b" stroke-width="2" stroke-dasharray="3,2"/>'
        : "";
  const selectedRing = selected
    ? '<circle cx="16" cy="15" r="15" fill="none" stroke="#ffffff" stroke-width="2.5"/>'
    : "";
  const opacity = property.status === "unconfirmed" ? "0.58" : "1";
  const score = property.fitScore >= 80 ? "A" : property.fitScore >= 65 ? "B" : property.fitScore >= 50 ? "C" : "D";

  return L.divIcon({
    html: `<svg width="34" height="46" viewBox="-1 -1 34 46" xmlns="http://www.w3.org/2000/svg" style="opacity:${opacity};filter:drop-shadow(0 8px 10px rgba(0,0,0,.22))"><path d="M16 1C8.8 1 3 6.8 3 14c0 9.6 13 29 13 29s13-19.4 13-29C29 6.8 23.2 1 16 1Z" fill="${color}" stroke="white" stroke-width="1.7"/><circle cx="16" cy="15" r="8" fill="rgba(255,255,255,.22)"/>${ring}${selectedRing}<text x="16" y="19" text-anchor="middle" font-family="Arial,sans-serif" font-size="9" font-weight="900" fill="white">${score}</text></svg>`,
    iconSize: [34, 46],
    iconAnchor: [17, 45],
    popupAnchor: [0, -42],
    className: "acq-pin"
  });
}

function popupHtml(property: PropertyRecord, area: Area | undefined) {
  const color = area?.color ?? "#01696f";
  const note = property.note ? `<div class="map-popup-note">${escapeHtml(property.note)}</div>` : "";
  return `
    <div class="map-popup">
      <div class="map-popup-top" style="border-color:${color}">
        <span>${escapeHtml(area?.shortName ?? property.areaName)}</span>
        <strong>${escapeHtml(property.name)}</strong>
        <small>${escapeHtml(property.location)}</small>
      </div>
      <div class="map-popup-body">
        <div><span>Price</span><strong>${escapeHtml(property.price)}</strong></div>
        <div><span>Rooms</span><strong>${property.rooms ?? "-"}</strong></div>
        <div><span>Score</span><strong>${property.fitScore}</strong></div>
        ${note}
        <a href="${escapeHtml(property.url)}" target="_blank" rel="noopener">View listing</a>
      </div>
    </div>`;
}

function AcquisitionMap({
  areas,
  properties,
  selectedId,
  theme,
  focusTarget,
  onSelect
}: {
  areas: Area[];
  properties: PropertyRecord[];
  selectedId: string | null;
  theme: Theme;
  focusTarget: FocusTarget | null;
  onSelect: (id: string) => void;
}) {
  const mapNode = useRef<HTMLDivElement | null>(null);
  const leafletRef = useRef<LeafletModule | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerLayerRef = useRef<LeafletLayerGroup | null>(null);
  const circleLayerRef = useRef<LeafletLayerGroup | null>(null);
  const tilesRef = useRef<{ light: LeafletTileLayer; dark: LeafletTileLayer } | null>(null);
  const fittedOnceRef = useRef(false);
  const lastPropertySignatureRef = useRef("");
  const [mapReady, setMapReady] = useState(false);
  const propertySignature = useMemo(() => properties.map((property) => property.id).join("|"), [properties]);

  useEffect(() => {
    let disposed = false;

    import("leaflet").then((L) => {
      if (disposed || !mapNode.current || mapRef.current) return;

      leafletRef.current = L;
      const map = L.map(mapNode.current, {
        zoomControl: false,
        preferCanvas: true
      }).setView([55.55, -3.4], 6);

      const light = L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        attribution: "&copy; OpenStreetMap &copy; CARTO",
        subdomains: "abcd",
        maxZoom: 19
      });
      const dark = L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: "&copy; OpenStreetMap &copy; CARTO",
        subdomains: "abcd",
        maxZoom: 19
      });

      tilesRef.current = { light, dark };
      light.addTo(map);
      L.control.zoom({ position: "bottomleft" }).addTo(map);
      markerLayerRef.current = L.layerGroup().addTo(map);
      circleLayerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      requestAnimationFrame(() => {
        if (disposed) return;
        map.invalidateSize(true);
        setMapReady(true);
      });
    });

    return () => {
      disposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const tiles = tilesRef.current;
    if (!mapReady || !map || !tiles) return;

    if (theme === "dark") {
      if (map.hasLayer(tiles.light)) map.removeLayer(tiles.light);
      if (!map.hasLayer(tiles.dark)) tiles.dark.addTo(map);
    } else {
      if (map.hasLayer(tiles.dark)) map.removeLayer(tiles.dark);
      if (!map.hasLayer(tiles.light)) tiles.light.addTo(map);
    }
  }, [mapReady, theme]);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const markerLayer = markerLayerRef.current;
    const circleLayer = circleLayerRef.current;
    if (!mapReady || !L || !map || !markerLayer || !circleLayer) return;

    markerLayer.clearLayers();
    circleLayer.clearLayers();

    const visibleAreaIds = new Set(properties.map((property) => property.areaId));
    areas
      .filter((area) => visibleAreaIds.has(area.id))
      .forEach((area) => {
        const areaProperties = properties.filter((property) => property.areaId === area.id);
        if (!areaProperties.length) return;
        const avgLat = areaProperties.reduce((sum, property) => sum + property.lat, 0) / areaProperties.length;
        const avgLng = areaProperties.reduce((sum, property) => sum + property.lng, 0) / areaProperties.length;
        L.circle([avgLat, avgLng], {
          radius: Math.min(26000, Math.max(9000, areaProperties.length * 900)),
          color: area.color,
          fillColor: area.color,
          fillOpacity: 0.045,
          weight: 1.4,
          opacity: 0.34,
          dashArray: "8,6"
        }).addTo(circleLayer);
      });

    const bounds = L.latLngBounds([]);
    properties.forEach((property) => {
      const area = areas.find((item) => item.id === property.areaId);
      const marker = L.marker([property.lat, property.lng], {
        icon: buildPinIcon(L, property, area, property.id === selectedId)
      });
      marker.bindPopup(popupHtml(property, area), { maxWidth: 288, closeButton: false });
      marker.on("click", () => onSelect(property.id));
      marker.addTo(markerLayer);
      bounds.extend([property.lat, property.lng]);
    });

    if (properties.length && (!fittedOnceRef.current || lastPropertySignatureRef.current !== propertySignature)) {
      map.fitBounds(bounds, { padding: [36, 36], maxZoom: 8 });
      fittedOnceRef.current = true;
      lastPropertySignatureRef.current = propertySignature;
    }
  }, [areas, mapReady, onSelect, properties, propertySignature, selectedId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusTarget) return;
    map.flyTo([focusTarget.lat, focusTarget.lng], focusTarget.zoom, {
      duration: 0.9,
      easeLinearity: 0.25
    });
  }, [focusTarget]);

  useEffect(() => {
    const map = mapRef.current;
    const selected = properties.find((property) => property.id === selectedId);
    if (!map || !selected) return;
    map.flyTo([selected.lat, selected.lng], Math.max(map.getZoom(), 10), { duration: 0.6 });
  }, [properties, selectedId]);

  return <div ref={mapNode} className="map-canvas" aria-label="Acquisition property map" />;
}

function Metric({
  icon,
  label,
  value,
  tone
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className={`metric ${tone ?? ""}`}>
      <span className="metric-icon">{icon}</span>
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

function PropertyRow({
  property,
  area,
  selected,
  shortlisted,
  stage,
  onSelect,
  onToggleShortlist
}: {
  property: PropertyRecord;
  area: Area | undefined;
  selected: boolean;
  shortlisted: boolean;
  stage: WorkflowStage;
  onSelect: () => void;
  onToggleShortlist: () => void;
}) {
  return (
    <button className={`property-row ${selected ? "selected" : ""}`} onClick={onSelect} type="button">
      <span className="row-color" style={{ background: area?.color ?? "#01696f" }} />
      <span className="row-main">
        <span className="row-title">{property.name}</span>
        <span className="row-meta">
          {property.areaName} · {property.rooms ?? "-"} rooms · {compactCurrency(property.priceValue)}
        </span>
      </span>
      <span className={`score-chip ${scoreTone(property.fitScore)}`}>{property.fitScore}</span>
      <span className={`status-chip ${statusTone(property.status)}`}>{STATUS_LABELS[property.status]}</span>
      <span className="stage-chip">{STAGE_LABELS[stage]}</span>
      <span
        className={`star-button ${shortlisted ? "active" : ""}`}
        onClick={(event) => {
          event.stopPropagation();
          onToggleShortlist();
        }}
        role="button"
        tabIndex={0}
        aria-label={shortlisted ? "Remove from shortlist" : "Add to shortlist"}
      >
        <Star size={16} fill={shortlisted ? "currentColor" : "none"} />
      </span>
    </button>
  );
}

function DetailPanel({
  property,
  area,
  shortlisted,
  stage,
  note,
  onToggleShortlist,
  onStageChange,
  onNoteChange,
  onClose
}: {
  property: PropertyRecord | null;
  area: Area | undefined;
  shortlisted: boolean;
  stage: WorkflowStage;
  note: string;
  onToggleShortlist: () => void;
  onStageChange: (stage: WorkflowStage) => void;
  onNoteChange: (note: string) => void;
  onClose: () => void;
}) {
  if (!property) {
    return (
      <aside className="detail-panel empty">
        <Target size={24} />
        <strong>No property selected</strong>
        <span>Choose a marker or row to inspect the listing.</span>
      </aside>
    );
  }

  return (
    <aside className="detail-panel">
      <div className="detail-top" style={{ borderColor: area?.color ?? "#01696f" }}>
        <button className="icon-button ghost close-button" type="button" onClick={onClose} aria-label="Close details">
          <X size={17} />
        </button>
        <span className="eyebrow">{property.areaName}</span>
        <h2>{property.name}</h2>
        <p>{property.location}</p>
        <div className="detail-actions">
          <button className={`command-button ${shortlisted ? "active" : ""}`} type="button" onClick={onToggleShortlist}>
            <Star size={16} fill={shortlisted ? "currentColor" : "none"} />
            {shortlisted ? "Shortlisted" : "Shortlist"}
          </button>
          <a className="command-button" href={property.url} target="_blank" rel="noopener">
            <ExternalLink size={16} />
            Listing
          </a>
        </div>
      </div>

      <div className="detail-grid">
        <Metric icon={<CircleDollarSign size={17} />} label="Asking price" value={property.price} tone="price" />
        <Metric icon={<BedDouble size={17} />} label="Rooms" value={property.rooms == null ? "-" : String(property.rooms)} />
        <Metric icon={<CheckCircle2 size={17} />} label="Fit score" value={`${property.fitScore}/100`} tone={scoreTone(property.fitScore)} />
        <Metric icon={<Database size={17} />} label="Confidence" value={`${property.confidence}%`} />
      </div>

      <div className="detail-section">
        <h3>Listing</h3>
        <dl className="fact-list">
          <div>
            <dt>Type</dt>
            <dd>{property.type}</dd>
          </div>
          <div>
            <dt>Kind</dt>
            <dd>{KIND_LABELS[property.kind]}</dd>
          </div>
          <div>
            <dt>Tenure</dt>
            <dd>{TENURE_LABELS[property.tenure]}</dd>
          </div>
          <div>
            <dt>Price per room</dt>
            <dd>{formatCurrency(property.pricePerRoom)}</dd>
          </div>
          <div>
            <dt>Source</dt>
            <dd>{property.source}</dd>
          </div>
          <div>
            <dt>Last seen</dt>
            <dd>{property.lastSeen}</dd>
          </div>
        </dl>
      </div>

      <div className="detail-section">
        <h3>Broker Note</h3>
        <p className="source-note">{property.note || "No note supplied."}</p>
      </div>

      <div className="detail-section">
        <h3>Workflow</h3>
        <div className="stage-grid">
          {WORKFLOW_STAGES.map((item) => (
            <button
              className={item === stage ? "active" : ""}
              key={item}
              type="button"
              onClick={() => onStageChange(item)}
            >
              {STAGE_LABELS[item]}
            </button>
          ))}
        </div>
      </div>

      <div className="detail-section">
        <h3>Notes</h3>
        <textarea
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
          placeholder="Add diligence notes, call outcomes, or next action."
        />
      </div>
    </aside>
  );
}

function CompareStrip({
  properties,
  onSelect,
  onRemove
}: {
  properties: PropertyRecord[];
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  if (!properties.length) return null;

  return (
    <section className="compare-strip">
      <div className="compare-title">
        <Table2 size={17} />
        <strong>{properties.length} shortlisted</strong>
      </div>
      <div className="compare-table">
        {properties.map((property) => (
          <button key={property.id} type="button" className="compare-item" onClick={() => onSelect(property.id)}>
            <span>
              <strong>{property.name}</strong>
              <small>{property.areaName}</small>
            </span>
            <span>{compactCurrency(property.priceValue)}</span>
            <span>{property.rooms ?? "-"} rooms</span>
            <span>{property.fitScore}</span>
            <span
              className="remove-shortlist"
              onClick={(event) => {
                event.stopPropagation();
                onRemove(property.id);
              }}
              role="button"
              tabIndex={0}
              aria-label="Remove from shortlist"
            >
              <X size={14} />
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

export function AcquisitionDesk({ initialData }: { initialData: AcquisitionData }) {
  const [data, setData] = useState(initialData);
  const [theme, setTheme] = useStoredState<Theme>("jy-theme", "light");
  const [shortlist, setShortlist] = useStoredState<string[]>("jy-shortlist", []);
  const [workflow, setWorkflow] = useStoredState<Record<string, WorkflowStage>>("jy-workflow", {});
  const [notes, setNotes] = useStoredState<Record<string, string>>("jy-notes", {});
  const [query, setQuery] = useState("");
  const [activeAreaIds, setActiveAreaIds] = useState(() => new Set(initialData.areas.map((area) => area.id)));
  const [statuses, setStatuses] = useState(() => new Set<ListingStatus>(["live", "under_offer", "unconfirmed"]));
  const [tenures, setTenures] = useState(() => new Set<Tenure>(["freehold", "leasehold", "unknown"]));
  const [kind, setKind] = useState<PropertyKind | "all">("all");
  const [maxPrice, setMaxPrice] = useState(5_000_000);
  const [minRooms, setMinRooms] = useState(0);
  const [minScore, setMinScore] = useState(0);
  const [sortMode, setSortMode] = useState<SortMode>("fit");
  const [selectedId, setSelectedId] = useState<string | null>(initialData.properties[0]?.id ?? null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [focusTarget, setFocusTarget] = useState<FocusTarget | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const sourceOptions = useMemo(() => {
    const counts = new Map<string, number>();
    data.properties.forEach((property) => {
      const key = sourceKey(property.source);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [data.properties]);

  const filteredProperties = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = data.properties.filter((property) => {
      if (!activeAreaIds.has(property.areaId)) return false;
      if (!statuses.has(property.status)) return false;
      if (!tenures.has(property.tenure)) return false;
      if (kind !== "all" && property.kind !== kind) return false;
      if (property.priceValue != null && property.priceValue > maxPrice) return false;
      if ((property.rooms ?? 0) < minRooms) return false;
      if (property.fitScore < minScore) return false;
      if (!needle) return true;

      return [
        property.name,
        property.areaName,
        property.location,
        property.source,
        property.type,
        property.note
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });

    return filtered.sort((a, b) => {
      if (sortMode === "price") return (a.priceValue ?? Number.MAX_SAFE_INTEGER) - (b.priceValue ?? Number.MAX_SAFE_INTEGER);
      if (sortMode === "pricePerRoom") {
        return (a.pricePerRoom ?? Number.MAX_SAFE_INTEGER) - (b.pricePerRoom ?? Number.MAX_SAFE_INTEGER);
      }
      if (sortMode === "rooms") return (b.rooms ?? 0) - (a.rooms ?? 0);
      return b.fitScore - a.fitScore;
    });
  }, [activeAreaIds, data.properties, kind, maxPrice, minRooms, minScore, query, sortMode, statuses, tenures]);

  const selectedProperty = useMemo(
    () => filteredProperties.find((property) => property.id === selectedId) ?? filteredProperties[0] ?? null,
    [filteredProperties, selectedId]
  );

  const selectedArea = selectedProperty ? data.areas.find((area) => area.id === selectedProperty.areaId) : undefined;
  const shortlistedProperties = shortlist
    .map((id) => data.properties.find((property) => property.id === id))
    .filter((property): property is PropertyRecord => Boolean(property));

  const filteredStats = useMemo(() => {
    const priced = filteredProperties.filter((property) => property.priceValue != null);
    const avgScore = filteredProperties.length
      ? Math.round(filteredProperties.reduce((sum, property) => sum + property.fitScore, 0) / filteredProperties.length)
      : 0;
    const live = filteredProperties.filter((property) => property.status === "live").length;
    return { priced: priced.length, avgScore, live };
  }, [filteredProperties]);

  function toggleShortlist(id: string) {
    setShortlist((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function clearFilters() {
    setQuery("");
    setActiveAreaIds(new Set(data.areas.map((area) => area.id)));
    setStatuses(new Set<ListingStatus>(["live", "under_offer", "unconfirmed"]));
    setTenures(new Set<Tenure>(["freehold", "leasehold", "unknown"]));
    setKind("all");
    setMaxPrice(5_000_000);
    setMinRooms(0);
    setMinScore(0);
    setSortMode("fit");
  }

  async function reloadData() {
    setLoading(true);
    try {
      const response = await fetch("/api/properties", { cache: "no-store" });
      if (!response.ok) throw new Error("Could not load properties");
      setData((await response.json()) as AcquisitionData);
      setRefreshMessage("Data loaded.");
    } catch (error) {
      setRefreshMessage(error instanceof Error ? error.message : "Data refresh failed.");
    } finally {
      setLoading(false);
    }
  }

  async function triggerRefresh() {
    setLoading(true);
    try {
      const response = await fetch("/api/refresh", { method: "POST" });
      const body = (await response.json()) as { message?: string };
      setRefreshMessage(body.message ?? "Refresh requested.");
      await reloadData();
    } catch (error) {
      setRefreshMessage(error instanceof Error ? error.message : "Refresh request failed.");
    } finally {
      setLoading(false);
    }
  }

  function focusCluster(cluster: Cluster) {
    setFocusTarget({ lat: cluster.lat, lng: cluster.lng, zoom: cluster.zoom, nonce: Date.now() });
  }

  const currentStage = selectedProperty ? workflow[selectedProperty.id] ?? "new" : "new";
  const currentNote = selectedProperty ? notes[selectedProperty.id] ?? "" : "";

  return (
    <main className="desk-shell">
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark">JY</div>
          <div>
            <h1>JY Hotels Acquisition Map</h1>
            <span>
              {data.summary.total} properties · refreshed {data.metadata.refreshedAt}
            </span>
          </div>
        </div>

        <div className="topbar-metrics">
          <Metric icon={<MapPin size={16} />} label="Shown" value={String(filteredProperties.length)} />
          <Metric icon={<CheckCircle2 size={16} />} label="Live" value={String(filteredStats.live)} tone="strong" />
          <Metric icon={<CircleDollarSign size={16} />} label="Median p/rm" value={compactCurrency(data.summary.medianPricePerRoom)} />
          <Metric icon={<Target size={16} />} label="Avg score" value={String(filteredStats.avgScore)} />
        </div>

        <div className="topbar-actions">
          <button className="icon-button" type="button" onClick={() => setSidebarOpen((value) => !value)} aria-label="Toggle filters">
            {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
          </button>
          <button className="icon-button" type="button" onClick={triggerRefresh} aria-label="Refresh data">
            <RefreshCw size={18} className={loading ? "spin" : ""} />
          </button>
          <a className="icon-button" href="/api/export" aria-label="Download CSV">
            <Download size={18} />
          </a>
          <button className="icon-button" type="button" onClick={() => setTheme(theme === "light" ? "dark" : "light")} aria-label="Toggle theme">
            {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </div>
      </header>

      <div className="desk-body">
        <aside className={`filter-panel ${sidebarOpen ? "open" : "closed"}`}>
          <div className="panel-scroll">
            <section className="filter-section search-section">
              <label className="search-box">
                <Search size={17} />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, place, broker, note" />
              </label>
              <button className="clear-button" type="button" onClick={clearFilters}>
                <X size={15} />
                Clear
              </button>
            </section>

            <section className="filter-section">
              <div className="section-title">
                <SlidersHorizontal size={15} />
                <span>Thresholds</span>
              </div>
              <label className="range-label">
                <span>Max price</span>
                <strong>{compactCurrency(maxPrice)}</strong>
              </label>
              <input
                min={150_000}
                max={5_000_000}
                step={50_000}
                type="range"
                value={maxPrice}
                onChange={(event) => setMaxPrice(Number(event.target.value))}
              />
              <div className="control-row">
                <label>
                  <span>Min rooms</span>
                  <input
                    inputMode="numeric"
                    min={0}
                    max={40}
                    placeholder="0"
                    type="number"
                    value={minRooms === 0 ? "" : String(minRooms)}
                    onChange={(event) => setMinRooms(parseBoundedNumber(event.target.value, 0, 40))}
                  />
                </label>
                <label>
                  <span>Min score</span>
                  <input
                    inputMode="numeric"
                    min={0}
                    max={100}
                    placeholder="0"
                    type="number"
                    value={minScore === 0 ? "" : String(minScore)}
                    onChange={(event) => setMinScore(parseBoundedNumber(event.target.value, 0, 100))}
                  />
                </label>
              </div>
              <label className="select-label">
                <span>Sort</span>
                <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
                  <option value="fit">Fit score</option>
                  <option value="price">Price</option>
                  <option value="pricePerRoom">Price per room</option>
                  <option value="rooms">Room count</option>
                </select>
              </label>
            </section>

            <section className="filter-section">
              <div className="section-title">
                <Filter size={15} />
                <span>Status</span>
              </div>
              <div className="chip-grid three">
                {(Object.keys(STATUS_LABELS) as ListingStatus[]).map((status) => (
                  <button
                    className={statuses.has(status) ? "active" : ""}
                    key={status}
                    type="button"
                    onClick={() => setStatuses((current) => toggleSetValue(current, status))}
                  >
                    {STATUS_LABELS[status]}
                  </button>
                ))}
              </div>
            </section>

            <section className="filter-section">
              <div className="section-title">
                <Database size={15} />
                <span>Tenure</span>
              </div>
              <div className="chip-grid three">
                {(Object.keys(TENURE_LABELS) as Tenure[]).map((tenure) => (
                  <button
                    className={tenures.has(tenure) ? "active" : ""}
                    key={tenure}
                    type="button"
                    onClick={() => setTenures((current) => toggleSetValue(current, tenure))}
                  >
                    {TENURE_LABELS[tenure]}
                  </button>
                ))}
              </div>
            </section>

            <section className="filter-section">
              <div className="section-title">
                <BedDouble size={15} />
                <span>Asset Type</span>
              </div>
              <select value={kind} onChange={(event) => setKind(event.target.value as PropertyKind | "all")}>
                <option value="all">All asset types</option>
                {(Object.keys(KIND_LABELS) as PropertyKind[]).map((item) => (
                  <option value={item} key={item}>
                    {KIND_LABELS[item]}
                  </option>
                ))}
              </select>
            </section>

            <section className="filter-section">
              <div className="section-title">
                <MapPin size={15} />
                <span>Areas</span>
              </div>
              <div className="area-list">
                {data.summary.areas.map((area) => (
                  <button
                    className={activeAreaIds.has(area.id) ? "active" : ""}
                    key={area.id}
                    type="button"
                    onClick={() => setActiveAreaIds((current) => toggleSetValue(current, area.id))}
                  >
                    <span className="area-dot" style={{ background: area.color }} />
                    <span>{area.name}</span>
                    <strong>{area.count}</strong>
                  </button>
                ))}
              </div>
            </section>

            <section className="filter-section">
              <div className="section-title">
                <LocateFixed size={15} />
                <span>Clusters</span>
              </div>
              <div className="cluster-list">
                {data.clusters.map((cluster) => (
                  <button key={cluster.id} className={cluster.priority} type="button" onClick={() => focusCluster(cluster)}>
                    <strong>{cluster.title.replace("⭐ ", "")}</strong>
                    <span>{cluster.detail}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="filter-section sources-section">
              <div className="section-title">
                <Database size={15} />
                <span>Top Sources</span>
              </div>
              {sourceOptions.map(([source, count]) => (
                <div className="source-row" key={source}>
                  <span>{source}</span>
                  <strong>{count}</strong>
                </div>
              ))}
            </section>
          </div>
        </aside>

        <section className="workspace">
          <div className="map-stage">
            <AcquisitionMap
              areas={data.areas}
              properties={filteredProperties}
              selectedId={selectedProperty?.id ?? null}
              theme={theme}
              focusTarget={focusTarget}
              onSelect={setSelectedId}
            />
            {refreshMessage && <div className="toast">{refreshMessage}</div>}
          </div>

          <section className="list-panel">
            <div className="list-head">
              <div>
                <span className="eyebrow">Pipeline</span>
                <h2>{filteredProperties.length} properties</h2>
              </div>
              <span>{filteredStats.priced} priced</span>
            </div>
            <div className="property-list">
              {filteredProperties.map((property) => (
                <PropertyRow
                  area={data.areas.find((area) => area.id === property.areaId)}
                  key={property.id}
                  property={property}
                  selected={selectedProperty?.id === property.id}
                  shortlisted={shortlist.includes(property.id)}
                  stage={workflow[property.id] ?? "new"}
                  onSelect={() => setSelectedId(property.id)}
                  onToggleShortlist={() => toggleShortlist(property.id)}
                />
              ))}
            </div>
          </section>
        </section>

        <DetailPanel
          property={selectedProperty}
          area={selectedArea}
          shortlisted={selectedProperty ? shortlist.includes(selectedProperty.id) : false}
          stage={currentStage}
          note={currentNote}
          onToggleShortlist={() => selectedProperty && toggleShortlist(selectedProperty.id)}
          onStageChange={(stage) =>
            selectedProperty &&
            setWorkflow((current) => ({
              ...current,
              [selectedProperty.id]: stage
            }))
          }
          onNoteChange={(note) =>
            selectedProperty &&
            setNotes((current) => ({
              ...current,
              [selectedProperty.id]: note
            }))
          }
          onClose={() => setSelectedId(null)}
        />
      </div>

      <CompareStrip
        properties={shortlistedProperties}
        onSelect={setSelectedId}
        onRemove={(id) => setShortlist((current) => current.filter((item) => item !== id))}
      />
    </main>
  );
}
