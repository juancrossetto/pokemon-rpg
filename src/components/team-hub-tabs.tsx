"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";

type TabId = "squad" | "pc";
type IndicatorBox = { left: number; top: number; width: number; height: number };

const CACHE_KEY = "team-hub-tab-indicator";

const TABS = [
  { id: "squad" as const, href: "/team", icon: "group" },
  { id: "pc" as const, href: "/team?tab=pc", icon: "storage" },
] as const;

function readCache(): IndicatorBox | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as IndicatorBox;
    if (
      typeof parsed?.left !== "number" ||
      typeof parsed?.top !== "number" ||
      typeof parsed?.width !== "number" ||
      typeof parsed?.height !== "number"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(box: IndicatorBox) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(box));
  } catch {
    /* private mode / quota */
  }
}

/**
 * Tabs Equipo | PC y Guardería con pastilla roja elástica (mismo espíritu
 * pegajoso que el bottom nav). La posición previa se cachea en sessionStorage
 * porque el page remonta al cambiar de tab.
 */
export function TeamHubTabs({
  active,
  labels,
}: {
  active: TabId;
  labels: { squad: string; pc: string };
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState<IndicatorBox | null>(null);
  const [animate, setAnimate] = useState(false);
  const seededRef = useRef(false);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    function measure(): IndicatorBox | null {
      const node = root?.querySelector<HTMLElement>("[data-active]");
      if (!node || !root) return null;
      const rootBox = root.getBoundingClientRect();
      const box = node.getBoundingClientRect();
      return {
        left: box.left - rootBox.left,
        top: box.top - rootBox.top,
        width: box.width,
        height: box.height,
      };
    }

    const next = measure();
    if (!next) {
      setIndicator(null);
      return;
    }

    if (!seededRef.current) {
      seededRef.current = true;
      const cached = readCache();
      if (cached) {
        setAnimate(false);
        setIndicator(cached);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setAnimate(true);
            setIndicator(next);
            writeCache(next);
          });
        });
        return;
      }
      setIndicator(next);
      writeCache(next);
      requestAnimationFrame(() => setAnimate(true));
      return;
    }

    setAnimate(true);
    setIndicator(next);
    writeCache(next);
  }, [active]);

  useEffect(() => {
    if (!animate) return;
    const root = rootRef.current;
    if (!root) return;
    const observer = new ResizeObserver(() => {
      const node = root.querySelector<HTMLElement>("[data-active]");
      if (!node) return;
      const rootBox = root.getBoundingClientRect();
      const box = node.getBoundingClientRect();
      const next = {
        left: box.left - rootBox.left,
        top: box.top - rootBox.top,
        width: box.width,
        height: box.height,
      };
      setIndicator(next);
      writeCache(next);
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, [active, animate]);

  return (
    <div
      ref={rootRef}
      className="relative mb-5 flex gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1"
    >
      {indicator ? (
        <span
          aria-hidden
          className={`team-hub-tab-active-bg pointer-events-none absolute rounded-lg ${
            animate ? "team-hub-tab-active-bg--animate" : ""
          }`}
          style={{
            left: indicator.left,
            top: indicator.top,
            width: indicator.width,
            height: indicator.height,
          }}
        />
      ) : null}

      {TABS.map((entry) => {
        const isActive = active === entry.id;
        return (
          <Link
            key={entry.id}
            href={entry.href}
            data-active={isActive || undefined}
            aria-current={isActive ? "page" : undefined}
            className={`relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-label-sm font-semibold transition-colors duration-300 ${
              isActive
                ? "text-white"
                : "text-on-surface-variant hover:bg-white/[0.05] hover:text-on-surface"
            }`}
          >
            <span aria-hidden className="material-symbols-outlined text-[18px]!">
              {entry.icon}
            </span>
            {labels[entry.id]}
          </Link>
        );
      })}
    </div>
  );
}
