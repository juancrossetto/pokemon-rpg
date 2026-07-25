import { prisma } from "../../src/lib/prisma";

// TMs/HMs reales de Rojo/Azul (mismo version group que el resto del seed).
// IDs y nombres de movimiento verificados contra PokeAPI /machine/{id} —
// no son inventados, es la lista real de Gen 1 (50 TMs + 5 HMs).
export const MACHINES: { code: string; moveName: string }[] = [
  { code: "TM01", moveName: "mega-punch" },
  { code: "TM02", moveName: "razor-wind" },
  { code: "TM03", moveName: "swords-dance" },
  { code: "TM04", moveName: "whirlwind" },
  { code: "TM05", moveName: "mega-kick" },
  { code: "TM06", moveName: "toxic" },
  { code: "TM07", moveName: "horn-drill" },
  { code: "TM08", moveName: "body-slam" },
  { code: "TM09", moveName: "take-down" },
  { code: "TM10", moveName: "double-edge" },
  { code: "TM11", moveName: "bubble-beam" },
  { code: "TM12", moveName: "water-gun" },
  { code: "TM13", moveName: "ice-beam" },
  { code: "TM14", moveName: "blizzard" },
  { code: "TM15", moveName: "hyper-beam" },
  { code: "TM16", moveName: "pay-day" },
  { code: "TM17", moveName: "submission" },
  { code: "TM18", moveName: "counter" },
  { code: "TM19", moveName: "seismic-toss" },
  { code: "TM20", moveName: "rage" },
  { code: "TM21", moveName: "mega-drain" },
  { code: "TM22", moveName: "solar-beam" },
  { code: "TM23", moveName: "dragon-rage" },
  { code: "TM24", moveName: "thunderbolt" },
  { code: "TM25", moveName: "thunder" },
  { code: "TM26", moveName: "earthquake" },
  { code: "TM27", moveName: "fissure" },
  { code: "TM28", moveName: "dig" },
  { code: "TM29", moveName: "psychic" },
  { code: "TM30", moveName: "teleport" },
  { code: "TM31", moveName: "mimic" },
  { code: "TM32", moveName: "double-team" },
  { code: "TM33", moveName: "reflect" },
  { code: "TM34", moveName: "bide" },
  { code: "TM35", moveName: "metronome" },
  { code: "TM36", moveName: "self-destruct" },
  { code: "TM37", moveName: "egg-bomb" },
  { code: "TM38", moveName: "fire-blast" },
  { code: "TM39", moveName: "swift" },
  { code: "TM40", moveName: "skull-bash" },
  { code: "TM41", moveName: "soft-boiled" },
  { code: "TM42", moveName: "dream-eater" },
  { code: "TM43", moveName: "sky-attack" },
  { code: "TM44", moveName: "rest" },
  { code: "TM45", moveName: "thunder-wave" },
  { code: "TM46", moveName: "psywave" },
  { code: "TM47", moveName: "explosion" },
  { code: "TM48", moveName: "rock-slide" },
  { code: "TM49", moveName: "tri-attack" },
  { code: "TM50", moveName: "substitute" },
  { code: "HM01", moveName: "cut" },
  { code: "HM02", moveName: "fly" },
  { code: "HM03", moveName: "surf" },
  { code: "HM04", moveName: "strength" },
  { code: "HM05", moveName: "flash" },
];

export async function seedMachines() {
  console.log(`→ Objetos (MTs/MOs, ${MACHINES.length})...`);
  for (const { code, moveName } of MACHINES) {
    const move = await prisma.move.findUnique({ where: { name: moveName } });
    if (!move) {
      console.warn(`  ⚠ ${code}: no se encontró el movimiento "${moveName}", se salteó`);
      continue;
    }
    await prisma.item.upsert({
      where: { name: code },
      create: {
        name: code,
        type: "MACHINE",
        moveId: move.id,
        buyPrice: 3000,
        effectText: `Enseña ${moveName.replace(/-/g, " ")} a un Pokémon compatible.`,
      },
      update: { moveId: move.id },
    });
  }
}
