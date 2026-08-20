import { describe, expect, it } from "vitest";
import { stageShortName, zoneAsk } from "@/lib/campaign/zone-ask";
import type { ZoneObjectiveState } from "@/lib/campaign/objectives";

type Zone = Parameters<typeof zoneAsk>[0];

function zone(over: Partial<Zone> = {}): Zone {
  return {
    unlocked: true,
    completedStages: 3,
    totalStages: 3,
    trainers: [],
    kindKey: "kinds.route",
    ...over,
  } as Zone;
}

function trainer(id: string, defeated: boolean) {
  return { id, nameKey: `trainers.${id}`, defeated } as Zone["trainers"][number];
}

function objective(over: Partial<ZoneObjectiveState>): ZoneObjectiveState {
  return {
    id: "pokedex",
    done: false,
    current: 0,
    target: 4,
    reward: { coins: 0 },
    claimed: false,
    claimable: false,
    required: false,
    ...over,
  } as ZoneObjectiveState;
}

describe("zoneAsk", () => {
  it("una zona cerrada no pide nada", () => {
    expect(zoneAsk(zone({ unlocked: false }), [])).toEqual({ key: "ask.locked" });
  });

  it("nombra al entrenador cuando queda uno solo", () => {
    const ask = zoneAsk(zone({ trainers: [trainer("omar", false)] }), []);
    expect(ask.key).toBe("ask.oneTrainerNamed");
    expect(ask.params).toEqual({ name: "trainers.omar" });
  });

  it("cuenta los entrenadores cuando queda más de uno", () => {
    const ask = zoneAsk(
      zone({ trainers: [trainer("a", false), trainer("b", false), trainer("c", true)] }),
      [],
    );
    expect(ask).toEqual({ key: "ask.trainers", params: { count: 2 } });
  });

  it("combina tramos y entrenadores cuando faltan los dos", () => {
    const ask = zoneAsk(
      zone({ completedStages: 1, totalStages: 3, trainers: [trainer("a", false)] }),
      [],
    );
    expect(ask).toEqual({ key: "ask.stagesAndTrainers", params: { stages: 2, trainers: 1 } });
  });

  it("pide sólo tramos cuando no hay entrenadores pendientes", () => {
    const ask = zoneAsk(zone({ completedStages: 1, totalStages: 3 }), []);
    expect(ask).toEqual({ key: "ask.stages", params: { count: 2 } });
  });

  /*
    El orden importa: la Pokédex es opcional y no cierra la zona. Si se
    anunciara antes que un entrenador pendiente, la ficha estaría pidiendo algo
    que no hace falta para seguir.
  */
  it("los entrenadores van antes que la Pokédex", () => {
    const ask = zoneAsk(
      zone({ trainers: [trainer("omar", false)] }),
      [objective({ current: 1, target: 4 })],
    );
    expect(ask.key).toBe("ask.oneTrainerNamed");
  });

  it("con la zona cerrada ofrece la Pokédex como extra", () => {
    const ask = zoneAsk(zone(), [objective({ current: 1, target: 4 })]);
    expect(ask).toEqual({ key: "ask.pokedexOptional", params: { count: 3 } });
  });

  it("avisa cuando hay recompensa sin cobrar", () => {
    const ask = zoneAsk(zone(), [
      objective({ done: true, current: 4, target: 4, claimable: true }),
    ]);
    expect(ask).toEqual({ key: "ask.claim" });
  });

  it("una zona sin nada pendiente lo dice", () => {
    const ask = zoneAsk(zone(), [objective({ done: true, current: 4, target: 4 })]);
    expect(ask).toEqual({ key: "ask.done" });
  });

  describe("gimnasio", () => {
    const gymZone = zone({ kindKey: "kinds.gym" });

    it("pide lo suyo, no tramos", () => {
      expect(zoneAsk(gymZone, [], { won: false, chapterCleared: true })).toEqual({
        key: "ask.gym",
      });
    });

    /*
      El caso que se veía mal: el panel mostraba "GANADO · Medalla Alma" y
      dos líneas arriba "desafiá al líder cuando tu equipo esté listo".
    */
    it("una medalla ya ganada no vuelve a pedir el desafío", () => {
      expect(zoneAsk(gymZone, [], { won: true, chapterCleared: true })).toEqual({
        key: "ask.gymWon",
      });
    });

    it("con el capítulo abierto manda a cerrarlo primero", () => {
      expect(zoneAsk(gymZone, [], { won: false, chapterCleared: false })).toEqual({
        key: "ask.gymChapterFirst",
      });
    });
  });

  describe("stageShortName", () => {
    it("saca el nombre de zona repetido", () => {
      expect(stageShortName("Ruta 21 (mar) · tramo 1")).toBe("Tramo 1");
    });

    it("deja pasar un nombre sin separador", () => {
      expect(stageShortName("Entrada del bosque")).toBe("Entrada del bosque");
    });
  });
});
