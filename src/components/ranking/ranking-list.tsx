import Image from "next/image";
import { FlagIcon } from "@/components/flag-icon";
import { AvatarImage } from "@/components/avatar-image";
import { spriteFor } from "@/lib/shiny";
import { avatarById } from "@/lib/avatars";
import { tierForRank } from "@/components/ranking-emblem";
import type { RankingEntry } from "@/lib/ranking";

export type RankingPortrait = "avatar" | "creature";

/** Mínimo de jugadores para que el podio tenga sentido. */
const PODIUM_MIN_ENTRIES = 4;

/** Qué mide la columna de score — define el tono y el rótulo (PC/CP o Elo). */
export type RankingMetricKind = "cp" | "elo";

/** Métrica del ranking: número y rótulo, sin icono. Misma forma en podio y fila. */
function RowMetric({
  metricLabel,
  primaryMetric,
}: {
  metricLabel: string;
  primaryMetric: string;
}) {
  return (
    <p className="lb-row__metric lb-row__metric--stat">
      <span className="lb-row__metric-value">{primaryMetric}</span>
      <span className="lb-row__metric-label">{metricLabel}</span>
    </p>
  );
}

function RankingPortraitView({
  entry,
  portrait,
  size,
  className = "",
}: {
  entry: RankingEntry;
  portrait: RankingPortrait;
  size: "md" | "lg" | "xl";
  className?: string;
}) {
  const creature = entry.featuredCreature;
  const sprite = creature ? spriteFor(creature.image, !!creature.isShiny) : null;
  const avatarSrc = avatarById(entry.avatarId ?? null)?.src ?? null;
  const useAvatar = portrait === "avatar";
  const empty = useAvatar ? false : !sprite;

  return (
    <div className={`lb-sphere ${empty ? "lb-sphere--empty" : ""} ${className}`}>
      <svg className="lb-sphere__ring" viewBox="0 0 100 100" aria-hidden focusable="false">
        <circle className="lb-sphere__ring-core" cx="50" cy="50" r="47" />
      </svg>
      <span className="lb-sphere__gap">
        {useAvatar ? (
          avatarSrc ? (
            <AvatarImage
              src={avatarSrc}
              alt={entry.playerName}
              className="lb-sphere__face"
            />
          ) : (
            <span className="lb-sphere__initials">
              {entry.playerName.slice(0, 2).toUpperCase()}
            </span>
          )
        ) : sprite ? (
          <Image
            src={sprite}
            alt={creature?.name ?? ""}
            width={size === "xl" ? 96 : size === "lg" ? 72 : 56}
            height={size === "xl" ? 96 : size === "lg" ? 72 : 56}
            className="lb-sphere__sprite"
            unoptimized
          />
        ) : (
          <span className="lb-sphere__initials">
            {entry.playerName.slice(0, 2).toUpperCase()}
          </span>
        )}
      </span>
    </div>
  );
}

function PodiumSlot({
  entry,
  place,
  youLabel,
  primaryMetric,
  secondaryMetric,
  portrait,
  metricKind,
  metricLabel,
}: {
  entry: RankingEntry;
  place: 1 | 2 | 3;
  youLabel: string;
  primaryMetric: string;
  secondaryMetric?: string;
  portrait: RankingPortrait;
  metricKind: RankingMetricKind;
  metricLabel: string;
}) {
  const isMe = !!entry.isCurrentPlayer;
  const placeClass =
    place === 1 ? "lb-podium__slot--1" : place === 2 ? "lb-podium__slot--2" : "lb-podium__slot--3";
  const size = place === 1 ? "xl" : "lg";

  return (
    <article
      className={`lb-podium__slot ${placeClass} lb-row--metric-${metricKind} ${isMe ? "lb-podium__slot--you" : ""}`}
      data-place={place}
    >
      <p className="lb-podium__place" aria-label={`#${place}`}>
        <span className="material-symbols-outlined lb-podium__chevron" aria-hidden>
          keyboard_double_arrow_up
        </span>
        <span>{place}°</span>
      </p>

      <RankingPortraitView entry={entry} portrait={portrait} size={size} />

      <div className="lb-podium__meta">
        <p className="lb-podium__name">
          <span className="truncate">{entry.playerName}</span>
          {entry.countryCode ? (
            <FlagIcon
              code={entry.countryCode}
              className="h-2.5 w-auto shrink-0 rounded-[1px] opacity-70"
            />
          ) : null}
        </p>
        {secondaryMetric || (portrait === "creature" && entry.featuredCreature?.name) ? (
          <p className="lb-podium__sub truncate">
            {secondaryMetric ?? entry.featuredCreature?.name}
          </p>
        ) : null}
        <RowMetric metricLabel={metricLabel} primaryMetric={primaryMetric} />
        {isMe ? <span className="lb-row__you-tag">{youLabel}</span> : null}
      </div>
    </article>
  );
}

export function RankingListItem({
  entry,
  youLabel,
  primaryMetric,
  secondaryMetric,
  portrait = "creature",
  metricKind = "cp",
  metricLabel,
}: {
  entry: RankingEntry;
  youLabel: string;
  primaryMetric: string;
  secondaryMetric?: string;
  portrait?: RankingPortrait;
  metricKind?: RankingMetricKind;
  metricLabel: string;
}) {
  const isMe = !!entry.isCurrentPlayer;
  const rank = entry.position;
  const tier = tierForRank(rank);
  const useAvatar = portrait === "avatar";

  return (
    <li
      className={`lb-row lb-row--metric-${metricKind} ${isMe ? "lb-row--you" : ""}`}
      data-rank={rank}
      data-tier={tier}
    >
      <span className="lb-row__rank-num" aria-label={`#${rank}`}>
        {rank}
      </span>

      <RankingPortraitView entry={entry} portrait={portrait} size="md" />

      <div className="lb-row__identity min-w-0 flex-1">
        <p className="lb-row__name">
          <span className="truncate">{entry.playerName}</span>
          {entry.countryCode ? (
            <FlagIcon
              code={entry.countryCode}
              className="h-2.5 w-auto shrink-0 rounded-[1px] opacity-70"
            />
          ) : null}
          {isMe ? <span className="lb-row__you-tag">{youLabel}</span> : null}
        </p>

        {useAvatar && (entry.teamSprites?.length ?? 0) > 0 ? (
          <span className="lb-row__team mt-0.5 flex items-center gap-0.5" aria-hidden>
            {entry.teamSprites!.map((mon, i) => (
              <Image
                key={`${mon.name}-${i}`}
                src={spriteFor(mon.image, !!mon.isShiny)}
                alt=""
                width={28}
                height={28}
                title={mon.name}
                className="h-5 w-5 object-contain drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)] sm:h-6 sm:w-6"
                unoptimized
              />
            ))}
          </span>
        ) : secondaryMetric || (!useAvatar && entry.featuredCreature?.name) ? (
          <p className="lb-row__sub truncate">
            {secondaryMetric ?? entry.featuredCreature?.name}
          </p>
        ) : null}
      </div>

      <div className="lb-row__metric-col">
        <RowMetric metricLabel={metricLabel} primaryMetric={primaryMetric} />
      </div>
    </li>
  );
}

export function RankingList({
  entries,
  youLabel,
  title,
  scopeLabel,
  formatPrimary,
  formatSecondary,
  portrait = "creature",
  metricKind = "cp",
  metricLabel,
}: {
  entries: RankingEntry[];
  youLabel: string;
  title: string;
  scopeLabel?: string;
  formatPrimary: (e: RankingEntry) => string;
  formatSecondary?: (e: RankingEntry) => string | undefined;
  portrait?: RankingPortrait;
  metricKind?: RankingMetricKind;
  metricLabel: string;
}) {
  if (entries.length === 0) return null;

  // Con pocos jugadores (típico de la tabla por país) el podio queda desangelado
  // —un aro solo en medio de la nada— y sobra la jerarquía: se muestra plana.
  const showPodium = entries.length >= PODIUM_MIN_ENTRIES;

  const podium = showPodium
    ? [1, 2, 3]
        .map((place) => entries.find((e) => e.position === place) ?? null)
        .filter((e): e is RankingEntry => e != null)
    : [];
  const rest = showPodium ? entries.filter((e) => e.position > 3) : entries;

  const first = podium.find((e) => e.position === 1) ?? null;
  const second = podium.find((e) => e.position === 2) ?? null;
  const third = podium.find((e) => e.position === 3) ?? null;

  return (
    <section className="lb-board">
      <div className="lb-board__head">
        <div>
          <p className="lb-board__title">{title}</p>
          {scopeLabel ? <p className="lb-board__scope">{scopeLabel}</p> : null}
        </div>
      </div>

      {podium.length > 0 ? (
        <div className="lb-podium" role="list">
          {second ? (
            <PodiumSlot
              entry={second}
              place={2}
              youLabel={youLabel}
              primaryMetric={formatPrimary(second)}
              secondaryMetric={formatSecondary?.(second)}
              portrait={portrait}
              metricKind={metricKind}
              metricLabel={metricLabel}
            />
          ) : (
            <span className="lb-podium__slot lb-podium__slot--2 lb-podium__slot--ghost" aria-hidden />
          )}
          {first ? (
            <PodiumSlot
              entry={first}
              place={1}
              youLabel={youLabel}
              primaryMetric={formatPrimary(first)}
              secondaryMetric={formatSecondary?.(first)}
              portrait={portrait}
              metricKind={metricKind}
              metricLabel={metricLabel}
            />
          ) : null}
          {third ? (
            <PodiumSlot
              entry={third}
              place={3}
              youLabel={youLabel}
              primaryMetric={formatPrimary(third)}
              secondaryMetric={formatSecondary?.(third)}
              portrait={portrait}
              metricKind={metricKind}
              metricLabel={metricLabel}
            />
          ) : (
            <span className="lb-podium__slot lb-podium__slot--3 lb-podium__slot--ghost" aria-hidden />
          )}
        </div>
      ) : null}

      {rest.length > 0 ? (
        <ol className="lb-board__list">
          {rest.map((entry) => (
            <RankingListItem
              key={`${entry.playerId}-${entry.position}`}
              entry={entry}
              youLabel={youLabel}
              primaryMetric={formatPrimary(entry)}
              secondaryMetric={formatSecondary?.(entry)}
              portrait={portrait}
              metricKind={metricKind}
              metricLabel={metricLabel}
            />
          ))}
        </ol>
      ) : null}
    </section>
  );
}
