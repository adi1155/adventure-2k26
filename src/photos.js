import { clamp, smoother } from "./geo.js";

const SLIDE_SEC = 1;
const SLIDE_COUNT = 5;

function srcs(id) {
  return Array.from({ length: SLIDE_COUNT }, (_, i) => `/photos/${id}/${i + 1}.jpg`);
}

export const STOPS = [
  { id: "lahore", name: "Lahore", srcs: srcs("lahore"), t0: 15.1, dur: 8.0 },
  { id: "islamabad", name: "Islamabad", srcs: srcs("islamabad"), t0: 35.5, dur: 8.0 },
  { id: "balakot", name: "Balakot", srcs: srcs("balakot"), t0: 50.7, dur: 8.0 },
  { id: "kiwai", name: "Kiwai", srcs: srcs("kiwai"), t0: 61.6, dur: 8.0 },
  { id: "kaghan", name: "Kaghan", srcs: srcs("kaghan"), t0: 71.8, dur: 8.0 },
  { id: "naran", name: "Naran", srcs: srcs("naran"), t0: 82.6, dur: 8.0 },
  { id: "babusar", name: "Babusar Top", srcs: srcs("babusar"), t0: 95.0, dur: 9.2, peak: true },
  { id: "chilas", name: "Chilas", srcs: srcs("chilas"), t0: 109.2, dur: 8.0 },
];

export const FIRST_TRAVEL = STOPS[0].t0 + STOPS[0].dur;
export const LAST_START = STOPS.at(-1).t0;
export const LAST_END = STOPS.at(-1).t0 + STOPS.at(-1).dur;

export function stopById(id) {
  return STOPS.find((stop) => stop.id === id);
}

export function buildRouteLegs(km) {
  const legs = [];
  for (let i = 0; i < STOPS.length - 1; i += 1) {
    const from = STOPS[i];
    const to = STOPS[i + 1];
    const fromM = i === 0 ? 0 : km(from.id);
    const toM = km(to.id);
    legs.push([from.t0 + from.dur, to.t0, fromM, toM]);
    legs.push([to.t0, to.t0 + to.dur, toM, toM]);
  }
  return legs;
}

export function travelWindow(fromId, toId) {
  const from = stopById(fromId);
  const to = stopById(toId);
  return [from.t0 + from.dur, to.t0];
}

export function photoState(t) {
  for (const stop of STOPS) {
    const u = t - stop.t0;
    if (u < -0.45 || u > stop.dur) continue;
    const zoomIn = smoother(clamp((u - 0.12) / 1.15, 0, 1));
    const zoomOut = smoother(clamp((u - (stop.dur - 1.65)) / 1.45, 0, 1));
    const punch = Math.max(0, zoomIn * (1 - zoomOut));
    const photoIn = smoother(clamp((u - 0.85) / 0.42, 0, 1));
    const photoOut = smoother(clamp((u - (stop.dur - 1.5)) / 0.65, 0, 1));
    const photo = Math.max(0, photoIn * (1 - photoOut));
    const pin = smoother(clamp((u + 0.4) / 0.35, 0, 1));
    const raw = Math.max(0, u - 1.0);
    const maxI = SLIDE_COUNT - 1;
    const i = Math.min(maxI, Math.floor(raw / SLIDE_SEC));
    const local = raw - i * SLIDE_SEC;
    const move = i < maxI ? smoother(clamp((local - 0.78) / 0.22, 0, 1)) : 0;
    return { stop, punch, photo, pin, u, slide: i + move, slideIndex: i };
  }
  return null;
}

export function revealedStopIds(t) {
  return STOPS.filter((s) => t >= s.t0 - (s.id === "lahore" ? 2.6 : 0.45)).map((s) => s.id);
}
