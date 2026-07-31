/**
 * Puente entre las columnas planas de `BattleSession` (playerAtkStage…) y el
 * objeto `StatStages` que usa el motor.
 *
 * Existe para que agregar una stat sea un cambio en un solo lugar: antes cada
 * acción de combate armaba el literal a mano y era fácil olvidarse una.
 */

import { normalizeStages, type StatStages } from "@/lib/status";

type StageRow = {
  playerAtkStage?: number | null;
  playerDefStage?: number | null;
  playerSpaStage?: number | null;
  playerSpdStage?: number | null;
  playerSpeStage?: number | null;
  playerAccStage?: number | null;
  playerEvaStage?: number | null;
  wildAtkStage?: number | null;
  wildDefStage?: number | null;
  wildSpaStage?: number | null;
  wildSpdStage?: number | null;
  wildSpeStage?: number | null;
  wildAccStage?: number | null;
  wildEvaStage?: number | null;
};

export function playerStagesFromSession(row: StageRow): StatStages {
  return normalizeStages({
    atk: row.playerAtkStage ?? 0,
    def: row.playerDefStage ?? 0,
    spa: row.playerSpaStage ?? 0,
    spd: row.playerSpdStage ?? 0,
    spe: row.playerSpeStage ?? 0,
    acc: row.playerAccStage ?? 0,
    eva: row.playerEvaStage ?? 0,
  });
}

export function wildStagesFromSession(row: StageRow): StatStages {
  return normalizeStages({
    atk: row.wildAtkStage ?? 0,
    def: row.wildDefStage ?? 0,
    spa: row.wildSpaStage ?? 0,
    spd: row.wildSpdStage ?? 0,
    spe: row.wildSpeStage ?? 0,
    acc: row.wildAccStage ?? 0,
    eva: row.wildEvaStage ?? 0,
  });
}

export function playerStageColumns(stages: StatStages) {
  return {
    playerAtkStage: stages.atk,
    playerDefStage: stages.def,
    playerSpaStage: stages.spa,
    playerSpdStage: stages.spd,
    playerSpeStage: stages.spe,
    playerAccStage: stages.acc,
    playerEvaStage: stages.eva,
  };
}

export function wildStageColumns(stages: StatStages) {
  return {
    wildAtkStage: stages.atk,
    wildDefStage: stages.def,
    wildSpaStage: stages.spa,
    wildSpdStage: stages.spd,
    wildSpeStage: stages.spe,
    wildAccStage: stages.acc,
    wildEvaStage: stages.eva,
  };
}

/** Al cambiar de Pokémon los stages vuelven a cero. */
export const RESET_PLAYER_STAGES = playerStageColumns(normalizeStages(null));
export const RESET_WILD_STAGES = wildStageColumns(normalizeStages(null));

/** Forma persistida de los stages dentro del JSON `fieldB` (batallas dobles). */
export interface SlotStageColumns {
  atkStage: number;
  defStage: number;
  spaStage?: number;
  spdStage?: number;
  speStage: number;
  accStage?: number;
  evaStage?: number;
}

export function stagesFromSlot(slot: SlotStageColumns): StatStages {
  return normalizeStages({
    atk: slot.atkStage,
    def: slot.defStage,
    spa: slot.spaStage ?? 0,
    spd: slot.spdStage ?? 0,
    spe: slot.speStage,
    acc: slot.accStage ?? 0,
    eva: slot.evaStage ?? 0,
  });
}

export function slotStageColumns(stages: StatStages): Required<SlotStageColumns> {
  return {
    atkStage: stages.atk,
    defStage: stages.def,
    spaStage: stages.spa,
    spdStage: stages.spd,
    speStage: stages.spe,
    accStage: stages.acc,
    evaStage: stages.eva,
  };
}
