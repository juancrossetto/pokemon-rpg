"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { groupMatches, itemMatches, visibleChildren } from "@/lib/navigation";
import type { NavGroup, NavItem } from "@/lib/navigation";

/** Etiquetas ya traducidas: el navbar desktop es cliente y no puede llamar a `t`. */
export type NavLabels = {
  /** `groups.adventure` → "Aventura", `campaign` → "Viaje", etc. */
  text: Record<string, string>;
  /** Descripciones por id de destino. Puede faltar. */
  description: Record<string, string>;
  home: string;
  soon: string;
};

/**
 * Indicador de ruta activa: contraste + línea corta + glow tenue.
 * Sin fondo sólido — a lo ancho del link se leía como un botón presionado.
 */
function ActiveUnderline() {
  return (
    <span
      aria-hidden
      className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-pokeball-red shadow-[0_0_8px_rgba(238,21,21,0.75)]"
    />
  );
}

const TRIGGER_BASE =
  "nav-link-text relative flex h-16 items-center gap-0.5 px-2.5 whitespace-nowrap transition-colors xl:gap-1 xl:px-3";

export function NavLinks({
  groups,
  labels,
}: {
  groups: NavGroup[];
  labels: NavLabels;
}) {
  const pathname = usePathname();
  const [openId, setOpenId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (openId === null) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpenId(null);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenId(null);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [openId]);

  const homeActive = pathname === "/";

  return (
    <div ref={rootRef} className="ml-2 flex items-center xl:ml-4">
      <Link
        href="/"
        aria-current={homeActive ? "page" : undefined}
        className={`${TRIGGER_BASE} ${
          homeActive ? "text-white" : "text-on-surface-variant hover:text-on-surface"
        }`}
      >
        {labels.home}
        {homeActive && <ActiveUnderline />}
      </Link>

      {groups.map((group) => {
        const children = visibleChildren(group);
        if (children.length === 0) return null;

        // Un grupo de un solo destino se muestra como link directo: abrir un
        // dropdown para una única opción es un click de más sin información.
        if (children.length === 1) {
          const only = children[0];
          const active = itemMatches(pathname, only);
          return (
            <Link
              key={group.id}
              href={only.href}
              aria-current={active ? "page" : undefined}
              className={`${TRIGGER_BASE} ${
                active ? "text-white" : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              {labels.text[group.labelKey] ?? group.id}
              {active && <ActiveUnderline />}
            </Link>
          );
        }

        return (
          <NavGroupMenu
            key={group.id}
            group={group}
            items={children}
            labels={labels}
            pathname={pathname}
            open={openId === group.id}
            onToggle={() => setOpenId((current) => (current === group.id ? null : group.id))}
            onClose={() => setOpenId(null)}
          />
        );
      })}
    </div>
  );
}

function NavGroupMenu({
  group,
  items,
  labels,
  pathname,
  open,
  onToggle,
  onClose,
}: {
  group: NavGroup;
  items: NavItem[];
  labels: NavLabels;
  pathname: string;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const active = groupMatches(pathname, group);

  // Apertura por click, no por hover: en tablet táctil el hover dispara al
  // primer toque y el link se abre solo. El teclado usa el mismo camino.
  function onTriggerKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown" && !open) {
      event.preventDefault();
      onToggle();
    }
  }

  useEffect(() => {
    if (!open) return;
    // Al abrir con teclado el foco entra al panel; al cerrar vuelve al trigger.
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      triggerRef.current?.focus();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={onToggle}
        onKeyDown={onTriggerKeyDown}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={panelId}
        className={`${TRIGGER_BASE} ${
          active || open ? "text-white" : "text-on-surface-variant hover:text-on-surface"
        }`}
      >
        {labels.text[group.labelKey] ?? group.id}
        <span
          aria-hidden
          className={`material-symbols-outlined hidden text-[16px]! transition-transform duration-150 xl:inline ${
            open ? "rotate-180" : ""
          }`}
        >
          expand_more
        </span>
        {active && <ActiveUnderline />}
      </button>

      {open && (
        <div
          ref={panelRef}
          id={panelId}
          role="menu"
          aria-label={labels.text[group.labelKey]}
          className="nav-dropdown-in absolute left-0 top-full z-50 w-[276px] rounded-xl border border-white/10 bg-surface-container-low/98 p-1.5 shadow-2xl backdrop-blur-xl"
        >
          <p className="px-2.5 pb-1.5 pt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-on-surface-variant/70">
            {labels.text[group.labelKey]}
          </p>
          {items.map((item) => {
            const itemActive = itemMatches(pathname, item);
            const label = labels.text[item.labelKey] ?? item.id;
            const description = labels.description[item.id];

            if (item.disabled) {
              return (
                <span
                  key={item.id}
                  role="menuitem"
                  aria-disabled
                  className="flex cursor-not-allowed items-start gap-2.5 rounded-lg px-2.5 py-2 opacity-45"
                >
                  <span className="material-symbols-outlined mt-px text-[18px]!">{item.icon}</span>
                  <span className="min-w-0">
                    <span className="block text-label-md">{label}</span>
                    <span className="block text-[11px] text-on-surface-variant">{labels.soon}</span>
                  </span>
                </span>
              );
            }

            return (
              <Link
                key={item.id}
                href={item.href}
                role="menuitem"
                aria-current={itemActive ? "page" : undefined}
                onClick={onClose}
                className={`flex items-start gap-2.5 rounded-lg px-2.5 py-2 transition-colors ${
                  itemActive
                    ? "bg-pokeball-red/10 text-white"
                    : "text-on-surface hover:bg-white/[0.06]"
                }`}
              >
                <span
                  className={`material-symbols-outlined mt-px text-[18px]! ${
                    itemActive ? "text-pokeball-red" : "text-on-surface-variant"
                  }`}
                >
                  {item.icon}
                </span>
                <span className="min-w-0">
                  <span className="nav-link-text block leading-tight">{label}</span>
                  {description && (
                    // Las descripciones se ocultan en pantallas medianas: en
                    // 1024 el dropdown competía con el contenido de la página.
                    <span className="mt-0.5 hidden text-[11px] leading-snug text-on-surface-variant xl:block">
                      {description}
                    </span>
                  )}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
