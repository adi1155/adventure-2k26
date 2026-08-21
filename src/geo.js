export const DURATION = 126;

export function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function lerp2(a, b, t) {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
}

export function smoothstep(t) {
  t = clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
}

export function smoother(t) {
  t = clamp(t, 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

export function range(t, a, b) {
  return smoother((t - a) / (b - a));
}

export function haversine(a, b) {
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

export function bearing(a, b) {
  const toRad = Math.PI / 180;
  const φ1 = a[1] * toRad;
  const φ2 = b[1] * toRad;
  const Δλ = (b[0] - a[0]) * toRad;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function shortestAngle(from, to) {
  return ((((to - from) % 360) + 540) % 360) - 180;
}

export function mixAngle(from, to, t) {
  return (from + shortestAngle(from, to) * t + 360) % 360;
}

export function pointAt(route, meters) {
  const { coordinates: coords, cumdist } = route;
  const m = clamp(meters, 0, cumdist[cumdist.length - 1]);
  let lo = 0;
  let hi = cumdist.length - 1;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (cumdist[mid] < m) lo = mid + 1;
    else hi = mid;
  }
  const i = Math.max(1, lo);
  const d0 = cumdist[i - 1];
  const d1 = cumdist[i];
  const t = d1 === d0 ? 0 : (m - d0) / (d1 - d0);
  return lerp2(coords[i - 1], coords[i], t);
}

export function sliceRoute(route, meters) {
  const { coordinates: coords, cumdist } = route;
  const m = clamp(meters, 0, cumdist[cumdist.length - 1]);
  const out = [coords[0]];
  for (let i = 1; i < coords.length; i++) {
    if (cumdist[i] <= m) out.push(coords[i]);
    else {
      const t = (m - cumdist[i - 1]) / Math.max(1, cumdist[i] - cumdist[i - 1]);
      out.push(lerp2(coords[i - 1], coords[i], t));
      break;
    }
  }
  return out;
}
