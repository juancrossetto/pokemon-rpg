"use client";

import { useEffect } from "react";
import { applyGameSettings, getGameSettings } from "@/lib/game-settings";

/** Aplica preferencias visuales antes de que una pantalla de juego las necesite. */
export function GameSettingsRuntime() {
  useEffect(() => {
    const settings = getGameSettings();
    applyGameSettings(settings);
  }, []);
  return null;
}
