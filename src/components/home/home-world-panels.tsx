"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import { Link } from "@/i18n/navigation";
import { itemSpriteUrl } from "@/lib/item-sprites";
import type {
  HomeFeedItem,
  HomeObjective,
  HomeQuickLink,
} from "@/lib/home-hub";

const C = {
  reward: "#ff9a4a",
  progress: "#3BC8B6",
  info: "#5b9dff",
  special: "#b57bff",
  combat: "#ff5a5a",
  btnYellow: "#FBCD3A",
  btnGreen: "#3BC8B6",
} as const;

const COIN_SPRITE =
  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/nugget.png";

const OBJECTIVE_ICON: Record<string, string> = {
  stages: "/nav/map-icon.png?v=4",
  pokedex: "/nav/collection-icon.png?v=4",
  trainers: "/nav/battle-wild-icon.png?v=4",
};

const QA_ACCENT: Record<string, string> = {
  pvp: C.combat,
  gyms: C.reward,
  friends: C.info,
  shop: C.special,
  market: C.special,
  clans: C.special,
  pokedex: C.info,
  ranking: C.reward,
};

function SectionLabel({
  title,
  subtitle,
  actionHref,
  actionLabel,
}: {
  title: string;
  subtitle?: string | null;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="mb-2 flex items-start justify-between gap-3 px-0.5">
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
          {title}
        </p>
        {subtitle ? (
          <p className="mt-px truncate text-[11px] font-normal leading-tight text-white/40">
            {subtitle}
          </p>
        ) : null}
      </div>
      {actionHref && actionLabel ? (
        <Link
          href={actionHref}
          className="shrink-0 pt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40 transition hover:text-white/75"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

/**
 * Card estilo ejemplo: título + progreso, fila reward (ítem / oro), CTA.
 */
function ObjectiveCard({
  obj,
  title,
  labels,
}: {
  obj: HomeObjective;
  title: string;
  labels: { claimable: string; claimed: string; go: string };
}) {
  const completed = obj.claimed || (obj.done && !obj.claimable);
  const icon = OBJECTIVE_ICON[obj.id] ?? "/nav/adventure-icon.png?v=4";
  const selectable = !completed;
  const hasItem = Boolean(obj.rewardItem) && obj.rewardQty > 0;
  const hasGold = obj.rewardCoins > 0;

  const ctaClass = selectable
    ? "home-obj-cta home-obj-cta--red"
    : "border border-white/10 bg-transparent text-white/45";

  const ctaLabel = (
    obj.claimable
      ? labels.claimable
      : completed
        ? labels.claimed
        : labels.go || "IR"
  ).toUpperCase();

  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-bold leading-tight text-white">
            {title}
          </p>
          <p className="mt-0.5 text-[11px] font-normal text-white/40">
            {obj.current}/{obj.target}
          </p>
        </div>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-black/35">
          <Image
            src={icon}
            alt=""
            width={28}
            height={28}
            className="h-7 w-7 object-contain"
            unoptimized
          />
        </span>
      </div>

      <div className="flex items-center justify-between gap-2">
        {hasItem ? (
          <span className="flex min-w-0 items-center gap-1.5">
            <Image
              src={itemSpriteUrl(obj.rewardItem)}
              alt=""
              width={22}
              height={22}
              className="h-[22px] w-[22px] object-contain [image-rendering:pixelated]"
              unoptimized
            />
            <span className="truncate text-[11px] font-bold uppercase tracking-wide text-white">
              ×{obj.rewardQty}
            </span>
          </span>
        ) : (
          <span />
        )}
        {hasGold ? (
          <span className="flex shrink-0 items-center gap-1">
            <Image
              src={COIN_SPRITE}
              alt=""
              width={16}
              height={16}
              className="h-4 w-4 object-contain [image-rendering:pixelated]"
              unoptimized
            />
            <span className="font-mono text-[13px] font-bold tabular-nums text-white">
              {obj.rewardCoins.toLocaleString()}
            </span>
          </span>
        ) : null}
      </div>

      <div className="h-px bg-white/[0.08]" />

      <span
        className={`flex h-9 w-full items-center justify-center rounded-md text-[11px] font-black uppercase tracking-[0.14em] leading-none transition ${ctaClass}`}
      >
        {ctaLabel}
      </span>
    </>
  );

  const shell =
    "home-float-card relative flex min-w-0 w-full flex-col gap-2.5 overflow-hidden rounded-2xl p-3 transition active:scale-[0.98]";

  if (selectable) {
    return (
      <Link href="/campaign" className={`${shell} hover:brightness-105`}>
        {body}
      </Link>
    );
  }

  return <div className={shell}>{body}</div>;
}

/** Objetivos de zona — fila full-width como Active Squad. */
export function HomeMissionsCarousel({
  zoneName,
  objectives,
  labels,
}: {
  zoneName: string | null;
  objectives: HomeObjective[];
  labels: {
    title: string;
    empty: string;
    claimable: string;
    claimed: string;
    go: string;
    openCampaign: string;
    objectiveLabels: Record<string, string>;
  };
}) {
  return (
    <section className="hidden min-w-0 md:block">
      <SectionLabel
        title={labels.title}
        subtitle={zoneName}
        actionHref="/campaign"
        actionLabel={labels.openCampaign}
      />
      {objectives.length === 0 ? (
        <p className="px-0.5 text-[12px] text-on-surface-variant">{labels.empty}</p>
      ) : (
        <div className="grid grid-cols-3 gap-1.5 md:gap-2">
          {objectives.map((obj) => (
            <ObjectiveCard
              key={obj.id}
              obj={obj}
              title={labels.objectiveLabels[obj.id] ?? obj.labelKey}
              labels={{
                claimable: labels.claimable,
                claimed: labels.claimed,
                go: labels.go,
              }}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/** Accesos rápidos: una sola card (oculto en mobile). */
export function HomeQuickAccess({
  links,
  labels,
}: {
  links: HomeQuickLink[];
  labels: { title: string; items: Record<string, string> };
}) {
  return (
    <div className="hidden min-w-0 md:block">
      <SectionLabel title={labels.title} />
      <section
        className="home-float-card rounded-2xl px-2 py-2 md:px-2.5 md:py-2.5"
        aria-label={labels.title}
      >
        <div className="grid grid-cols-3 gap-1 sm:grid-cols-6 sm:gap-1.5">
          {links.map((link) => {
            const accent = QA_ACCENT[link.id] ?? C.info;
            return (
              <Link
                key={link.id}
                href={link.href}
                className="group flex flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 transition hover:bg-white/[0.05] active:scale-[0.96]"
                style={{ "--type-accent": accent } as CSSProperties}
              >
                <Image
                  src={link.iconSrc}
                  alt=""
                  width={36}
                  height={36}
                  className="h-8 w-8 object-contain drop-shadow-[0_3px_8px_rgba(0,0,0,0.45)] transition group-hover:scale-105 sm:h-9 sm:w-9"
                  unoptimized
                />
                <span className="max-w-full truncate text-center text-[9px] font-semibold leading-tight text-white/75 group-hover:text-white sm:text-[10px]">
                  {labels.items[link.labelKey] ?? link.labelKey}
                </span>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export function HomeFeedPanel({
  title,
  icon,
  items,
  empty,
  seeAllHref,
  seeAllLabel,
}: {
  title: string;
  icon: string;
  items: HomeFeedItem[];
  empty: string;
  seeAllHref?: string;
  seeAllLabel?: string;
}) {
  return (
    <section className="flex h-full flex-col rounded-2xl border border-white/10 bg-[#0c0e14]/92 p-3.5 sm:p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-white">
          <span className="material-symbols-outlined text-[16px]!" style={{ color: C.info }}>
            {icon}
          </span>
          {title}
        </p>
        {seeAllHref && seeAllLabel ? (
          <Link
            href={seeAllHref}
            className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/70 transition hover:text-white"
          >
            {seeAllLabel}
          </Link>
        ) : null}
      </div>
      {items.length === 0 ? (
        <p className="text-[12px] text-on-surface-variant">{empty}</p>
      ) : (
        <ul className="flex flex-1 flex-col gap-1.5">
          {items.map((item) => {
            const body = (
              <span className="flex items-start gap-2 rounded-md px-1.5 py-1.5">
                <span
                  aria-hidden
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: C.info }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-[12px] leading-snug text-white/85">
                    {item.text}
                  </span>
                  {item.at ? (
                    <span className="mt-0.5 block text-[10px] text-on-surface-variant/70">
                      {item.at}
                    </span>
                  ) : null}
                </span>
              </span>
            );
            return (
              <li key={item.id}>
                {item.href ? (
                  <Link
                    href={item.href}
                    className="block rounded-md transition hover:bg-white/[0.04]"
                  >
                    {body}
                  </Link>
                ) : (
                  body
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
