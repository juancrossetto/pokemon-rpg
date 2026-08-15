"use client";

import Image from "next/image";
import { useRef, type CSSProperties, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { PokemonImage } from "@/components/pokemon-image";

export type HomeEventShowcaseData = {
  hero: {
    name: string;
    tagline: string;
    accent: string;
    endsAt: string;
    progress: number;
    claimable: number;
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

export function HomeEventHero({ data, locale }: { data: HomeEventShowcaseData; locale: string }) {
  const t = useTranslations("home.hub.eventShowcase");
  const ends = new Intl.DateTimeFormat(locale, { weekday: "short", day: "2-digit", month: "short" }).format(new Date(data.hero.endsAt));

  return (
    <Link
      href="/events"
      className="home-event-hero"
      style={{ "--event-accent": data.hero.accent } as CSSProperties}
    >
      <span className="home-event-hero__grid" aria-hidden />
      <span className="home-event-hero__copy">
        <span className="home-event-hero__eyebrow">{t("heroEyebrow")}</span>
        <strong className="home-event-hero__title">{data.hero.name}</strong>
        <span className="home-event-hero__tagline">{data.hero.tagline}</span>
        <span className="home-event-hero__meta">
          <span><span className="material-symbols-outlined" aria-hidden>schedule</span>{t("ends", { date: ends })}</span>
          {data.hero.claimable > 0 ? <b>{t("rewardsReady", { count: data.hero.claimable })}</b> : null}
        </span>
        <span className="home-event-hero__progress">
          <span style={{ width: `${data.hero.progress}%` }} />
        </span>
        <span className="home-event-hero__cta">{t("openEvents")}<span className="material-symbols-outlined" aria-hidden>arrow_forward</span></span>
      </span>
      {/* Arte a sangre completa. Va por `next/image` y no como `background-image`
          para que se sirva optimizado: el PNG original pesa 2,5 MB. */}
      <span className="home-event-hero__art" aria-hidden>
        <Image
          src="/events/banner-event-wide.png"
          alt=""
          fill
          sizes="(max-width: 767px) 100vw, 1200px"
          priority
          className="home-event-hero__bg"
        />
      </span>
    </Link>
  );
}

export function HomeEventCarousel({ data }: { data: HomeEventShowcaseData }) {
  const t = useTranslations("home.hub.eventShowcase");
  const railRef = useRef<HTMLDivElement>(null);

  function move(direction: -1 | 1) {
    railRef.current?.scrollBy({ left: direction * Math.max(280, railRef.current.clientWidth * 0.72), behavior: "smooth" });
  }

  return (
    <section className="home-event-carousel" aria-labelledby="home-events-title">
      <header className="home-event-carousel__head">
        <div>
          <span>{t("carouselEyebrow")}</span>
          <h2 id="home-events-title">{t("carouselTitle")}</h2>
        </div>
        <div className="home-event-carousel__controls">
          <button type="button" onClick={() => move(-1)} aria-label={t("previous")}><span className="material-symbols-outlined">chevron_left</span></button>
          <button type="button" onClick={() => move(1)} aria-label={t("next")}><span className="material-symbols-outlined">chevron_right</span></button>
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
          /* Mismo resolutor de sprites que las otras cards (CDN + fallback
             local) en vez de un PNG suelto: así el arte del evento no depende
             de un asset que hay que mantener a mano. */
          art={
            <PokemonImage
              speciesId={93}
              speciesName="haunter"
              alt=""
              width={230}
              height={230}
              className="home-event-card__pokemon"
            />
          }
        />
      </div>
    </section>
  );
}

function EventCard({ href, kind, accent, eyebrow, title, subtitle, status, progress, progressLabel, art, live }: {
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
      <span className="home-event-card__art">{art}</span>
    </Link>
  );
}
