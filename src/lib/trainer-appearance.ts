/**
 * Apariencia / cosméticos del entrenador.
 *
 * Todavía no hay columnas en Prisma: estos tipos documentan el contrato para
 * cuando existan modelos GLB propios y loadouts. El perfil hoy funciona con
 * avatar 2D (Showdown) + sprite del compañero; `trainerModelUrl` /
 * `companionModelUrl` activan la escena WebGL si están presentes.
 */

export type TrainerModelFormat = "glb" | "gltf" | "vrm";

export type TrainerVec3 = { x: number; y: number; z: number };

export type TrainerAppearance = {
  trainerModelUrl?: string;
  trainerModelFormat?: TrainerModelFormat;
  companionModelUrl?: string;
  idleAnimationUrl?: string;
  pose?: string;
  scale?: number;
  position?: TrainerVec3;
  rotation?: TrainerVec3;
};

export type TrainerTitleDef = {
  id: string;
  /** Clave i18n o texto ya resuelto en la UI. */
  nameKey: string;
  descriptionKey?: string;
  unlocked: boolean;
  selected: boolean;
  rarity?: "common" | "rare" | "epic" | "legendary";
};

export type TrainerCosmeticLoadout = {
  trainerModelId?: string;
  outfitId?: string;
  poseId?: string;
  backgroundId?: string;
  frameId?: string;
  selectedTitleId?: string;
  featuredBadgeIds?: string[];
  appearance?: TrainerAppearance;
};

/** Permisos de acciones según perfil propio / ajeno. */
export type TrainerProfileMode = "own" | "other";

export type TrainerProfilePermissions = {
  canEdit: boolean;
  canManageTeam: boolean;
  canSelectTitle: boolean;
  canChallenge: boolean;
  canAddFriend: boolean;
};

export function permissionsFor(mode: TrainerProfileMode): TrainerProfilePermissions {
  if (mode === "own") {
    return {
      canEdit: true,
      canManageTeam: true,
      canSelectTitle: false, // títulos siguen siendo auto hasta migración
      canChallenge: false,
      canAddFriend: false,
    };
  }
  return {
    canEdit: false,
    canManageTeam: false,
    canSelectTitle: false,
    canChallenge: true,
    canAddFriend: true,
  };
}

/** ¿Hay al menos un modelo 3D usable? */
export function hasAny3dModel(appearance?: TrainerAppearance | null): boolean {
  return Boolean(appearance?.trainerModelUrl || appearance?.companionModelUrl);
}
