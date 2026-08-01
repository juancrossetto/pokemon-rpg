/**
 * Ligas / regiones del hub de gimnasios.
 *
 * Hoy sólo Kanto tiene medallas en DB. El resto queda `available: false` para
 * poder sumar Johto+ sin rehacer el UI: alcanza con cargar gyms y marcar la
 * región como disponible (y filtrar por región cuando el schema lo tenga).
 */
export type GymRegionId = "kanto" | "johto" | "hoenn" | "sinnoh";

export type GymRegionDef = {
  id: GymRegionId;
  /** Orden de temporada / generación. */
  order: number;
  /** Medallas de gimnasio esperadas en esa liga (sin Alto Mando). */
  badgeTarget: number;
  /** Hay contenido jugable cargado. */
  available: boolean;
};

export const GYM_REGIONS: GymRegionDef[] = [
  { id: "kanto", order: 1, badgeTarget: 8, available: true },
  { id: "johto", order: 2, badgeTarget: 8, available: false },
  { id: "hoenn", order: 3, badgeTarget: 8, available: false },
  { id: "sinnoh", order: 4, badgeTarget: 8, available: false },
];

export const DEFAULT_GYM_REGION_ID: GymRegionId = "kanto";

export function gymRegionDef(id: string): GymRegionDef {
  return GYM_REGIONS.find((r) => r.id === id) ?? GYM_REGIONS[0]!;
}

export function listGymRegions(): GymRegionDef[] {
  return [...GYM_REGIONS].sort((a, b) => a.order - b.order);
}
