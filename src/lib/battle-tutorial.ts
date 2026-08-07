/**
 * Primer combate post-starter: pelear sí, capturar/huir no.
 * Marcador durable en `routeTrainerId` (no se pierde al truncar el log).
 * El string `"tutorial"` en el log queda por compatibilidad con batallas viejas.
 */
export const TUTORIAL_BATTLE_ID = "tutorial";

export function isTutorialBattle(battle: {
  routeTrainerId?: string | null;
  log?: readonly string[] | null;
}): boolean {
  if (battle.routeTrainerId === TUTORIAL_BATTLE_ID) return true;
  return Boolean(battle.log?.includes(TUTORIAL_BATTLE_ID));
}
