// Colores estándar de tipo Pokémon — se usan para las badges en el Pokédex.
export const TYPE_COLORS: Record<string, string> = {
  normal: "#A8A878",
  fire: "#F08030",
  water: "#6890F0",
  electric: "#F8D030",
  grass: "#78C850",
  ice: "#98D8D8",
  fighting: "#C03028",
  poison: "#A040A0",
  ground: "#E0C068",
  flying: "#A890F0",
  psychic: "#F85888",
  bug: "#A8B820",
  rock: "#B8A038",
  ghost: "#705898",
  dragon: "#7038F8",
  dark: "#705848",
  steel: "#B8B8D0",
  fairy: "#EE99AC",
};

export function typeColor(type: string): string {
  return TYPE_COLORS[type.toLowerCase()] ?? "#68A090";
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === rn
      ? ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6
      : max === gn
        ? ((bn - rn) / d + 2) / 6
        : ((rn - gn) / d + 4) / 6;
  return [h * 360, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const hn = (((h % 360) + 360) % 360) / 360;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t: number) => {
    let tn = t;
    if (tn < 0) tn += 1;
    if (tn > 1) tn -= 1;
    if (tn < 1 / 6) return p + (q - p) * 6 * tn;
    if (tn < 1 / 2) return q;
    if (tn < 2 / 3) return p + (q - p) * (2 / 3 - tn) * 6;
    return p;
  };
  const to255 = (v: number) =>
    Math.round(Math.max(0, Math.min(1, v)) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to255(channel(hn + 1 / 3))}${to255(channel(hn))}${to255(channel(hn - 1 / 3))}`;
}

/**
 * Versión flúor del color de tipo.
 *
 * La paleta oficial de tipos es apagada (`normal` es un caqui, `dark` un marrón)
 * y sobre fondo oscuro no lee como neón. Se sube la saturación a un piso alto y
 * se lleva la luz a una franja media-alta: así hasta los tipos más turbios dan
 * un acento vivo, sin perder la identidad cromática del tipo.
 *
 * `hueShift` desplaza el matiz — sirve para armar el segundo tono del degradé
 * cuando el Pokémon tiene un solo tipo.
 */
export function neonTypeColor(type: string, hueShift = 0): string {
  const [h, s, l] = rgbToHsl(...hexToRgb(typeColor(type)));
  return hslToHex(h + hueShift, Math.max(s, 0.85), Math.min(Math.max(l, 0.58), 0.68));
}
