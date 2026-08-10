"use client";

import { useEffect, useState } from "react";

/**
 * TEMPORAL — diagnóstico del dock en PWA anclada.
 *
 * Sólo se monta en standalone (la app abierta desde la pantalla de inicio), así
 * que nadie que use la web normal lo ve. Imprime las medidas que hacen falta
 * para saber por qué el dock no queda pegado al borde inferior en iOS, algo que
 * no se puede reproducir en un navegador de escritorio.
 *
 * Cuando tengamos la captura, este archivo se borra junto con su render.
 */
type Metrics = Record<string, string | number | boolean>;

function read(): Metrics {
  const doc = document.documentElement;
  const cs = getComputedStyle(doc);
  const nav = document.querySelector<HTMLElement>(".mobile-bottom-nav");
  const dock = document.querySelector<HTMLElement>(".mobile-bottom-nav__dock");
  const navRect = nav?.getBoundingClientRect();
  const dockRect = dock?.getBoundingClientRect();
  const bodyRect = document.body.getBoundingClientRect();
  const vv = window.visualViewport;

  // Safe area real: la leemos pintando el env() en un elemento de prueba.
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:fixed;left:-9999px;height:env(safe-area-inset-bottom,0px);";
  document.body.appendChild(probe);
  const safeBottom = Math.round(probe.getBoundingClientRect().height);
  probe.remove();

  return {
    standaloneMQ: window.matchMedia("(display-mode: standalone)").matches,
    navStandalone: Boolean((window.navigator as { standalone?: boolean }).standalone),
    claseIsStandalone: doc.classList.contains("is-standalone"),
    innerH: window.innerHeight,
    clientH: doc.clientHeight,
    screenH: window.screen.height,
    vvH: vv ? Math.round(vv.height) : "-",
    vvOffsetTop: vv ? Math.round(vv.offsetTop) : "-",
    safeBottom,
    bodyTop: Math.round(bodyRect.top),
    bodyH: Math.round(bodyRect.height),
    bodyBottom: Math.round(bodyRect.bottom),
    navPos: nav ? getComputedStyle(nav).position : "-",
    navBottomCss: nav ? getComputedStyle(nav).bottom : "-",
    navTop: navRect ? Math.round(navRect.top) : "-",
    navBottom: navRect ? Math.round(navRect.bottom) : "-",
    dockBottom: dockRect ? Math.round(dockRect.bottom) : "-",
    HUECO: navRect ? Math.round(window.innerHeight - navRect.bottom) : "-",
    appVh: cs.getPropertyValue("--app-vh").trim() || "-",
    navH: cs.getPropertyValue("--bottom-nav-h").trim() || "-",
    vvGap: cs.getPropertyValue("--vv-gap").trim() || "-",
  };
}

export function StandaloneViewportDebug() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((window.navigator as { standalone?: boolean }).standalone);
    if (!isStandalone) return;

    const tick = () => setMetrics(read());
    const timers = [80, 400, 1200].map((ms) => window.setTimeout(tick, ms));
    window.addEventListener("resize", tick);
    window.visualViewport?.addEventListener("resize", tick);
    return () => {
      for (const t of timers) window.clearTimeout(t);
      window.removeEventListener("resize", tick);
      window.visualViewport?.removeEventListener("resize", tick);
    };
  }, []);

  if (!metrics) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: "env(safe-area-inset-top, 0px)",
        left: 0,
        right: 0,
        zIndex: 2147483647,
        background: "rgba(0,0,0,0.92)",
        color: "#7CFFB2",
        font: "600 10px/1.35 ui-monospace, monospace",
        padding: "6px 8px",
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: "2px 6px",
        pointerEvents: "none",
      }}
    >
      {Object.entries(metrics).map(([k, v]) => (
        <span key={k} style={{ whiteSpace: "nowrap" }}>
          <span style={{ color: "#8891a8" }}>{k}</span>{" "}
          <span style={{ color: k === "HUECO" ? "#FF6B6B" : "#7CFFB2" }}>{String(v)}</span>
        </span>
      ))}
    </div>
  );
}
