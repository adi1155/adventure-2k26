import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ffmpegPath from "ffmpeg-static";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const photos = path.join(root, "public", "photos");
const stops = ["lahore", "islamabad", "balakot", "kiwai", "kaghan", "naran", "babusar", "chilas"];

const crops = [
  "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720",
  "scale=1600:900:force_original_aspect_ratio=increase,crop=1280:720:0:90",
  "scale=1600:900:force_original_aspect_ratio=increase,crop=1280:720:320:90",
  "scale=1920:1080:force_original_aspect_ratio=increase,crop=1280:720:(in_w-1280)/2:0",
  "scale=1920:1080:force_original_aspect_ratio=increase,crop=1280:720:(in_w-1280)/2:(in_h-720)",
];

for (const stop of stops) {
  const src = path.join(photos, `${stop}.jpg`);
  const dir = path.join(photos, stop);
  fs.mkdirSync(dir, { recursive: true });
  crops.forEach((vf, i) => {
    const dest = path.join(dir, `${i + 1}.jpg`);
    const result = spawnSync(
      ffmpegPath,
      ["-y", "-i", src, "-vf", vf, "-q:v", "4", dest],
      { stdio: "inherit" },
    );
    if (result.status !== 0) {
      throw new Error(`ffmpeg failed for ${stop} shot ${i + 1}`);
    }
  });
}

console.log("Wrote 5 stills for each stop.");
