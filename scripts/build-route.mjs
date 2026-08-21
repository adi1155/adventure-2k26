import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "data");

const files = ["m2.json", "m1_balakot.json", "valley.json", "babusar.json"];

function haversine(a, b) {
  const R = 6371000;
  const toRad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * toRad;
  const dLon = (b[0] - a[0]) * toRad;
  const lat1 = a[1] * toRad;
  const lat2 = b[1] * toRad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function loadCoords(file) {
  const json = JSON.parse(fs.readFileSync(path.join(dataDir, file), "utf8"));
  return json.routes[0].geometry.coordinates.map(([lon, lat]) => [lon, lat]);
}

function concatRoutes(segments) {
  const out = [];
  for (const seg of segments) {
    for (const pt of seg) {
      const prev = out[out.length - 1];
      if (prev && prev[0] === pt[0] && prev[1] === pt[1]) continue;
      out.push(pt);
    }
  }
  return out;
}

function resample(coords, intervalM) {
  if (coords.length < 2) return coords.slice();
  const out = [coords[0]];
  let carry = 0;
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1];
    const b = coords[i];
    const d = haversine(a, b);
    if (d === 0) continue;
    let dist = intervalM - carry;
    while (dist <= d) {
      const t = dist / d;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      dist += intervalM;
    }
    carry = d - (dist - intervalM);
  }
  const last = coords[coords.length - 1];
  const tail = out[out.length - 1];
  if (haversine(tail, last) > 15) out.push(last);
  else out[out.length - 1] = last;
  return out;
}

function cumulative(coords) {
  const dist = [0];
  for (let i = 1; i < coords.length; i++) {
    dist.push(dist[i - 1] + haversine(coords[i - 1], coords[i]));
  }
  return dist;
}

function nearestIndex(coords, lon, lat) {
  let best = 0;
  let bestD = Infinity;
  const target = [lon, lat];
  for (let i = 0; i < coords.length; i++) {
    const d = haversine(coords[i], target);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return { index: best, meters: bestD, coord: coords[best] };
}

const raw = concatRoutes(files.map(loadCoords));
const coordinates = resample(raw, 180);
const cumdist = cumulative(coordinates);
const totalM = cumdist[cumdist.length - 1];

const places = {
  lahore: { name: "Lahore", lon: 74.3436, lat: 31.5497 },
  islamabad: { name: "Islamabad", lon: 73.0479, lat: 33.6844 },
  balakot: { name: "Balakot", lon: 73.353, lat: 34.548 },
  kiwai: { name: "Kiwai", lon: 73.519, lat: 34.761 },
  kaghan: { name: "Kaghan", lon: 73.528, lat: 34.777 },
  naran: { name: "Naran", lon: 73.651, lat: 34.904 },
  babusar: { name: "Babusar Top", lon: 74.046, lat: 35.207 },
  chilas: { name: "Chilas", lon: 74.1, lat: 35.426 },
  m1: { name: "M-1 Motorway", lon: 72.689, lat: 33.819 },
};

const resolved = {};
for (const [id, place] of Object.entries(places)) {
  const hit = nearestIndex(coordinates, place.lon, place.lat);
  resolved[id] = {
    name: place.name,
    index: hit.index,
    km: cumdist[hit.index] / 1000,
    coord: hit.coord,
    snapMeters: Math.round(hit.meters),
  };
}

const out = {
  totalKm: Math.round((totalM / 1000) * 10) / 10,
  pointCount: coordinates.length,
  coordinates,
  cumdist,
  places: resolved,
};

const publicDir = path.join(root, "public");
fs.mkdirSync(publicDir, { recursive: true });
fs.writeFileSync(path.join(publicDir, "route.json"), JSON.stringify(out));

console.log(
  `Route ${out.totalKm} km, ${out.pointCount} points`,
);
for (const [id, p] of Object.entries(resolved)) {
  console.log(`  ${id.padEnd(10)} km=${p.km.toFixed(1).padStart(6)} snap=${p.snapMeters}m`);
}
