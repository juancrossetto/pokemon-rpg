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
  /** Contadores por `badgeKey`. 0 o ausente = sin badge. */
  badges: Record<string, number>;
};

/** Punto/contador de acciones pendientes. Nunca es el único indicador. */
function PendingBadge({ count, className = "" }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={`flex h-4 min-w-4 items-center justify-center rounded-full bg-tertiary px-1 text-[10px] font-bold text-surface ${className}`}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

/**
 * Posición y ancho del subrayado activo, en píxeles relativos al contenedor.
 * `null` hasta la primera medición (SSR y primer frame).
 */
type IndicatorBox = { left: number; width: number } | null;

const TRIGGER_BASE =
  "nav-link-text relative flex h-14 items-center gap-0.5 px-2.5 whitespace-nowrap uppercase tracking-[0.12em] transition-colors xl:gap-1 xl:px-3";

export function NavLinks({
  groups,
  labels,
}: {
  groups: NavGroup[];
  labels: NavLabels;
}) {
  const pathname = usePathname();
  const [openId, setOpenId] = useState<string | null>(null);
  const [indicator, setIndicator] = useState<IndicatorBox>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  /*
    Un único subrayado que se desliza entre opciones.

    Antes cada link dibujaba el suyo: al cambiar de sección, uno desaparecía y
    otro aparecía de golpe, sin relación entre los dos. Con una sola barra
    posicionada en el contenedor, el cambio se lee como un movimiento y admite
    la curva elástica que pidió el diseño.

    Se mide el elemento marcado con `data-active` en vez de recalcular cuál es
    —la lógica de "qué está activo" ya vive en `groupMatches`/`itemMatches` y
    duplicarla acá sería una segunda fuente de verdad que se puede desincronizar.
  */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    function measure() {
      const node = root?.querySelector<HTMLElement>("[data-active]");
      if (!node || !root) {
        setIndicator(null);
        return;
      }
      const rootBox = root.getBoundingClientRect();
      const box = node.getBoundingClientRect();
      // Se recorta a los lados para que la barra no ocupe todo el link, que es
      // como se veía antes con `inset-x-3`.
      const inset = 10;
      setIndicator({
        left: box.left - rootBox.left + inset,
        width: Math.max(0, box.width - inset * 2),
      });
    }

    measure();
    // El ancho de los links cambia con la fuente y con el idioma; sin esto el
    // subrayado queda corrido tras cargar la tipografía o al cambiar de locale.
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, [pathname]);

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
    <div ref={rootRef} className="relative ml-2 flex items-center xl:ml-3">
      {indicator && (
        <span
          aria-hidden
          className="nav-indicator absolute bottom-0 h-0.5 rounded-full bg-pokeball-red shadow-[0_0_8px_rgba(238,21,21,0.75)]"
          style={{ left: indicator.left, width: indicator.width }}
        />
      )}
      <Link
        href="/"
        prefetch
        data-active={homeActive || undefined}
        aria-current={homeActive ? "page" : undefined}
        className={`${TRIGGER_BASE} ${
          homeActive ? "text-white" : "text-on-surface-variant hover:text-on-surface"
        }`}
      >
        {labels.home}
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
              prefetch
              data-active={active || undefined}
              aria-current={active ? "page" : undefined}
              className={`${TRIGGER_BASE} ${
                active ? "text-white" : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              {labels.text[group.labelKey] ?? group.id}
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
  const [panelMounted, setPanelMounted] = useState(open);
  const [panelPhase, setPanelPhase] = useState<"in" | "out">(open ? "in" : "out");
  const active = groupMatches(pathname, group);
  // El grupo acumula los pendientes de sus hijos: el jugador ve que hay algo
  // que hacer en Aventura sin tener que abrir el menú.
  const groupBadge = items.reduce(
    (sum, item) => sum + (item.badgeKey ? (labels.badges[item.badgeKey] ?? 0) : 0),
    0,
  );

  // Apertura por click, no por hover: en tablet táctil el hover dispara al
  // primer toque y el link se abre solo. El teclado usa el mismo camino.
  function onTriggerKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown" && !open) {
      event.preventDefault();
      onToggle();
    }
  }

  useEffect(() => {
    if (open) {
      setPanelMounted(true);
      setPanelPhase("in");
      return;
    }
    if (!panelMounted) return;
    setPanelPhase("out");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ms = reduced ? 0 : 160;
    const timer = window.setTimeout(() => setPanelMounted(false), ms);
    return () => window.clearTimeout(timer);
    // panelMounted intencional: al cerrar necesitamos el valor actual para
    // decidir si hay que animar la salida.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ver arriba
  }, [open]);

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
        data-active={active || undefined}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={panelId}
        className={`${TRIGGER_BASE} ${
          open
            ? "rounded-t-lg rounded-b-none bg-[#14161e] text-white ring-1 ring-inset ring-white/10"
            : active
              ? "rounded-lg text-white"
              : "rounded-lg text-on-surface-variant hover:bg-white/[0.04] hover:text-on-surface"
        }`}
      >
        {labels.text[group.labelKey] ?? group.id}
        <PendingBadge count={groupBadge} />
        <span
          aria-hidden
          className={`material-symbols-outlined hidden text-[14px]! transition-transform duration-200 ease-out xl:inline ${
            open ? "rotate-180" : ""
          }`}
        >
          expand_more
        </span>
      </button>

      {panelMounted && (
        <div
          ref={panelRef}
          id={panelId}
          role="menu"
          aria-label={labels.text[group.labelKey]}
          aria-hidden={!open}
          className={`nav-dropdown absolute left-0 top-full z-50 min-w-full w-max overflow-hidden rounded-b-lg border border-t-0 border-white/10 bg-[#14161e] py-1 shadow-[0_12px_28px_rgba(0,0,0,0.4)] ${
            panelPhase === "in" ? "nav-dropdown--in" : "nav-dropdown--out"
          }`}
        >
          <div className="flex flex-col">
            {items.map((item) => {
              const itemActive = itemMatches(pathname, item);
              const label = labels.text[item.labelKey] ?? item.id;

              if (item.disabled) {
                return (
                  <span
                    key={item.id}
                    role="menuitem"
                    aria-disabled
                    className="nav-dropdown__item flex cursor-not-allowed items-center justify-center gap-1 whitespace-nowrap px-3 py-2 opacity-45"
                  >
                    <span className="nav-link-text leading-tight">{label}</span>
                    <span className="text-[10px] text-on-surface-variant">
                      ({labels.soon})
                    </span>
                  </span>
                );
              }

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  prefetch
                  role="menuitem"
                  tabIndex={open ? 0 : -1}
                  aria-current={itemActive ? "page" : undefined}
                  onClick={onClose}
                  className={`nav-dropdown__item flex items-center justify-center gap-1 whitespace-nowrap px-3 py-2 uppercase tracking-[0.1em] transition-colors duration-150 ${
                    itemActive
                      ? "bg-white/[0.08] text-white"
                      : "text-on-surface/90 hover:bg-white/[0.05] hover:text-white"
                  }`}
                >
                  <span className="nav-link-text flex items-center justify-center gap-1.5 leading-tight">
                    {label}
                    <PendingBadge
                      count={item.badgeKey ? (labels.badges[item.badgeKey] ?? 0) : 0}
                    />
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
