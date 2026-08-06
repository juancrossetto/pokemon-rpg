/**
 * Mide un PNG de marco para cargarlo en `src/lib/home-frames.ts`.
 *
 * El corte (`slice`) NO se deduce del arte: es una decisión. Intenté
 * detectarlo buscando dónde el borde deja de ser un riel de altura constante,
 * y en el marco original da 376 — que es donde arranca la voluta, sí, pero
 * 2×376 supera los 634px de alto del PNG y `border-image` no puede usarlo.
 * Por eso los assets sueltos se cortaron a 160. Así que el corte se pasa por
 * parámetro y el script valida que entre.
 *
 * Lo que sí se mide es dónde cae el riel dentro de esa esquina, por lado: de
 * ahí salen la retracción del arte y el padding del copy.
 *
 *   node scripts/measure-frame.mjs public/home/frames/marco-1.png [slice=160]
 */
import sharp from "sharp";

const file = process.argv[2];
const slice = Number(process.argv[3] ?? 160);

if (!file) {
  console.error("uso: node scripts/measure-frame.mjs <archivo.png> [slice]");
  process.exit(1);
}

const img = sharp(file);
const { width, height } = await img.metadata();
const { data } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });

const alpha = (x, y) => data[(y * width + x) * 4 + 3];

function opaqueRows(x, from, to) {
  const rows = [];
  for (let y = from; y < to; y++) if (alpha(x, y) > 20) rows.push(y);
  return rows;
}

function opaqueCols(y, from, to) {
  const cols = [];
  for (let x = from; x < to; x++) if (alpha(x, y) > 20) cols.push(x);
  return cols;
}

const limit = Math.min(width, height);
if (slice * 2 > limit) {
  console.error(
    `slice ${slice} no entra: 2×${slice} = ${slice * 2} supera el lado corto (${limit}).`,
  );
  process.exit(1);
}

// Se mide en el medio de cada lado, donde sólo está el riel recto.
const midX = Math.floor(width / 2);
const midY = Math.floor(height / 2);
const top = opaqueRows(midX, 0, slice);
const bottom = opaqueRows(midX, height - slice, height);
const left = opaqueCols(midY, 0, slice);
const right = opaqueCols(midY, width - slice, width);

if (!top.length || !bottom.length || !left.length || !right.length) {
  console.error("no encontré riel en algún lado — ¿el PNG tiene marco completo?");
  process.exit(1);
}

const f = (n) => Number((n / slice).toFixed(2));

console.log(`${file}  ${width}x${height}  slice ${slice}`);
console.log("{");
console.log(`  slice: ${slice},`);
console.log("  rails: {");
console.log(`    top: ${f(top.at(-1) + 1)},`);
console.log(`    bottom: ${f(slice - (bottom[0] - (height - slice)))},`);
console.log(`    left: ${f(left.at(-1) + 1)},`);
console.log(`    right: ${f(slice - (right[0] - (width - slice)))},`);
console.log("  },");
console.log("}");
