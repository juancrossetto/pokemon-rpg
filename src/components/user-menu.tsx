"use client";

import { useEffect, useRef, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { Link } from "@/i18n/navigation";
import { avatarById } from "@/lib/avatars";
import { useOptimisticAvatarId } from "@/components/optimistic-avatar";
import { TrainerAvatar } from "@/components/trainer-avatar";

/**
 * Menú de cuenta. Solo cuenta: los módulos de juego (equipo, inventario, PC)
 * se movieron al grupo Colección del navbar, donde el jugador los busca.
 * Cabecera = acceso al perfil (nombre + CTA); abajo, cerrar sesión.
 */
export function UserMenu({
  name,
  avatarId,
  logoutLabel,
  profileLabel,
  profileHref = "/profile",
}: {
  name: string;
  avatarId: string | null;
  logoutLabel: string;
  /*
    Obligatorio a propósito. Nació opcional y el menú se renderiza en dos
    lugares —el navbar de escritorio y el header de MobileChrome—: al cablear
    sólo el primero, el segundo no falló, simplemente dejó de dibujar la
    entrada. Un prop requerido convierte ese olvido en un error de compilación.
  */
  profileLabel: string;
  profileHref?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const { data: session } = useSession();
  const resolvedAvatarId = useOptimisticAvatarId(
    avatarId,
    session?.user?.id,
  );
  const avatar = avatarById(resolvedAvatarId);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={name}
        onClick={() => setOpen((v) => !v)}
        // El contenedor sigue la silueta de la placa: con `rounded-full` el
        // anillo de foco dibujaba un círculo alrededor de un avatar cuadrado.
        className="group relative flex items-center justify-center rounded-[28%] transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/40"
      >
        <TrainerAvatar name={name} src={avatar?.src ?? null} size="sm" active={open} />
      </button>

      {open && (
        <div
          role="menu"
          className="user-menu-panel absolute right-0 top-full z-50 mt-2 w-62 overflow-hidden rounded-2xl border border-white/12 bg-[#16181e]/96 shadow-[0_18px_50px_-12px_rgba(0,0,0,0.75),0_0_0_1px_rgba(255,255,255,0.04)_inset] backdrop-blur-xl"
        >
          {/* Perfil + entrenador fusionados: toda la cabecera lleva a /profile */}
          <Link
            href={profileHref}
            role="menuitem"
            onClick={() => setOpen(false)}
            className="group/profile flex items-center gap-3 px-3.5 py-3 transition-colors hover:bg-white/4"
          >
            <TrainerAvatar name={name} src={avatar?.src ?? null} size="md" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold leading-tight text-on-surface">
                {name}
              </span>
              <span className="mt-0.5 flex items-center gap-0.5 text-[11px] font-medium text-on-surface-variant transition-colors group-hover/profile:text-primary">
                {profileLabel}
                <span className="material-symbols-outlined text-[14px]! opacity-70 transition-transform group-hover/profile:translate-x-0.5">
                  chevron_right
                </span>
              </span>
            </span>
          </Link>

          <div className="mx-3 h-px bg-linear-to-r from-transparent via-white/12 to-transparent" />

          <div className="p-1.5">
            <button
              type="button"
              role="menuitem"
              onClick={() => signOut({ callbackUrl: "/" })}
              className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-left text-[13px] text-on-surface-variant transition-colors hover:bg-pokeball-red/10 hover:text-pokeball-red"
            >
              <span className="material-symbols-outlined text-[18px]!">logout</span>
              {logoutLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
