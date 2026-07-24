"use client";

import { useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";
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
}: {
  name: string;
  avatarId: string | null;
  logoutLabel: string;
  trainerLabel: string;
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
          <AvatarImage src={avatar.src} alt={name} className="h-full w-full object-cover" />
        ) : (
          initials(name)
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1.5 min-w-44 rounded-lg border border-white/10 bg-background/98 backdrop-blur-xl shadow-2xl py-1 z-50"
        >
          <div className="px-3 py-2 border-b border-white/10">
            <p className="text-label-sm text-on-surface-variant">{trainerLabel}</p>
            <p className="text-label-md text-on-surface truncate">{name}</p>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="w-full text-left px-3 py-2 text-label-md text-on-surface-variant hover:text-pokeball-red hover:bg-white/5 transition-colors"
          >
            {logoutLabel}
          </button>
        </div>
      )}
    </div>
  );
}
