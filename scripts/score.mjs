import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "output");
fs.mkdirSync(outDir, { recursive: true });

const sampleRate = 44100;
const duration = 110;
const n = sampleRate * duration;
const L = new Float32Array(n);
const R = new Float32Array(n);

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function env(t, a, d, s, hold, r) {
  if (t < 0) return 0;
  if (t < a) return t / a;
  if (t < a + d) return 1 - (1 - s) * ((t - a) / d);
  if (t < a + d + hold) return s;
  const k = (t - a - d - hold) / r;
  return k >= 1 ? 0 : s * (1 - k);
}

function addSine(bufL, bufR, t0, t1, freq, amp, pan = 0) {
  const i0 = Math.max(0, Math.floor(t0 * sampleRate));
  const i1 = Math.min(n, Math.floor(t1 * sampleRate));
  const len = Math.max(1, i1 - i0);
  for (let i = i0; i < i1; i++) {
    const t = i / sampleRate - t0;
    const u = (i - i0) / len;
    const fade = Math.sin(Math.PI * clamp(u, 0, 1));
    const s = Math.sin(2 * Math.PI * freq * (i / sampleRate)) * amp * fade;
    bufL[i] += s * (1 - pan) * 0.7;
    bufR[i] += s * (1 + pan) * 0.7;
  }
}

function addNoiseBurst(t0, dur, amp) {
  const i0 = Math.floor(t0 * sampleRate);
  const i1 = Math.min(n, Math.floor((t0 + dur) * sampleRate));
  for (let i = i0; i < i1; i++) {
    const u = (i - i0) / Math.max(1, i1 - i0);
    const g = amp * Math.exp(-u * 7) * (Math.random() * 2 - 1);
    L[i] += g;
    R[i] += g * 0.92;
  }
}

function addHit(t0) {
  addNoiseBurst(t0, 0.35, 0.22);
  addSine(L, R, t0, t0 + 0.9, 92, 0.16, 0);
  addSine(L, R, t0, t0 + 0.7, 46, 0.2, 0);
}

for (let i = 0; i < n; i++) {
  const t = i / sampleRate;
  const intro = env(t, 0.8, 2, 0.7, 8, 4);
  const travel = env(t - 15, 1.2, 2, 0.85, 40, 6);
  const north = env(t - 40, 2, 3, 0.9, 18, 5);
  const peak = env(t - 60.5, 1.4, 1.5, 1, 6, 3.5);
  const finale = env(t - 75.5, 1.2, 1.5, 0.9, 6, 3);

  const drone =
    Math.sin(2 * Math.PI * 73.42 * t) * 0.06 * (0.5 + intro) +
    Math.sin(2 * Math.PI * 110 * t) * 0.045 +
    Math.sin(2 * Math.PI * 146.83 * t) * 0.03;
  const strings =
    (Math.sin(2 * Math.PI * 220.0 * t) * 0.028 +
      Math.sin(2 * Math.PI * 261.63 * t) * 0.022 +
      Math.sin(2 * Math.PI * 329.63 * t) * 0.018) *
    (0.15 + travel * 0.7 + north * 0.4);
  const choir =
    (Math.sin(2 * Math.PI * 293.66 * t) * 0.03 +
      Math.sin(2 * Math.PI * 440 * t) * 0.025 +
      Math.sin(2 * Math.PI * 587.33 * t) * 0.018) *
    (peak * 0.95 + finale * 0.55);
  const pulse = Math.sin(2 * Math.PI * 49 * t) * 0.04 * travel * (0.4 + 0.6 * Math.abs(Math.sin(t * 1.7)));
  const air = (Math.random() * 2 - 1) * (0.008 + north * 0.01 + peak * 0.012);
  const lift = finale * Math.sin(2 * Math.PI * 82.41 * t) * 0.04;

  const mix = (drone + strings + choir + pulse + air + lift) * (0.55 + intro * 0.2);
  const pan = Math.sin(t * 0.11) * 0.12;
  L[i] += mix * (1 - pan);
  R[i] += mix * (1 + pan);
}

const hits = [12.2, 15.3, 21.4, 33.8, 40.2, 47.4, 55.6, 62.6, 70.2, 79.8, 93.6, 99.8];
for (const h of hits) addHit(h);

function writeWav(file, chL, chR) {
  const bytesPerSample = 2;
  const dataSize = n * 2 * bytesPerSample;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2 * bytesPerSample, 28);
  buf.writeUInt16LE(2 * bytesPerSample, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(dataSize, 40);
  let o = 44;
  for (let i = 0; i < n; i++) {
    const a = clamp(chL[i], -1, 1);
    const b = clamp(chR[i], -1, 1);
    buf.writeInt16LE((a * 32767) | 0, o);
    buf.writeInt16LE((b * 32767) | 0, o + 2);
    o += 4;
  }
  fs.writeFileSync(file, buf);
}

const wavPath = path.join(outDir, "score.wav");
writeWav(wavPath, L, R);
console.log("Wrote", wavPath);
