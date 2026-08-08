/**
 * Importa avatares nuevos desde el folder de assets de Cursor.
 * *1 → miniatura (knockout fondo negro)
 * *2 → perfil + stage recortado
 *
 *   node scripts/import-avatar-batch.mjs
 */
import { readdir, mkdir, writeFile } from "node:fs/promises";
import { join, basename } from "node:path";
import sharp from "sharp";

const ASSETS =
  "C:/Users/Fede Crossetto/.cursor/projects/c-Repos-pokemon-rpg/assets";
const OUT_DIR = "public/avatars";
const STAGE_DIR = "public/avatars/stage";
const THRESHOLD = 22;

/** Sólo este lote (no reescribir ash/aura/etc. del folder de assets). */
const ALLOW_ROOTS = new Set([
  "ariana",
  "azul",
  "camila",
  "chase",
  "cintia",
  "fero",
  "kalm",
  "lira",
  "lucho",
  "n",
  "nanci",
  "petra",
  "rojo",
]);

function toSlug(base) {
  // AzulA1 → azul + a → azula ; NA1 → na ; N1 → n ; nanciA1 → nancia
  const m = base.match(/^([A-Za-z]+?)([A-Z])?([12])$/);
  if (!m) return null;
  const root = m[1].toLowerCase();
  const letter = m[2] ? m[2].toLowerCase() : "";
  return `${root}${letter}`;
}

function isAllowed(slug) {
  for (const root of ALLOW_ROOTS) {
    if (slug === root) return true;
    if (slug.startsWith(root) && slug.length === root.length + 1) return true;
  }
  return false;
}

function floodKnockout(data, width, height, channels) {
  const visited = new Uint8Array(width * height);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    stack.push(x, y);
  };
  for (let x = 0; x < width; x++) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    push(0, y);
    push(width - 1, y);
  }
  while (stack.length) {
    const y = stack.pop();
    const x = stack.pop();
    const p = y * width + x;
    if (visited[p]) continue;
    visited[p] = 1;
    const i = p * channels;
    const a = data[i + 3];
    if (a === 0) {
      push(x - 1, y);
      push(x + 1, y);
      push(x, y - 1);
      push(x, y + 1);
      continue;
    }
    if (data[i] > THRESHOLD || data[i + 1] > THRESHOLD || data[i + 2] > THRESHOLD) {
      continue;
    }
    data[i + 3] = 0;
    push(x - 1, y);
    push(x + 1, y);
    push(x, y - 1);
    push(x, y + 1);
  }
}

async function processPng(srcPath, destPath, { trimForStage = false } = {}) {
  const { data, info } = await sharp(srcPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  floodKnockout(data, info.width, info.height, info.channels);
  let buf = await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(destPath, buf);
  if (trimForStage) {
    const trimmed = await sharp(buf).trim({ threshold: 1 }).png().toBuffer();
    return trimmed;
  }
  return null;
}

const files = await readdir(ASSETS);
/** @type {Map<string, { v1?: string, v2?: string }>} */
const bySlug = new Map();

for (const file of files) {
  // images_Name1-uuid.png  OR  sometimes shorter
  const m = file.match(/_images_([A-Za-z0-9]+)[-_][a-f0-9-]+\.png$/i);
  if (!m) continue;
  const base = m[1];
  const variantMatch = base.match(/^(.*)([12])$/);
  if (!variantMatch) continue;
  const namePart = variantMatch[1];
  const variant = variantMatch[2];
  // Rebuild base as Name+variant for toSlug: e.g. AzulA + 1
  const slug = toSlug(namePart + variant);
  if (!slug || !isAllowed(slug)) continue;
  const entry = bySlug.get(slug) ?? {};
  if (variant === "1") entry.v1 = join(ASSETS, file);
  else entry.v2 = join(ASSETS, file);
  bySlug.set(slug, entry);
}

await mkdir(OUT_DIR, { recursive: true });
await mkdir(STAGE_DIR, { recursive: true });

const ready = [];
const incomplete = [];

for (const [slug, entry] of [...bySlug.entries()].sort()) {
  if (!entry.v1 || !entry.v2) {
    incomplete.push({ slug, has1: !!entry.v1, has2: !!entry.v2 });
    continue;
  }
  await processPng(entry.v1, join(OUT_DIR, `${slug}1.png`));
  const stageBuf = await processPng(entry.v2, join(OUT_DIR, `${slug}2.png`), {
    trimForStage: true,
  });
  await writeFile(join(STAGE_DIR, `${slug}.png`), stageBuf);
  ready.push(slug);
  console.log(`✓ ${slug}`);
}

console.log(`\nImportados: ${ready.length}`);
if (incomplete.length) {
  console.log("Incompletos (falta 1 o 2):");
  for (const x of incomplete) console.log(" ", x);
}
console.log("\nSLUGS_JSON=" + JSON.stringify(ready));
