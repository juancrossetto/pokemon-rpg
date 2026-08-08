/**
 * Importa el lote de NPCs de aventura desde Downloads.
 * Knockout fondo negro + genera *1 / *2 / stage.
 *
 *   node scripts/import-adventure-npc-avatars.mjs
 */
import { mkdir, writeFile, copyFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const DL = "C:/Users/Fede Crossetto/Downloads";
const OUT = "public/avatars";
const STAGE = "public/avatars/stage";
const THRESHOLD = 22;

/** @type {{ slug: string, thumb: string, profile: string }[]} */
const BATCH = [
  {
    slug: "cazabichos",
    thumb: "Cazabichos.png",
    profile: "Cazabichos.png",
  },
  {
    slug: "reclutarocket",
    thumb: "Recluta_Rocket_Hombre1.png",
    profile: "Recluta_Rocket_Hombre2.png",
  },
  {
    slug: "reclutarocketf",
    thumb: "Recluta_Rocket_Mujer1.png",
    profile: "Recluta_Rocket_Mujer2.png",
  },
  {
    slug: "hugo",
    thumb: "Hugo.png",
    profile: "Hugo.png",
  },
  {
    slug: "supernerd",
    thumb: "SuperNerd.png",
    profile: "SuperNerd.png",
  },
  {
    slug: "motorista",
    thumb: "Motorista_kai.png",
    profile: "Motorista_kai.png",
  },
];

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

async function knockoutToPng(srcPath) {
  const { data, info } = await sharp(srcPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  floodKnockout(data, info.width, info.height, info.channels);
  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

await mkdir(OUT, { recursive: true });
await mkdir(STAGE, { recursive: true });

for (const item of BATCH) {
  const thumbSrc = join(DL, item.thumb);
  const profileSrc = join(DL, item.profile);
  const thumbOut = join(OUT, `${item.slug}1.png`);
  const profileOut = join(OUT, `${item.slug}2.png`);
  const stageOut = join(STAGE, `${item.slug}.png`);

  const thumbBuf = await knockoutToPng(thumbSrc);
  await writeFile(thumbOut, thumbBuf);

  const profileBuf =
    item.thumb === item.profile ? thumbBuf : await knockoutToPng(profileSrc);
  await writeFile(profileOut, profileBuf);

  const stageBuf = await sharp(profileBuf).trim({ threshold: 1 }).png().toBuffer();
  await writeFile(stageOut, stageBuf);

  console.log(`ok ${item.slug}`);
}

console.log("done");
