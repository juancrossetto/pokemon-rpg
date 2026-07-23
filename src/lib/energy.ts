// 1 punto de energía cada 5 minutos — ver dossier de diseño: la energía
// limita cuánto se puede grindear y es el control de inflación principal.
const REGEN_MS_PER_POINT = 5 * 60 * 1000;

export function getCurrentEnergy(energy: number, energyMax: number, energyUpdatedAt: Date): number {
  const elapsedMs = Date.now() - energyUpdatedAt.getTime();
  const regenerated = Math.floor(elapsedMs / REGEN_MS_PER_POINT);
  return Math.min(energyMax, energy + regenerated);
}
