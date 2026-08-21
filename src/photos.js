import { clamp, smoother } from "./geo.js";

export const STOPS = [
  { id: "lahore", name: "Lahore", src: "/photos/lahore.jpg", t0: 15.1, dur: 6.0 },
  { id: "islamabad", name: "Islamabad", src: "/photos/islamabad.jpg", t0: 33.7, dur: 6.1 },
  { id: "balakot", name: "Balakot", src: "/photos/balakot.jpg", t0: 47.3, dur: 5.2 },
  { id: "kiwai", name: "Kiwai", src: "/photos/kiwai.jpg", t0: 55.5, dur: 4.7 },
  { id: "kaghan", name: "Kaghan", src: "/photos/kaghan.jpg", t0: 62.5, dur: 4.7 },
  { id: "naran", name: "Naran", src: "/photos/naran.jpg", t0: 70.1, dur: 5.0 },
  { id: "babusar", name: "Babusar Top", src: "/photos/babusar.jpg", t0: 79.7, dur: 8.4, peak: true },
  { id: "chilas", name: "Chilas", src: "/photos/chilas.jpg", t0: 93.5, dur: 6.0 },
];

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
    return { stop, punch, photo, pin, u };
  }
  return null;
}

export function revealedStopIds(t) {
  return STOPS.filter((s) => t >= s.t0 - (s.id === "lahore" ? 2.6 : 0.45)).map((s) => s.id);
}
