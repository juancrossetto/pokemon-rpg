"use client";

import { useEffect } from "react";
import { getGameSettings } from "@/lib/game-settings";

/** Aplica preferencias visuales antes de que una pantalla de juego las necesite. */
export function GameSettingsRuntime() {
  useEffect(() => {
    const settings = getGameSettings();
    document.documentElement.dataset.reduceMotion = settings.reducedMotion ? "1" : "0";
    document.documentElement.dataset.flashes = settings.flashes ? "1" : "0";
  }, []);
  return null;
}
