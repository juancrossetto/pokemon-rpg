/** Entradas `koLog`: `"a:Name>b:Name"` (atacante>debilitado). */

export function parseKo(entry: string): {
  attackerSide: "a" | "b";
  attackerName: string;
  faintedSide: "a" | "b";
  faintedName: string;
} | null {
  const [attacker, fainted] = entry.split(">");
  if (!attacker || !fainted) return null;
  const ai = attacker.indexOf(":");
  const fi = fainted.indexOf(":");
  if (ai < 0 || fi < 0) return null;
  const attackerSide = attacker.slice(0, ai);
  const faintedSide = fainted.slice(0, fi);
  if (
    (attackerSide !== "a" && attackerSide !== "b") ||
    (faintedSide !== "a" && faintedSide !== "b")
  ) {
    return null;
  }
  return {
    attackerSide,
    attackerName: attacker.slice(ai + 1),
    faintedSide,
    faintedName: fainted.slice(fi + 1),
  };
}

export function faintedBySide(koLog: string[]): { a: Set<string>; b: Set<string> } {
  const a = new Set<string>();
  const b = new Set<string>();
  for (const entry of koLog) {
    const parsed = parseKo(entry);
    if (!parsed) continue;
    if (parsed.faintedSide === "a") a.add(parsed.faintedName.toLowerCase());
    else b.add(parsed.faintedName.toLowerCase());
  }
  return { a, b };
}
