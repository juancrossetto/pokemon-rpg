/**
 * Regenera las startup images iOS desde public/splash/boot.webp.
 * Uso: node scripts/generate-apple-splashes.mjs
 */
import sharp from "sharp";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "public/splash/boot.webp");
const outDir = path.join(root, "public/splash/apple");

const portraits = [
  [1290, 2796, 430, 932, 3],
  [1179, 2556, 393, 852, 3],
  [1170, 2532, 390, 844, 3],
  [1284, 2778, 428, 926, 3],
  [1125, 2436, 375, 812, 3],
  [1242, 2688, 414, 896, 3],
  [828, 1792, 414, 896, 2],
  [750, 1334, 375, 667, 2],
  [1242, 2208, 414, 736, 3],
  [2048, 2732, 1024, 1366, 2],
  [1668, 2388, 834, 1194, 2],
  [1640, 2360, 820, 1180, 2],
  [1536, 2048, 768, 1024, 2],
];

async function cover(w, h) {
  return sharp(src)
    .resize(w, h, { fit: "cover", position: "top" })
    .flatten({ background: { r: 10, g: 8, b: 6 } })
    .jpeg({ quality: 72, mozjpeg: true })
    .toBuffer();
}

fs.mkdirSync(outDir, { recursive: true });
const meta = [];
let total = 0;

for (const [w, h, cssW, cssH, dpr] of portraits) {
  for (const [ow, oh, orient] of [
    [w, h, "portrait"],
    [h, w, "landscape"],
  ]) {
    const name = `apple-splash-${ow}-${oh}.jpg`;
    const buf = await cover(ow, oh);
    fs.writeFileSync(path.join(outDir, name), buf);
    total += buf.length;
    meta.push({
      href: `/splash/apple/${name}`,
      media: `screen and (device-width: ${cssW}px) and (device-height: ${cssH}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: ${orient})`,
    });
  }
}

fs.writeFileSync(path.join(outDir, "entries.json"), JSON.stringify(meta, null, 2));
console.log(`Wrote ${meta.length} images (${(total / 1024 / 1024).toFixed(2)} MB)`);
