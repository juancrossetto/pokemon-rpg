"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  searchPvpOpponents,
  startPvpChallenge,
  type PvpOpponentHit,
} from "@/actions/start-pvp-battle";
import { SubmitButton } from "@/components/submit-button";
import { TrainerAvatar } from "@/components/trainer-avatar";
import { FlagIcon } from "@/components/flag-icon";
import { avatarById } from "@/lib/avatars";
import { tierAccentClass, tierForRating } from "@/lib/pvp/tiers";

function avatarSrc(avatarId: string | null): string | null {
  return avatarById(avatarId)?.src ?? null;
}

export function PvpChallengeSearch({
  locale,
  canFight,
}: {
  locale: string;
  canFight: boolean;
}) {
  const t = useTranslations("pvp");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<PvpOpponentHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<PvpOpponentHit | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selected) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchTimer.current = setTimeout(() => {
      void searchPvpOpponents(q).then((res) => {
        if (res.ok) setHits(res.hits);
        else setHits([]);
        setSearching(false);
        setPanelOpen(true);
      });
    }, 280);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [query, selected]);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setPanelOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  function pick(hit: PvpOpponentHit) {
    setSelected(hit);
    setQuery(hit.username);
    setHits([]);
    setPanelOpen(false);
  }

  function clearSelection() {
    setSelected(null);
    setQuery("");
    setHits([]);
  }

  const showEmpty =
    !selected && panelOpen && query.trim().length >= 2 && !searching && hits.length === 0;
  const showHits = !selected && panelOpen && hits.length > 0;

  return (
    <div ref={rootRef} className="flex flex-wrap gap-2">
      <form
        action={startPvpChallenge.bind(null, locale)}
        className="flex min-w-0 flex-1 flex-wrap gap-2"
      >
        {selected ? (
          <input type="hidden" name="opponentUserId" value={selected.userId} />
        ) : null}

        <div className="relative min-w-48 flex-1">
          {selected ? (
            <div className="flex items-center gap-2.5 border-b border-electric-yellow/35 px-1 py-1.5">
              <TrainerAvatar
                name={selected.username}
                src={avatarSrc(selected.avatarId)}
                size="sm"
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-[13px] font-bold text-white">
                    {selected.username}
                  </span>
                  <FlagIcon code={selected.country} className="h-3 w-4 shrink-0" />
                </span>
                <span
                  className={`text-[11px] tabular-nums ${tierAccentClass(tierForRating(selected.pvpRating))}`}
                >
                  {t("rating")} {selected.pvpRating}
                </span>
              </span>
              <button
                type="button"
                onClick={clearSelection}
                aria-label={t("challengeClear")}
                className="shrink-0 rounded-md p-1 text-white/45 hover:bg-white/10 hover:text-white"
              >
                <span className="material-symbols-outlined text-[18px]!">close</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 border-b border-white/12 px-1 py-2 focus-within:border-pokeball-red/50">
              <span className="material-symbols-outlined text-[18px]! text-white/40">
                search
              </span>
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPanelOpen(true);
                }}
                onFocus={() => {
                  if (hits.length > 0 || query.trim().length >= 2) setPanelOpen(true);
                }}
                placeholder={t("challengePlaceholder")}
                autoComplete="off"
                spellCheck={false}
                className="min-w-0 flex-1 bg-transparent text-[13px] text-white placeholder:text-white/35 focus:outline-none"
              />
              {searching ? (
                <span className="shrink-0 text-[10px] uppercase tracking-wider text-white/40">
                  {t("searching")}
                </span>
              ) : null}
            </div>
          )}

          {showHits ? (
            <ul
              role="listbox"
              className="absolute z-20 mt-1.5 max-h-64 w-full overflow-y-auto rounded-xl border border-white/10 bg-[#12141c] py-1 shadow-[0_14px_32px_rgba(0,0,0,0.55)]"
            >
              {hits.map((hit) => (
                <li key={hit.userId}>
                  <button
                    type="button"
                    role="option"
                    onClick={() => pick(hit)}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-white/5"
                  >
                    <TrainerAvatar
                      name={hit.username}
                      src={avatarSrc(hit.avatarId)}
                      size="sm"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-[13px] font-semibold text-white">
                          {hit.username}
                        </span>
                        <FlagIcon code={hit.country} className="h-3 w-4 shrink-0" />
                      </span>
                      <span
                        className={`text-[11px] tabular-nums ${tierAccentClass(tierForRating(hit.pvpRating))}`}
                      >
                        {t("rating")} {hit.pvpRating}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {showEmpty ? (
            <p className="absolute z-20 mt-1.5 w-full rounded-xl border border-white/10 bg-[#12141c] px-3 py-3 text-center text-[12px] text-white/50 shadow-[0_14px_32px_rgba(0,0,0,0.55)]">
              {t("challengeNoResults")}
            </p>
          ) : null}
        </div>

        <SubmitButton
          label={t("challengeSubmit")}
          pendingLabel={t("starting")}
          disabled={!canFight || !selected}
          className="game-cta w-auto! min-h-10! px-5"
        />
      </form>
    </div>
  );
}
