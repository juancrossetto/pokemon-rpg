import { Teams, BattleStreams, RandomPlayerAI } from "@pkmn/sim";
import type { PokemonSet } from "@pkmn/sim";

// Spike aislado para evaluar @pkmn/sim (motor real de Pokémon Showdown, MIT)
// como posible reemplazo del motor de batalla propio. NO usa datos ni schema
// del proyecto — arma sets fijos a mano solo para la demo. Ver /gyms-demo... o
// más bien /showdown-demo para la página que consume esto.
function mon(partial: Partial<PokemonSet>): PokemonSet {
  return {
    name: partial.species as string,
    species: "",
    item: "",
    ability: "",
    moves: [],
    nature: "Hardy",
    gender: "",
    evs: { hp: 84, atk: 84, def: 84, spa: 84, spd: 84, spe: 84 },
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    level: 50,
    ...partial,
  };
}

const TEAM_A: PokemonSet[] = [
  mon({ species: "Charizard", ability: "Blaze", item: "Charcoal", moves: ["flamethrower", "airslash", "dragonclaw", "swordsdance"] }),
];
const TEAM_B: PokemonSet[] = [
  mon({ species: "Blastoise", ability: "Torrent", item: "Leftovers", moves: ["surf", "icebeam", "rapidspin", "toxic"] }),
];

export interface ShowdownDemoResult {
  log: string[];
  durationMs: number;
}

export async function runShowdownDemoBattle(): Promise<ShowdownDemoResult> {
  const started = Date.now();
  const streams = BattleStreams.getPlayerStreams(new BattleStreams.BattleStream());
  const spec = { formatid: "gen9customgame" };
  const p1spec = { name: "AshCharizard", team: Teams.pack(TEAM_A) };
  const p2spec = { name: "GaryBlastoise", team: Teams.pack(TEAM_B) };

  const p1 = new RandomPlayerAI(streams.p1);
  const p2 = new RandomPlayerAI(streams.p2);
  void p1.start();
  void p2.start();

  const log: string[] = [];
  const collector = (async () => {
    for await (const chunk of streams.omniscient) {
      log.push(...chunk.split("\n"));
    }
  })();

  await streams.omniscient.write(
    `>start ${JSON.stringify(spec)}\n>player p1 ${JSON.stringify(p1spec)}\n>player p2 ${JSON.stringify(p2spec)}`,
  );
  await collector;

  return { log, durationMs: Date.now() - started };
}
