/**
 * Redimensiona/recomprime los PNG sobredimensionados de public/.
 * Uso único (npm i -D sharp-cli para tener sharp); conserva nombres y alpha.
 * Los tamaños destino cubren el mayor render real @2x.
 */
import sharp from "sharp";
import { readdir, rename, stat } from "node:fs/promises";
import path from "node:path";

const jobs = [
  // [glob dir, filtro, maxDim, opciones png]
  { dir: "public/ranking", match: /^insignia-.*\.png$/, max: 512 },
  { dir: "public/clans/emblems", match: /^guild-.*\.png$/, max: 512 },
  { dir: "public/gyms/portraits", match: /\.png$/, max: 640 },
  { dir: "public/events", match: /^gift_.*\.png$/, max: 512 },
  { dir: "public", match: /^logo\.png$/, max: 640 },
  { dir: "public/auth", match: /\.png$/, max: 1280 },
  { dir: "public/gyms/maps", match: /\.png$/, max: 900 },
  /*
   * Íconos HD de objeto. Se muestran de 10 a ~28px en chips, recompensas y
   * mochila, y la mayoría del set ya está en 256. Tres quedaron fuera de
   * escala (rare-candy 1024², energy-pack 512², coin-bag 415×388) y el
   * navegador los decodifica enteros: medido en campaña, rare-candy pintaba a
   * 28px con 334 veces los píxeles necesarios. 256 cubre el render real @2x y
   * deja intacto todo lo que ya cumple.
   */
  { dir: "public/items/hd", match: /\.png$/, max: 256 },
  /*
   * `location-icon` es el único 512² de /nav y se pinta a 36px como máximo
   * (medido en el home: 51× los píxeles necesarios). El resto de la carpeta
   * ya está en 256 y algunos `*-profile` se muestran grandes, así que el job
   * apunta solo a este archivo.
   */
  { dir: "public/nav", match: /^location-icon\.png$/, max: 128 },
];

let savedTotal = 0;

for (const job of jobs) {
  const files = await readdir(job.dir);
  for (const f of files) {
    if (!job.match.test(f)) continue;
    const file = path.join(job.dir, f);
    const before = (await stat(file)).size;
    const tmp = file + ".tmp";
    await sharp(file)
      .resize(job.max, job.max, { fit: "inside", withoutEnlargement: true })
      .png({ compressionLevel: 9, palette: true, quality: 90 })
      .toFile(tmp);
    const after = (await stat(tmp)).size;
    if (after < before) {
      await rename(tmp, file);
      savedTotal += before - after;
      console.log(`${file}: ${(before / 1024).toFixed(0)}K -> ${(after / 1024).toFixed(0)}K`);
    } else {
      const { unlink } = await import("node:fs/promises");
      await unlink(tmp);
      console.log(`${file}: kept (no gain)`);
    }
  }
}

// Boot splash: sin alpha → WebP (los refs se actualizan en código aparte).
const bootBefore = (await stat("public/splash/boot.png")).size;
await sharp("public/splash/boot.png").webp({ quality: 82 }).toFile("public/splash/boot.webp");
const bootAfter = (await stat("public/splash/boot.webp")).size;
console.log(`boot.png ${(bootBefore / 1024).toFixed(0)}K -> boot.webp ${(bootAfter / 1024).toFixed(0)}K`);
savedTotal += bootBefore - bootAfter;

console.log(`TOTAL saved: ${(savedTotal / 1024 / 1024).toFixed(1)}M`);
