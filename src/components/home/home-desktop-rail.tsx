"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { FlagIcon } from "@/components/flag-icon";
import { AvatarImage } from "@/components/avatar-image";
import { avatarById } from "@/lib/avatars";
import { gymBadgeImageUrl } from "@/lib/gym-art";
import { uiSpriteUrl } from "@/lib/sprites";

export type HomeSquadFilter = "all" | "favorites" | "injured" | "ready";

export type HomeRailBadge = {
  order: number;
  type: string;
  name: string;
  earned: boolean;
};

export type HomeRailRankEntry = {
  position: number;
  playerId: string;
  playerName: string;
  countryCode: string;
  avatarId: string | null;
  combatPower: number;
  isCurrentPlayer: boolean;
  featured: { name: string; image: string; isShiny: boolean } | null;
};

/**
 * Columna izquierda desktop del Home: un solo módulo (filtros / medallero /
 * top 5) separado por divisores — sin cards apiladas.
 */
export function HomeDesktopRail({
  filter,
  onFilterChange,
  badges,
  badgesEarned,
  badgesTotal,
  top,
}: {
  filter: HomeSquadFilter;
  onFilterChange: (next: HomeSquadFilter) => void;
  badges: HomeRailBadge[];
  badgesEarned: number;
  badgesTotal: number;
  top: HomeRailRankEntry[];
}) {
  const t = useTranslations("home.rail");

  const filters: { id: HomeSquadFilter; label: string }[] = [
    { id: "all", label: t("filterAll") },
    { id: "favorites", label: t("filterFavorites") },
    { id: "injured", label: t("filterInjured") },
    { id: "ready", label: t("filterReady") },
  ];

  return (
    <aside className="sticky top-4 hidden h-fit w-[15.5rem] shrink-0 xl:block 2xl:w-[16.5rem]">
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0c0e14]/92">
        {/* Filtros */}
        <div className="px-3.5 py-3">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-white">
              <span className="material-symbols-outlined text-[16px]! text-[#ff7a28]">
                filter_list
              </span>
              {t("filtersTitle")}
            </p>
            {filter !== "all" ? (
              <button
                type="button"
                onClick={() => onFilterChange("all")}
                className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#ff9a4a] transition hover:text-[#ffb56e]"
              >
                {t("filtersClear")}
              </button>
            ) : null}
          </div>
          <ul className="flex flex-col gap-0.5">
            {filters.map((f) => {
              const active = filter === f.id;
              return (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => onFilterChange(f.id)}
                    className={`flex w-full items-center gap-2.5 rounded-md px-1.5 py-1.5 text-left text-[12px] transition ${
                      active
                        ? "text-white"
                        : "text-on-surface-variant hover:text-white/90"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] border transition ${
                        active
                          ? "border-[#ff7a28] bg-[#ff7a28] text-[#1a1208]"
                          : "border-white/25 bg-transparent"
                      }`}
                    >
                      {active ? (
                        <span className="material-symbols-outlined text-[12px]! font-bold">
                          check
                        </span>
                      ) : null}
                    </span>
                    <span className={active ? "font-semibold" : "font-medium"}>
                      {f.label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="mx-3.5 h-px bg-white/8" aria-hidden />

        {/* Medallero */}
        <div className="px-3.5 py-3">
          <div className="mb-2.5 flex items-baseline justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white">
              {t("medalsTitle")}
            </p>
            <span className="font-mono text-[10px] tabular-nums text-white/50">
              {t("medalsProgress", { earned: badgesEarned, total: badgesTotal })}
            </span>
          </div>
          {badges.length === 0 ? (
            <p className="text-[11px] text-on-surface-variant/80">{t("medalsEmpty")}</p>
          ) : (
            <ul className="grid grid-cols-4 gap-1.5">
              {badges.map((b) => (
                <li key={b.order}>
                  <span
                    className={`relative flex h-9 w-9 items-center justify-center rounded-full ${
                      b.earned ? "bg-white/[0.06]" : "bg-white/[0.02] opacity-35 grayscale"
                    }`}
                    title={b.name}
                  >
                    <Image
                      src={gymBadgeImageUrl(b.type)}
                      alt={b.name}
                      width={26}
                      height={26}
                      className="h-6.5 w-6.5 object-contain"
                      unoptimized
                    />
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/gyms"
            className="mt-2.5 inline-flex text-[11px] font-semibold text-[#ff9a4a] transition hover:text-[#ffb56e]"
          >
            {t("medalsViewAll")}
          </Link>
        </div>

        <div className="mx-3.5 h-px bg-white/8" aria-hidden />

        {/* Top 5 */}
        <div className="px-3.5 py-3">
          <div className="mb-2.5 flex items-baseline justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white">
              {t("topTitle")}
            </p>
            <Link
              href="/ranking"
              className="text-[10px] font-semibold text-[#ff9a4a] transition hover:text-[#ffb56e]"
            >
              {t("topViewAll")}
            </Link>
          </div>
          {top.length === 0 ? (
            <p className="text-[11px] text-on-surface-variant/80">{t("topEmpty")}</p>
          ) : (
            <ol className="flex flex-col">
              {top.map((row, i) => {
                const avatar = avatarById(row.avatarId);
                const featured = row.featured;
                return (
                  <li
                    key={row.playerId}
                    className={`flex items-center gap-2 py-1.5 ${
                      i > 0 ? "border-t border-white/[0.06]" : ""
                    } ${row.isCurrentPlayer ? "rounded-md bg-[#ff7a28]/10 px-1" : ""}`}
                  >
                    <span className="w-3.5 shrink-0 text-center font-mono text-[11px] font-bold tabular-nums text-white/55">
                      {row.position}
                    </span>
                    <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded-[26%] bg-[#12141a]">
                      {avatar?.src ? (
                        <AvatarImage
                          src={avatar.src}
                          alt={row.playerName}
                          className="trainer-sprite-fill h-full w-full"
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-[9px] font-bold text-white/50">
                          {row.playerName.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex min-w-0 items-center gap-1">
                        <span className="truncate text-[12px] font-semibold text-white">
                          {row.playerName}
                        </span>
                        <FlagIcon code={row.countryCode} className="h-2.5 w-3.5 shrink-0" />
                      </span>
                      <span className="font-mono text-[10px] tabular-nums text-white/45">
                        {t("cp")} {row.combatPower.toLocaleString()}
                      </span>
                    </span>
                    {featured ? (
                      <Image
                        src={uiSpriteUrl(featured.image, featured.isShiny)}
                        alt={featured.name}
                        width={32}
                        height={32}
                        className="h-7 w-7 shrink-0 object-contain"
                        unoptimized
                      />
                    ) : null}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </aside>
  );
}
