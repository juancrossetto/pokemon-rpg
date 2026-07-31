/**
 * Normaliza el arte de avatar para la escena del perfil.
 *
 * El arte de `public/avatars/*2.png` viene con encuadres muy distintos: unos
 * son retratos ajustados (242×684) y otros vienen centrados dentro de un lienzo
 * cuadrado con 60–70% de píxeles transparentes (256×256 con la figura de 88px
 * de ancho). La escena dimensiona por altura, así que ese margen invisible se
 * traduce en un personaje diminuto flotando sobre la línea de piso.
 *
 * Acá se recorta el bounding box opaco y se escribe en `public/avatars/stage/`.
 * El original queda intacto: el picker y los chips siguen usando `*1.png`, y si
 * el arte se reemplaza basta con volver a correr esto.
 *
 *   node scripts/build-avatar-stage.mjs
 */
import { readdir, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const SRC_DIR = "public/avatars";
const OUT_DIR = "public/avatars/stage";

const files = (await readdir(SRC_DIR)).filter((f) => f.endsWith("2.png"));
await mkdir(OUT_DIR, { recursive: true });

const manifest = {};

for (const file of files) {
  const slug = file.replace(/2\.png$/, "");
  const input = join(SRC_DIR, file);

  // `trim` recorta contra el borde; con umbral 1 alcanza para alfa puro.
  const trimmed = await sharp(input).trim({ threshold: 1 }).png().toBuffer();
  const meta = await sharp(trimmed).metadata();

  await writeFile(join(OUT_DIR, `${slug}.png`), trimmed);
  manifest[slug] = { width: meta.width, height: meta.height };

  const before = await sharp(input).metadata();
  console.log(
    `${slug.padEnd(20)} ${before.width}x${before.height} → ${meta.width}x${meta.height}` +
      `  ar=${(meta.width / meta.height).toFixed(2)}`,
  );
}

console.log(`\n${files.length} avatares normalizados en ${OUT_DIR}`);
