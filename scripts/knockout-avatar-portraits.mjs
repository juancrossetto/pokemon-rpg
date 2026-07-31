/**
 * Quita el fondo negro opaco de los retratos `public/avatars/*1.png`.
 *
 * Los *1 vienen de renders con lienzo negro sólido: en chips circulares
 * (ranking, amigos) se ve el cuadrado negro y bordes sucios. Acá se hace
 * flood-fill desde los bordes sobre píxeles casi-negros y se escribe alfa=0.
 * El trazo oscuro del personaje no se toca si no está conectado al borde.
 *
 *   node scripts/knockout-avatar-portraits.mjs
 *   node scripts/knockout-avatar-portraits.mjs ash1.png misty1.png   # subset
 */
import { readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const SRC_DIR = "public/avatars";
const THRESHOLD = 22;

const args = process.argv.slice(2);
const files =
  args.length > 0
    ? args.map((f) => (f.endsWith(".png") ? f : `${f}.png`))
    : (await readdir(SRC_DIR)).filter((f) => f.endsWith("1.png"));

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

  let cleared = 0;
  while (stack.length) {
    const y = stack.pop();
    const x = stack.pop();
    const p = y * width + x;
    if (visited[p]) continue;
    visited[p] = 1;

    const i = p * channels;
    const a = data[i + 3];

    // Ya transparente: seguimos caminando para alcanzar bolsas de negro
    // interiores (muchos *1 ya tienen esquinas con alfa=0).
    if (a === 0) {
      push(x - 1, y);
      push(x + 1, y);
      push(x, y - 1);
      push(x, y + 1);
      continue;
    }

    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r > THRESHOLD || g > THRESHOLD || b > THRESHOLD) continue;

    data[i + 3] = 0;
    cleared++;
    push(x - 1, y);
    push(x + 1, y);
    push(x, y - 1);
    push(x, y + 1);
  }
  return cleared;
}

let total = 0;
for (const file of files) {
  const input = join(SRC_DIR, file);
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const cleared = floodKnockout(data, info.width, info.height, info.channels);
  if (cleared === 0) {
    console.log(`${file.padEnd(28)} sin cambios`);
    continue;
  }

  const out = await sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: info.channels,
    },
  })
    .png()
    .toBuffer();

  await writeFile(input, out);
  total++;
  console.log(
    `${file.padEnd(28)} ${info.width}x${info.height}  cleared=${cleared}`,
  );
}

console.log(`\n${total}/${files.length} retratos con fondo transparente`);
