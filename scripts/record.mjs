import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import ffmpegPath from "ffmpeg-static";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "output");
const framesDir = path.join(outDir, "frames");
fs.mkdirSync(outDir, { recursive: true });
fs.rmSync(framesDir, { recursive: true, force: true });
fs.mkdirSync(framesDir, { recursive: true });

const PORT = 5173;
const URL = `http://127.0.0.1:${PORT}/?export=1`;
const WIDTH = 1280;
const HEIGHT = 720;
const FPS = 20;
const DURATION = 110;
const TOTAL = FPS * DURATION;

function run(cmd, args, opts = {}) {
  return spawn(cmd, args, {
    stdio: "inherit",
    shell: false,
    windowsHide: true,
    ...opts,
  });
}

async function waitForServer(url, tries = 40) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("Vite did not start");
}

await new Promise((resolve, reject) => {
  const p = run(process.execPath, [path.join(root, "scripts", "score.mjs")]);
  p.on("exit", (code) => (code === 0 ? resolve() : reject(new Error("score failed"))));
});

const viteCli = path.join(root, "node_modules", "vite", "bin", "vite.js");
const preview = run(process.execPath, [viteCli, "--host", "127.0.0.1", "--port", String(PORT)], {
  cwd: root,
});

try {
  await waitForServer(`http://127.0.0.1:${PORT}/`);

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--use-gl=angle",
      "--ignore-gpu-blocklist",
      "--enable-webgl",
      "--autoplay-policy=no-user-gesture-required",
      "--hide-scrollbars",
      `--window-size=${WIDTH},${HEIGHT}`,
    ],
  });

  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
  });

  const page = await context.newPage();
  page.setDefaultTimeout(180000);
  page.on("crash", () => console.error("PAGE CRASHED"));
  page.on("close", () => console.error("PAGE CLOSED"));
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__READY === true, { timeout: 180000 });
  console.log(`Capturing ${TOTAL} frames at ${WIDTH}x${HEIGHT} ${FPS}fps`);

  for (let i = 0; i < TOTAL; i++) {
    const t = i / FPS;
    await page.evaluate(async (time) => {
      window.__seek(time);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    }, t);
    const buf = await page.screenshot({
      type: "jpeg",
      quality: 78,
    });
    fs.writeFileSync(path.join(framesDir, `${String(i).padStart(5, "0")}.jpg`), buf);
    if (i === 0 && buf.length < 25000) {
      throw new Error(`First frame too small (${buf.length} bytes) — WebGL likely failed`);
    }
    if (i % FPS === 0) console.log(`  ${i / FPS}s / ${DURATION}s`);
  }

  await context.close();
  await browser.close();

  const wav = path.join(outDir, "score.wav");
  const mp4 = path.join(outDir, "Adventure-2K26.mp4");
  await new Promise((resolve, reject) => {
    const p = run(ffmpegPath, [
      "-y",
      "-framerate",
      String(FPS),
      "-i",
      path.join(framesDir, "%05d.jpg"),
      "-i",
      wav,
      "-map",
      "0:v:0",
      "-map",
      "1:a:0",
      "-c:v",
      "libx264",
      "-crf",
      "20",
      "-preset",
      "veryfast",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "160k",
      "-shortest",
      "-movflags",
      "+faststart",
      mp4,
    ]);
    p.on("exit", (code) => (code === 0 ? resolve() : reject(new Error("ffmpeg failed"))));
  });

  fs.rmSync(framesDir, { recursive: true, force: true });
  console.log("\nRendered:", mp4);
} finally {
  preview.kill();
}
