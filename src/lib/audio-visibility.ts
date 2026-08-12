"use client";

import {
  pauseAllBgmForBackground,
  resumeAllBgmFromBackground,
} from "@/lib/battle-bgm";
import {
  pauseWorldBgmForBackground,
  resumeWorldBgmFromBackground,
} from "@/lib/world-bgm";

let bound = false;

function pauseMediaForBackground() {
  pauseWorldBgmForBackground();
  pauseAllBgmForBackground();
  for (const video of document.querySelectorAll("video")) {
    if (!video.paused) video.pause();
  }
}

function resumeMediaFromBackground() {
  resumeWorldBgmFromBackground();
  resumeAllBgmFromBackground();
}

function syncWithVisibility() {
  if (document.visibilityState === "hidden") {
    pauseMediaForBackground();
  } else {
    resumeMediaFromBackground();
  }
}

/**
 * Pausa BGM (y vídeos) al minimizar la PWA o cambiar de app.
 * En iOS standalone `visibilitychange` es lo fiable; `pagehide` cubre cierre.
 */
export function bindAudioVisibilityHandlers() {
  if (bound || typeof window === "undefined") return;
  bound = true;

  syncWithVisibility();
  document.addEventListener("visibilitychange", syncWithVisibility);
  window.addEventListener("pagehide", pauseMediaForBackground);
}
