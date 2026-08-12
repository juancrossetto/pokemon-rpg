"use client";

import { useLayoutEffect } from "react";

/**
 * Publica `--bottom-nav-h` mientras corre el fallback del shell, para que el
 * overlay de locale no se meta debajo del dock.
 */
export function AppShellFallbackMeasure() {
  useLayoutEffect(() => {
    const dock = document.querySelector<HTMLElement>(
      ".mobile-bottom-nav .mobile-bottom-nav__dock",
    );
    if (!dock) return;
    const height = Math.ceil(dock.getBoundingClientRect().height);
    if (height > 0) {
      document.documentElement.style.setProperty("--bottom-nav-h", `${height}px`);
    }
  }, []);

  return null;
}
