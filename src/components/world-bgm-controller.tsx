"use client";

import { useEffect } from "react";
import { usePathname } from "@/i18n/navigation";
import { bindAudioVisibilityHandlers } from "@/lib/audio-visibility";
import {
  startWorldBgm,
  stopWorldBgm,
  unlockWorldBgm,
  worldBgmKindForPath,
} from "@/lib/world-bgm";

/**
 * BGM ambiental según ruta. No corta al cambiar de menú (misma pista =
 * sigue). Pausa al minimizar la PWA o cambiar de app.
 */
export function WorldBgmController() {
  const pathname = usePathname();

  useEffect(() => {
    bindAudioVisibilityHandlers();
  }, []);

  useEffect(() => {
    function unlock() {
      unlockWorldBgm();
    }
    window.addEventListener("pointerdown", unlock, { once: true, passive: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    const kind = worldBgmKindForPath(pathname);
    if (kind) startWorldBgm(kind);
    else stopWorldBgm();
  }, [pathname]);

  return null;
}
