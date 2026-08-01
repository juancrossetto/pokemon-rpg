import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  activeLimitedEvent,
  isMissionComplete,
  LIMITED_EVENTS,
  missionById,
  missionProgress,
} from "@/lib/events/limited";
import { nextWeeklyReset, weekStart } from "@/lib/events/time";

const LOCALES = ["es", "en", "pt"] as const;

function messages(locale: string): Record<string, unknown> {
  return JSON.parse(readFileSync(`messages/${locale}.json`, "utf8"));
}

function lookup(root: Record<string, unknown>, path: string[]): unknown {
  return path.reduce<unknown>(
    (node, key) =>
      typeof node === "object" && node !== null
        ? (node as Record<string, unknown>)[key]
        : undefined,
    root,
  );
}

describe("activeLimitedEvent", () => {
  it("siempre devuelve una edición: no hay huecos sin evento", () => {
    // Un año entero de lunes: si alguna semana quedara sin evento, la pantalla
    // volvería al cartel de "próximamente" que este módulo vino a eliminar.
    for (let week = 0; week < 53; week++) {
      const at = new Date(Date.UTC(2026, 0, 5 + week * 7, 12));
      expect(activeLimitedEvent(at).def).toBeTruthy();
    }
  });

  it("la ventana coincide con la semana de juego", () => {
    const at = new Date(Date.UTC(2026, 6, 29, 15, 30));
    const event = activeLimitedEvent(at);
    expect(event.startsAt.getTime()).toBe(weekStart(at).getTime());
    expect(event.endsAt.getTime()).toBe(nextWeeklyReset(at).getTime());
  });

  it("no cambia de edición dentro de la misma semana", () => {
    const monday = new Date(Date.UTC(2026, 6, 27, 0, 5));
    const sunday = new Date(Date.UTC(2026, 7, 2, 23, 55));
    expect(activeLimitedEvent(monday).code).toBe(activeLimitedEvent(sunday).code);
  });

  it("rota a la semana siguiente y el código lleva la semana", () => {
    const thisWeek = activeLimitedEvent(new Date(Date.UTC(2026, 6, 29)));
    const nextWeek = activeLimitedEvent(new Date(Date.UTC(2026, 7, 5)));
    expect(nextWeek.code).not.toBe(thisWeek.code);
    expect(thisWeek.code).toContain("@");
  });
});

describe("catálogo", () => {
  it("los ids de evento y de misión no se repiten", () => {
    const eventIds = LIMITED_EVENTS.map((event) => event.id);
    expect(new Set(eventIds).size).toBe(eventIds.length);
    for (const event of LIMITED_EVENTS) {
      const ids = event.missions.map((mission) => mission.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("toda misión tiene meta positiva y al menos una recompensa", () => {
    for (const event of LIMITED_EVENTS) {
      for (const mission of event.missions) {
        expect(mission.target).toBeGreaterThan(0);
        expect(mission.rewards.length).toBeGreaterThan(0);
      }
    }
  });

  /**
   * El copy del evento no se puede resolver en tiempo de compilación (la clave
   * sale del catálogo, no de un literal), así que sin este test una edición
   * nueva sin traducir recién se descubre la semana que le toca salir.
   */
  it("cada evento y misión tiene copy en los tres idiomas", () => {
    for (const locale of LOCALES) {
      const root = messages(locale);
      for (const event of LIMITED_EVENTS) {
        for (const key of [event.nameKey, event.taglineKey]) {
          const path = ["events", "limited", "catalog", ...key.split(".")];
          expect(lookup(root, path), `${locale}: ${key}`).toBeTypeOf("string");
        }
        for (const mission of event.missions) {
          const path = ["events", "limited", "missions", mission.id];
          expect(lookup(root, path), `${locale}: ${mission.id}`).toBeTypeOf("string");
        }
      }
    }
  });
});

describe("progreso de misión", () => {
  const mission = LIMITED_EVENTS[0]!.missions[0]!;

  it("recorta el progreso a la meta", () => {
    expect(missionProgress(mission, mission.target + 25)).toBe(mission.target);
    expect(missionProgress(mission, -3)).toBe(0);
  });

  it("se completa desde la meta exacta en adelante", () => {
    expect(isMissionComplete(mission, mission.target - 1)).toBe(false);
    expect(isMissionComplete(mission, mission.target)).toBe(true);
  });

  it("missionById no inventa misiones de otra edición", () => {
    const [battleRush, catchFever] = LIMITED_EVENTS;
    expect(missionById(battleRush!, battleRush!.missions[0]!.id)).toBeTruthy();
    expect(missionById(battleRush!, catchFever!.missions[0]!.id)).toBeNull();
  });
});
