import Image from "next/image";
import { FlagIcon } from "@/components/flag-icon";
import { TrainerAvatar } from "@/components/trainer-avatar";
import { spriteFor } from "@/lib/shiny";
import { avatarById } from "@/lib/avatars";
import { tierForRank } from "@/components/ranking-emblem";
import type { RankingEntry } from "@/lib/ranking";

function tierAccent(rank: number): string {
  if (rank === 1) return "lb-row--gold";
  if (rank === 2) return "lb-row--silver";
  if (rank === 3) return "lb-row--bronze";
  return "";
}

export type RankingPortrait = "avatar" | "creature";

export function RankingListItem({
  entry,
  youLabel,
  primaryMetric,
  secondaryMetric,
  portrait = "creature",
}: {
  entry: RankingEntry;
  youLabel: string;
  primaryMetric: string;
  secondaryMetric?: string;
  /** Combat Power → avatar; PvP y otros → criatura destacada. */
  portrait?: RankingPortrait;
}) {
  const isMe = !!entry.isCurrentPlayer;
  const rank = entry.position;
  const creature = entry.featuredCreature;
  const sprite = creature ? spriteFor(creature.image, !!creature.isShiny) : null;
  const avatarSrc = avatarById(entry.avatarId ?? null)?.src ?? null;
  const useAvatar = portrait === "avatar";
  const hasPortrait = useAvatar ? !!avatarSrc || !!entry.playerName : !!sprite;
  const tier = tierForRank(rank);

  return (
    <li
      className={`lb-row ${tierAccent(rank)} ${isMe ? "lb-row--you" : ""}`}
      data-rank={rank}
      data-tier={tier}
    >
      <span className="lb-row__rail" aria-hidden />

      <div className="lb-row__rank-wrap">
        <span className="lb-row__rank">{rank}</span>
      </div>

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
                className="h-6 w-6 object-contain drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]"
                unoptimized
              />
            ))}
          </span>
        ) : secondaryMetric || (!useAvatar && creature?.name) ? (
          <p className="lb-row__sub truncate">
            {secondaryMetric ?? creature?.name}
          </p>
        ) : null}
      </div>

      <div className={`lb-row__avatar ${hasPortrait ? "" : "lb-row__avatar--empty"}`}>
        {useAvatar ? (
          <TrainerAvatar name={entry.playerName} src={avatarSrc} size="md" framed={false} />
        ) : sprite ? (
          <Image
            src={sprite}
            alt={creature?.name ?? ""}
            width={56}
            height={56}
            className="lb-row__sprite"
            unoptimized
          />
        ) : null}
      </div>

      <div className="lb-row__score">
        <span className="lb-row__score-label" aria-hidden>
          <span className="material-symbols-outlined">emoji_events</span>
        </span>
        <span className="lb-row__score-value">{primaryMetric}</span>
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
}: {
  entries: RankingEntry[];
  youLabel: string;
  title: string;
  scopeLabel?: string;
  formatPrimary: (e: RankingEntry) => string;
  formatSecondary?: (e: RankingEntry) => string | undefined;
  portrait?: RankingPortrait;
}) {
  if (entries.length === 0) return null;

  return (
    <section className="lb-board">
      <div className="lb-board__head">
        <div>
          <p className="lb-board__title">{title}</p>
          {scopeLabel ? <p className="lb-board__scope">{scopeLabel}</p> : null}
        </div>
      </div>
      <ol className="lb-board__list">
        {entries.map((entry) => (
          <RankingListItem
            key={`${entry.playerId}-${entry.position}`}
            entry={entry}
            youLabel={youLabel}
            primaryMetric={formatPrimary(entry)}
            secondaryMetric={formatSecondary?.(entry)}
            portrait={portrait}
          />
        ))}
      </ol>
    </section>
  );
}
