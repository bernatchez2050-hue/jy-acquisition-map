import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = process.cwd();
const sourcePath = path.join(root, "work", "twystukaugust.html");
const outputPath = path.join(root, "src", "data", "seed.json");

if (!fs.existsSync(sourcePath)) {
  throw new Error(`Missing source HTML at ${sourcePath}`);
}

const html = fs.readFileSync(sourcePath, "utf8");

function extractConst(name) {
  const start = html.indexOf(`const ${name}=`);
  if (start === -1) throw new Error(`Could not find const ${name}`);
  const arrayStart = html.indexOf("[", start);
  let depth = 0;
  let inString = false;
  let quote = "";
  let escaped = false;

  for (let i = arrayStart; i < html.length; i += 1) {
    const ch = html[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === quote) {
        inString = false;
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      inString = true;
      quote = ch;
      continue;
    }

    if (ch === "[") depth += 1;
    if (ch === "]") {
      depth -= 1;
      if (depth === 0) return html.slice(arrayStart, i + 1);
    }
  }

  throw new Error(`Could not parse const ${name}`);
}

function evalArray(source) {
  return vm.runInNewContext(`(${source})`, {}, { timeout: 1000 });
}

function decodeHtml(value) {
  return String(value ?? "")
    .replace(/&amp;/g, "&")
    .replace(/&middot;/g, "·")
    .replace(/&#11088;/g, "⭐")
    .replace(/&pound;/g, "£")
    .replace(/&rarr;/g, "→")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function slugify(value) {
  return decodeHtml(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

function parsePrice(price) {
  const text = decodeHtml(price).toLowerCase();
  if (!text || text.includes("poa") || text.includes("price on application")) return null;
  const match = text.match(/£\s*([0-9][0-9,.]*)(?:\s*(m|million))?/i);
  if (!match) return null;
  const numeric = Number(match[1].replace(/,/g, ""));
  if (!Number.isFinite(numeric)) return null;
  return match[2] ? Math.round(numeric * 1_000_000) : Math.round(numeric);
}

function parseRooms(property) {
  const text = `${property.type ?? ""} ${property.note ?? ""}`.toLowerCase();
  const matches = [...text.matchAll(/(\d{1,3})\s*(?:[- ]?(?:en[- ]?suite|bed(?:room)?s?|letting bedrooms?|rooms?|keys?|lodges?|suites?))/g)]
    .map((match) => Number(match[1]))
    .filter((num) => num > 0 && num < 120);
  if (matches.length) return Math.max(...matches);
  const fallback = text.match(/(?:sleeping up to|accommodation for)\s*(\d{1,3})/);
  return fallback ? Number(fallback[1]) : null;
}

function parseTenure(property) {
  const priceAndType = `${property.type ?? ""} ${property.price ?? ""}`.toLowerCase();
  if (/\bfreehold\b|\bfh\b/.test(priceAndType)) return "freehold";
  if (/\bleasehold\b|\blh\b/.test(priceAndType)) return "leasehold";
  const text = `${priceAndType} ${property.note ?? ""}`.toLowerCase();
  if (/\bfreehold\b|\bfh\b/.test(text)) return "freehold";
  if (/\bleasehold\b|\blh\b/.test(text)) return "leasehold";
  return "unknown";
}

function parseKind(property) {
  const text = `${property.name ?? ""} ${property.type ?? ""} ${property.note ?? ""}`.toLowerCase();
  if (/guest\s*house|bed\s*&\s*breakfast|\bb&b\b/.test(text)) return "guest_house";
  if (/\bpub\b|public house|freehouse|bar/.test(text)) return "pub";
  if (/\binn\b/.test(text)) return "inn";
  if (/\bhotel\b/.test(text)) return "hotel";
  if (/hostel|holiday|self-catering|cottage/.test(text)) return "holiday_accommodation";
  return "hospitality";
}

function parseRefreshDate() {
  const match = html.match(/refreshed\s+(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/i);
  if (!match) return null;
  const months = {
    jan: "01",
    january: "01",
    feb: "02",
    february: "02",
    mar: "03",
    march: "03",
    apr: "04",
    april: "04",
    may: "05",
    jun: "06",
    june: "06",
    jul: "07",
    july: "07",
    aug: "08",
    august: "08",
    sep: "09",
    september: "09",
    oct: "10",
    october: "10",
    nov: "11",
    november: "11",
    dec: "12",
    december: "12"
  };
  const day = match[1].padStart(2, "0");
  return `${match[3]}-${months[match[2].toLowerCase()] ?? "01"}-${day}`;
}

function parseClusters() {
  const cards = [...html.matchAll(/<div class="cc" onclick="zt\(([-0-9.]+),([-0-9.]+),(\d+)\)"><div class="ct">([\s\S]*?)<\/div><div class="cp">([\s\S]*?)<\/div><span class="cd">([\s\S]*?)<\/span><\/div>/g)];
  return cards.map((match, index) => {
    const title = decodeHtml(match[4]).replace(/<[^>]+>/g, "").trim();
    const properties = decodeHtml(match[5]).replace(/<[^>]+>/g, "").trim();
    const detail = decodeHtml(match[6]).replace(/<[^>]+>/g, "").trim();
    return {
      id: `cluster-${String(index + 1).padStart(2, "0")}-${slugify(title)}`,
      title,
      properties,
      detail,
      lat: Number(match[1]),
      lng: Number(match[2]),
      zoom: Number(match[3]),
      priority: title.includes("⭐") || title.includes("Harrogate") || title.includes("Windermere") ? "high" : "standard"
    };
  });
}

function scoreProperty(property) {
  let score = 46;
  const price = property.priceValue;
  const rooms = property.rooms;
  const ppr = property.pricePerRoom;

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
    if (price >= 250_000 && price <= 1_250_000) score += 11;
    if (price > 2_000_000) score -= 9;
  } else {
    score -= 5;
  }

  if (ppr != null) {
    if (ppr <= 80_000) score += 10;
    else if (ppr <= 120_000) score += 5;
    else if (ppr > 180_000) score -= 8;
  }

  if ([4, 6, 7, 13, 14, 15].includes(property.areaId)) score += 5;
  if (/turnover|profit|ebitda|net profit/i.test(property.note)) score += 4;
  if (/requires|closed|upgrading|vacant|development potential/i.test(property.note)) score -= 3;

  return Math.max(1, Math.min(100, Math.round(score)));
}

function confidence(property) {
  let score = 72;
  if (property.status === "live") score += 8;
  if (property.status === "unconfirmed") score -= 26;
  if (property.priceValue == null) score -= 11;
  if (property.rooms == null) score -= 7;
  if (!property.url) score -= 14;
  return Math.max(1, Math.min(100, score));
}

const areas = evalArray(extractConst("AREAS")).map((area) => ({
  id: area.id,
  slug: slugify(area.name),
  name: decodeHtml(area.name),
  shortName: decodeHtml(area.s),
  color: area.c
}));

const properties = evalArray(extractConst("P")).map((raw, index) => {
  const area = areas.find((item) => item.id === raw.area);
  const clean = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, decodeHtml(value)]));
  const rooms = parseRooms(clean);
  const priceValue = parsePrice(clean.price);
  const pricePerRoom = priceValue != null && rooms ? Math.round(priceValue / rooms) : null;
  const enriched = {
    id: `p-${String(index + 1).padStart(3, "0")}-${slugify(clean.name)}`,
    sourceIndex: index + 1,
    name: clean.name,
    areaId: raw.area,
    areaName: area?.name ?? "Unknown",
    areaSlug: area?.slug ?? "unknown",
    lat: Number(raw.lat),
    lng: Number(raw.lng),
    kind: parseKind(clean),
    type: clean.type,
    tenure: parseTenure(clean),
    rooms,
    price: clean.price,
    priceValue,
    pricePerRoom,
    source: clean.source,
    location: clean.location,
    url: clean.url,
    status: clean.status,
    note: clean.note,
    lastSeen: parseRefreshDate() ?? "2026-08-12"
  };
  return {
    ...enriched,
    fitScore: scoreProperty(enriched),
    confidence: confidence(enriched)
  };
});

const metadata = {
  title: "JY Hotels Property Acquisition Map",
  sourceUrl: "https://twystukaugust.pplx.app/",
  refreshedAt: parseRefreshDate() ?? "2026-08-12",
  extractedAt: new Date().toISOString(),
  propertyCount: properties.length
};

const data = {
  metadata,
  areas,
  clusters: parseClusters(),
  properties
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(data, null, 2)}\n`);

console.log(`Wrote ${properties.length} properties, ${areas.length} areas, and ${data.clusters.length} clusters to ${outputPath}`);
