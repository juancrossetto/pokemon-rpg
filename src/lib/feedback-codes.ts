// Los códigos de resultado viajan por querystring (?error= / ?notice=) y
// terminan en t(`errors.${code}`). Sin validarlos contra una lista blanca,
// cualquiera puede pasar ?error=loquesea y next-intl termina renderizando la
// clave cruda —o un error— en pantalla.

export const MARKET_ERRORS = [
  "invalid_price",
  "not_found",
  "already_listed",
  "in_battle",
  "last_team_member",
  "not_enough_items",
  "breeding",
  "not_available",
  "own_listing",
  "insufficient_coins",
  "insufficient_fee",
  "rate_limited",
  "trade_locked",
  "no_moves",
] as const;

export const MARKET_NOTICES = [
  "listed",
  "bought",
  "bought_pokemon",
  "cancelled",
  "claimed",
] as const;

export const PC_ERRORS = [
  "not_found",
  "already_in_team",
  "not_in_team",
  "listed",
  "breeding",
  "pending_claim",
  "team_full",
  "in_battle",
  "last_team_member",
  "rate_limited",
  "trade_locked",
] as const;

export const PC_NOTICES = ["deposited", "withdrawn"] as const;

export const CLAN_ERRORS = [
  "not_found",
  "invalid_name",
  "invalid_tag",
  "invalid_fields",
  "name_taken",
  "tag_taken",
  "already_in_clan",
  "not_in_clan",
  "clan_full",
  "insufficient_coins",
  "forbidden",
  "leader_must_transfer",
  "target_not_member",
  "rate_limited",
  "invite_only",
  "request_required",
  "already_applied",
  "no_application",
  "applications_full",
  "invites_full",
  "cooldown",
  "level_too_low",
  "pending_elsewhere",
] as const;

export const CLAN_NOTICES = [
  "created",
  "joined",
  "left",
  "disbanded",
  "kicked",
  "promoted",
  "demoted",
  "transferred",
  "applied",
  "application_cancelled",
  "application_accepted",
  "application_declined",
  "invite_sent",
  "invite_accepted",
  "invite_declined",
  "settings_saved",
] as const;

export const PVP_ERRORS = [
  "no_team",
  "no_opponents",
  "no_energy",
  "rate_limited",
  "cooldown",
] as const;

export type MarketError = (typeof MARKET_ERRORS)[number];
export type MarketNotice = (typeof MARKET_NOTICES)[number];

/** Devuelve el código solo si está en la lista blanca; si no, null. */
export function pickCode<T extends string>(
  raw: string | undefined,
  allowed: readonly T[],
): T | null {
  return allowed.includes(raw as T) ? (raw as T) : null;
}
