"use client";

import { useTranslations } from "next-intl";
import { useFriendsRailVisible } from "@/components/friends/use-friends-rail-visible";
import { writeFriendsRailVisible } from "@/lib/friends-rail-pref";

/**
 * Interruptor de la columna de amigos, al lado de la campana.
 *
 * Encendido: acento primary (el rosa/violeta de la marca) para que se note
 * que las burbujas están en pantalla. Apagado: el mismo cromo apagado que el
 * resto de iconos del header.
 */
export function FriendsRailToggle() {
  const t = useTranslations("home.friendsRail");
  const visible = useFriendsRailVisible();
  const label = visible ? t("toggleHide") : t("toggleShow");

  return (
    <button
      type="button"
      aria-pressed={visible}
      aria-label={label}
      title={label}
      onClick={() => writeFriendsRailVisible(!visible)}
      className={`relative z-[81] flex h-8 w-8 items-center justify-center rounded-md border transition ${
        visible
          ? "border-primary/55 bg-primary/15 text-primary shadow-[0_0_12px_color-mix(in_srgb,var(--color-primary)_32%,transparent)]"
          : "border-white/10 bg-white/5 text-on-surface-variant hover:bg-white/10 hover:text-on-surface"
      }`}
    >
      <span
        className={`material-symbols-outlined text-[18px]! ${visible ? "ms-fill" : ""}`}
        aria-hidden
      >
        group
      </span>
    </button>
  );
}
