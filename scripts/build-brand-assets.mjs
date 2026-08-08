/**
 * Regenera logo de marca, favicon y íconos PWA a partir de los masterball
 * de Downloads. Framing PWA: any @ 80%, maskable @ 60%, fondo #0a0806.
 */
import sharp from "sharp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BG = { r: 10, g: 8, b: 6, alpha: 1 }; // #0a0806
const BLACK_THRESH = 14;
const TMP = path.join(ROOT, ".tmp-brand");

const SRC_LOGO =
  process.env.BRAND_LOGO_SRC ??
  "C:/Users/Fede Crossetto/Downloads/logo-masterball.png";
const SRC_FAVICON =
  process.env.BRAND_FAVICON_SRC ??
  "C:/Users/Fede Crossetto/Downloads/favicon-masterball.png";

async function knockoutAndTrim(srcPath, destPath) {
  const { data, info } = await sharp(srcPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    if (
      data[i] < BLACK_THRESH &&
      data[i + 1] < BLACK_THRESH &&
      data[i + 2] < BLACK_THRESH
    ) {
      data[i + 3] = 0;
    }
  }
  await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .trim({ threshold: 4 })
    .png({ compressionLevel: 9 })
    .toFile(destPath);
  return sharp(destPath).metadata();
}

function buildIco(pngBuffersWithSize) {
  const count = pngBuffersWithSize.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);
  let offset = 6 + 16 * count;
  const entries = [];
  for (const { png, width, height } of pngBuffersWithSize) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(width >= 256 ? 0 : width, 0);
    entry.writeUInt8(height >= 256 ? 0 : height, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += png.length;
  }
  return Buffer.concat([
    header,
    ...entries,
    ...pngBuffersWithSize.map((x) => x.png),
  ]);
}

async function makeAppIcon(logoPath, size, scale, outPath) {
  const target = Math.round(size * scale);
  const logoBuf = await sharp(logoPath)
    .resize(target, target, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  const logoMeta = await sharp(logoBuf).metadata();
  const left = Math.round((size - logoMeta.width) / 2);
  const top = Math.round((size - logoMeta.height) / 2);
  await sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .composite([{ input: logoBuf, left, top }])
    .png({ compressionLevel: 9 })
    .toFile(outPath);
  console.log(
    "wrote",
    path.relative(ROOT, outPath),
    `${size}x${size}`,
    `scale ${scale}`,
    `${fs.statSync(outPath).size}b`,
  );
}

fs.mkdirSync(TMP, { recursive: true });

const logoPath = path.join(ROOT, "public/logo.png");
const logoFullPath = path.join(TMP, "logo-full.png");
await knockoutAndTrim(SRC_LOGO, logoFullPath);
// Retina-friendly web size (header ~72–240px CSS; 800 cubre ~3–4×).
await sharp(logoFullPath)
  .resize({ width: 800, withoutEnlargement: true })
  .png({ compressionLevel: 9 })
  .toFile(logoPath);
const logoMeta = await sharp(logoPath).metadata();
console.log(
  "logo",
  `${logoMeta.width}x${logoMeta.height}`,
  `${fs.statSync(logoPath).size}b`,
);

const ballTrimPath = path.join(TMP, "ball-trim.png");
const ballMeta = await knockoutAndTrim(SRC_FAVICON, ballTrimPath);
console.log("ball trim", `${ballMeta.width}x${ballMeta.height}`);

const side = Math.max(ballMeta.width, ballMeta.height);
const ballSquarePath = path.join(TMP, "ball-square.png");
await sharp(ballTrimPath)
  .resize(side, side, {
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png({ compressionLevel: 9 })
  .toFile(ballSquarePath);

await sharp({
  create: { width: 512, height: 512, channels: 4, background: BG },
})
  .composite([
    {
      input: await sharp(ballSquarePath)
        .resize(512, 512, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer(),
      gravity: "centre",
    },
  ])
  .png({ compressionLevel: 9 })
  .toFile(path.join(ROOT, "src/app/icon.png"));
console.log("wrote src/app/icon.png");

await sharp({
  create: { width: 180, height: 180, channels: 4, background: BG },
})
  .composite([
    {
      input: await sharp(ballSquarePath)
        .resize(180, 180, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer(),
      gravity: "centre",
    },
  ])
  .png({ compressionLevel: 9 })
  .toFile(path.join(ROOT, "src/app/apple-icon.png"));
console.log("wrote src/app/apple-icon.png");

const icoParts = [];
for (const s of [16, 32, 48]) {
  const png = await sharp(ballSquarePath)
    .resize(s, s, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  icoParts.push({ png, width: s, height: s });
}
fs.writeFileSync(path.join(ROOT, "src/app/favicon.ico"), buildIco(icoParts));
console.log("wrote src/app/favicon.ico");

await makeAppIcon(logoFullPath, 192, 0.8, path.join(ROOT, "public/icons/icon-192.png"));
await makeAppIcon(logoFullPath, 512, 0.8, path.join(ROOT, "public/icons/icon-512.png"));
await makeAppIcon(
  logoFullPath,
  192,
  0.6,
  path.join(ROOT, "public/icons/icon-192-maskable.png"),
);
await makeAppIcon(
  logoFullPath,
  512,
  0.6,
  path.join(ROOT, "public/icons/icon-512-maskable.png"),
);

fs.rmSync(TMP, { recursive: true, force: true });
console.log(`LOGO_DIMS=${logoMeta.width}x${logoMeta.height}`);
