"use client";

import { useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import { Link } from "@/i18n/navigation";
import { avatarById } from "@/lib/avatars";
import { AvatarImage } from "@/components/avatar-image";

const AVATAR_COLORS = [
  "bg-pokeball-red/80",
  "bg-tertiary/80",
  "bg-electric-yellow/70 text-surface",
  "bg-primary/80",
  "bg-secondary/80",
];

function avatarTone(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase() || "?";
}

export function UserMenu({
  name,
  avatarId,
  logoutLabel,
  trainerLabel,
  teamLabel,
  inventoryLabel,
  pcLabel,
}: {
  name: string;
  avatarId: string | null;
  logoutLabel: string;
  trainerLabel: string;
  teamLabel: string;
  inventoryLabel: string;
  pcLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const avatar = avatarById(avatarId);

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
        className={`h-8 w-8 rounded-full overflow-hidden flex items-center justify-center text-label-sm font-bold border border-white/15 shadow-sm hover:brightness-110 transition ${
          avatar ? "bg-surface-container-high" : `text-white ${avatarTone(name)}`
        }`}
      >
        {avatar ? (
          <AvatarImage
            src={avatar.src}
            alt={name}
            className="h-full w-full object-contain p-0.5 [image-rendering:pixelated]"
          />
        ) : (
          initials(name)
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1.5 min-w-48 rounded-lg border border-white/10 bg-background/98 py-1 shadow-2xl backdrop-blur-xl"
        >
          <div className="border-b border-white/10 px-3 py-2">
            <p className="text-label-sm text-on-surface-variant">{trainerLabel}</p>
            <p className="truncate text-label-md text-on-surface">{name}</p>
          </div>
          <Link
            href="/team"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2 px-3 py-2 text-label-md text-on-surface-variant transition-colors hover:bg-white/5 hover:text-on-surface"
          >
            <span className="material-symbols-outlined text-[18px]! text-pokeball-red">group</span>
            {teamLabel}
          </Link>
          <Link
            href="/inventory"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2 px-3 py-2 text-label-md text-on-surface-variant transition-colors hover:bg-white/5 hover:text-on-surface"
          >
            <span className="material-symbols-outlined text-[18px]! text-pokeball-red">
              inventory_2
            </span>
            {inventoryLabel}
          </Link>
          {pcLabel && (
            <Link
              href="/pc"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 px-3 py-2 text-label-md text-on-surface-variant transition-colors hover:bg-white/5 hover:text-on-surface"
            >
              <span className="material-symbols-outlined text-[18px]! text-pokeball-red">storage</span>
              {pcLabel}
            </Link>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="w-full px-3 py-2 text-left text-label-md text-on-surface-variant transition-colors hover:bg-white/5 hover:text-pokeball-red"
          >
            {logoutLabel}
          </button>
        </div>
      )}
    </div>
  );
}
