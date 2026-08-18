"use client";

import { useEffect, useRef, useState, useTransition, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { AvatarImage } from "@/components/avatar-image";
import { Link, useRouter } from "@/i18n/navigation";
import { avatarById } from "@/lib/avatars";
import { PRESENCE_META } from "@/lib/friends";
import { toggleFriendFavorite } from "@/actions/friends";
import type { HomeFriendPresence } from "@/lib/friends-data";
import { useFriendsRailVisible } from "@/components/friends/use-friends-rail-visible";
import {
  FRIENDS_RAIL_PREF_EVENT,
  readFriendsRailVisible,
} from "@/lib/friends-rail-pref";

/**
 * Columna flotante de amigos, en el chrome de la app.
 *
 * Retratos circulares y el punto de presencia, nada más: sin encabezado, sin
 * contador y sin pie. Al tocar uno se abre una card chica con las acciones que
 * tienen sentido desde cualquier pantalla. Con el toggle encendido se ven
 * también los desconectados (punto gris).
 *
 * Lo que **no** está es a propósito: eliminar amigo y bloquear viven en
 * `/friends`. Un destructivo dentro de un menú que se abre al primer clic, en
 * una columna de retratos de 44px, es un accidente esperando a pasar.
 *
 * Sólo de `xl` para arriba. Por debajo el contenido ya usa todo el ancho y la
 * columna quedaría encima, no al costado.
 */
export function FriendsRail({
  locale,
  friends,
}: {
  locale: string;
  friends: HomeFriendPresence[];
}) {
  const t = useTranslations("home.friendsRail");
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const railRef = useRef<HTMLElement>(null);
  const visible = useFriendsRailVisible();
  const [burst, setBurst] = useState<"in" | "out" | null>(null);

  // Cerrar al tocar fuera o con Escape: es un menú flotante sobre toda la
  // pantalla, y sin esto queda abierto mientras se navega por debajo.
  useEffect(() => {
    if (!openId) return;
    function onPointerDown(event: PointerEvent) {
      if (!railRef.current?.contains(event.target as Node)) setOpenId(null);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenId(null);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openId]);

  // El pop sólo en el toggle: el primer paint y el login no deben reventar
  // las burbujas solas.
  useEffect(() => {
    function onPref() {
      const next = readFriendsRailVisible();
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setBurst(null);
        if (!next) setOpenId(null);
        return;
      }
      if (next) setBurst("in");
      else {
        setOpenId(null);
        setBurst("out");
      }
    }
    window.addEventListener(FRIENDS_RAIL_PREF_EVENT, onPref);
    return () => window.removeEventListener(FRIENDS_RAIL_PREF_EVENT, onPref);
  }, []);

  useEffect(() => {
    if (burst === null) return;
    const extra = Math.max(0, friends.length - 1) * 26;
    const ms = burst === "out" ? 280 + extra : 360 + extra;
    let frame = 0;
    const t = window.setTimeout(() => {
      frame = requestAnimationFrame(() => setBurst(null));
    }, ms);
    return () => {
      window.clearTimeout(t);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [burst, friends.length]);

  if (friends.length === 0) return null;
  if (!visible && burst !== "out") return null;

  const burstClass =
    burst === "in" ? " is-pop-in" : burst === "out" ? " is-pop-out" : "";

  return (
    <aside ref={railRef} className={`home-friends-rail${burstClass}`} aria-label={t("title")}>
      <ul className="home-friends-rail__list">
        {friends.map((friend, index) => {
          const avatar = avatarById(friend.avatarId)?.src ?? null;
          const meta = PRESENCE_META[friend.presence];
          const presenceLabel = t(`presence.${friend.presence}`);
          const open = openId === friend.userId;
          return (
            <li
              key={friend.userId}
              className="home-friends-rail__item"
              style={{ "--friends-i": index } as CSSProperties}
            >
              <button
                type="button"
                className={`home-friends-rail__friend${
                  friend.presence === "offline" ? " is-offline" : ""
                }`}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label={`${friend.username}, ${presenceLabel}`}
                onClick={() => setOpenId(open ? null : friend.userId)}
              >
                <span className="home-friends-rail__portrait">
                  {avatar ? (
                    <AvatarImage src={avatar} alt="" size={44} />
                  ) : (
                    <span className="material-symbols-outlined" aria-hidden>person</span>
                  )}
                </span>
                <span className="home-friends-rail__name">{friend.username}</span>
                <i className={`home-friends-rail__dot ${meta.dot}`} aria-hidden />
                <span className={`home-friends-rail__status ${meta.tone}`}>
                  {presenceLabel}
                </span>
              </button>

              {open ? (
                <div className="home-friends-rail__menu" role="menu">
                  <p className="home-friends-rail__menu-head">
                    <strong>{friend.username}</strong>
                    <span className={meta.tone}>{presenceLabel}</span>
                  </p>

                  <Link
                    href={`/friends?trainer=${friend.userId}`}
                    className="home-friends-rail__action"
                    role="menuitem"
                  >
                    <span className="material-symbols-outlined" aria-hidden>badge</span>
                    {t("actions.card")}
                  </Link>

                  <button
                    type="button"
                    className="home-friends-rail__action"
                    role="menuitem"
                    disabled={pending}
                    onClick={() => {
                      startTransition(async () => {
                        await toggleFriendFavorite(locale, friend.userId);
                        // La columna se arma en el servidor: `refresh` es lo que
                        // trae el estado nuevo sin duplicarlo en el cliente.
                        router.refresh();
                        setOpenId(null);
                      });
                    }}
                  >
                    <span
                      className={`material-symbols-outlined${friend.isFavorite ? " ms-fill" : ""}`}
                      aria-hidden
                    >
                      star
                    </span>
                    {friend.isFavorite ? t("actions.unfavorite") : t("actions.favorite")}
                  </button>

                  <Link href="/friends" className="home-friends-rail__action" role="menuitem">
                    <span className="material-symbols-outlined" aria-hidden>group</span>
                    {t("actions.all")}
                  </Link>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
