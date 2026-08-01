/**
 * Evento por tiempo limitado (live-op).
 *
 * La pantalla de eventos decía "llegan pronto" y no había nada detrás. El
 * diario premia entrar y el semanal premia jugar, pero ninguno de los dos
 * caduca de verdad para el jugador que ya terminó la historia: siempre están,
 * siempre son iguales. Lo que faltaba era algo que **se pierda si no jugás
 * esta semana**, que es el gancho de retención del endgame.
 *
 * Decisiones:
 *
 * - **Rotación calculada, no configurada.** El evento activo sale del número de
 *   semana ISO. No hay tabla de programación ni panel de administración que
 *   alguien tenga que recordar cargar: siempre hay exactamente uno corriendo y
 *   su ventana coincide con la semana de juego (`weekStart` → `nextWeeklyReset`),
 *   así el reinicio es el mismo que ya usa el desafío semanal.
 * - **Métricas derivadas.** Igual que el semanal, el progreso se lee de tablas
 *   que ya existen acotadas a la ventana del evento. No hay contadores nuevos
 *   que incrementar desde cinco actions y que se desincronicen si una falla.
 * - **Misiones independientes.** A diferencia del semanal (un porcentaje global
 *   con hitos), acá cada misión se cobra sola. Es lo que hace que un evento
 *   temático se sienta como una lista de desafíos y no como otra barra.
 *
 * Los reclamos viven en `EventMissionClaim`, que ya estaba en el schema sin
 * usarse: la PK `[userId, eventCode, missionId]` impide el doble cobro y el
 * `eventCode` incluye la semana, así que la edición de la semana que viene
 * vuelve a estar disponible sin borrar nada.
 */

import { nextWeeklyReset, weekKey, weekStart } from "./time";
import type { RewardBundle } from "./rewards";

/**
 * Métricas medibles con lo que el juego ya persiste.
 *
 * No hay métrica de energía gastada ni de tiempo jugado: no se guardan, y una
 * misión que no se puede medir con honestidad es peor que no tenerla.
 */
export type LimitedMetric = "battles" | "catches" | "shinies" | "zones";

export type LimitedMission = {
  id: string;
  metric: LimitedMetric;
  target: number;
  rewards: RewardBundle;
  /** Pantalla donde se progresa, o `null` si no hay una sola. */
  href: string | null;
};

export type LimitedEventDef = {
  /** Estable por edición; el código real le antepone la semana. */
  id: string;
  /** Claves bajo `events.limited.catalog.<id>.`. */
  nameKey: string;
  taglineKey: string;
  /** Material Symbols. */
  icon: string;
  /** Color de acento en hex — la card del evento no debe verse como el resto. */
  accent: string;
  missions: LimitedMission[];
};

/**
 * Catálogo de ediciones.
 *
 * Tres temas que se turnan: uno de combate, uno de captura y uno de
 * exploración. Cada uno empuja un sistema distinto, así que la semana no
 * premia siempre lo mismo y el jugador que ya farmea rutas encuentra una razón
 * para volver a los otros modos.
 */
export const LIMITED_EVENTS: LimitedEventDef[] = [
  {
    id: "battle-rush",
    nameKey: "battleRush.name",
    taglineKey: "battleRush.tagline",
    icon: "swords",
    accent: "#ef4444",
    missions: [
      {
        id: "wins-10",
        metric: "battles",
        target: 10,
        href: "/battle",
        rewards: [{ kind: "item", itemName: "Super Potion", quantity: 3 }],
      },
      {
        id: "wins-30",
        metric: "battles",
        target: 30,
        href: "/battle",
        rewards: [
          { kind: "coins", amount: 1200 },
          { kind: "energy", amount: 10 },
        ],
      },
      {
        id: "wins-60",
        metric: "battles",
        target: 60,
        href: "/battle",
        rewards: [
          { kind: "item", itemName: "Rare Candy", quantity: 1 },
          { kind: "gems", amount: 2 },
        ],
      },
    ],
  },
  {
    id: "catch-fever",
    nameKey: "catchFever.name",
    taglineKey: "catchFever.tagline",
    icon: "catching_pokemon",
    accent: "#22c55e",
    missions: [
      {
        id: "catch-15",
        metric: "catches",
        target: 15,
        href: "/battle",
        rewards: [{ kind: "item", itemName: "Great Ball", quantity: 10 }],
      },
      {
        id: "catch-40",
        metric: "catches",
        target: 40,
        href: "/battle",
        rewards: [
          { kind: "item", itemName: "Ultra Ball", quantity: 5 },
          { kind: "coins", amount: 900 },
        ],
      },
      {
        id: "shiny-1",
        metric: "shinies",
        target: 1,
        href: "/battle",
        rewards: [{ kind: "gems", amount: 3 }],
      },
    ],
  },
  {
    id: "explorer-week",
    nameKey: "explorerWeek.name",
    taglineKey: "explorerWeek.tagline",
    icon: "explore",
    accent: "#38bdf8",
    missions: [
      {
        id: "zones-2",
        metric: "zones",
        target: 2,
        href: "/campaign",
        rewards: [{ kind: "item", itemName: "Poke Ball", quantity: 10 }],
      },
      {
        id: "zones-5",
        metric: "zones",
        target: 5,
        href: "/campaign",
        rewards: [
          { kind: "coins", amount: 1000 },
          { kind: "energy", amount: 10 },
        ],
      },
      {
        id: "catch-25",
        metric: "catches",
        target: 25,
        href: "/battle",
        rewards: [
          { kind: "item", itemName: "Rare Candy", quantity: 1 },
          { kind: "gems", amount: 2 },
        ],
      },
    ],
  },
];

export type ActiveLimitedEvent = {
  def: LimitedEventDef;
  /** `<id>@<semana ISO>` — parte de la PK del reclamo. */
  code: string;
  startsAt: Date;
  endsAt: Date;
};

/** Número de semana ISO a partir de la clave "2026-W31". */
function weekNumber(key: string): number {
  const parsed = Number.parseInt(key.slice(key.indexOf("W") + 1), 10);
  return Number.isFinite(parsed) ? parsed : 1;
}

/**
 * Edición vigente. Siempre devuelve una: la ventana es la semana de juego.
 *
 * Que no pueda devolver `null` es deliberado — un hueco entre eventos deja la
 * pantalla otra vez con el cartel de "próximamente" que este módulo vino a
 * eliminar.
 */
export function activeLimitedEvent(now: Date = new Date()): ActiveLimitedEvent {
  const key = weekKey(now);
  const index = (weekNumber(key) - 1) % LIMITED_EVENTS.length;
  const def = LIMITED_EVENTS[index] ?? LIMITED_EVENTS[0]!;
  return {
    def,
    code: `${def.id}@${key}`,
    startsAt: weekStart(now),
    endsAt: nextWeeklyReset(now),
  };
}

export function missionById(
  def: LimitedEventDef,
  missionId: string,
): LimitedMission | null {
  return def.missions.find((mission) => mission.id === missionId) ?? null;
}

/** Progreso recortado a la meta: 12 capturas sobre 10 muestran 10/10. */
export function missionProgress(mission: LimitedMission, raw: number): number {
  return Math.max(0, Math.min(raw, mission.target));
}

export function isMissionComplete(mission: LimitedMission, raw: number): boolean {
  return raw >= mission.target;
}
