"use client";

import { useEffect, useState } from "react";

/**
 * Capas ambientales CSS sobre la escena de expedición.
 * Solo transforms/opacity; se pausa fuera de vista o con pestaña oculta.
 */
export function ExpeditionAmbient({ kind }: { kind?: string }) {
  const [active, setActive] = useState(true);

  useEffect(() => {
    function sync() {
      setActive(document.visibilityState === "visible");
    }
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  const theme =
    kind === "forest"
      ? "expedition-ambient--forest"
      : kind === "dungeon"
        ? "expedition-ambient--dungeon"
        : kind === "gym"
          ? "expedition-ambient--gym"
          : kind === "town"
            ? "expedition-ambient--town"
            : "expedition-ambient--route";

  return (
    <div
      aria-hidden
      className={`expedition-ambient pointer-events-none absolute inset-0 overflow-hidden ${theme} ${
        active ? "" : "expedition-ambient--paused"
      }`}
    >
      <span className="expedition-ambient__fog" />
      <span className="expedition-ambient__glow" />
      <span className="expedition-ambient__particle expedition-ambient__particle--a" />
      <span className="expedition-ambient__particle expedition-ambient__particle--b" />
      <span className="expedition-ambient__particle expedition-ambient__particle--c" />
      <span className="expedition-ambient__beacon" />
    </div>
  );
}
