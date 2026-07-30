/**
 * Comprime iconos de /public/nav a ≤128px (los tabs muestran ~36–40px).
 * Muchos PNG venían a 1–2 MB y el drawer del menú tardaba en pintar.
 */
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";

const DIR = path.join(process.cwd(), "public", "nav");
const MAX = 128;

const files = (await fs.readdir(DIR)).filter((f) => f.endsWith(".png"));
let before = 0;
let after = 0;

for (const file of files) {
  const full = path.join(DIR, file);
  const input = await fs.readFile(full);
  before += input.length;
  const out = await sharp(input)
    .resize(MAX, MAX, { fit: "inside", withoutEnlargement: true })
    .png({ compressionLevel: 9, effort: 10 })
    .toBuffer();
  await fs.writeFile(full, out);
  after += out.length;
  console.log(
    `${file.padEnd(28)} ${(input.length / 1024).toFixed(0).padStart(5)} KB → ${(out.length / 1024).toFixed(0).padStart(4)} KB`,
  );
}

console.log(
  `\nTotal: ${(before / 1024 / 1024).toFixed(1)} MB → ${(after / 1024).toFixed(0)} KB`,
);
