"use client";

import { CdnImage as Image } from "@/components/cdn-image";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { PokemonImage } from "@/components/pokemon-image";
import { itemHdIconUrl } from "@/lib/item-hd-icons";

export type HomeEventShowcaseData = {
  hero: {
    name: string;
    tagline: string;
    accent: string;
    endsAt: string;
    progress: number;
    claimable: number;
    /** Vitrina de premios: icono HD + cantidad acumulada, ya ordenada por peso. */
    rewards: { icon: string; label: string }[];
  };
  raid: {
    speciesId: number;
    name: string;
    spriteUrl: string;
    level: number;
    accent: string;
    attemptsLeft: number;
    attemptsTotal: number;
    communityPercent: number;
    communityDefeated: boolean;
  };
  safari: {
    attemptsLeft: number;
    attemptsTotal: number;
    active: boolean;
    encountersUsed: number;
    catches: number;
    score: number;
    featured: {
      speciesId: number;
      name: string;
      spriteUrl: string;
      isShiny: boolean;
    };
  };
  tower: {
    attemptsLeft: number;
    attemptsTotal: number;
    active: boolean;
    currentFloor: number;
    bestFloor: number;
    totalFloors: number;
    percent: number;
  };
};

/**
 * Una portada del banner destacado.
 *
 * `art.fit` es la diferencia de tratamiento entre un arte panorámico y un
 * asset con sujeto recortado:
 *
 * - `cover`: escena panorámica anclada a la derecha, en una caja con la
 *   proporción del propio arte (`ratio`). Al respetar la proporción no se
 *   recorta nada —la escena se ve entera— y el desvanecido lateral la funde
 *   con el panel.
 * - `subject`: arte alto (la torre) anclado a la derecha y contenido por alto,
 *   con desvanecido radial en vez de lateral.
 *
 * `ratio` es la proporción de la **caja**, y `focus` el punto del arte al que
 * se ancla. Con `ratio` igual a la del archivo no se recorta nada; con una
 * caja más angosta se recorta a lo ancho, que es lo que se usa cuando el arte
 * trae mucho fondo vacío: en un banner bajo, mostrar el PNG entero deja al
 * sujeto diminuto, así que se recorta el fondo —nunca el sujeto— y la escena
 * llega completa de arriba abajo.
 */
type EventBannerSlide = {
  id: string;
  href: string;
  accent: string;
  /** Segundo tono del degradé del CTA. Va con el acento, salido del mismo arte. */
  accentDeep: string;
  eyebrow: string;
  title: string;
  tagline: string;
  /** Chips de la fila de metadatos. `tone: "accent"` la pinta con el acento. */
  chips: { icon?: string; label: string; tone?: "accent" }[];
  progress: { percent: number; label: string } | null;
  /** Vitrina de premios. Vacía en los slots que no entregan nada listado. */
  rewards: { icon: string; label: string }[];
  cta: string;
  art: { src: string; fit: "cover" | "subject"; ratio?: string; focus?: string };
};

/** Cada cuánto pasa sola la portada. */
const SLIDE_INTERVAL_MS = 7000;
/** Cuánto hay que arrastrar para que cuente como cambio de portada. */
const DRAG_THRESHOLD_PX = 45;

const STONE_REWARD_ICONS = (
  ["Fire Stone", "Water Stone", "Thunder Stone", "Leaf Stone"] as const
)
  .map((name) => {
    const icon = itemHdIconUrl(name);
    return icon ? { icon, label: "×1" } : null;
  })
  .filter((entry): entry is { icon: string; label: string } => entry !== null);

export function HomeEventBanner({ data, locale }: { data: HomeEventShowcaseData; locale: string }) {
  const t = useTranslations("home.hub.eventShowcase");
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const dragRef = useRef<{ x: number; dragged: boolean } | null>(null);
  const ends = new Intl.DateTimeFormat(locale, { weekday: "short", day: "2-digit", month: "short" }).format(new Date(data.hero.endsAt));

  /*
    Fuente única de las portadas del banner.
    Agregar o sacar un evento destacado es agregar o sacar una entrada de este
    array: los controles, los puntos y el contador salen de su largo, y con una
    sola entrada el banner se dibuja sin navegación.

    El `accent` sale del **arte**, no de los datos del evento. Es lo que hace
    que la portada se lea como una pieza y no como una plantilla teñida: el
    acento pinta chapa, chips, barra, CTA y controles, y si no es el color que
    domina la imagen, el bloque de UI queda flotando encima. El caso concreto:
    `data.hero.accent` para el evento limitado es rojo y el arte de Mewtwo es
    violeta y azul — el panel entero se peleaba con la foto. El acento del
    evento sigue vivo en la card del carrusel de abajo, que no tiene arte
    propio que respetar.
  */
  const slides: EventBannerSlide[] = [
    {
      id: "limited",
      href: "/events",
      accent: "#a855f7",
      accentDeep: "#e879f9",
      eyebrow: t("heroEyebrow"),
      title: data.hero.name,
      tagline: data.hero.tagline,
      chips: [
        { icon: "schedule", label: t("ends", { date: ends }) },
        ...(data.hero.claimable > 0
          ? [{ icon: "redeem", label: t("rewardsReady", { count: data.hero.claimable }), tone: "accent" as const }]
          : []),
      ],
      progress: { percent: data.hero.progress, label: t("progress", { percent: data.hero.progress }) },
      rewards: data.hero.rewards,
      cta: t("openEvents"),
      /*
        La caja es más ancha que el arte (2.8:1 contra 2:1), y eso es
        deliberado: con la proporción exacta del archivo la escena entraba
        entera pero medía 460px en un banner de 1350 — se veía diminuta. Al
        ensanchar la caja, `cover` escala por ancho y el sujeto crece ~40%.

        Lo que se recorta es alto, y el `focus` elige qué: con 56% se va el
        techo del laboratorio y la base de la cápsula, y quedan enteros Mewtwo
        —orejas incluidas— y Mew, con unos pocos píxeles de aire arriba. A 2.8
        el sujeto entra más grande pero justo al ras del borde; 2.6 es el punto
        donde crece todo lo que puede sin tocar las orejas. Para ajustar, mover
        el `focus`; la proporción es lo que fija el tamaño.
      */
      art: { src: "/events/banners/slot-1.png", fit: "cover", ratio: "2.6 / 1", focus: "70% 56%" },
    },
    {
      id: "stones",
      href: "/events",
      // Ámbar del arte: los pilares de Flareon / Jolteon dominan el borde
      // izquierdo del PNG, que es el que se funde con el panel.
      accent: "#fb923c",
      accentDeep: "#fbbf24",
      eyebrow: t("stonesEyebrow"),
      title: t("stonesTitle"),
      tagline: t("stonesTagline"),
      chips: [
        { icon: "auto_awesome", label: t("stonesChip"), tone: "accent" },
        { icon: "schedule", label: t("ends", { date: ends }) },
      ],
      progress: null,
      rewards: STONE_REWARD_ICONS,
      cta: t("heroCtaStones"),
      /*
        Proporción exacta del archivo (393×162): entra completo, sin recortar.

        Sigue estando muy por debajo de lo que pide
        `public/events/banners/README.md`. Peor que el anterior, incluso: la
        caja del banner mide 230px de alto y el archivo tiene 162 — se agranda
        un 42% antes de contar la densidad de pantalla. No hay encuadre que lo
        arregle; se corrige reemplazando el archivo por uno de ≥1200px.
      */
      art: { src: "/events/banners/slot-2.png", fit: "cover", ratio: "393 / 162" },
    },
    {
      id: "tower",
      href: "/tower",
      accent: "var(--color-primary)",
      accentDeep: "#c084fc",
      eyebrow: t("towerEyebrow"),
      title: t("towerTitle"),
      tagline: t("heroTowerTagline"),
      chips: [
        {
          icon: "stairs",
          label: data.tower.active
            ? t("towerFloor", { floor: data.tower.currentFloor })
            : t("towerBest", { floor: data.tower.bestFloor }),
        },
        {
          icon: "bolt",
          label: t("attempts", { current: data.tower.attemptsLeft, total: data.tower.attemptsTotal }),
          tone: "accent",
        },
      ],
      progress: {
        percent: data.tower.percent,
        label: t("towerProgress", {
          floor: data.tower.active ? data.tower.currentFloor : data.tower.bestFloor,
          total: data.tower.totalFloors,
        }),
      },
      rewards: [],
      cta: t("heroCtaTower"),
      /*
        Arte panorámico (1717×916), no el retrato de la torre: por eso pasa de
        `subject` a `cover`. La caja a 2.3:1 es más ancha que el archivo, así
        que `cover` escala por ancho —se ven todas las gemas, de punta a
        punta— y recorta alto. El `focus` en 65% se lleva cielo de arriba y
        deja entero al Pokémon con su gema.
      */
      art: { src: "/events/banners/slot-3.png", fit: "cover", ratio: "2.3 / 1", focus: "center 45%" },
    },
  ];

  const total = slides.length;
  const active = slides[Math.min(index, total - 1)];

  /*
    Rotación automática.

    Se frena mientras el puntero está encima o algo del banner tiene el foco:
    que la portada cambie sola justo cuando el usuario iba a hacer clic es la
    forma más rápida de que termine en el evento equivocado. Tampoco corre con
    `prefers-reduced-motion`, donde el carrusel queda enteramente manual.
  */
  useEffect(() => {
    if (total < 2 || paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % total), SLIDE_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [total, paused]);

  /*
    Arrastre lateral. `dragRef` guarda el x inicial y si el gesto llegó a
    contar como arrastre: sin ese segundo dato, soltar el puntero después de
    deslizar navegaba al evento —el slide es un `Link`— en vez de pasar de
    portada.
  */
  function onPointerDown(event: ReactPointerEvent) {
    dragRef.current = { x: event.clientX, dragged: false };
  }

  function onPointerUp(event: ReactPointerEvent) {
    const start = dragRef.current;
    if (!start || total < 2) return;
    const dx = event.clientX - start.x;
    if (Math.abs(dx) >= DRAG_THRESHOLD_PX) {
      dragRef.current = { x: start.x, dragged: true };
      setIndex((i) => (i + (dx < 0 ? 1 : total - 1)) % total);
    }
  }

  return (
    <section
      className="event-banner"
      style={{ "--event-accent": active.accent, "--event-accent-2": active.accentDeep } as CSSProperties}
      aria-roledescription="carousel"
      aria-label={t("heroLabel")}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => {
        setPaused(false);
        dragRef.current = null;
      }}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      <Link
        href={active.href}
        className="event-banner__slide"
        // El clic que cierra un arrastre no es un clic: sin esto, deslizar
        // para cambiar de portada terminaba abriendo el evento.
        onClickCapture={(event) => {
          if (dragRef.current?.dragged) {
            event.preventDefault();
            dragRef.current = null;
          }
        }}
      >
        {/* Arte a sangre. Va por `next/image` y no como `background-image` para
            que se sirva optimizado: el PNG de Mew pesa 2,5 MB. */}
        {/* Sólo se monta el arte activo. Antes las tres imágenes grandes
            ocupaban el mismo rectángulo y el lazy-loader las consideraba
            visibles: descargaba ~4,5 MB de fuente y durante el crossfade se
            leían como banners superpuestos. */}
        <span
          key={active.id}
          className={`event-banner__art event-banner__art--${active.art.fit} is-active`}
          style={{ "--art-ratio": active.art.ratio, "--art-focus": active.art.focus } as CSSProperties}
          aria-hidden
        >
          <Image
            src={active.art.src}
            alt=""
            fill
            sizes="(max-width: 767px) 100vw, 1200px"
            quality={80}
            loading="eager"
            className="event-banner__img"
          />
        </span>
        {/* El degradé que borra la división: tinta plena del lado del texto,
            transparente antes de llegar al sujeto. */}
        <span className="event-banner__scrim" aria-hidden />

        {/* `key` por portada: al cambiar, React remonta el bloque y la
            animación de entrada vuelve a correr. Sin eso el texto cambiaría de
            golpe mientras el arte se funde. */}
        <span key={active.id} className="event-banner__copy">
          <span className="event-banner__eyebrow">
            <i aria-hidden />
            {active.eyebrow}
          </span>
          <strong className="event-banner__title">{active.title}</strong>
          <span className="event-banner__tagline">{active.tagline}</span>

          <span className="event-banner__chips">
            {active.chips.map((chip) => (
              <span key={chip.label} className={`event-banner__chip${chip.tone === "accent" ? " is-accent" : ""}`}>
                {chip.icon ? <span className="material-symbols-outlined" aria-hidden>{chip.icon}</span> : null}
                {chip.label}
              </span>
            ))}
          </span>

          {/* CTA y progreso comparten fila. Apilados, el botón quedaba pegado
              al borde de abajo: la fila le devuelve el renglón que le faltaba
              sin tocar el alto del banner. */}
          <span className="event-banner__actions">
            <span className="event-banner__cta">
              {active.cta}
              <span className="material-symbols-outlined" aria-hidden>arrow_forward</span>
            </span>
            {active.progress ? (
              <span className="event-banner__progress">
                <span className="event-banner__track">
                  <span style={{ width: `${active.progress.percent}%` }} />
                </span>
                <b>{active.progress.label}</b>
              </span>
            ) : null}

            {/* Vitrina de premios: iconos sueltos sobre el panel, sin card ni
                marco. Lo que los agrupa es el solape y la etiqueta, no una caja
                más adentro de la caja. */}
            {active.rewards.length > 0 ? (
              <span className="event-banner__rewards">
                <b>{t("heroRewards")}</b>
                <span className="event-banner__reward-icons">
                  {active.rewards.map((reward) => (
                    <span key={reward.icon} className="event-banner__reward">
                      <Image src={reward.icon} alt="" width={38} height={38} />
                      <i>{reward.label}</i>
                    </span>
                  ))}
                </span>
              </span>
            ) : null}
          </span>
        </span>
      </Link>

      {/* Los controles viven fuera del `Link` — un `button` dentro de un `a` es
          anidamiento inválido y el navegador rompe el árbol. */}
      {total > 1 ? (
        <div className="event-banner__nav">
          <span className="event-banner__dots">
            {slides.map((slide, i) => (
              <button
                key={slide.id}
                type="button"
                className={`event-banner__dot${i === index ? " is-active" : ""}`}
                aria-label={t("heroGoto", { n: i + 1 })}
                aria-current={i === index ? "true" : undefined}
                onClick={() => setIndex(i)}
              />
            ))}
          </span>
          <span className="event-banner__count">
            {String(index + 1).padStart(2, "0")}<i>/</i>{String(total).padStart(2, "0")}
          </span>
          <span className="event-banner__arrows">
            <button type="button" aria-label={t("heroPrev")} onClick={() => setIndex((i) => (i - 1 + total) % total)}>
              <span className="material-symbols-outlined" aria-hidden>chevron_left</span>
            </button>
            <button type="button" aria-label={t("heroNext")} onClick={() => setIndex((i) => (i + 1) % total)}>
              <span className="material-symbols-outlined" aria-hidden>chevron_right</span>
            </button>
          </span>
        </div>
      ) : null}
    </section>
  );
}

export function HomeEventCarousel({ data }: { data: HomeEventShowcaseData }) {
  const t = useTranslations("home.hub.eventShowcase");
  const railRef = useRef<HTMLDivElement>(null);
  const [activeCard, setActiveCard] = useState(0);
  const cardCount = 4;

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    let frame = 0;
    const syncActiveCard = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const cards = [...rail.children] as HTMLElement[];
        const center = rail.scrollLeft + rail.clientWidth / 2;
        let nearest = 0;
        let distance = Number.POSITIVE_INFINITY;
        cards.forEach((card, index) => {
          const nextDistance = Math.abs(card.offsetLeft + card.offsetWidth / 2 - center);
          if (nextDistance < distance) {
            distance = nextDistance;
            nearest = index;
          }
        });
        setActiveCard(nearest);
      });
    };
    rail.addEventListener("scroll", syncActiveCard, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      rail.removeEventListener("scroll", syncActiveCard);
    };
  }, []);

  const scrollToCard = (index: number) => {
    const rail = railRef.current;
    const card = rail?.children.item(index) as HTMLElement | null;
    if (!rail || !card) return;
    rail.scrollTo({
      left: card.offsetLeft - (rail.clientWidth - card.offsetWidth) / 2,
      behavior: "smooth",
    });
  };

  return (
    <section className="home-event-carousel" aria-labelledby="home-events-title">
      <header className="home-event-carousel__head">
        <h2 id="home-events-title">{t("carouselTitle")}</h2>
        <div className="flex items-center gap-2">
          <Link href="/events" className="text-[11px] font-semibold text-white/45 transition hover:text-white">
            {t("carouselViewAll")}
          </Link>
          <span className="home-event-carousel__controls">
            <button
              type="button"
              aria-label={t("carouselPrev")}
              onClick={() => scrollToCard((activeCard - 1 + cardCount) % cardCount)}
            >
              <span className="material-symbols-outlined" aria-hidden>chevron_left</span>
            </button>
            <button
              type="button"
              aria-label={t("carouselNext")}
              onClick={() => scrollToCard((activeCard + 1) % cardCount)}
            >
              <span className="material-symbols-outlined" aria-hidden>chevron_right</span>
            </button>
          </span>
        </div>
      </header>

      <div ref={railRef} className="home-event-carousel__rail">
        <EventCard
          href="/raids"
          kind="raid"
          accent={data.raid.accent}
          eyebrow={t("raidEyebrow")}
          title={t("raidTitle")}
          subtitle={data.raid.name}
          status={data.raid.communityDefeated ? t("raidDefeated") : t("attempts", { current: data.raid.attemptsLeft, total: data.raid.attemptsTotal })}
          live={{ label: data.raid.attemptsLeft > 0 ? t("liveOpen") : t("liveDone"), tone: data.raid.attemptsLeft > 0 ? "on" : "off" }}
          progress={data.raid.communityPercent}
          progressLabel={t("community", { percent: data.raid.communityPercent })}
          art={
            <PokemonImage src={data.raid.spriteUrl} speciesId={data.raid.speciesId} speciesName={data.raid.name} alt={data.raid.name} width={230} height={230} className="home-event-card__pokemon" />
          }
        />

        <EventCard
          href="/safari"
          kind="safari"
          accent="#65d9dc"
          eyebrow={t("safariEyebrow")}
          title={t("safariTitle")}
          subtitle={data.safari.active ? t("safariActive") : t("safariSubtitle")}
          status={t("attempts", { current: data.safari.attemptsLeft, total: data.safari.attemptsTotal })}
          live={{ label: data.safari.active ? t("liveRunning") : data.safari.attemptsLeft > 0 ? t("liveOpen") : t("liveDone"), tone: data.safari.attemptsLeft > 0 || data.safari.active ? "on" : "off" }}
          progress={data.safari.active ? Math.min(100, data.safari.encountersUsed * 10) : 0}
          progressLabel={data.safari.active ? t("encounters", { count: data.safari.encountersUsed }) : t("weeklyMode")}
          art={
            <PokemonImage src={data.safari.featured.spriteUrl} speciesId={data.safari.featured.speciesId} speciesName={data.safari.featured.name} isShiny={data.safari.featured.isShiny} alt={data.safari.featured.name} width={230} height={230} className="home-event-card__pokemon" />
          }
        />

        <EventCard
          href="/tower"
          kind="tower"
          // Token del tema, no un naranja suelto: el acento pinta barra, estado
          // y eyebrow, y un hex fijo se desalinea con cualquier cambio de tema.
          accent="var(--color-primary)"
          eyebrow={t("towerEyebrow")}
          title={t("towerTitle")}
          subtitle={
            data.tower.active
              ? t("towerFloor", { floor: data.tower.currentFloor })
              : t("towerBest", { floor: data.tower.bestFloor })
          }
          status={t("attempts", {
            current: data.tower.attemptsLeft,
            total: data.tower.attemptsTotal,
          })}
          progress={data.tower.percent}
          progressLabel={t("towerProgress", {
            floor: data.tower.active ? data.tower.currentFloor : data.tower.bestFloor,
            total: data.tower.totalFloors,
          })}
          live={{
            label: data.tower.active
              ? t("liveRunning")
              : data.tower.attemptsLeft > 0
                ? t("liveOpen")
                : t("liveDone"),
            tone: data.tower.active || data.tower.attemptsLeft > 0 ? "on" : "off",
          }}
          portraitArt
          art={
            <Image
              src="/events/tower.png"
              alt=""
              width={230}
              height={230}
              className="home-event-card__pokemon"
            />
          }
        />

        <EventCard
          href="/events"
          kind="limited"
          accent={data.hero.accent}
          eyebrow={t("limitedEyebrow")}
          title={data.hero.name}
          subtitle={data.hero.tagline}
          status={data.hero.claimable > 0 ? t("rewardsReady", { count: data.hero.claimable }) : t("missionsActive")}
          live={{ label: data.hero.claimable > 0 ? t("liveReward") : t("liveOpen"), tone: "on" }}
          progress={data.hero.progress}
          progressLabel={t("progress", { percent: data.hero.progress })}
          portraitArt
          art={
            <Image
              src="/avatars/oak2.png"
              alt=""
              width={230}
              height={230}
              className="home-event-card__pokemon"
            />
          }
        />
      </div>
      <div className="-mt-1 flex justify-center gap-1.5 sm:hidden" aria-label={t("carouselPages")}>
        {Array.from({ length: cardCount }, (_, index) => (
          <button
            key={index}
            type="button"
            onClick={() => scrollToCard(index)}
            aria-label={t("carouselPage", { page: index + 1 })}
            aria-current={activeCard === index ? "true" : undefined}
            className={[
              "h-1.5 rounded-full transition-all",
              activeCard === index ? "w-5 bg-pokeball-red" : "w-1.5 bg-white/20",
            ].join(" ")}
          />
        ))}
      </div>
    </section>
  );
}

function EventCard({ href, kind, accent, eyebrow, title, subtitle, status, progress, progressLabel, art, portraitArt = false, live }: {
  href: string;
  kind: "raid" | "safari" | "tower" | "limited";
  accent: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  status: string;
  progress: number;
  progressLabel: string;
  art: ReactNode;
  /**
   * El arte es un retrato alto (torre, Oak), no un sprite cuadrado.
   *
   * Los sprites de Pokémon son 1:1 y se dimensionan por ancho sin problema; un
   * asset 1:2,4 con esa misma regla resuelve un alto enorme, tapa el texto y se
   * sale de la card. Con esto se ancla por alto y el ancho lo da la proporción.
   */
  portraitArt?: boolean;
  /** Estado en vivo (punto + texto corto) arriba a la izquierda. */
  live?: { label: string; tone: "on" | "off" } | null;
}) {
  return (
    <Link href={href} className={`home-event-card home-event-card--${kind}`} style={{ "--event-card-accent": accent } as CSSProperties}>
      <span className="home-event-card__surface" aria-hidden />
      {live ? (
        <span className={`home-event-card__live is-${live.tone}`}>
          <i aria-hidden />
          {live.label}
        </span>
      ) : null}
      <span className="home-event-card__copy">
        <span className="home-event-card__eyebrow">{eyebrow}</span>
        <strong>{title}</strong>
        <span className="home-event-card__subtitle">{subtitle}</span>
        <span className="home-event-card__status">{status}</span>
        <span className="home-event-card__progress-copy">{progressLabel}</span>
        <span className="home-event-card__bar"><span style={{ width: `${progress}%` }} /></span>
      </span>
      <span className={`home-event-card__art${portraitArt ? " home-event-card__art--portrait" : ""}`}>
        {art}
      </span>
    </Link>
  );
}
