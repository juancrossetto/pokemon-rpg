"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { useState, useTransition } from "react";
import {
  listClanWarFoes,
  matchClanWar,
  registerClanForWar,
  startClanWarBattle,
  type ClanWarFoeOption,
} from "@/actions/clan-war";
import { CLAN_WAR_ENERGY_COST } from "@/lib/clan-war/rules";
import { ClanEmblemBadge } from "@/components/clans/clan-emblem-badge";

type WarClan = {
  id: string;
  name: string;
  tag: string;
  emblem: unknown;
};

type WarBattle = {
  id: string;
  slot: number;
  status: string;
  winnerClanId: string | null;
  fighterA: { id: string; username: string } | null;
  fighterB: { id: string; username: string } | null;
};

type War = {
  id: string;
  status: string;
  scoreA: number;
  scoreB: number;
  clanA: WarClan;
  clanB: WarClan;
  battles: WarBattle[];
};

type HistoryWar = War & {
  seasonKey: string;
  completedAt: string | null;
};

export function ClanWarPanel({
  clanId,
  canManage,
  registered,
  seasonKey,
  rating,
  gateOk,
  gateReason,
  memberCount,
  level,
  war,
  history,
}: {
  clanId: string;
  canManage: boolean;
  registered: boolean;
  seasonKey: string;
  rating: number;
  gateOk: boolean;
  gateReason: "members" | "level" | null;
  memberCount: number;
  level: number;
  war: War | null;
  history: HistoryWar[];
}) {
  const t = useTranslations("clans.hub");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [panelTab, setPanelTab] = useState<"current" | "history">(
    war ? "current" : history.length > 0 ? "history" : "current",
  );
  const [pickingSlot, setPickingSlot] = useState<number | null>(null);
  const [foes, setFoes] = useState<ClanWarFoeOption[]>([]);
  const [selectedFoe, setSelectedFoe] = useState<string | null>(null);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

  function run(action: () => Promise<{ ok: boolean; error?: string; won?: boolean }>) {
    setError(null);
    setFlash(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error ?? "failed");
        return;
      }
      if (result.won === true) setFlash(t("warFightWon"));
      else if (result.won === false) setFlash(t("warFightLost"));
      router.refresh();
    });
  }

  function openFoePicker(slot: number) {
    setError(null);
    setFlash(null);
    setPickingSlot(slot);
    setSelectedFoe(null);
    setFoes([]);
    startTransition(async () => {
      if (!war) return;
      const result = await listClanWarFoes(war.id);
      if (!result.ok) {
        setError(result.error);
        setPickingSlot(null);
        return;
      }
      setFoes(result.foes);
      if (result.foes[0]) setSelectedFoe(result.foes[0].userId);
    });
  }

  function confirmFight() {
    if (!war || pickingSlot == null || !selectedFoe) return;
    setError(null);
    startTransition(async () => {
      try {
        await startClanWarBattle(locale, war.id, pickingSlot, selectedFoe);
      } catch {
        // redirect a /battle
      }
      router.refresh();
    });
  }

  const mySide: "A" | "B" | null = war
    ? war.clanA.id === clanId
      ? "A"
      : war.clanB.id === clanId
        ? "B"
        : null
    : null;
  const rival = war
    ? war.clanA.id === clanId
      ? war.clanB
      : war.clanA
    : null;
  const myScore = war ? (war.clanA.id === clanId ? war.scoreA : war.scoreB) : 0;
  const rivalScore = war ? (war.clanA.id === clanId ? war.scoreB : war.scoreA) : 0;

  return (
    <section className="mb-4 rounded-xl border border-white/10 bg-glass-surface p-4">
      <h2 className="text-headline-md text-on-surface">{t("warTitle")}</h2>
      <p className="mt-1 text-label-md text-on-surface-variant">{t("warSubtitle")}</p>
      <p className="mt-1 text-[11px] text-on-surface-variant">
        {t("warSeason", { season: seasonKey })} · {t("warRating", { rating })}
      </p>

      <div className="mt-3 flex gap-1">
        <button
          type="button"
          onClick={() => setPanelTab("current")}
          className={`min-h-10 rounded-lg border px-3 text-label-sm transition-colors ${
            panelTab === "current"
              ? "border-pokeball-red/45 bg-pokeball-red/12 text-on-surface"
              : "border-transparent text-on-surface-variant hover:border-white/15"
          }`}
        >
          {t("warTabCurrent")}
        </button>
        <button
          type="button"
          onClick={() => setPanelTab("history")}
          className={`min-h-10 rounded-lg border px-3 text-label-sm transition-colors ${
            panelTab === "history"
              ? "border-pokeball-red/45 bg-pokeball-red/12 text-on-surface"
              : "border-transparent text-on-surface-variant hover:border-white/15"
          }`}
        >
          {t("warTabHistory")}
        </button>
      </div>

      {error ? (
        <p className="mt-2 rounded-lg border border-error/40 bg-error-container/20 px-3 py-2 text-label-sm text-error">
          {t.has(`warErrors.${error}`) ? t(`warErrors.${error}`) : error}
        </p>
      ) : null}
      {flash ? (
        <p className="mt-2 rounded-lg border border-tertiary/40 bg-tertiary/10 px-3 py-2 text-label-sm text-tertiary">
          {flash}
        </p>
      ) : null}

      {panelTab === "history" ? (
        <div className="mt-3 space-y-2">
          {history.length === 0 ? (
            <p className="rounded-lg border border-white/10 bg-black/20 p-3 text-label-sm text-on-surface-variant">
              {t("warHistoryEmpty")}
            </p>
          ) : (
            history.map((h) => {
              const hRival = h.clanA.id === clanId ? h.clanB : h.clanA;
              const hMyScore = h.clanA.id === clanId ? h.scoreA : h.scoreB;
              const hRivalScore = h.clanA.id === clanId ? h.scoreB : h.scoreA;
              const result =
                hMyScore > hRivalScore ? "win" : hMyScore < hRivalScore ? "loss" : "draw";
              const open = expandedHistoryId === h.id;
              return (
                <article
                  key={h.id}
                  className="rounded-lg border border-white/10 bg-black/20"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedHistoryId(open ? null : h.id)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-label-sm font-semibold text-on-surface">
                        vs [{hRival.tag}] {hRival.name}
                      </p>
                      <p className="text-[11px] text-on-surface-variant">
                        {t("warSeason", { season: h.seasonKey })}
                        {h.completedAt
                          ? ` · ${new Date(h.completedAt).toLocaleDateString(locale)}`
                          : null}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-mono text-label-md font-bold tabular-nums text-white">
                        {hMyScore}:{hRivalScore}
                      </p>
                      <p
                        className={`text-[11px] ${
                          result === "win"
                            ? "text-tertiary"
                            : result === "loss"
                              ? "text-error"
                              : "text-on-surface-variant"
                        }`}
                      >
                        {result === "win"
                          ? t("warHistoryWin")
                          : result === "loss"
                            ? t("warHistoryLoss")
                            : t("warHistoryDraw")}
                      </p>
                    </div>
                  </button>
                  {open ? (
                    <ul className="space-y-1 border-t border-white/10 px-3 py-2">
                      {h.battles.map((b) => {
                        const aName = b.fighterA?.username ?? "—";
                        const bName = b.fighterB?.username ?? "—";
                        const sideA = h.clanA.id === clanId;
                        const won =
                          b.winnerClanId != null && b.winnerClanId === clanId
                            ? true
                            : b.winnerClanId != null
                              ? false
                              : null;
                        return (
                          <li
                            key={b.id}
                            className="flex items-center justify-between gap-2 text-[11px] text-on-surface-variant"
                          >
                            <span>
                              {t("warSlot", { slot: b.slot })} ·{" "}
                              {sideA ? `${aName} vs ${bName}` : `${bName} vs ${aName}`}
                            </span>
                            {won === true ? (
                              <span className="text-tertiary">{t("warSlotWon")}</span>
                            ) : won === false ? (
                              <span className="text-error">{t("warSlotLost")}</span>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </article>
              );
            })
          )}
        </div>
      ) : !war ? (
        <div
          className={`mt-3 rounded-lg border p-3 ${
            gateOk ? "border-tertiary/40 bg-tertiary/10" : "border-white/10 bg-black/20"
          }`}
        >
          <p className="text-label-sm text-on-surface">
            {gateOk
              ? registered
                ? t("warStateWaiting")
                : t("warStateReady")
              : t("warStateLocked", { level: 5 })}
          </p>
          <ul className="mt-1 text-label-sm text-on-surface-variant">
            <li>
              •{" "}
              {memberCount >= 10
                ? t("warReqMembersMet", { current: memberCount, need: 10 })
                : t("warReqMembers", { count: 10 })}
            </li>
            <li>
              •{" "}
              {level >= 5
                ? t("warReqLevelMet", { current: level, need: 5 })
                : t("warReqLevel", { level: 5 })}
            </li>
            <li>• {registered ? t("warReqRegisterOpen") : t("warReqRegister")}</li>
          </ul>

          {canManage && gateOk ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {!registered ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => registerClanForWar(locale, clanId))}
                  className="min-h-11 rounded-lg border border-tertiary/50 bg-tertiary/20 px-3 py-2 text-label-sm font-semibold text-tertiary hover:bg-tertiary/30 disabled:opacity-50"
                >
                  {pending ? t("warWorking") : t("warRegisterCta")}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => matchClanWar(locale, clanId))}
                  className="min-h-11 rounded-lg border border-tertiary/50 bg-tertiary/20 px-3 py-2 text-label-sm font-semibold text-tertiary hover:bg-tertiary/30 disabled:opacity-50"
                >
                  {pending ? t("warWorking") : t("warMatchCta")}
                </button>
              )}
            </div>
          ) : null}

          {!gateOk && gateReason ? (
            <p className="mt-2 text-label-sm text-on-surface-variant">
              {gateReason === "members" ? t("warHintMembers") : t("warHintLevel")}
            </p>
          ) : null}

          {history.length > 0 ? (
            <p className="mt-2 text-[11px] text-on-surface-variant">{t("warHistoryHint")}</p>
          ) : null}
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/25 p-3">
            <div className="flex min-w-0 items-center gap-2">
              <ClanEmblemBadge
                emblem={war.clanA.id === clanId ? war.clanA.emblem : war.clanB.emblem}
                size={40}
              />
              <div className="min-w-0">
                <p className="truncate text-label-sm font-semibold text-white">
                  [{war.clanA.id === clanId ? war.clanA.tag : war.clanB.tag}]
                </p>
                <p className="text-[11px] text-on-surface-variant">{t("warYou")}</p>
              </div>
            </div>
            <p className="font-mono text-xl font-bold tabular-nums text-white">
              {myScore} : {rivalScore}
            </p>
            {rival ? (
              <div className="flex min-w-0 items-center gap-2 text-right">
                <div className="min-w-0">
                  <p className="truncate text-label-sm font-semibold text-white">[{rival.tag}]</p>
                  <p className="text-[11px] text-on-surface-variant">{rival.name}</p>
                </div>
                <ClanEmblemBadge emblem={rival.emblem} size={40} />
              </div>
            ) : null}
          </div>

          <p className="text-label-sm text-on-surface-variant">
            {war.status === "COMPLETED" ? t("warStatusCompleted") : t("warStatusActive")}
            {" · "}
            {t("warEnergyHint", { cost: CLAN_WAR_ENERGY_COST })}
          </p>
          <p className="text-[11px] text-on-surface-variant">
            {t("warTeamHint")}{" "}
            <Link href="/pvp" className="text-tertiary underline-offset-2 hover:underline">
              {t("warTeamLink")}
            </Link>
          </p>

          {pickingSlot != null ? (
            <div className="rounded-lg border border-tertiary/40 bg-tertiary/10 p-3">
              <p className="text-label-sm font-semibold text-on-surface">
                {t("warPickFoeTitle", { slot: pickingSlot })}
              </p>
              <p className="mt-1 text-[11px] text-on-surface-variant">{t("warPickFoeHint")}</p>
              {foes.length === 0 ? (
                <p className="mt-2 text-label-sm text-on-surface-variant">{t("warNoFoes")}</p>
              ) : (
                <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                  {foes.map((f) => (
                    <li key={f.userId}>
                      <button
                        type="button"
                        onClick={() => setSelectedFoe(f.userId)}
                        className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-label-sm ${
                          selectedFoe === f.userId
                            ? "border-tertiary bg-tertiary/20 text-white"
                            : "border-white/10 bg-black/20 text-on-surface hover:border-white/25"
                        }`}
                      >
                        <span className="font-semibold">{f.username}</span>
                        <span className="text-[11px] text-on-surface-variant">
                          {t("warFoeMeta", { n: f.teamSize, level: f.topLevel })}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={pending || !selectedFoe}
                  onClick={confirmFight}
                  className="min-h-10 rounded-lg border border-pokeball-red/50 bg-pokeball-red/20 px-3 py-1.5 text-label-sm font-semibold text-white hover:bg-pokeball-red/30 disabled:opacity-50"
                >
                  {pending ? t("warWorking") : t("warFightConfirm")}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setPickingSlot(null)}
                  className="min-h-10 rounded-lg border border-white/15 px-3 py-1.5 text-label-sm text-on-surface-variant hover:border-white/30"
                >
                  {t("warPickCancel")}
                </button>
              </div>
            </div>
          ) : null}

          <ul className="space-y-2">
            {war.battles.map((b) => {
              const open = b.status === "OPEN" && war.status === "ACTIVE";
              const inProgress = b.status === "IN_PROGRESS";
              const aName = b.fighterA?.username ?? "—";
              const bName = b.fighterB?.username ?? "—";
              const won =
                b.winnerClanId != null && b.winnerClanId === clanId
                  ? true
                  : b.winnerClanId != null
                    ? false
                    : null;
              return (
                <li
                  key={b.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-label-sm font-semibold text-on-surface">
                      {t("warSlot", { slot: b.slot })}
                      {inProgress ? (
                        <span className="ml-2 text-tertiary">{t("warSlotLive")}</span>
                      ) : won === true ? (
                        <span className="ml-2 text-tertiary">{t("warSlotWon")}</span>
                      ) : won === false ? (
                        <span className="ml-2 text-error">{t("warSlotLost")}</span>
                      ) : null}
                    </p>
                    <p className="text-[11px] text-on-surface-variant">
                      {mySide === "A" ? `${aName} vs ${bName}` : `${bName} vs ${aName}`}
                    </p>
                  </div>
                  {open ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => openFoePicker(b.slot)}
                      className="min-h-10 rounded-lg border border-pokeball-red/50 bg-pokeball-red/20 px-3 py-1.5 text-label-sm font-semibold text-white hover:bg-pokeball-red/30 disabled:opacity-50"
                    >
                      {pending ? t("warWorking") : t("warFightCta")}
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
