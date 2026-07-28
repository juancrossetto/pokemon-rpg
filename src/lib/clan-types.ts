/**
 * Tipos de clan sin Prisma — para client y validación.
 */

export type ClanJoinPolicy = "OPEN" | "REQUEST" | "INVITE";

export type ClanFocus =
  | "CASUAL"
  | "COMPETITIVE"
  | "PVE"
  | "PVP"
  | "COLLECTION"
  | "EVENTS"
  | "SOCIAL"
  | "MIXED";

export type ClanAffinity =
  | "NORMAL"
  | "FIRE"
  | "WATER"
  | "GRASS"
  | "ELECTRIC"
  | "ICE"
  | "ROCK"
  | "GROUND"
  | "PSYCHIC"
  | "DARK"
  | "STEEL"
  | "DRAGON"
  | "FAIRY"
  | "FIGHTING"
  | "GHOST";

export type ClanRoleId = "LEADER" | "OFFICER" | "MEMBER";

export type ClanPermission =
  | "manage_clan"
  | "manage_members"
  | "manage_roles"
  | "manage_applications"
  | "manage_announcements"
  | "invite_members"
  | "remove_members"
  | "edit_identity";

export const CLAN_ROLE_PERMISSIONS: Record<ClanRoleId, ClanPermission[]> = {
  LEADER: [
    "manage_clan",
    "manage_members",
    "manage_roles",
    "manage_applications",
    "manage_announcements",
    "invite_members",
    "remove_members",
    "edit_identity",
  ],
  OFFICER: [
    "manage_members",
    "manage_applications",
    "manage_announcements",
    "invite_members",
    "remove_members",
  ],
  MEMBER: [],
};

export function clanHasPermission(
  role: ClanRoleId,
  permission: ClanPermission,
): boolean {
  return CLAN_ROLE_PERMISSIONS[role].includes(permission);
}
