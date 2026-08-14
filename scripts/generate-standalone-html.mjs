import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const seedPath = path.join(root, "src", "data", "seed.json");
const outputDir = path.join(root, "outputs");
const htmlPath = path.join(outputDir, "jy-acquisition-cockpit.html");
const dataPath = path.join(outputDir, "jy-acquisition-data.json");

const seed = JSON.parse(fs.readFileSync(seedPath, "utf8"));
const seedJson = JSON.stringify(seed).replace(/</g, "\\u003c");

const html = String.raw`<!doctype html>
<html lang="en" data-theme="light">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>JY Hotels Acquisition Cockpit</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
  <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css">
  <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css">
  <style>
    :root {
      --bg: #f4f1ea;
      --panel: #fbfaf6;
      --panel-2: #ffffff;
      --ink: #24211b;
      --muted: #716b60;
      --faint: #9d9587;
      --line: #d9d1c4;
      --line-strong: #b9afa0;
      --teal: #006b70;
      --teal-2: #2e8b88;
      --green: #4d7a4e;
      --amber: #c47a2d;
      --red: #a43f4d;
      --violet: #6c5b98;
      --shadow: 0 16px 38px rgba(34, 28, 18, 0.16);
      --soft-shadow: 0 8px 20px rgba(34, 28, 18, 0.08);
    }
    :root[data-theme="dark"] {
      --bg: #161615;
      --panel: #1e1d1a;
      --panel-2: #26241f;
      --ink: #f1ece2;
      --muted: #aaa195;
      --faint: #7d7568;
      --line: #3a362f;
      --line-strong: #5b554b;
      --teal: #5bbab6;
      --teal-2: #88d2ca;
      --green: #83bd7b;
      --amber: #e3a85d;
      --red: #d77381;
      --violet: #aaa0d6;
      --shadow: 0 16px 38px rgba(0, 0, 0, 0.36);
      --soft-shadow: 0 8px 20px rgba(0, 0, 0, 0.24);
    }
    * { box-sizing: border-box; }
    html, body { height: 100%; margin: 0; }
    body {
      background: var(--bg);
      color: var(--ink);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      letter-spacing: 0;
      overflow: hidden;
    }
    button, input, select, textarea { font: inherit; }
    button, a { -webkit-tap-highlight-color: transparent; }
    button { cursor: pointer; }
    a { color: inherit; }
    .app { display: flex; flex-direction: column; height: 100vh; min-height: 0; }
    .topbar {
      align-items: center;
      background: var(--panel);
      border-bottom: 1px solid var(--line);
      display: grid;
      flex: 0 0 auto;
      gap: 12px;
      grid-template-columns: minmax(260px, 1fr) auto auto;
      min-height: 70px;
      padding: 9px 12px;
      position: relative;
      z-index: 30;
    }
    .brand { align-items: center; display: flex; gap: 11px; min-width: 0; }
    .brand-mark {
      align-items: center;
      background: var(--teal);
      border-radius: 8px;
      color: #fff;
      display: flex;
      flex: 0 0 auto;
      font-weight: 900;
      height: 40px;
      justify-content: center;
      width: 40px;
    }
    h1, h2, h3, p { margin: 0; }
    h1 { font-size: 18px; line-height: 1.15; }
    .brand small { color: var(--muted); display: block; font-size: 12px; margin-top: 2px; }
    .metrics { display: grid; gap: 7px; grid-template-columns: repeat(5, minmax(86px, 1fr)); }
    .metric {
      background: var(--panel-2);
      border: 1px solid var(--line);
      border-radius: 8px;
      min-height: 48px;
      padding: 7px 9px;
    }
    .metric strong { display: block; font-size: 16px; line-height: 1.1; }
    .metric span { color: var(--muted); display: block; font-size: 11px; margin-top: 4px; }
    .actions { display: flex; gap: 7px; justify-self: end; }
    .icon-btn, .text-btn, .chip-btn, .seg-btn {
      align-items: center;
      background: var(--panel-2);
      border: 1px solid var(--line);
      border-radius: 8px;
      color: var(--ink);
      display: inline-flex;
      gap: 7px;
      justify-content: center;
      min-height: 38px;
      text-decoration: none;
      transition: border-color 150ms ease, transform 150ms ease, background 150ms ease;
    }
    .icon-btn { width: 38px; }
    .text-btn { font-size: 12px; font-weight: 800; padding: 0 10px; }
    .icon-btn:hover, .text-btn:hover, .chip-btn:hover, .seg-btn:hover { border-color: var(--line-strong); transform: translateY(-1px); }
    .body {
      display: grid;
      flex: 1 1 auto;
      grid-template-columns: 330px minmax(0, 1fr) 382px;
      min-height: 0;
    }
    .sidebar, .details {
      background: var(--panel);
      min-height: 0;
      overflow-y: auto;
    }
    .sidebar { border-right: 1px solid var(--line); padding: 12px; }
    .details { border-left: 1px solid var(--line); display: flex; flex-direction: column; }
    .section { border-bottom: 1px solid var(--line); padding: 12px 0; }
    .section:first-child { padding-top: 0; }
    .section:last-child { border-bottom: 0; }
    .section-title {
      align-items: center;
      color: var(--muted);
      display: flex;
      font-size: 11px;
      font-weight: 900;
      gap: 7px;
      letter-spacing: 0.08em;
      margin-bottom: 9px;
      text-transform: uppercase;
    }
    .search {
      align-items: center;
      background: var(--panel-2);
      border: 1px solid var(--line);
      border-radius: 8px;
      display: flex;
      gap: 8px;
      min-height: 40px;
      padding: 0 10px;
    }
    .search input {
      background: transparent;
      border: 0;
      color: var(--ink);
      min-width: 0;
      outline: 0;
      width: 100%;
    }
    .grid-2 { display: grid; gap: 8px; grid-template-columns: 1fr 1fr; }
    .grid-3 { display: grid; gap: 7px; grid-template-columns: repeat(3, minmax(0, 1fr)); }
    label.field { color: var(--muted); display: grid; font-size: 12px; gap: 5px; }
    .range-row { align-items: center; color: var(--muted); display: flex; font-size: 12px; justify-content: space-between; margin: 8px 0 4px; }
    .range-row strong { color: var(--ink); }
    input[type="range"] { accent-color: var(--teal); width: 100%; }
    input[type="number"], input[type="text"], select, textarea {
      background: var(--panel-2);
      border: 1px solid var(--line);
      border-radius: 8px;
      color: var(--ink);
      min-height: 36px;
      outline: 0;
      padding: 7px 9px;
      width: 100%;
    }
    textarea { line-height: 1.4; min-height: 96px; resize: vertical; }
    .chip-btn {
      color: var(--muted);
      font-size: 12px;
      min-height: 34px;
      padding: 6px 7px;
    }
    .chip-btn.active, .seg-btn.active {
      background: color-mix(in srgb, var(--teal) 13%, var(--panel-2));
      border-color: var(--teal);
      color: var(--ink);
      font-weight: 800;
    }
    .area-list, .cluster-list, .source-list { display: grid; gap: 6px; }
    .area-row, .cluster-row, .source-row {
      background: var(--panel-2);
      border: 1px solid var(--line);
      border-radius: 8px;
      color: var(--ink);
      min-height: 36px;
      padding: 7px 9px;
      text-align: left;
      width: 100%;
    }
    .area-row { align-items: center; display: grid; gap: 7px; grid-template-columns: auto minmax(0, 1fr) auto; }
    .area-row:not(.active) { opacity: 0.48; }
    .dot { border-radius: 999px; display: inline-block; height: 10px; width: 10px; }
    .area-row span:nth-child(2), .cluster-row strong, .source-row span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .cluster-row { display: grid; gap: 3px; }
    .cluster-row.high { border-color: color-mix(in srgb, var(--teal) 50%, var(--line)); }
    .cluster-row span { color: var(--muted); font-size: 11px; }
    .source-row { align-items: center; display: grid; gap: 8px; grid-template-columns: minmax(0, 1fr) auto auto; }
    .source-row small { color: var(--muted); }
    .workspace { display: grid; grid-template-rows: minmax(320px, 1fr) 295px; min-height: 0; }
    .map-wrap { min-height: 0; position: relative; }
    #map { height: 100%; min-height: 320px; width: 100%; }
    .map-toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
      left: 12px;
      position: absolute;
      top: 12px;
      z-index: 800;
    }
    .map-toolbar .seg-btn { background: var(--panel); box-shadow: var(--soft-shadow); font-size: 12px; min-height: 34px; padding: 0 9px; }
    .toast {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      bottom: 12px;
      box-shadow: var(--shadow);
      color: var(--ink);
      display: none;
      left: 12px;
      max-width: 480px;
      padding: 10px 12px;
      position: absolute;
      z-index: 900;
    }
    .toast.show { display: block; }
    .leaflet-container { background: var(--bg); font: inherit; }
    .leaflet-popup-content-wrapper { background: var(--panel); box-shadow: var(--shadow); color: var(--ink); padding: 0; }
    .leaflet-popup-content { margin: 0; width: 280px !important; }
    .leaflet-popup-tip { background: var(--panel); }
    .popup { overflow: hidden; }
    .popup-head { border-left: 5px solid var(--teal); padding: 10px 12px; }
    .popup-head span { color: var(--muted); display: block; font-size: 10px; font-weight: 900; letter-spacing: 0.08em; text-transform: uppercase; }
    .popup-head strong { display: block; font-size: 14px; margin-top: 3px; }
    .popup-head small { color: var(--muted); display: block; margin-top: 4px; }
    .popup-body { border-top: 1px solid var(--line); display: grid; gap: 6px; padding: 10px 12px 12px; }
    .popup-body div { display: flex; justify-content: space-between; }
    .popup-body span { color: var(--muted); }
    .popup-body a { background: var(--teal); border-radius: 7px; color: #fff; display: block; font-size: 12px; font-weight: 900; padding: 7px 8px; text-align: center; text-decoration: none; }
    .list-panel {
      background: var(--panel);
      border-top: 1px solid var(--line);
      display: flex;
      flex-direction: column;
      min-height: 0;
    }
    .list-head {
      align-items: center;
      border-bottom: 1px solid var(--line);
      display: flex;
      justify-content: space-between;
      padding: 10px 12px;
    }
    .list-head h2 { font-size: 16px; }
    .list-head small, .subtle { color: var(--muted); font-size: 12px; }
    .list { display: grid; gap: 6px; overflow-y: auto; padding: 9px; }
    .property-row {
      align-items: center;
      background: var(--panel-2);
      border: 1px solid var(--line);
      border-radius: 8px;
      color: var(--ink);
      display: grid;
      gap: 8px;
      grid-template-columns: auto minmax(170px, 1fr) auto auto auto auto;
      min-height: 52px;
      padding: 8px;
      text-align: left;
      width: 100%;
    }
    .property-row.selected { border-color: var(--teal); box-shadow: inset 0 0 0 1px var(--teal); }
    .row-main { display: grid; gap: 3px; min-width: 0; }
    .row-main strong, .row-main small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .row-main small { color: var(--muted); }
    .pill {
      border: 1px solid var(--line);
      border-radius: 999px;
      font-size: 11px;
      font-weight: 900;
      min-width: 38px;
      padding: 4px 8px;
      text-align: center;
    }
    .pill.green { color: var(--green); }
    .pill.amber { color: var(--amber); }
    .pill.red { color: var(--red); }
    .pill.muted { color: var(--muted); }
    .star { color: var(--faint); display: inline-flex; justify-content: center; width: 28px; }
    .star.active { color: var(--amber); }
    .detail-head {
      border-top: 5px solid var(--teal);
      padding: 16px 15px 12px;
      position: relative;
    }
    .detail-head h2 { font-size: 23px; line-height: 1.08; margin-top: 5px; padding-right: 34px; }
    .detail-head p { color: var(--muted); font-size: 13px; margin-top: 8px; }
    .eyebrow { color: var(--muted); font-size: 11px; font-weight: 900; letter-spacing: 0.08em; text-transform: uppercase; }
    .detail-actions { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 12px; }
    .detail-body { display: grid; gap: 0; }
    .stat-grid { display: grid; gap: 8px; grid-template-columns: 1fr 1fr; padding: 12px; }
    .detail-section { border-top: 1px solid var(--line); padding: 13px 15px; }
    .detail-section h3 { font-size: 13px; margin-bottom: 8px; }
    .facts { display: grid; gap: 8px; margin: 0; }
    .facts div { display: grid; gap: 10px; grid-template-columns: 104px minmax(0, 1fr); }
    .facts dt { color: var(--muted); font-size: 12px; }
    .facts dd { font-size: 12px; font-weight: 750; margin: 0; overflow-wrap: anywhere; }
    .stage-grid { display: grid; gap: 7px; grid-template-columns: 1fr 1fr; }
    .change-list { display: grid; gap: 7px; max-height: 190px; overflow-y: auto; }
    .change-item {
      background: var(--panel-2);
      border: 1px solid var(--line);
      border-radius: 8px;
      display: grid;
      gap: 3px;
      padding: 8px;
    }
    .change-item strong { font-size: 12px; }
    .change-item small { color: var(--muted); line-height: 1.35; }
    .compare {
      background: var(--panel);
      border-top: 1px solid var(--line);
      box-shadow: var(--soft-shadow);
      display: grid;
      flex: 0 0 auto;
      grid-template-columns: auto minmax(0, 1fr);
      min-height: 78px;
      position: relative;
      z-index: 40;
    }
    .compare-title { align-items: center; border-right: 1px solid var(--line); display: flex; gap: 8px; padding: 0 14px; white-space: nowrap; }
    .compare-list { display: flex; gap: 8px; overflow-x: auto; padding: 10px; }
    .compare-card {
      background: var(--panel-2);
      border: 1px solid var(--line);
      border-radius: 8px;
      color: var(--ink);
      display: grid;
      flex: 0 0 390px;
      gap: 8px;
      grid-template-columns: minmax(0, 1fr) 76px 64px 58px 26px;
      min-height: 54px;
      padding: 8px;
      text-align: left;
    }
    .compare-card strong, .compare-card small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .compare-card small { color: var(--muted); font-size: 11px; }
    .empty-state { align-items: center; color: var(--muted); display: flex; flex: 1 1 auto; justify-content: center; padding: 24px; text-align: center; }
    .hidden { display: none !important; }
    @media (max-width: 1280px) {
      .topbar { grid-template-columns: minmax(260px, 1fr) auto; }
      .metrics { display: none; }
      .body { grid-template-columns: 310px minmax(0, 1fr) 340px; }
      .sidebar { padding: 10px; }
    }
    @media (max-width: 980px) {
      body { overflow: auto; }
      .app { height: auto; min-height: 100vh; }
      .topbar { grid-template-columns: minmax(0, 1fr); position: sticky; top: 0; }
      .actions { justify-self: stretch; overflow-x: auto; }
      .body { display: block; }
      .sidebar, .details { border-left: 0; border-right: 0; max-height: none; overflow: visible; }
      .workspace { display: block; }
      .map-wrap { height: 58vh; min-height: 380px; }
      .list-panel { height: 420px; }
      .compare { grid-template-columns: 1fr; }
      .compare-title { border-bottom: 1px solid var(--line); border-right: 0; min-height: 42px; }
    }
    @media (max-width: 640px) {
      h1 { font-size: 16px; }
      .grid-2, .grid-3, .stat-grid, .stage-grid { grid-template-columns: 1fr; }
      .property-row { grid-template-columns: auto minmax(0, 1fr) auto auto; }
      .property-row .status, .property-row .stage { display: none; }
      .compare-card { flex-basis: 320px; grid-template-columns: minmax(0, 1fr) 70px 52px 24px; }
      .compare-card span:nth-child(3) { display: none; }
    }
    @media print {
      body { background: #fff; color: #000; overflow: visible; }
      .topbar, .sidebar, .map-wrap, .list-panel, .details, .compare { display: none !important; }
      #print-memo { display: block !important; padding: 24px; }
    }
  </style>
</head>
<body>
  <div class="app">
    <header class="topbar">
      <div class="brand">
        <div class="brand-mark">JY</div>
        <div>
          <h1>JY Hotels Acquisition Cockpit</h1>
          <small id="subtitle">Loading property snapshot</small>
        </div>
      </div>
      <div class="metrics" id="metrics"></div>
      <div class="actions">
        <button class="text-btn" id="refreshBtn" title="Reload jy-acquisition-data.json if it is hosted next to this HTML">Refresh data</button>
        <button class="text-btn" id="importBtn">Import</button>
        <button class="text-btn" id="exportBtn">Export CSV</button>
        <button class="text-btn" id="memoBtn">Memo/PDF</button>
        <button class="text-btn" id="shareBtn">Share</button>
        <button class="icon-btn" id="themeBtn" title="Toggle theme">◐</button>
      </div>
    </header>

    <div class="body">
      <aside class="sidebar">
        <section class="section">
          <label class="search">
            <span>⌕</span>
            <input id="searchInput" placeholder="Search name, place, broker, note">
          </label>
        </section>

        <section class="section">
          <div class="section-title">Thresholds</div>
          <div class="range-row"><span>Max price</span><strong id="maxPriceLabel"></strong></div>
          <input id="maxPriceInput" type="range" min="150000" max="5000000" step="50000">
          <div class="range-row"><span>Max price per room</span><strong id="maxPprLabel"></strong></div>
          <input id="maxPprInput" type="range" min="25000" max="400000" step="5000">
          <div class="range-row"><span>Distance to target</span><strong id="distanceLabel"></strong></div>
          <input id="distanceInput" type="range" min="5" max="250" step="5">
          <div class="grid-2" style="margin-top: 9px;">
            <label class="field">Min rooms<input id="minRoomsInput" type="number" min="0" max="80"></label>
            <label class="field">Min score<input id="minScoreInput" type="number" min="0" max="100"></label>
          </div>
          <div class="grid-2" style="margin-top: 9px;">
            <label class="field">Asset type<select id="kindSelect"></select></label>
            <label class="field">Target town<select id="targetSelect"></select></label>
          </div>
          <div class="grid-2" style="margin-top: 9px;">
            <label class="field">Source<select id="sourceSelect"></select></label>
            <label class="field">Sort<select id="sortSelect"></select></label>
          </div>
        </section>

        <section class="section">
          <div class="section-title">Status</div>
          <div class="grid-3" id="statusChips"></div>
        </section>

        <section class="section">
          <div class="section-title">Tenure</div>
          <div class="grid-3" id="tenureChips"></div>
        </section>

        <section class="section">
          <div class="section-title">Special Filters</div>
          <div class="grid-2">
            <button class="chip-btn" id="financialsBtn">EBITDA / profit</button>
            <button class="chip-btn" id="verifyBtn">Needs verification</button>
          </div>
        </section>

        <section class="section">
          <div class="section-title">Regions</div>
          <div class="area-list" id="areaList"></div>
        </section>

        <section class="section">
          <div class="section-title">Portfolio Clusters</div>
          <div class="cluster-list" id="clusterList"></div>
        </section>

        <section class="section">
          <div class="section-title">Broker / Source Management</div>
          <div class="source-list" id="sourceList"></div>
        </section>
      </aside>

      <main class="workspace">
        <section class="map-wrap">
          <div id="map"></div>
          <div class="map-toolbar">
            <button class="seg-btn active" id="clusterToggle">Marker clusters</button>
            <button class="seg-btn" id="heatToggle">Heatmap</button>
            <button class="seg-btn" id="fitMapBtn">Fit map</button>
          </div>
          <div class="toast" id="toast"></div>
        </section>
        <section class="list-panel">
          <div class="list-head">
            <div>
              <small>Pipeline</small>
              <h2 id="listTitle">Properties</h2>
            </div>
            <small id="listMeta"></small>
          </div>
          <div class="list" id="propertyList"></div>
        </section>
      </main>

      <aside class="details" id="details"></aside>
    </div>

    <section class="compare" id="compare"></section>
  </div>

  <input class="hidden" id="importFile" type="file" accept=".json,.csv,text/csv,application/json">
  <div class="hidden" id="print-memo"></div>

  <script id="seed-data" type="application/json">__SEED_JSON__</script>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script src="https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"></script>
  <script src="https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js"></script>
  <script>
    (function () {
      var STATUS_LABELS = { live: "Live", under_offer: "Under offer", unconfirmed: "Unverified" };
      var TENURE_LABELS = { freehold: "Freehold", leasehold: "Leasehold", unknown: "Unknown" };
      var KIND_LABELS = {
        hotel: "Hotel",
        inn: "Inn",
        pub: "Pub",
        guest_house: "Guest house",
        holiday_accommodation: "Holiday",
        hospitality: "Hospitality"
      };
      var STAGE_LABELS = {
        new: "New",
        reviewing: "Reviewing",
        broker_contacted: "Broker contacted",
        nda: "NDA",
        financials: "Financials requested",
        offer_candidate: "Offer candidate",
        rejected: "Rejected"
      };
      var STAGES = ["new", "reviewing", "broker_contacted", "nda", "financials", "offer_candidate", "rejected"];
      var seed = JSON.parse(document.getElementById("seed-data").textContent);
      var data = normalizeData(seed);
      var filters = defaultFilters();
      var shortlist = getStore("jy-html-shortlist", []);
      var workflow = getStore("jy-html-workflow", {});
      var notes = getStore("jy-html-notes", {});
      var sourceMeta = getStore("jy-html-source-meta", {});
      var refreshLog = getStore("jy-html-refresh-log", []);
      var snapshot = getStore("jy-html-snapshot", null);
      var selectedId = data.properties[0] ? data.properties[0].id : null;
      var map = null;
      var lightTiles = null;
      var darkTiles = null;
      var markerLayer = null;
      var plainLayer = null;
      var heatLayer = null;
      var circleLayer = null;
      var clusterMode = true;
      var heatMode = false;
      var filtered = [];
      var lastChanges = [];

      if (!snapshot) {
        setStore("jy-html-snapshot", makeSnapshot(data.properties));
      }
      loadHash();
      initControls();
      initMap();
      renderAll();

      function $(id) { return document.getElementById(id); }
      function getStore(key, fallback) {
        try {
          var raw = localStorage.getItem(key);
          return raw ? JSON.parse(raw) : fallback;
        } catch (error) {
          return fallback;
        }
      }
      function setStore(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
      }
      function escapeHtml(value) {
        return String(value == null ? "" : value)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;");
      }
      function slug(value) {
        return String(value || "")
          .toLowerCase()
          .replace(/&/g, "and")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");
      }
      function normalizeData(input) {
        var areas = input.areas || [];
        var clusters = input.clusters || [];
        var properties = (input.properties || input).map(function (raw, index) {
          var area = areas.find(function (a) { return a.id === (raw.areaId || raw.area); });
          var rooms = raw.rooms == null ? parseRooms(raw) : raw.rooms;
          var priceValue = raw.priceValue == null ? parsePrice(raw.price) : raw.priceValue;
          var pricePerRoom = raw.pricePerRoom == null && priceValue && rooms ? Math.round(priceValue / rooms) : raw.pricePerRoom;
          var enriched = {
            id: raw.id || ("p-" + String(index + 1).padStart(3, "0") + "-" + slug(raw.name)),
            sourceIndex: raw.sourceIndex || index + 1,
            name: raw.name || "Unnamed property",
            areaId: raw.areaId || raw.area || (area ? area.id : 0),
            areaName: raw.areaName || (area ? area.name : "Unknown"),
            areaSlug: raw.areaSlug || slug(area ? area.name : "unknown"),
            lat: Number(raw.lat),
            lng: Number(raw.lng),
            kind: raw.kind || parseKind(raw),
            type: raw.type || "",
            tenure: raw.tenure || parseTenure(raw),
            rooms: rooms,
            price: raw.price || "POA",
            priceValue: priceValue,
            pricePerRoom: pricePerRoom || null,
            source: raw.source || "Unknown",
            location: raw.location || "",
            url: raw.url || "",
            status: raw.status || "unconfirmed",
            note: raw.note || "",
            lastSeen: raw.lastSeen || (input.metadata && input.metadata.refreshedAt) || new Date().toISOString().slice(0, 10),
            fitScore: raw.fitScore || 0,
            confidence: raw.confidence || 0
          };
          enriched.fitScore = enriched.fitScore || scoreProperty(enriched);
          enriched.confidence = enriched.confidence || confidence(enriched);
          return enriched;
        }).filter(function (p) { return Number.isFinite(p.lat) && Number.isFinite(p.lng); });
        return {
          metadata: input.metadata || { refreshedAt: new Date().toISOString().slice(0, 10), sourceUrl: "" },
          areas: areas,
          clusters: clusters,
          properties: properties
        };
      }
      function parsePrice(price) {
        var text = String(price || "").toLowerCase();
        if (!text || text.indexOf("poa") >= 0) return null;
        var match = text.match(/£\s*([0-9][0-9,.]*)(?:\s*(m|million))?/i);
        if (!match) return null;
        var value = Number(match[1].replace(/,/g, ""));
        if (!Number.isFinite(value)) return null;
        return match[2] ? Math.round(value * 1000000) : Math.round(value);
      }
      function parseRooms(property) {
        var text = String((property.type || "") + " " + (property.note || "")).toLowerCase();
        var matches = Array.from(text.matchAll(/(\d{1,3})\s*(?:[- ]?(?:en[- ]?suite|bed(?:room)?s?|letting bedrooms?|rooms?|keys?|lodges?|suites?))/g))
          .map(function (match) { return Number(match[1]); })
          .filter(function (num) { return num > 0 && num < 120; });
        return matches.length ? Math.max.apply(null, matches) : null;
      }
      function parseTenure(property) {
        var priceType = String((property.type || "") + " " + (property.price || "")).toLowerCase();
        if (/\bfreehold\b|\bfh\b/.test(priceType)) return "freehold";
        if (/\bleasehold\b|\blh\b/.test(priceType)) return "leasehold";
        return "unknown";
      }
      function parseKind(property) {
        var text = String((property.name || "") + " " + (property.type || "") + " " + (property.note || "")).toLowerCase();
        if (/guest\s*house|bed\s*&\s*breakfast|\bb&b\b/.test(text)) return "guest_house";
        if (/\bpub\b|public house|freehouse|bar/.test(text)) return "pub";
        if (/\binn\b/.test(text)) return "inn";
        if (/\bhotel\b/.test(text)) return "hotel";
        if (/hostel|holiday|self-catering|cottage/.test(text)) return "holiday_accommodation";
        return "hospitality";
      }
      function scoreProperty(property) {
        var score = 46;
        var price = property.priceValue;
        var rooms = property.rooms;
        var ppr = property.pricePerRoom;
        if (property.status === "live") score += 8;
        if (property.status === "under_offer") score -= 9;
        if (property.status === "unconfirmed") score -= 16;
        if (property.tenure === "freehold") score += 11;
        if (property.tenure === "leasehold") score -= 4;
        if (rooms != null) {
          if (rooms >= 6 && rooms <= 22) score += 12;
          else if (rooms > 22 && rooms <= 35) score += 6;
          else if (rooms < 4) score -= 5;
        }
        if (price != null) {
          if (price >= 250000 && price <= 1250000) score += 11;
          if (price > 2000000) score -= 9;
        } else score -= 5;
        if (ppr != null) {
          if (ppr <= 80000) score += 10;
          else if (ppr <= 120000) score += 5;
          else if (ppr > 180000) score -= 8;
        }
        if ([4, 6, 7, 13, 14, 15].indexOf(property.areaId) >= 0) score += 5;
        if (/turnover|profit|ebitda|net profit/i.test(property.note)) score += 4;
        if (/requires|closed|upgrading|vacant|development potential/i.test(property.note)) score -= 3;
        return Math.max(1, Math.min(100, Math.round(score)));
      }
      function confidence(property) {
        var score = 72;
        if (property.status === "live") score += 8;
        if (property.status === "unconfirmed") score -= 26;
        if (property.priceValue == null) score -= 11;
        if (property.rooms == null) score -= 7;
        if (!property.url) score -= 14;
        return Math.max(1, Math.min(100, score));
      }
      function defaultFilters() {
        return {
          query: "",
          areas: [],
          statuses: ["live", "under_offer", "unconfirmed"],
          tenures: ["freehold", "leasehold", "unknown"],
          kind: "all",
          source: "all",
          target: "all",
          maxPrice: 3000000,
          maxPpr: 400000,
          maxDistance: 250,
          minRooms: 0,
          minScore: 0,
          financialsOnly: false,
          needsVerification: false,
          sort: "fit"
        };
      }
      function initControls() {
        filters.areas = data.areas.map(function (a) { return a.id; });
        $("searchInput").addEventListener("input", function (event) { filters.query = event.target.value; renderAll(); });
        $("maxPriceInput").value = filters.maxPrice;
        $("maxPprInput").value = filters.maxPpr;
        $("distanceInput").value = filters.maxDistance;
        $("minRoomsInput").value = filters.minRooms;
        $("minScoreInput").value = filters.minScore;
        ["maxPriceInput", "maxPprInput", "distanceInput", "minRoomsInput", "minScoreInput"].forEach(function (id) {
          $(id).addEventListener("input", function (event) {
            var key = id === "maxPriceInput" ? "maxPrice" : id === "maxPprInput" ? "maxPpr" : id === "distanceInput" ? "maxDistance" : id === "minRoomsInput" ? "minRooms" : "minScore";
            filters[key] = Number(event.target.value);
            renderAll();
          });
        });
        $("financialsBtn").addEventListener("click", function () { filters.financialsOnly = !filters.financialsOnly; renderAll(); });
        $("verifyBtn").addEventListener("click", function () { filters.needsVerification = !filters.needsVerification; renderAll(); });
        $("clusterToggle").addEventListener("click", function () { clusterMode = !clusterMode; renderAll(); });
        $("heatToggle").addEventListener("click", function () { heatMode = !heatMode; renderAll(); });
        $("fitMapBtn").addEventListener("click", fitMap);
        $("themeBtn").addEventListener("click", toggleTheme);
        $("refreshBtn").addEventListener("click", refreshFromSidecar);
        $("importBtn").addEventListener("click", function () { $("importFile").click(); });
        $("importFile").addEventListener("change", importFile);
        $("exportBtn").addEventListener("click", exportCsv);
        $("memoBtn").addEventListener("click", printMemo);
        $("shareBtn").addEventListener("click", shareState);

        var kindSelect = $("kindSelect");
        kindSelect.innerHTML = '<option value="all">All asset types</option>' + Object.keys(KIND_LABELS).map(function (key) {
          return '<option value="' + key + '">' + KIND_LABELS[key] + '</option>';
        }).join("");
        kindSelect.addEventListener("change", function (event) { filters.kind = event.target.value; renderAll(); });

        var sourceSelect = $("sourceSelect");
        var sources = uniqueSources();
        sourceSelect.innerHTML = '<option value="all">All sources</option>' + sources.map(function (source) {
          return '<option value="' + escapeHtml(source) + '">' + escapeHtml(source) + '</option>';
        }).join("");
        sourceSelect.addEventListener("change", function (event) { filters.source = event.target.value; renderAll(); });

        $("sortSelect").innerHTML = [
          ["fit", "Fit score"],
          ["price", "Price"],
          ["pricePerRoom", "Price per room"],
          ["rooms", "Room count"],
          ["distance", "Distance"]
        ].map(function (item) { return '<option value="' + item[0] + '">' + item[1] + '</option>'; }).join("");
        $("sortSelect").addEventListener("change", function (event) { filters.sort = event.target.value; renderAll(); });

        var targets = data.clusters.map(function (cluster) { return { id: cluster.id, label: cluster.title.replace("⭐ ", ""), lat: cluster.lat, lng: cluster.lng }; });
        $("targetSelect").innerHTML = '<option value="all">No distance filter</option>' + targets.map(function (target) {
          return '<option value="' + target.id + '">' + escapeHtml(target.label) + '</option>';
        }).join("");
        $("targetSelect").addEventListener("change", function (event) { filters.target = event.target.value; renderAll(); });

        renderChips("statusChips", STATUS_LABELS, filters.statuses, function (key) {
          toggleArray(filters.statuses, key);
          renderAll();
        });
        renderChips("tenureChips", TENURE_LABELS, filters.tenures, function (key) {
          toggleArray(filters.tenures, key);
          renderAll();
        });
      }
      function renderChips(containerId, labels, activeArray, callback) {
        $(containerId).innerHTML = Object.keys(labels).map(function (key) {
          return '<button class="chip-btn ' + (activeArray.indexOf(key) >= 0 ? "active" : "") + '" data-key="' + key + '">' + labels[key] + '</button>';
        }).join("");
        Array.from($(containerId).querySelectorAll("button")).forEach(function (button) {
          button.addEventListener("click", function () { callback(button.dataset.key); });
        });
      }
      function initMap() {
        if (!window.L) {
          $("map").innerHTML = '<div class="empty-state">Map library did not load. The list, filters, exports, and workflow still work.</div>';
          return;
        }
        map = L.map("map", { zoomControl: false, preferCanvas: true }).setView([55.5, -3.5], 6);
        lightTiles = L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
          attribution: "&copy; OpenStreetMap &copy; CARTO",
          subdomains: "abcd",
          maxZoom: 19
        }).addTo(map);
        darkTiles = L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
          attribution: "&copy; OpenStreetMap &copy; CARTO",
          subdomains: "abcd",
          maxZoom: 19
        });
        L.control.zoom({ position: "bottomleft" }).addTo(map);
        markerLayer = window.L.markerClusterGroup ? L.markerClusterGroup({ chunkedLoading: true, maxClusterRadius: 42 }) : L.layerGroup();
        plainLayer = L.layerGroup();
        circleLayer = L.layerGroup().addTo(map);
        markerLayer.addTo(map);
      }
      function renderAll() {
        filters.areas = filters.areas.length ? filters.areas : data.areas.map(function (a) { return a.id; });
        filtered = applyFilters();
        if (selectedId && !data.properties.find(function (p) { return p.id === selectedId; })) selectedId = filtered[0] ? filtered[0].id : null;
        renderMetrics();
        renderAreaList();
        renderClusterList();
        renderSourceList();
        renderLabels();
        renderChips("statusChips", STATUS_LABELS, filters.statuses, function (key) { toggleArray(filters.statuses, key); renderAll(); });
        renderChips("tenureChips", TENURE_LABELS, filters.tenures, function (key) { toggleArray(filters.tenures, key); renderAll(); });
        $("financialsBtn").classList.toggle("active", filters.financialsOnly);
        $("verifyBtn").classList.toggle("active", filters.needsVerification);
        $("clusterToggle").classList.toggle("active", clusterMode);
        $("heatToggle").classList.toggle("active", heatMode);
        renderMap();
        renderList();
        renderDetails();
        renderCompare();
      }
      function applyFilters() {
        var query = filters.query.trim().toLowerCase();
        var target = getTarget();
        return data.properties.filter(function (property) {
          if (filters.areas.indexOf(property.areaId) < 0) return false;
          if (filters.statuses.indexOf(property.status) < 0) return false;
          if (filters.tenures.indexOf(property.tenure) < 0) return false;
          if (filters.kind !== "all" && property.kind !== filters.kind) return false;
          if (filters.source !== "all" && sourceKey(property.source) !== filters.source) return false;
          if (property.priceValue != null && property.priceValue > filters.maxPrice) return false;
          if (property.pricePerRoom != null && property.pricePerRoom > filters.maxPpr) return false;
          if ((property.rooms || 0) < filters.minRooms) return false;
          if (property.fitScore < filters.minScore) return false;
          if (filters.financialsOnly && !/turnover|profit|ebitda|net profit|yield/i.test(property.note)) return false;
          if (filters.needsVerification && !(property.status === "unconfirmed" || property.confidence < 70 || property.priceValue == null || property.rooms == null)) return false;
          if (target && distanceKm(property.lat, property.lng, target.lat, target.lng) > filters.maxDistance) return false;
          if (!query) return true;
          return [property.name, property.areaName, property.location, property.source, property.type, property.note].join(" ").toLowerCase().indexOf(query) >= 0;
        }).sort(function (a, b) {
          var target = getTarget();
          if (filters.sort === "price") return (a.priceValue || Number.MAX_SAFE_INTEGER) - (b.priceValue || Number.MAX_SAFE_INTEGER);
          if (filters.sort === "pricePerRoom") return (a.pricePerRoom || Number.MAX_SAFE_INTEGER) - (b.pricePerRoom || Number.MAX_SAFE_INTEGER);
          if (filters.sort === "rooms") return (b.rooms || 0) - (a.rooms || 0);
          if (filters.sort === "distance" && target) return distanceKm(a.lat, a.lng, target.lat, target.lng) - distanceKm(b.lat, b.lng, target.lat, target.lng);
          return b.fitScore - a.fitScore;
        });
      }
      function renderMetrics() {
        var live = filtered.filter(function (p) { return p.status === "live"; }).length;
        var under = filtered.filter(function (p) { return p.status === "under_offer"; }).length;
        var scores = filtered.map(function (p) { return p.fitScore; });
        var avgScore = scores.length ? Math.round(scores.reduce(function (sum, val) { return sum + val; }, 0) / scores.length) : 0;
        var pprs = filtered.map(function (p) { return p.pricePerRoom; }).filter(Boolean).sort(function (a, b) { return a - b; });
        var medianPpr = pprs.length ? pprs[Math.floor(pprs.length / 2)] : null;
        $("metrics").innerHTML = metric(filtered.length, "Shown") + metric(live, "Live") + metric(under, "Under offer") + metric(avgScore, "Avg score") + metric(formatMoney(medianPpr), "Median p/rm");
        $("subtitle").textContent = data.properties.length + " properties · refreshed " + data.metadata.refreshedAt + " · " + refreshLog.length + " refresh log entries";
        $("listTitle").textContent = filtered.length + " properties";
        $("listMeta").textContent = filtered.filter(function (p) { return p.priceValue != null; }).length + " priced · " + shortlist.length + " shortlisted";
      }
      function metric(value, label) {
        return '<div class="metric"><strong>' + value + '</strong><span>' + label + '</span></div>';
      }
      function renderLabels() {
        $("maxPriceLabel").textContent = compactMoney(filters.maxPrice);
        $("maxPprLabel").textContent = compactMoney(filters.maxPpr);
        $("distanceLabel").textContent = filters.target === "all" ? "Off" : filters.maxDistance + " km";
        $("searchInput").value = filters.query;
        $("maxPriceInput").value = filters.maxPrice;
        $("maxPprInput").value = filters.maxPpr;
        $("distanceInput").value = filters.maxDistance;
        $("minRoomsInput").value = filters.minRooms;
        $("minScoreInput").value = filters.minScore;
        $("kindSelect").value = filters.kind;
        $("sourceSelect").value = filters.source;
        $("targetSelect").value = filters.target;
        $("sortSelect").value = filters.sort;
      }
      function renderAreaList() {
        var counts = countBy(filtered, "areaId");
        $("areaList").innerHTML = data.areas.map(function (area) {
          return '<button class="area-row ' + (filters.areas.indexOf(area.id) >= 0 ? "active" : "") + '" data-id="' + area.id + '"><span class="dot" style="background:' + area.color + '"></span><span>' + escapeHtml(area.name) + '</span><strong>' + (counts[area.id] || 0) + '</strong></button>';
        }).join("");
        Array.from($("areaList").querySelectorAll("button")).forEach(function (button) {
          button.addEventListener("click", function () {
            toggleArray(filters.areas, Number(button.dataset.id));
            renderAll();
          });
        });
      }
      function renderClusterList() {
        $("clusterList").innerHTML = data.clusters.map(function (cluster) {
          return '<button class="cluster-row ' + cluster.priority + '" data-id="' + cluster.id + '"><strong>' + escapeHtml(cluster.title.replace("⭐ ", "")) + '</strong><span>' + escapeHtml(cluster.detail) + '</span></button>';
        }).join("");
        Array.from($("clusterList").querySelectorAll("button")).forEach(function (button) {
          button.addEventListener("click", function () {
            var cluster = data.clusters.find(function (item) { return item.id === button.dataset.id; });
            filters.target = cluster.id;
            if (map) map.flyTo([cluster.lat, cluster.lng], cluster.zoom, { duration: 0.8 });
            renderAll();
          });
        });
      }
      function renderSourceList() {
        var counts = {};
        data.properties.forEach(function (p) {
          var key = sourceKey(p.source);
          counts[key] = (counts[key] || 0) + 1;
        });
        var rows = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; }).slice(0, 8);
        $("sourceList").innerHTML = rows.map(function (source) {
          var meta = sourceMeta[source] || {};
          return '<button class="source-row" data-source="' + escapeHtml(source) + '"><span>' + escapeHtml(source) + '</span><small>' + (meta.reliability || "unrated") + '</small><strong>' + counts[source] + '</strong></button>';
        }).join("");
        Array.from($("sourceList").querySelectorAll("button")).forEach(function (button) {
          button.addEventListener("click", function () {
            filters.source = button.dataset.source;
            renderAll();
          });
        });
      }
      function renderMap() {
        if (!map || !window.L) return;
        var activeLayer = clusterMode ? markerLayer : plainLayer;
        var inactiveLayer = clusterMode ? plainLayer : markerLayer;
        if (inactiveLayer && map.hasLayer(inactiveLayer)) map.removeLayer(inactiveLayer);
        if (activeLayer && !map.hasLayer(activeLayer)) activeLayer.addTo(map);
        markerLayer.clearLayers();
        plainLayer.clearLayers();
        circleLayer.clearLayers();
        if (heatLayer && map.hasLayer(heatLayer)) map.removeLayer(heatLayer);
        filtered.forEach(function (property) {
          var area = areaFor(property);
          var marker = L.marker([property.lat, property.lng], { icon: pinIcon(property, area) });
          marker.bindPopup(popupHtml(property, area), { maxWidth: 292, closeButton: false });
          marker.on("click", function () { selectedId = property.id; renderAll(); });
          markerLayer.addLayer(marker);
          plainLayer.addLayer(marker);
        });
        data.areas.forEach(function (area) {
          var areaProperties = filtered.filter(function (p) { return p.areaId === area.id; });
          if (!areaProperties.length) return;
          var lat = areaProperties.reduce(function (sum, p) { return sum + p.lat; }, 0) / areaProperties.length;
          var lng = areaProperties.reduce(function (sum, p) { return sum + p.lng; }, 0) / areaProperties.length;
          L.circle([lat, lng], {
            radius: Math.min(28000, Math.max(9000, areaProperties.length * 950)),
            color: area.color,
            fillColor: area.color,
            fillOpacity: 0.045,
            opacity: 0.32,
            weight: 1.4,
            dashArray: "8,6"
          }).addTo(circleLayer);
        });
        if (heatMode && window.L.heatLayer) {
          heatLayer = L.heatLayer(filtered.map(function (p) { return [p.lat, p.lng, Math.max(0.25, p.fitScore / 100)]; }), { radius: 28, blur: 22, maxZoom: 10 });
          heatLayer.addTo(map);
        }
      }
      function renderList() {
        $("propertyList").innerHTML = filtered.map(function (property) {
          var area = areaFor(property);
          var stage = workflow[property.id] || "new";
          return '<button class="property-row ' + (property.id === selectedId ? "selected" : "") + '" data-id="' + property.id + '"><span class="dot" style="background:' + (area ? area.color : "#006b70") + '"></span><span class="row-main"><strong>' + escapeHtml(property.name) + '</strong><small>' + escapeHtml(property.areaName) + ' · ' + (property.rooms || "-") + ' rooms · ' + compactMoney(property.priceValue) + '</small></span><span class="pill ' + scoreTone(property.fitScore) + '">' + property.fitScore + '</span><span class="pill status ' + statusTone(property.status) + '">' + STATUS_LABELS[property.status] + '</span><span class="pill stage muted">' + STAGE_LABELS[stage] + '</span><span class="star ' + (shortlist.indexOf(property.id) >= 0 ? "active" : "") + '" data-star="' + property.id + '">★</span></button>';
        }).join("") || '<div class="empty-state">No properties match the current filters.</div>';
        Array.from($("propertyList").querySelectorAll(".property-row")).forEach(function (row) {
          row.addEventListener("click", function () {
            selectedId = row.dataset.id;
            var property = data.properties.find(function (p) { return p.id === selectedId; });
            if (property && map) map.flyTo([property.lat, property.lng], Math.max(map.getZoom(), 10), { duration: 0.6 });
            renderAll();
          });
        });
        Array.from($("propertyList").querySelectorAll("[data-star]")).forEach(function (star) {
          star.addEventListener("click", function (event) {
            event.stopPropagation();
            toggleShortlist(star.dataset.star);
          });
        });
      }
      function renderDetails() {
        var property = data.properties.find(function (p) { return p.id === selectedId; });
        if (!property) {
          $("details").innerHTML = '<div class="empty-state">Select a property to inspect it.</div>';
          return;
        }
        var area = areaFor(property);
        var stage = workflow[property.id] || "new";
        var source = sourceKey(property.source);
        var meta = sourceMeta[source] || {};
        var changes = changesFor(property);
        var duplicates = duplicatesFor(property);
        $("details").innerHTML =
          '<div class="detail-head" style="border-color:' + (area ? area.color : "var(--teal)") + '">' +
          '<span class="eyebrow">' + escapeHtml(property.areaName) + '</span>' +
          '<h2>' + escapeHtml(property.name) + '</h2>' +
          '<p>' + escapeHtml(property.location) + '</p>' +
          '<div class="detail-actions">' +
          '<button class="text-btn" id="detailShortlist">' + (shortlist.indexOf(property.id) >= 0 ? "Shortlisted ★" : "Shortlist ☆") + '</button>' +
          '<a class="text-btn" href="' + escapeHtml(property.url) + '" target="_blank" rel="noopener">Listing</a>' +
          '<button class="text-btn" id="verifyListing">' + (meta.verified ? "Verified" : "Mark verified") + '</button>' +
          '</div></div>' +
          '<div class="detail-body">' +
          '<div class="stat-grid">' + metric(property.price, "Asking price") + metric(property.rooms || "-", "Rooms") + metric(property.fitScore + "/100", "Fit score") + metric(property.confidence + "%", "Confidence") + '</div>' +
          '<div class="detail-section"><h3>Listing</h3><dl class="facts">' +
          fact("Type", property.type) + fact("Kind", KIND_LABELS[property.kind]) + fact("Tenure", TENURE_LABELS[property.tenure]) + fact("Price / room", formatMoney(property.pricePerRoom)) + fact("Source", property.source) + fact("Last seen", property.lastSeen) +
          '</dl></div>' +
          '<div class="detail-section"><h3>Scoring rationale</h3><p class="subtle">' + escapeHtml(scoreRationale(property)) + '</p></div>' +
          '<div class="detail-section"><h3>Broker note</h3><p class="subtle">' + escapeHtml(property.note || "No note supplied.") + '</p></div>' +
          '<div class="detail-section"><h3>Due diligence workflow</h3><div class="stage-grid">' + STAGES.map(function (key) { return '<button class="chip-btn ' + (stage === key ? "active" : "") + '" data-stage="' + key + '">' + STAGE_LABELS[key] + '</button>'; }).join("") + '</div></div>' +
          '<div class="detail-section"><h3>Your notes</h3><textarea id="noteInput" placeholder="Call notes, diligence questions, next action">' + escapeHtml(notes[property.id] || "") + '</textarea></div>' +
          '<div class="detail-section"><h3>Source management</h3><div class="grid-2"><label class="field">Reliability<select id="reliabilitySelect"><option value="">Unrated</option><option>High</option><option>Medium</option><option>Low</option></select></label><label class="field">Broker contact<input id="contactInput" type="text" value="' + escapeHtml(meta.contact || "") + '"></label></div><p class="subtle" style="margin-top:8px;">Possible duplicates: ' + (duplicates.length ? duplicates.map(function (p) { return escapeHtml(p.name); }).join(", ") : "none detected") + '</p></div>' +
          '<div class="detail-section"><h3>Change history</h3><div class="change-list">' + (changes.length ? changes.map(renderChange).join("") : '<p class="subtle">No tracked changes for this listing yet. Import or refresh newer data to start comparing snapshots.</p>') + '</div></div>' +
          '</div>';
        $("detailShortlist").addEventListener("click", function () { toggleShortlist(property.id); });
        $("verifyListing").addEventListener("click", function () {
          sourceMeta[source] = Object.assign({}, sourceMeta[source], { verified: !meta.verified });
          setStore("jy-html-source-meta", sourceMeta);
          renderAll();
        });
        Array.from(document.querySelectorAll("[data-stage]")).forEach(function (button) {
          button.addEventListener("click", function () {
            workflow[property.id] = button.dataset.stage;
            setStore("jy-html-workflow", workflow);
            renderAll();
          });
        });
        $("noteInput").addEventListener("input", function (event) {
          notes[property.id] = event.target.value;
          setStore("jy-html-notes", notes);
        });
        $("reliabilitySelect").value = meta.reliability || "";
        $("reliabilitySelect").addEventListener("change", function (event) {
          sourceMeta[source] = Object.assign({}, sourceMeta[source], { reliability: event.target.value });
          setStore("jy-html-source-meta", sourceMeta);
          renderAll();
        });
        $("contactInput").addEventListener("input", function (event) {
          sourceMeta[source] = Object.assign({}, sourceMeta[source], { contact: event.target.value });
          setStore("jy-html-source-meta", sourceMeta);
        });
      }
      function renderCompare() {
        var items = shortlist.map(function (id) { return data.properties.find(function (p) { return p.id === id; }); }).filter(Boolean);
        $("compare").innerHTML = '<div class="compare-title"><strong>' + items.length + ' shortlisted</strong><span class="subtle">' + (items.length < 5 ? "add " + (5 - items.length) + " more" : items.length > 20 ? "cap exceeded" : "target 5-20") + '</span></div><div class="compare-list">' + (items.length ? items.map(function (p) {
          return '<button class="compare-card" data-id="' + p.id + '"><span><strong>' + escapeHtml(p.name) + '</strong><small>' + escapeHtml(p.areaName) + ' · ' + escapeHtml(sourceKey(p.source)) + '</small></span><span>' + compactMoney(p.priceValue) + '</span><span>' + (p.rooms || "-") + ' rooms</span><span>' + yieldEstimate(p) + '</span><span data-remove="' + p.id + '">×</span></button>';
        }).join("") : '<div class="empty-state">Shortlist assets to compare price, rooms, source, estimated yield, notes, and next action.</div>') + '</div>';
        Array.from($("compare").querySelectorAll(".compare-card")).forEach(function (card) {
          card.addEventListener("click", function () { selectedId = card.dataset.id; renderAll(); });
        });
        Array.from($("compare").querySelectorAll("[data-remove]")).forEach(function (button) {
          button.addEventListener("click", function (event) {
            event.stopPropagation();
            toggleShortlist(button.dataset.remove);
          });
        });
      }
      function pinIcon(property, area) {
        var color = area ? area.color : "#006b70";
        var letter = property.fitScore >= 80 ? "A" : property.fitScore >= 65 ? "B" : property.fitScore >= 50 ? "C" : "D";
        var ring = property.status === "under_offer" ? '<circle cx="16" cy="15" r="12" fill="none" stroke="#d9822b" stroke-width="2.5"/>' : property.status === "unconfirmed" ? '<circle cx="16" cy="15" r="12" fill="none" stroke="#77736b" stroke-width="2" stroke-dasharray="3,2"/>' : "";
        var selected = property.id === selectedId ? '<circle cx="16" cy="15" r="15" fill="none" stroke="#ffffff" stroke-width="2.5"/>' : "";
        return L.divIcon({
          html: '<svg width="34" height="46" viewBox="-1 -1 34 46" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 8px 10px rgba(0,0,0,.22));opacity:' + (property.status === "unconfirmed" ? ".58" : "1") + '"><path d="M16 1C8.8 1 3 6.8 3 14c0 9.6 13 29 13 29s13-19.4 13-29C29 6.8 23.2 1 16 1Z" fill="' + color + '" stroke="white" stroke-width="1.7"/><circle cx="16" cy="15" r="8" fill="rgba(255,255,255,.22)"/>' + ring + selected + '<text x="16" y="19" text-anchor="middle" font-family="Arial,sans-serif" font-size="9" font-weight="900" fill="white">' + letter + '</text></svg>',
          iconSize: [34, 46],
          iconAnchor: [17, 45],
          popupAnchor: [0, -42],
          className: "jy-pin"
        });
      }
      function popupHtml(property, area) {
        return '<div class="popup"><div class="popup-head" style="border-color:' + (area ? area.color : "var(--teal)") + '"><span>' + escapeHtml(property.areaName) + '</span><strong>' + escapeHtml(property.name) + '</strong><small>' + escapeHtml(property.location) + '</small></div><div class="popup-body"><div><span>Price</span><strong>' + escapeHtml(property.price) + '</strong></div><div><span>Rooms</span><strong>' + (property.rooms || "-") + '</strong></div><div><span>Score</span><strong>' + property.fitScore + '</strong></div><a href="' + escapeHtml(property.url) + '" target="_blank" rel="noopener">View listing</a></div></div>';
      }
      function toggleShortlist(id) {
        var index = shortlist.indexOf(id);
        if (index >= 0) shortlist.splice(index, 1);
        else {
          if (shortlist.length >= 20) {
            toast("Shortlist is capped at 20 for the comparison table.");
            return;
          }
          shortlist.push(id);
        }
        setStore("jy-html-shortlist", shortlist);
        renderAll();
      }
      function refreshFromSidecar() {
        fetch("jy-acquisition-data.json?ts=" + Date.now(), { cache: "no-store" })
          .then(function (response) {
            if (!response.ok) throw new Error("No sidecar data file found");
            return response.json();
          })
          .then(function (json) {
            applyNewData(json, "sidecar file");
          })
          .catch(function () {
            toast("No newer jy-acquisition-data.json could be loaded next to this HTML. Use Import to refresh from a downloaded JSON/CSV.");
          });
      }
      function importFile(event) {
        var file = event.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function () {
          try {
            var text = String(reader.result || "");
            var json = file.name.toLowerCase().endsWith(".csv") ? { properties: parseCsv(text), areas: data.areas, clusters: data.clusters, metadata: { refreshedAt: new Date().toISOString().slice(0, 10), sourceUrl: file.name } } : JSON.parse(text);
            applyNewData(json, file.name);
          } catch (error) {
            toast("Import failed: " + error.message);
          } finally {
            event.target.value = "";
          }
        };
        reader.readAsText(file);
      }
      function applyNewData(json, source) {
        var previous = getStore("jy-html-snapshot", makeSnapshot(data.properties));
        var next = normalizeData(json);
        var changes = compareSnapshots(previous, makeSnapshot(next.properties));
        data = next;
        filtered = [];
        lastChanges = changes;
        refreshLog.unshift({ at: new Date().toISOString(), source: source, count: next.properties.length, changes: changes.length });
        refreshLog = refreshLog.slice(0, 50);
        setStore("jy-html-refresh-log", refreshLog);
        setStore("jy-html-snapshot", makeSnapshot(next.properties));
        filters.areas = data.areas.map(function (a) { return a.id; });
        selectedId = data.properties[0] ? data.properties[0].id : null;
        initControls();
        renderAll();
        fitMap();
        toast("Refresh complete: " + next.properties.length + " properties, " + changes.length + " tracked changes.");
      }
      function makeSnapshot(properties) {
        var snap = {};
        properties.forEach(function (p) {
          snap[p.id] = { id: p.id, name: p.name, price: p.price, priceValue: p.priceValue, status: p.status, url: p.url, source: p.source, location: p.location };
        });
        return snap;
      }
      function compareSnapshots(oldSnap, newSnap) {
        var changes = [];
        Object.keys(newSnap).forEach(function (id) {
          var oldItem = oldSnap[id];
          var next = newSnap[id];
          if (!oldItem) changes.push({ id: id, type: "new", title: next.name, detail: "New listing detected" });
          else {
            if (oldItem.price !== next.price) changes.push({ id: id, type: "price", title: next.name, detail: "Price changed from " + oldItem.price + " to " + next.price });
            if (oldItem.status !== next.status) changes.push({ id: id, type: "status", title: next.name, detail: "Status changed from " + oldItem.status + " to " + next.status });
            if (oldItem.url !== next.url) changes.push({ id: id, type: "url", title: next.name, detail: "Listing URL changed" });
          }
        });
        Object.keys(oldSnap).forEach(function (id) {
          if (!newSnap[id]) changes.push({ id: id, type: "removed", title: oldSnap[id].name, detail: "Listing no longer appears in the refreshed file" });
        });
        var log = getStore("jy-html-change-history", []);
        log = changes.map(function (change) { return Object.assign({ at: new Date().toISOString() }, change); }).concat(log).slice(0, 300);
        setStore("jy-html-change-history", log);
        return changes;
      }
      function changesFor(property) {
        var log = getStore("jy-html-change-history", []);
        return log.filter(function (change) { return change.id === property.id; }).slice(0, 20);
      }
      function renderChange(change) {
        return '<div class="change-item"><strong>' + escapeHtml(change.type.toUpperCase()) + ' · ' + escapeHtml(change.title) + '</strong><small>' + escapeHtml(change.detail) + '<br>' + escapeHtml(change.at || "") + '</small></div>';
      }
      function parseCsv(text) {
        var rows = [];
        var row = [];
        var cell = "";
        var quoted = false;
        for (var i = 0; i < text.length; i += 1) {
          var ch = text[i];
          var next = text[i + 1];
          if (quoted) {
            if (ch === '"' && next === '"') {
              cell += '"';
              i += 1;
            } else if (ch === '"') quoted = false;
            else cell += ch;
          } else if (ch === '"') quoted = true;
          else if (ch === ",") { row.push(cell); cell = ""; }
          else if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
          else if (ch !== "\r") cell += ch;
        }
        row.push(cell);
        rows.push(row);
        var headers = rows.shift().map(function (h) { return slug(h); });
        return rows.filter(function (r) { return r.length > 1; }).map(function (r, index) {
          var obj = {};
          headers.forEach(function (header, col) { obj[header] = r[col]; });
          return {
            id: obj.id || ("import-" + index + "-" + slug(obj.name || obj.property || "")),
            name: obj.name || obj.property || obj.title,
            areaName: obj.area || obj.region,
            areaId: Number(obj.areaid || obj.area_id || 0),
            lat: Number(obj.lat || obj.latitude),
            lng: Number(obj.lng || obj.lon || obj.longitude),
            type: obj.type,
            price: obj.price,
            source: obj.source || obj.broker,
            location: obj.location,
            url: obj.url || obj.link,
            status: obj.status || "unconfirmed",
            note: obj.note || obj.notes || ""
          };
        });
      }
      function exportCsv() {
        var headers = ["Name", "Area", "Location", "Status", "Kind", "Tenure", "Rooms", "Price", "Price value", "Price per room", "Fit score", "Confidence", "Source", "URL", "Stage", "Notes"];
        var rows = filtered.map(function (p) {
          return [p.name, p.areaName, p.location, p.status, p.kind, p.tenure, p.rooms, p.price, p.priceValue, p.pricePerRoom, p.fitScore, p.confidence, p.source, p.url, workflow[p.id] || "new", notes[p.id] || ""];
        });
        download("jy-acquisition-filtered.csv", [headers].concat(rows).map(function (row) { return row.map(csvCell).join(","); }).join("\n"), "text/csv");
      }
      function printMemo() {
        var items = shortlist.length ? shortlist.map(function (id) { return data.properties.find(function (p) { return p.id === id; }); }).filter(Boolean) : filtered.slice(0, 12);
        var html = '<h1>JY Hotels Acquisition Memo</h1><p>Generated ' + new Date().toLocaleString() + ' · ' + items.length + ' properties</p><table style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr><th align="left">Property</th><th align="left">Area</th><th align="right">Price</th><th align="right">Rooms</th><th align="right">Score</th><th align="left">Next action</th></tr></thead><tbody>' + items.map(function (p) {
          return '<tr><td style="border-top:1px solid #ccc;padding:7px;">' + escapeHtml(p.name) + '<br><small>' + escapeHtml(p.source) + '</small></td><td style="border-top:1px solid #ccc;padding:7px;">' + escapeHtml(p.areaName) + '</td><td style="border-top:1px solid #ccc;padding:7px;text-align:right;">' + escapeHtml(p.price) + '</td><td style="border-top:1px solid #ccc;padding:7px;text-align:right;">' + (p.rooms || "-") + '</td><td style="border-top:1px solid #ccc;padding:7px;text-align:right;">' + p.fitScore + '</td><td style="border-top:1px solid #ccc;padding:7px;">' + STAGE_LABELS[workflow[p.id] || "new"] + '</td></tr>';
        }).join("") + '</tbody></table>';
        $("print-memo").innerHTML = html;
        window.print();
      }
      function shareState() {
        var payload = { filters: filters, shortlist: shortlist, selectedId: selectedId };
        var encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
        location.hash = "state=" + encoded;
        if (navigator.clipboard) navigator.clipboard.writeText(location.href);
        toast("Share link created and copied when browser permissions allow.");
      }
      function loadHash() {
        if (!location.hash || location.hash.indexOf("state=") < 0) return;
        try {
          var encoded = location.hash.split("state=")[1];
          var payload = JSON.parse(decodeURIComponent(escape(atob(encoded))));
          filters = Object.assign(defaultFilters(), payload.filters || {});
          shortlist = payload.shortlist || shortlist;
          selectedId = payload.selectedId || selectedId;
        } catch (error) {
          toast("Could not read the share link state.");
        }
      }
      function fitMap() {
        if (!map || !filtered.length) return;
        var bounds = L.latLngBounds(filtered.map(function (p) { return [p.lat, p.lng]; }));
        map.fitBounds(bounds, { padding: [36, 36], maxZoom: 9 });
      }
      function toggleTheme() {
        var root = document.documentElement;
        var next = root.dataset.theme === "dark" ? "light" : "dark";
        root.dataset.theme = next;
        if (map && lightTiles && darkTiles) {
          if (next === "dark") {
            if (map.hasLayer(lightTiles)) map.removeLayer(lightTiles);
            darkTiles.addTo(map);
          } else {
            if (map.hasLayer(darkTiles)) map.removeLayer(darkTiles);
            lightTiles.addTo(map);
          }
        }
      }
      function getTarget() {
        if (filters.target === "all") return null;
        return data.clusters.find(function (cluster) { return cluster.id === filters.target; }) || null;
      }
      function distanceKm(lat1, lon1, lat2, lon2) {
        var r = 6371;
        var dLat = (lat2 - lat1) * Math.PI / 180;
        var dLon = (lon2 - lon1) * Math.PI / 180;
        var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      }
      function sourceKey(source) {
        return String(source || "Unknown")
          .replace(/\s*,?\s*(Hotels|Pubs & Restaurants|Commercial|Limited|Ltd|LLP).*$/i, "")
          .replace(/\s*\(Rightmove\)$/i, "")
          .trim() || "Unknown";
      }
      function uniqueSources() {
        var map = {};
        data.properties.forEach(function (p) { map[sourceKey(p.source)] = true; });
        return Object.keys(map).sort();
      }
      function countBy(items, key) {
        var counts = {};
        items.forEach(function (item) { counts[item[key]] = (counts[item[key]] || 0) + 1; });
        return counts;
      }
      function toggleArray(array, value) {
        var index = array.indexOf(value);
        if (index >= 0) array.splice(index, 1);
        else array.push(value);
      }
      function areaFor(property) {
        return data.areas.find(function (area) { return area.id === property.areaId; });
      }
      function scoreTone(score) {
        if (score >= 75) return "green";
        if (score >= 58) return "amber";
        return "red";
      }
      function statusTone(status) {
        if (status === "live") return "green";
        if (status === "under_offer") return "amber";
        return "muted";
      }
      function compactMoney(value) {
        if (value == null || value === "") return "POA";
        if (value >= 1000000) return "GBP " + (value / 1000000).toFixed(value % 1000000 === 0 ? 0 : 1) + "m";
        return "GBP " + Math.round(value / 1000) + "k";
      }
      function formatMoney(value) {
        if (value == null || value === "") return "POA";
        return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(value);
      }
      function yieldEstimate(property) {
        if (!property.priceValue) return "TBD";
        var base = 4.8 + (property.fitScore - 50) * 0.045;
        if (property.pricePerRoom && property.pricePerRoom < 85000) base += 1.1;
        if (/turnover|profit|ebitda/i.test(property.note)) base += 0.7;
        return Math.max(3.5, Math.min(10.5, base)).toFixed(1) + "%";
      }
      function scoreRationale(property) {
        var parts = [];
        parts.push(property.tenure === "freehold" ? "Freehold control improves the score." : property.tenure === "leasehold" ? "Leasehold tenure weighs down the score." : "Tenure needs confirmation.");
        if (property.pricePerRoom) parts.push("Asking price per room is " + formatMoney(property.pricePerRoom) + ".");
        if (property.rooms) parts.push(property.rooms + " rooms puts it in the " + (property.rooms >= 6 && property.rooms <= 22 ? "preferred owner-operator range." : "watch-list range."));
        if (/turnover|profit|ebitda/i.test(property.note)) parts.push("Listing mentions financial performance.");
        if (/requires|closed|upgrading|vacant/i.test(property.note)) parts.push("Capex or operational risk is flagged.");
        return parts.join(" ");
      }
      function duplicatesFor(property) {
        var name = slug(property.name).replace(/\b(the|hotel|inn|guest|house|pub)\b/g, "");
        return data.properties.filter(function (p) {
          if (p.id === property.id) return false;
          if (p.url && p.url === property.url) return true;
          var other = slug(p.name).replace(/\b(the|hotel|inn|guest|house|pub)\b/g, "");
          return name && other && name === other && p.areaId === property.areaId;
        }).slice(0, 5);
      }
      function fact(label, value) {
        return '<div><dt>' + escapeHtml(label) + '</dt><dd>' + escapeHtml(value == null || value === "" ? "-" : value) + '</dd></div>';
      }
      function csvCell(value) {
        return '"' + String(value == null ? "" : value).replace(/"/g, '""') + '"';
      }
      function download(filename, text, type) {
        var blob = new Blob([text], { type: type || "text/plain" });
        var url = URL.createObjectURL(blob);
        var link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      }
      function toast(message) {
        var node = $("toast");
        node.textContent = message;
        node.classList.add("show");
        clearTimeout(toast.timer);
        toast.timer = setTimeout(function () { node.classList.remove("show"); }, 5200);
      }
    })();
  </script>
</body>
</html>`;

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(dataPath, JSON.stringify(seed, null, 2) + "\n", "utf8");
fs.writeFileSync(htmlPath, html.replace("__SEED_JSON__", seedJson), "utf8");

console.log(`Wrote ${htmlPath}`);
console.log(`Wrote ${dataPath}`);
