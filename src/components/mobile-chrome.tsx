"use client";

import Image from "next/image";
import { useEffect, useLayoutEffect, useRef, useState, type AnimationEvent, type TouchEvent } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { UserMenu } from "@/components/user-menu";
import { BrandLogo } from "@/components/brand-logo";
import { NotificationsBell } from "@/components/notifications-bell";
import { ResourceBar, type ResourceBarLabels } from "@/components/resource-bar";
import {
  allNavIconSrcs,
  groupMatches,
  itemMatches,
  MOBILE_BAR_GROUPS,
  visibleChildren,
} from "@/lib/navigation";
import type { NavGroup, NavItem } from "@/lib/navigation";
import type { NavLabels } from "@/components/nav-links";
import type { NotificationDTO } from "@/lib/notifications";
import { consumeMobileNavDrawerOpen, peekMobileNavDrawerOpen } from "@/lib/nav-drawer-persist";
import { getLastNavHref, setLastNavHref } from "@/lib/nav-last-dest";
import { HandbookTrigger } from "@/components/handbook/handbook-trigger";
import { openHandbook } from "@/lib/handbook/open";
import { chapterForPath } from "@/lib/handbook/chapters";

type NavLink = {
  href: string;
  label: string;
  icon: string;
  /** Ícono custom (PNG/SVG) en lugar del Material Symbol — p. ej. tab Combate. */
  iconSrc?: string;
  /**
   * Grupo que representa este tab. Con esto el tab queda activo en cualquier
   * ruta de la sección y no solo en la de su `href`: estando en `/gyms` se
   * marca "Aventura" aunque el tab apunte a `/campaign`.
   */
  groupId?: string;
};

type IndicatorBox = {
  left: number;
  top: number;
  width: number;
  height: number;
  combat: boolean;
} | null;


const BAR_GROUP_IDS = new Set<string>(MOBILE_BAR_GROUPS);
const SWIPE_CLOSE_PX = 96;
/** Hasta acá el toque es tap; recién después arranca el drag del sheet. */
const SWIPE_DRAG_START_PX = 10;

/**
 * ¿La app corre anclada al inicio (sin barra de URL)?
 *
 * `display-mode: standalone` cubre iOS moderno y Android; `navigator.standalone`
 * es el flag propietario de Safari iOS, que sigue siendo el único fiable en
 * algunas versiones. Se consulta en el momento y no se cachea porque el modo
 * puede diferir entre la pestaña y el icono del inicio.
 */
function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function NavDrawerIcon({ src, active }: { src: string; active?: boolean }) {
  return (
    <span className="relative flex h-9 w-9 shrink-0 items-center justify-center">
      <Image
        src={src}
        alt=""
        width={36}
        height={36}
        unoptimized
        className={`h-9 w-9 object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.4)] ${
          active ? "brightness-110" : "brightness-95"
        }`}
        aria-hidden
      />
    </span>
  );
}

function DrawerNavRow({
  item,
  active,
  label,
  description,
  badge,
  disabled,
  soonLabel,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  label: string;
  description?: string;
  badge: number;
  disabled?: boolean;
  soonLabel: string;
  onNavigate: () => void;
}) {
  const iconNode = item.iconSrc ? (
    <NavDrawerIcon src={item.iconSrc} active={active} />
  ) : (
    <span
      className={`flex h-9 w-9 shrink-0 items-center justify-center ${
        active ? "text-white" : "text-on-surface-variant"
      }`}
    >
      <span className="material-symbols-outlined text-[22px]!">{item.icon}</span>
    </span>
  );

  const rowClass = `flex min-h-12 w-full items-center gap-3 rounded-xl px-2 py-2 transition-colors ${
    active ? "bg-white/[0.06] text-white" : "text-on-surface active:bg-white/[0.04]"
  }`;

  const body = (
    <>
      {iconNode}
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-sm font-semibold leading-tight">{label}</span>
        {disabled ? (
          <span className="mt-0.5 block text-[11px] leading-snug text-on-surface-variant/80">
            {soonLabel}
          </span>
        ) : description ? (
          <span className="mt-0.5 block truncate text-[11px] leading-snug text-on-surface-variant/70">
            {description}
          </span>
        ) : null}
      </span>
      {badge > 0 ? (
        <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-tertiary px-1.5 text-[10px] font-bold text-surface">
          {badge}
        </span>
      ) : disabled ? null : (
        <span
          className={`material-symbols-outlined shrink-0 text-[18px]! ${
            active ? "text-white/50" : "text-on-surface-variant/35"
          }`}
        >
          chevron_right
        </span>
      )}
    </>
  );

  if (disabled) {
    return (
      <span aria-disabled className={`${rowClass} opacity-45`}>
        {body}
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={rowClass}
    >
      {body}
    </Link>
  );
}

export function MobileChrome({
  brand,
  brandHref = "/login",
  locale,
  languageLabel: _languageLabel,
  energy,
  energyMax,
  energyUpdatedAt,
  coins,
  gems,
  resourceLabels,
  userName,
  avatarId,
  logoutLabel,
  profileLabel,
  lockedHref,
  lockedLabel,
  lockedIcon,
  primary,
  groups,
  navLabels,
  moreLabel: _moreLabel,
  closeLabel: _closeLabel,
  shortcutsLabel: _shortcutsLabel,
  retapHint: _retapHint,
  seeAllNavLabel: _seeAllNavLabel,
  emptyNavLabel: _emptyNavLabel,
  swipeGroupsLabel: _swipeGroupsLabel,
  handbookLabel,
  loginLabel,
  registerLabel,
  notifications,
  adventureTowerActive = false,
}: {
  brand: string;
  brandHref?: string;
  locale: string;
  languageLabel: string;
  energy: number | null;
  energyMax: number | null;
  energyUpdatedAt: string | null;
  coins: number | null;
  gems: number | null;
  resourceLabels: ResourceBarLabels;
  userName: string | null;
  avatarId?: string | null;
  logoutLabel: string;
  profileLabel: string;
  lockedHref: string | null;
  lockedLabel: string | null;
  lockedIcon: "swords" | "military_tech";
  primary: NavLink[];
  /** Misma configuración que consume el navbar desktop. */
  groups: NavGroup[];
  navLabels: NavLabels;
  moreLabel: string;
  closeLabel: string;
  shortcutsLabel: string;
  retapHint: string;
  seeAllNavLabel: string;
  emptyNavLabel: string;
  swipeGroupsLabel: string;
  handbookLabel: string;
  loginLabel: string;
  registerLabel: string;
  notifications: { items: NotificationDTO[]; unreadCount: number } | null;
  /**
   * Hay un intento de Torre en curso (activo/pausado/bendición/descanso).
   * Si es false, el tab Aventura no debe reabrir `/tower`.
   */
  adventureTowerActive?: boolean;
}) {
  const tNav = useTranslations("nav");
  const router = useRouter();
  const [drawerPresent, setDrawerPresent] = useState(false);
  /** `open` = visible / entrando · `closing` = animación de salida. */
  const [drawerPhase, setDrawerPhase] = useState<"open" | "closing">("open");
  /**
   * `null` = drawer completo (Más).
   * id de grupo = mini-sheet sólo con ese grupo (segundo toque del tab).
   */
  const [drawerFocusGroupId, setDrawerFocusGroupId] = useState<string | null>(null);
  /**
   * Tras un cambio de locale el layout remonta: reabrimos el sheet sin
   * animación de entrada para que el switch se sienta imperceptible.
   */
  const [skipSheetMotion, setSkipSheetMotion] = useState(false);
  /** Sin motion en el primer paint para scale/label de tabs. */
  const [tabMotionReady, setTabMotionReady] = useState(false);
  const [indicator, setIndicator] = useState<IndicatorBox>(null);
  const [indicatorAnimated, setIndicatorAnimated] = useState(false);
  const [sheetDragY, setSheetDragY] = useState(0);
  const [isSwipeDragging, setIsSwipeDragging] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const indicatorSeenRef = useRef(false);
  const swipeStartY = useRef<number | null>(null);
  const sheetDragYRef = useRef(0);
  const swipeDraggingRef = useRef(false);
  const groupSwipeStart = useRef<{ x: number; y: number } | null>(null);
  /** Evita que el click fantasma post-cierre (iOS) reabra el drawer. */
  const closeCooldownUntilRef = useRef(0);
  /** Mientras el sheet está en el DOM (incluye animación de salida). */
  const moreOpen = drawerPresent;
  /** UI “abierta”: durante el slide-out los tabs vuelven al destino de la ruta. */
  const drawerShown = drawerPresent && drawerPhase === "open";

  function resolveGroupHref(groupId: string, fallbackHref: string): string {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return fallbackHref;
    const last = getLastNavHref(groupId);
    if (!last) return fallbackHref;
    // Torre sólo si el intento sigue vivo; si ya terminó, default = Viaje.
    if (
      groupId === "adventure" &&
      last.split("?")[0] === "/tower" &&
      !adventureTowerActive
    ) {
      return fallbackHref;
    }
    const hit = visibleChildren(group).find(
      (child) => child.href.split("?")[0] === last,
    );
    return hit?.href ?? fallbackHref;
  }

  function openMore(focusGroupId: string | null = null) {
    // Ignorar mientras sale: un segundo toque/ghost-click en Más reiniciaría
    // la animación de entrada (rebote) y dejaría el menú abierto.
    if (drawerPresent && drawerPhase === "closing") return;
    if (Date.now() < closeCooldownUntilRef.current) return;
    sheetDragYRef.current = 0;
    swipeDraggingRef.current = false;
    setSheetDragY(0);
    setIsSwipeDragging(false);
    setDrawerFocusGroupId(focusGroupId);
    setDrawerPhase("open");
    setDrawerPresent(true);
  }

  function closeMore() {
    if (!drawerPresent || drawerPhase === "closing") return;
    swipeDraggingRef.current = false;
    setIsSwipeDragging(false);
    sheetDragYRef.current = 0;
    setSheetDragY(0);
    closeCooldownUntilRef.current = Date.now() + 450;
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      finishClose();
      return;
    }
    setDrawerPhase("closing");
  }

  function finishClose() {
    setDrawerPresent(false);
    setDrawerPhase("open");
    setDrawerFocusGroupId(null);
    sheetDragYRef.current = 0;
    swipeDraggingRef.current = false;
    setSheetDragY(0);
    setIsSwipeDragging(false);
    closeCooldownUntilRef.current = Date.now() + 450;
    // No devolver foco al botón Más en táctil: iOS dispara un click fantasma
    // que reabre el drawer (parece un “rebote” que no cierra).
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(pointer: fine)").matches
    ) {
      requestAnimationFrame(() => {
        moreButtonRef.current?.focus({ preventScroll: true });
      });
    }
  }

  function toggleMoreDrawer() {
    if (drawerPhase === "closing") return;
    if (Date.now() < closeCooldownUntilRef.current) return;
    if (drawerShown && !groupMode) {
      closeMore();
      return;
    }
    openMore(null);
  }

  // Fallback si animationend no dispara.
  useEffect(() => {
    if (!drawerPresent || drawerPhase !== "closing") return;
    const t = window.setTimeout(() => finishClose(), 400);
    return () => window.clearTimeout(t);
  }, [drawerPresent, drawerPhase]);

  /*
    Precalienta los PNG de la nav apenas monta el chrome. Sin esto el drawer
    los pide al abrir y se ve el pop-in (antes sumaban ~30 MB en frío).
  */
  useEffect(() => {
    const urls = new Set<string>([
      ...allNavIconSrcs(),
      ...primary.map((p) => p.iconSrc).filter((u): u is string => Boolean(u)),
    ]);
    for (const url of urls) {
      const img = new window.Image();
      img.decoding = "async";
      img.src = url;
    }
  }, [primary]);

  // Clase en <html>/<body> para CSS de standalone también cuando sólo hay
  // navigator.standalone (Safari iOS viejo sin display-mode). En body hace
  // falta para ganar a `overflow-x-clip` de Tailwind y bloquear el rubber-band.
  useEffect(() => {
    if (!isStandalone()) return;
    document.documentElement.classList.add("is-standalone");
    document.body.classList.add("is-standalone");
    return () => {
      document.documentElement.classList.remove("is-standalone");
      document.body.classList.remove("is-standalone");
    };
  }, []);

  // Habilita transitions de tabs tras asentar el layout (más lento en PWA
  // standalone: si no, el scale del tab activo “salta” al refrescar).
  useEffect(() => {
    const delay = isStandalone() ? 700 : 120;
    const t = window.setTimeout(() => setTabMotionReady(true), delay);
    return () => window.clearTimeout(t);
  }, []);
  const bottomNavRef = useRef<HTMLElement>(null);
  // Invitados también tienen "Más" (idioma + CTA de login).
  const showMore = groups.length > 0 || !userName;
  // `usePathname` de next-intl ya viene sin el prefijo de idioma, así que se
  // compara directo contra los href de los links.
  const pathname = usePathname();
  const prevPathname = useRef(pathname);

  // En standalone el scroll vive en `.app-main` (body overflow:hidden).
  // Next scrollea el window; acá reseteamos el contenedor real al navegar.
  useEffect(() => {
    if (!isStandalone()) return;
    const main = document.querySelector<HTMLElement>(".app-main");
    main?.scrollTo({ top: 0, left: 0 });
  }, [pathname]);

  const groupMode = Boolean(drawerFocusGroupId);
  const focusedGroup = drawerFocusGroupId
    ? groups.find((g) => g.id === drawerFocusGroupId)
    : undefined;

  // Recordar el último hijo visitado de cada grupo de la bottom bar.
  useEffect(() => {
    for (const groupId of MOBILE_BAR_GROUPS) {
      const group = groups.find((g) => g.id === groupId);
      if (!group) continue;
      const child = visibleChildren(group).find((c) => itemMatches(pathname, c));
      if (!child) continue;
      if (
        groupId === "adventure" &&
        child.href.split("?")[0] === "/tower" &&
        !adventureTowerActive
      ) {
        setLastNavHref(groupId, "/campaign");
        continue;
      }
      setLastNavHref(groupId, child.href);
    }
  }, [pathname, groups, adventureTowerActive]);

  // Al cambiar de locale el layout se remonta. Reabrimos el sheet en el mismo
  // layout effect (antes del paint) y sin animación de entrada. No consumimos
  // el flag acá: Strict Mode remonta y necesita poder leerlo otra vez.
  useLayoutEffect(() => {
    if (!peekMobileNavDrawerOpen()) return;
    setSkipSheetMotion(true);
    setDrawerFocusGroupId(null);
    setDrawerPhase("open");
    setDrawerPresent(true);
  }, []);

  // Liberar el flag después de que el remount de Strict Mode ya pasó.
  useEffect(() => {
    if (!peekMobileNavDrawerOpen()) return;
    const t = window.setTimeout(() => {
      consumeMobileNavDrawerOpen();
      setSkipSheetMotion(false);
    }, 120);
    return () => window.clearTimeout(t);
  }, []);

  // Cerrar al navegar (p. ej. primer toque de un tab mientras el sheet está abierto).
  // Si estamos restaurando tras un cambio de locale, no cerrar.
  useEffect(() => {
    if (prevPathname.current === pathname) return;
    prevPathname.current = pathname;
    if (peekMobileNavDrawerOpen()) return;
    const raf = requestAnimationFrame(() => closeMore());
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- sólo al cambiar de ruta
  }, [pathname]);

  function isActive(href: string): boolean {
    const clean = href.split("?")[0];
    if (clean === "/") return pathname === "/";
    return pathname === clean || pathname.startsWith(`${clean}/`);
  }

  function isPrimaryActive(item: NavLink): boolean {
    if (item.groupId) {
      const group = groups.find((g) => g.id === item.groupId);
      return group ? groupMatches(pathname, group) : false;
    }
    return isActive(item.href);
  }

  const anyPrimaryActive = primary.some(isPrimaryActive);
  // "Más" solo si la ruta no cae en un tab de la barra (ranking, clanes…),
  // o si el drawer está abierto en modo completo.
  const moreRouteActive = groups.some(
    (g) => !BAR_GROUP_IDS.has(g.id) && groupMatches(pathname, g),
  );
  const moreActive =
    (drawerShown && !groupMode) || (!drawerPresent && !anyPrimaryActive && moreRouteActive);

  /*
    Pastilla deslizante detrás del tab activo. Un único elemento medido sobre
    `[data-active]` para animar el cambio de sección (no un fade por tab).
  */
  useEffect(() => {
    const root = dockRef.current;
    if (!root) return;

    function measureIndicator() {
      const node = root?.querySelector<HTMLElement>("[data-active]");
      if (!node || !root) {
        setIndicator(null);
        return;
      }
      const rootBox = root.getBoundingClientRect();
      // Pastilla sólo detrás del ícono/FAB — el label queda fuera y no se corta.
      const target =
        node.querySelector<HTMLElement>(".mobile-nav-tab-icon, .mobile-nav-fab") ??
        node;
      const box = target.getBoundingClientRect();
      const isCombat = node.classList.contains("mobile-nav-tab--combat");
      const pad = isCombat ? 6 : 5;
      const next = {
        left: box.left - rootBox.left - pad,
        top: box.top - rootBox.top - pad,
        width: Math.max(0, box.width + pad * 2),
        height: Math.max(0, box.height + pad * 2),
        combat: isCombat,
      };
      setIndicator((prev) => {
        if (
          prev &&
          prev.combat === next.combat &&
          Math.abs(prev.left - next.left) < 0.5 &&
          Math.abs(prev.top - next.top) < 0.5 &&
          Math.abs(prev.width - next.width) < 0.5 &&
          Math.abs(prev.height - next.height) < 0.5
        ) {
          return prev;
        }
        return next;
      });
      if (!indicatorSeenRef.current) {
        indicatorSeenRef.current = true;
        window.requestAnimationFrame(() => setIndicatorAnimated(true));
      }
    }

    measureIndicator();
    const raf = window.requestAnimationFrame(measureIndicator);
    const observer = new ResizeObserver(measureIndicator);
    observer.observe(root);
    return () => {
      window.cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [pathname, drawerShown, drawerFocusGroupId, primary.length, showMore, moreActive]);

  /*
    Altura de la nav para el padding de contenido. Vive en un efecto aparte
    del indicador y NO depende de `pathname`: antes, cada navegación hacía
    cleanup → borraba `--bottom-nav-h` / `style.bottom` → remedia → y la barra
    saltaba un frame hacia arriba.

    Tampoco tocamos `style.bottom` según innerHeight−clientHeight: ese gap
    cambia al hacer click, al esconderse la barra de URL y al reflow de cada
    pantalla, y era lo que levantaba los iconos fuera de lugar.
  */
  useEffect(() => {
    const root = bottomNavRef.current;
    if (!root) return;

    function publishNavHeight() {
      if (!root) return;
      const styles = getComputedStyle(root);
      const padBottom = Number.parseFloat(styles.paddingBottom) || 0;
      const height = Math.ceil(root.getBoundingClientRect().height - padBottom);
      if (height > 0) {
        document.documentElement.style.setProperty("--bottom-nav-h", `${height}px`);
      }
      /*
        El sheet debe pegarse al tope del dock, no al padding superior del nav
        (reserva del FAB). Si no, queda un hueco donde se ve el fondo.
      */
      const dock = dockRef.current;
      if (dock) {
        const inset = Math.max(
          0,
          Math.ceil(window.innerHeight - dock.getBoundingClientRect().top) - 1,
        );
        document.documentElement.style.setProperty("--bottom-sheet-inset", `${inset}px`);
      } else {
        document.documentElement.style.setProperty(
          "--bottom-sheet-inset",
          `${height > 0 ? height : 84}px`,
        );
      }
    }

    function publishVvGap() {
      /*
        Sólo para padding de contenido (`.pb-bottom-nav`), no para mover la
        barra. En standalone el gap es ruido del overscroll; lo forzamos a 0.
      */
      if (isStandalone()) {
        document.documentElement.style.setProperty("--vv-gap", "0px");
        return;
      }
      const gap = Math.max(
        0,
        Math.round(window.innerHeight - document.documentElement.clientHeight),
      );
      document.documentElement.style.setProperty("--vv-gap", `${gap}px`);
    }

    // Anclar siempre al borde: cualquier inset dinámico es la fuente del salto.
    root.style.bottom = "";

    publishNavHeight();
    publishVvGap();

    const observer = new ResizeObserver(publishNavHeight);
    observer.observe(root);
    if (dockRef.current) observer.observe(dockRef.current);

    function onViewportSettle() {
      publishNavHeight();
      publishVvGap();
    }

    window.addEventListener("resize", onViewportSettle);
    /*
      visualViewport resize = teclado / rotación. No escuchamos `scroll`:
      en iOS dispara en cada frame del rebote y hacía bailar la barra.
    */
    window.visualViewport?.addEventListener("resize", onViewportSettle);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", onViewportSettle);
      window.visualViewport?.removeEventListener("resize", onViewportSettle);
      // No borrar --bottom-nav-h/--vv-gap acá: en remount (Strict/locale) el
      // hueco a 0 hacía saltar la barra un frame antes de volver a medir.
    };
  }, [primary.length, showMore, moreOpen]);

  // Bloqueo de scroll mientras el sheet esté montado (también durante el
  // slide-out). La trampa de foco sólo aplica con el sheet usable.
  useEffect(() => {
    if (!moreOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [moreOpen]);

  useEffect(() => {
    if (!moreOpen || !drawerShown) return;

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMore();
        return;
      }
      if (event.key !== "Tab" || !drawerRef.current) return;
      // Trampa de foco: con el drawer abierto el tab no debe recorrer la
      // página de atrás, que está oculta tras el overlay.
      const focusables = drawerRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([type="hidden"]), select, [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    const raf = requestAnimationFrame(() => {
      drawerRef.current?.querySelector<HTMLElement>("a[href], button")?.focus();
    });

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
      // El foco al opener vive en finishClose — no acá (ver comentario ahí).
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- closeMore sólo se usa en el handler Escape
  }, [moreOpen, drawerShown, drawerFocusGroupId]);

  function onHandleTouchStart(event: TouchEvent<HTMLDivElement>) {
    if (!drawerShown) return;
    swipeStartY.current = event.touches[0]?.clientY ?? null;
    swipeDraggingRef.current = false;
    // No marcar dragging todavía: un tap en el asa mataba la animación
    // (`is-dragging { animation: none }`) y al soltar reiniciaba el sheet-in
    // con su overshoot — exactamente el rebote al tocar la X.
  }

  function onHandleTouchMove(event: TouchEvent<HTMLDivElement>) {
    if (swipeStartY.current == null) return;
    const y = event.touches[0]?.clientY ?? swipeStartY.current;
    const next = Math.max(0, y - swipeStartY.current);
    if (!swipeDraggingRef.current && next < SWIPE_DRAG_START_PX) return;
    if (!swipeDraggingRef.current) {
      swipeDraggingRef.current = true;
      setIsSwipeDragging(true);
    }
    sheetDragYRef.current = next;
    setSheetDragY(next);
  }

  function onHandleTouchEnd() {
    const dragged = sheetDragYRef.current;
    const wasDragging = swipeDraggingRef.current;
    swipeStartY.current = null;
    swipeDraggingRef.current = false;
    setIsSwipeDragging(false);
    if (wasDragging && dragged >= SWIPE_CLOSE_PX) {
      closeMore();
      return;
    }
    sheetDragYRef.current = 0;
    setSheetDragY(0);
  }

  function onSheetAnimationEnd(event: AnimationEvent<HTMLDivElement>) {
    if (event.target !== drawerRef.current) return;
    // Sólo terminar al completar la salida — un animationend de la entrada
    // interrumpida no debe desmontar a mitad de gesto.
    if (drawerPhase !== "closing") return;
    if (event.animationName && !event.animationName.includes("sheet-out")) return;
    finishClose();
  }

  function shiftMiniGroup(dir: -1 | 1) {
    if (!drawerFocusGroupId) return;
    const ids = MOBILE_BAR_GROUPS.filter((id) =>
      groups.some((g) => g.id === id && visibleChildren(g).length > 0),
    );
    const idx = ids.indexOf(drawerFocusGroupId as (typeof MOBILE_BAR_GROUPS)[number]);
    if (idx < 0) return;
    const next = ids[idx + dir];
    if (next) {
      setDrawerFocusGroupId(next);
      try {
        navigator.vibrate?.(8);
      } catch {
        // ignore
      }
    }
  }

  function onGroupSwipeStart(event: TouchEvent<HTMLDivElement>) {
    if (!groupMode) return;
    const t = event.touches[0];
    if (!t) return;
    groupSwipeStart.current = { x: t.clientX, y: t.clientY };
  }

  function onGroupSwipeEnd(event: TouchEvent<HTMLDivElement>) {
    const start = groupSwipeStart.current;
    groupSwipeStart.current = null;
    if (!groupMode || !start) return;
    const t = event.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    shiftMiniGroup(dx < 0 ? 1 : -1);
  }

  function renderGroupSections(groupsToShow: NavGroup[]) {
    return groupsToShow.map((group) => {
      const items = visibleChildren(group);
      if (items.length === 0) return null;
      return (
        <section key={group.id} data-nav-group={group.id} className="mb-3 last:mb-1">
          {!groupMode ? (
            <p className="mb-1 px-2 text-[10px] font-medium uppercase tracking-[0.14em] text-on-surface-variant/55">
              {tNav(group.labelKey)}
            </p>
          ) : null}
          <ul className="flex flex-col">
            {items.map((item) => (
              <li key={item.id}>
                <DrawerNavRow
                  item={item}
                  active={itemMatches(pathname, item)}
                  label={tNav(item.labelKey)}
                  description={
                    item.descriptionKey ? tNav(item.descriptionKey) : undefined
                  }
                  badge={item.badgeKey ? (navLabels.badges[item.badgeKey] ?? 0) : 0}
                  disabled={item.disabled}
                  soonLabel={liveSoonLabel}
                  onNavigate={closeMore}
                />
              </li>
            ))}
          </ul>
        </section>
      );
    });
  }

  const liveMoreLabel = tNav("menu");
  const liveCloseLabel = tNav("close");
  const liveLanguageLabel = tNav("language");
  const liveSeeAllNavLabel = tNav("seeAllNav");
  const liveRetapHint = tNav("retapHint");
  const liveSwipeGroupsLabel = tNav("swipeGroups");
  const liveEmptyNavLabel = tNav("emptyNav");
  const liveSoonLabel = tNav("soon");

  const sheetTitle = groupMode
    ? focusedGroup
      ? tNav(focusedGroup.labelKey)
      : liveMoreLabel
    : tNav("navigation");

  return (
    <>
      {/* Top bar mobile: brand + resources + account.
          min-h incluye safe-area: con border-box, `min-h-14` + pt-safe
          comía el alto útil y en PWA iOS los iconos quedaban sin aire abajo. */}
      <header className="mobile-top-chrome fixed top-0 inset-x-0 z-50 flex min-h-[calc(3.5rem+env(safe-area-inset-top,0px))] items-center justify-between gap-2 border-b border-white/10 bg-background/95 px-3 pt-[env(safe-area-inset-top,0px)] pb-2.5 backdrop-blur-xl xl:hidden">
        <Link
          href={lockedHref ?? brandHref}
          className="flex h-8 shrink-0 items-center justify-center"
          aria-label={brand}
        >
          <BrandLogo alt={brand} priority sizes="64px" className="h-7 w-auto" />
        </Link>

        <div className="flex h-8 min-w-0 shrink-0 items-center gap-1.5">
          {energy !== null &&
            energyMax !== null &&
            energyUpdatedAt &&
            coins !== null &&
            gems !== null && (
              <ResourceBar
                energy={energy}
                energyMax={energyMax}
                energyUpdatedAt={energyUpdatedAt}
                coins={coins}
                gems={gems}
                labels={resourceLabels}
                variant="mobile"
              />
            )}
          {userName ? (
            <HandbookTrigger className="hidden min-[401px]:inline-flex h-8 w-8 items-center justify-center rounded-md text-on-surface-variant transition hover:text-electric-yellow" />
          ) : null}
          {notifications && (
            <NotificationsBell
              initialItems={notifications.items}
              initialUnread={notifications.unreadCount}
            />
          )}
          {userName ? (
            <UserMenu
              name={userName}
              avatarId={avatarId ?? null}
              logoutLabel={logoutLabel}
              profileLabel={profileLabel}
              handbookLabel={handbookLabel}
              onHandbook={() =>
                openHandbook(chapterForPath(pathname) ?? undefined)
              }
            />
          ) : (
            <div className="flex items-center gap-1.5">
              <Link
                href="/login"
                className="page-title inline-flex items-center justify-center rounded-lg border border-white/25 bg-transparent px-2.5 py-1.5 text-[10px] text-white transition hover:border-white/45 hover:bg-white/6"
              >
                {loginLabel}
              </Link>
              <Link
                href="/register"
                className="page-title inline-flex items-center justify-center rounded-lg border border-pokeball-red bg-pokeball-red px-2.5 py-1.5 text-[10px] text-white shadow-[0_2px_8px_color-mix(in_srgb,var(--color-pokeball-red)_28%,transparent)] transition hover:brightness-110"
              >
                {registerLabel}
              </Link>
            </div>
          )}
        </div>
      </header>

      {/*
        Bottom bar siempre visible: el sheet se ancla encima (`--bottom-nav-h`)
        y el backdrop no la tapa, así Más puede cerrar y el contexto no desaparece.
      */}
      <nav
        ref={bottomNavRef}
        className="mobile-bottom-nav xl:hidden"
      >
        {lockedHref && lockedLabel ? (
          <div className="mobile-bottom-nav__dock mobile-bottom-nav__dock--flat">
            <Link
              href={lockedHref}
              className="mobile-nav-tab mobile-nav-tab--active flex-1"
            >
              <span className="mobile-nav-tab-icon">
                <span className="material-symbols-outlined text-[28px]!">{lockedIcon}</span>
              </span>
              <span className="mobile-nav-tab-text">{lockedLabel}</span>
            </Link>
          </div>
        ) : (
          <div
            ref={dockRef}
            className={`mobile-bottom-nav__dock${
              primary.some((p) => p.groupId === "combat")
                ? ""
                : " mobile-bottom-nav__dock--flat"
            }`}
          >
            {indicator && (
              <span
                aria-hidden
                className={`mobile-nav-active-bg${
                  indicator.combat ? " mobile-nav-active-bg--fab" : ""
                }${indicatorAnimated ? " mobile-nav-active-bg--animate" : ""}`}
                style={{
                  left: indicator.left,
                  top: indicator.top,
                  width: indicator.width,
                  height: indicator.height,
                }}
              />
            )}
            {primary.map((item) => {
              const group = item.groupId
                ? groups.find((g) => g.id === item.groupId)
                : undefined;
              const active = isPrimaryActive(item);
              const showActive =
                drawerShown && groupMode && item.groupId === drawerFocusGroupId
                  ? true
                  : active && !drawerShown;
              const badge = group
                ? visibleChildren(group).reduce(
                    (sum, child) =>
                      sum + (child.badgeKey ? (navLabels.badges[child.badgeKey] ?? 0) : 0),
                    0,
                  )
                : 0;
              const isCombat = item.groupId === "combat";
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  data-active={showActive || undefined}
                  aria-current={showActive ? "page" : undefined}
                  aria-label={item.label}
                  onClick={(event) => {
                    // Ya estás en el grupo: segundo toque abre/cierra el mini-sheet.
                    if (item.groupId && active) {
                      event.preventDefault();
                      // Torre finalizada: el tab Aventura debe volver a Viaje,
                      // no quedarse en /tower abriendo el drawer.
                      if (
                        item.groupId === "adventure" &&
                        !adventureTowerActive &&
                        (pathname === "/tower" || pathname.startsWith("/tower/"))
                      ) {
                        setLastNavHref("adventure", "/campaign");
                        router.push("/campaign");
                        if (drawerShown) closeMore();
                        return;
                      }
                      if (drawerShown && drawerFocusGroupId === item.groupId) {
                        closeMore();
                      } else {
                        openMore(item.groupId);
                      }
                      return;
                    }
                    // Primer toque: ir al último destino del grupo si hay.
                    if (item.groupId) {
                      event.preventDefault();
                      router.push(resolveGroupHref(item.groupId, item.href));
                    }
                  }}
                  className={`mobile-nav-tab ${
                    tabMotionReady ? "" : "mobile-nav-tab--no-motion "
                  }${isCombat ? "mobile-nav-tab--combat " : ""}${
                    showActive ? "mobile-nav-tab--active" : ""
                  }`}
                >
                  {isCombat ? (
                    <span className="mobile-nav-fab">
                      {item.iconSrc ? (
                        <Image
                          src={item.iconSrc}
                          alt=""
                          width={48}
                          height={48}
                          unoptimized
                          aria-hidden
                          priority
                        />
                      ) : (
                        <span className="material-symbols-outlined text-[30px]!">
                          {item.icon}
                        </span>
                      )}
                    </span>
                  ) : item.iconSrc ? (
                    <span className="mobile-nav-tab-icon">
                      <Image
                        src={item.iconSrc}
                        alt=""
                        width={48}
                        height={48}
                        unoptimized
                        aria-hidden
                        priority
                      />
                    </span>
                  ) : (
                    <span className="mobile-nav-tab-icon">
                      <span className="material-symbols-outlined text-[28px]!">
                        {item.icon}
                      </span>
                    </span>
                  )}
                  <span className="mobile-nav-tab-text">{item.label}</span>
                  {badge > 0 && (
                    <span
                      aria-hidden
                      className="absolute right-[14%] top-1 h-2 w-2 rounded-full bg-tertiary ring-2 ring-[#0a0b11]"
                    />
                  )}
                </Link>
              );
            })}
            {showMore && (
              <button
                ref={moreButtonRef}
                type="button"
                onClick={toggleMoreDrawer}
                aria-expanded={drawerShown && !groupMode}
                aria-haspopup="dialog"
                aria-label={liveMoreLabel}
                data-active={moreActive || undefined}
                className={`mobile-nav-tab ${
                  tabMotionReady ? "" : "mobile-nav-tab--no-motion "
                }${moreActive ? "mobile-nav-tab--active" : ""}`}
              >
                {drawerShown && !groupMode ? (
                  <span className="mobile-nav-tab-icon">
                    <span className="material-symbols-outlined text-[28px]!">close</span>
                  </span>
                ) : (
                  <span className="mobile-nav-tab-icon">
                    <Image
                      src="/nav/menu-icon.png?v=4"
                      alt=""
                      width={48}
                      height={48}
                      unoptimized
                      aria-hidden
                    />
                  </span>
                )}
                <span className="mobile-nav-tab-text">{liveMoreLabel}</span>
              </button>
            )}
          </div>
        )}
      </nav>

      {/*
        El drawer se desmonta al cerrarse. Estuvo montado en permanente y
        oculto con `invisible` para no volver a decodificar los PNG al abrirlo,
        pero eso deja un `fixed inset-0` con `backdrop-blur` vivo sobre TODA la
        app: basta que un navegador pinte el backdrop-filter de un elemento con
        `visibility: hidden` —WebKit lo hace— para que la pantalla entera quede
        borrosa de forma permanente.
      */}
      {moreOpen && showMore && (
        <div className="fixed inset-0 z-[60] xl:hidden" role="presentation">
          <button
            type="button"
            aria-label={liveCloseLabel}
            className={`mobile-nav-sheet-backdrop absolute inset-x-0 top-0 bg-black/70 backdrop-blur-sm ${
              skipSheetMotion
                ? ""
                : drawerPhase === "closing"
                  ? "is-closing"
                  : "is-open"
            }`}
            style={{ bottom: "var(--bottom-sheet-inset, var(--bottom-nav-h, 5.25rem))" }}
            onClick={closeMore}
          />
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label={sheetTitle}
            onAnimationEnd={onSheetAnimationEnd}
            className={[
              "mobile-nav-sheet absolute inset-x-0 flex flex-col overflow-hidden",
              groupMode ? "max-h-[min(52dvh,28rem)]" : "max-h-[min(78dvh,40rem)]",
              skipSheetMotion
                ? ""
                : drawerPhase === "closing"
                  ? "is-closing"
                  : "is-open",
              isSwipeDragging ? "is-dragging" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            style={{
              bottom: "var(--bottom-sheet-inset, var(--bottom-nav-h, 5.25rem))",
              ...(drawerShown && (isSwipeDragging || sheetDragY > 0)
                ? { transform: `translate3d(0, ${sheetDragY}px, 0)` }
                : {}),
            }}
          >
            <div className="mobile-nav-sheet__header shrink-0 px-4 pb-2.5 pt-2.5">
              <div
                className="touch-none mx-auto mb-2.5 flex w-full cursor-grab justify-center py-1 active:cursor-grabbing"
                onTouchStart={onHandleTouchStart}
                onTouchMove={onHandleTouchMove}
                onTouchEnd={onHandleTouchEnd}
                onTouchCancel={onHandleTouchEnd}
                aria-hidden
              >
                <div className="mobile-nav-sheet__handle h-1 w-10 rounded-full" />
              </div>
              <div className="flex items-center justify-between gap-3">
                <p className="mobile-nav-sheet__title text-label-sm uppercase tracking-wider">
                  {sheetTitle}
                </p>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    closeMore();
                  }}
                  aria-label={liveCloseLabel}
                  className="mobile-nav-sheet__close flex h-9 w-9 items-center justify-center rounded-xl"
                >
                  <span className="material-symbols-outlined text-[20px]!">close</span>
                </button>
              </div>
              {groupMode ? (
                <p className="mt-1.5 text-[11px] leading-snug text-on-surface-variant/80">
                  {liveRetapHint}
                </p>
              ) : null}
            </div>

            <div
              data-nav-scroll
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-2"
              onTouchStart={onGroupSwipeStart}
              onTouchEnd={onGroupSwipeEnd}
              onTouchCancel={() => {
                groupSwipeStart.current = null;
              }}
            >
              {groups.length === 0 ? (
                <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
                  <span className="material-symbols-outlined text-[36px]! text-on-surface-variant/50">
                    explore
                  </span>
                  <p className="text-sm text-on-surface-variant">{liveEmptyNavLabel}</p>
                  <Link
                    href="/login"
                    onClick={closeMore}
                    className="ui-btn-primary min-h-11 rounded-xl px-4 text-sm"
                  >
                    {loginLabel}
                  </Link>
                </div>
              ) : (
                <>
                  {groupMode && focusedGroup
                    ? renderGroupSections([focusedGroup])
                    : renderGroupSections(groups)}

                  {groupMode ? (
                    <p className="mt-1 px-2.5 pb-2 text-center text-[10px] text-on-surface-variant/55">
                      {liveSwipeGroupsLabel}
                    </p>
                  ) : null}
                </>
              )}
            </div>

            <div className="mobile-nav-sheet__footer shrink-0 px-4 pt-3 pb-3">
              {groupMode && groups.length > 0 ? (
                <button
                  type="button"
                  onClick={() => openMore(null)}
                  className="mobile-nav-sheet__see-all flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl text-sm font-medium text-on-surface"
                >
                  <span className="material-symbols-outlined text-[18px]!">menu</span>
                  {liveSeeAllNavLabel}
                </button>
              ) : (
                <>
                  <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-on-surface-variant/55">
                    {liveLanguageLabel}
                  </p>
                  <LocaleSwitcher
                    currentLocale={locale}
                    label={liveLanguageLabel}
                    variant="inline"
                    keepMobileDrawer
                  />
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
