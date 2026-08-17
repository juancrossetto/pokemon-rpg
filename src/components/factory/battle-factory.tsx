"use client";

import { CdnImage as Image } from "@/components/cdn-image";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  claimFactoryReward,
  chooseFactorySwap,
  createFactoryRun,
  fightFactoryRound,
  redeemFactoryPoints,
  submitFactoryDraft,
  type FactoryActionResult,
} from "@/actions/factory";
import { useRouter } from "@/i18n/navigation";
import { PokemonImage } from "@/components/pokemon-image";
import { TrainerAvatar } from "@/components/trainer-avatar";
import { avatarById } from "@/lib/avatars";
import { itemHdIconUrl, itemSpriteUrl } from "@/lib/item-sprites";
import {
  FACTORY_EXCHANGE,
  FACTORY_MAX_WINS,
  FACTORY_TEAM_SIZE,
  type FactoryRankingEntry,
  type FactoryRental,
  type FactoryRunView,
} from "@/lib/factory";

type Props = {
  locale: string;
  run: FactoryRunView | null;
  factoryPoints: number;
  ranking: FactoryRankingEntry[];
  resetsAt: string;
};

export function BattleFactory({ locale, run, factoryPoints, ranking, resetsAt }: Props) {
  const t = useTranslations("factory");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selectedDraft, setSelectedDraft] = useState<number[]>([]);
  const [ownSwap, setOwnSwap] = useState<number | null>(null);
  const [rivalSwap, setRivalSwap] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [battlePulse, setBattlePulse] = useState(false);

  function execute(action: () => Promise<FactoryActionResult>, pulse = false) {
    setFeedback(null);
    if (pulse) setBattlePulse(true);
    startTransition(async () => {
      const result = await action();
      setBattlePulse(false);
      if (!result.ok) {
        setFeedback(t(`errors.${result.error}`));
        return;
      }
      if (result.battle) {
        setFeedback(result.battle.won ? t("battleWon") : t("battleLost"));
      }
      setOwnSwap(null);
      setRivalSwap(null);
      router.refresh();
    });
  }

  function toggleDraft(id: number) {
    if (pending) return;
    setSelectedDraft((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : current.length < FACTORY_TEAM_SIZE
          ? [...current, id]
          : current,
    );
  }

  const lastRound = run?.battleHistory.at(-1) ?? null;
  const resetLabel = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(resetsAt));

  return (
    <main className="factory-page mx-auto w-full max-w-6xl px-4 pb-28 pt-6 sm:px-6 lg:pb-14">
      <section className="factory-hero">
        <div className="factory-hero__copy">
          <p className="factory-eyebrow">{t("eyebrow")}</p>
          <h1 className="page-title text-4xl text-white sm:text-5xl">{t("title")}</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-white/65 sm:text-base">
            {t("description")}
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold uppercase tracking-[0.12em]">
            <span className="factory-chip"><span>7</span>{t("battles")}</span>
            <span className="factory-chip"><span>3</span>{t("rentals")}</span>
            <span className="factory-chip"><span>{factoryPoints}</span>{t("pointsShort")}</span>
          </div>
        </div>
        <div className="factory-emblem" aria-hidden="true">
          <span className="material-symbols-outlined">precision_manufacturing</span>
          <b>BF</b>
        </div>
      </section>

      {run ? <FactoryProgress wins={run.round} status={run.status} /> : null}

      <section className="factory-stage">
        {!run ? (
          <EmptyFactory
            pending={pending}
            resetLabel={resetLabel}
            onStart={() => execute(() => createFactoryRun(locale))}
            t={t}
          />
        ) : null}

        {run?.status === "DRAFTING" ? (
          <div>
            <StageHeader step="01" title={t("draftTitle")} copy={t("draftCopy")} />
            <div className="factory-rental-grid mt-5">
              {run.draftPool.map((rental) => (
                <RentalCard
                  key={rental.speciesId}
                  rental={rental}
                  selected={selectedDraft.includes(rental.speciesId)}
                  onClick={() => toggleDraft(rental.speciesId)}
                />
              ))}
            </div>
            <div className="factory-action-row">
              <span>{t("selected", { count: selectedDraft.length })}</span>
              <button
                className="game-cta game-cta--primary min-w-56"
                disabled={pending || selectedDraft.length !== FACTORY_TEAM_SIZE}
                onClick={() => execute(() => submitFactoryDraft(locale, selectedDraft))}
              >
                <span className="game-cta__label">{t("confirmTeam")}</span>
              </button>
            </div>
          </div>
        ) : null}

        {run?.status === "ACTIVE" ? (
          <div>
            <StageHeader
              step={String(run.round + 1).padStart(2, "0")}
              title={t("roundTitle", { round: run.round + 1 })}
              copy={t("roundCopy")}
            />
            <div className="factory-versus mt-5">
              <div>
                <p className="factory-side-label">{t("yourRentals")}</p>
                <div className="factory-team-row">
                  {run.team.map((rental) => <TeamMon key={rental.speciesId} rental={rental} />)}
                </div>
              </div>
              <div className={`factory-vs ${battlePulse ? "factory-vs--active" : ""}`}>
                <span>VS</span>
              </div>
              <div>
                <p className="factory-side-label text-right">{t("rivalTeam")}</p>
                <div className="factory-team-row factory-team-row--rival">
                  {[0, 1, 2].map((index) => (
                    <span className="factory-mystery" key={index}>?</span>
                  ))}
                </div>
              </div>
            </div>
            <div className="factory-action-row justify-end">
              <button
                className="game-cta game-cta--secondary min-w-64"
                disabled={pending}
                onClick={() => execute(() => fightFactoryRound(locale), true)}
              >
                <span className="game-cta__icon material-symbols-outlined">swords</span>
                <span className="game-cta__label">{pending ? t("simulating") : t("fight")}</span>
              </button>
            </div>
          </div>
        ) : null}

        {run?.status === "AWAITING_SWAP" ? (
          <div>
            <StageHeader
              step={String(run.round).padStart(2, "0")}
              title={t("swapTitle")}
              copy={t("swapCopy")}
            />
            {lastRound ? (
              <p className="factory-result-line">{t("roundResult", { turns: lastRound.turns })}</p>
            ) : null}
            <SwapRow
              label={t("replaceOne")}
              rentals={run.team}
              selected={ownSwap}
              onSelect={setOwnSwap}
            />
            <SwapRow
              label={t("takeOne")}
              rentals={run.lastOpponent}
              selected={rivalSwap}
              onSelect={setRivalSwap}
            />
            <div className="factory-action-row">
              <button
                className="rounded-xl border border-white/15 px-5 py-3 text-sm font-bold text-white/70 hover:bg-white/5"
                disabled={pending}
                onClick={() => execute(() => chooseFactorySwap(locale, null, null))}
              >
                {t("keepTeam")}
              </button>
              <button
                className="game-cta game-cta--primary min-w-56"
                disabled={pending || ownSwap === null || rivalSwap === null}
                onClick={() => execute(() => chooseFactorySwap(locale, ownSwap, rivalSwap))}
              >
                <span className="game-cta__label">{t("confirmSwap")}</span>
              </button>
            </div>
          </div>
        ) : null}

        {run && (run.status === "WON" || run.status === "LOST") ? (
          <FactoryEnd
            run={run}
            pending={pending}
            onClaim={() => execute(() => claimFactoryReward(locale))}
            t={t}
          />
        ) : null}

        {feedback ? <p className="factory-feedback" role="status">{feedback}</p> : null}
      </section>

      <FactoryExchange
        points={factoryPoints}
        pending={pending}
        onRedeem={(itemName) => execute(() => redeemFactoryPoints(itemName, locale))}
        t={t}
      />

      <FactoryRanking entries={ranking} t={t} />
    </main>
  );
}

function StageHeader({ step, title, copy }: { step: string; title: string; copy: string }) {
  return (
    <header className="factory-stage-header">
      <span>{step}</span>
      <div><h2>{title}</h2><p>{copy}</p></div>
    </header>
  );
}

function EmptyFactory({ pending, resetLabel, onStart, t }: { pending: boolean; resetLabel: string; onStart: () => void; t: ReturnType<typeof useTranslations<"factory">> }) {
  return (
    <div className="factory-empty">
      <div className="factory-empty__head">
        <span className="material-symbols-outlined" aria-hidden="true">casino</span>
        <div><h2>{t("readyTitle")}</h2><p>{t("readyCopy", { time: resetLabel })}</p></div>
      </div>
      <ol className="factory-how">
        <li><b>01</b><span><strong>{t("howDraft")}</strong><small>{t("howDraftCopy")}</small></span></li>
        <li><b>02</b><span><strong>{t("howFight")}</strong><small>{t("howFightCopy")}</small></span></li>
        <li><b>03</b><span><strong>{t("howSwap")}</strong><small>{t("howSwapCopy")}</small></span></li>
      </ol>
      <div className="factory-empty__action">
        <span>{t("oneAttempt")}</span>
        <button className="game-cta game-cta--primary min-w-60" disabled={pending} onClick={onStart}>
          <span className="game-cta__label">{t("generateDraft")}</span>
        </button>
      </div>
    </div>
  );
}

function FactoryProgress({ wins, status }: { wins: number; status: FactoryRunView["status"] }) {
  return (
    <div className="factory-progress" aria-label={`${wins}/${FACTORY_MAX_WINS}`}>
      {Array.from({ length: FACTORY_MAX_WINS }, (_, index) => (
        <span key={index} className={index < wins ? "is-cleared" : index === wins && status === "ACTIVE" ? "is-current" : ""}>
          {index < wins ? "✓" : index + 1}
        </span>
      ))}
    </div>
  );
}

function RentalCard({ rental, selected, onClick }: { rental: FactoryRental; selected: boolean; onClick: () => void }) {
  return (
    <button className={`factory-rental ${selected ? "is-selected" : ""}`} onClick={onClick} aria-pressed={selected}>
      <span className="factory-rental__check material-symbols-outlined">{selected ? "check" : "add"}</span>
      <PokemonImage src={rental.spriteUrl} speciesId={rental.speciesId} speciesName={rental.name} alt={rental.name} width={112} height={112} className="factory-rental__image" />
      <span className="factory-rental__level">LV. {rental.level}</span>
      <strong>{rental.name}</strong>
      <span className="factory-rental__types">{rental.types.join(" · ")}</span>
      <span className="factory-rental__moves">{rental.moves.slice(0, 2).map((move) => move.name.replaceAll("-", " ")).join(" / ")}</span>
    </button>
  );
}

function TeamMon({ rental }: { rental: FactoryRental }) {
  return (
    <span className="factory-team-mon" title={rental.name}>
      <PokemonImage src={rental.spriteUrl} speciesId={rental.speciesId} speciesName={rental.name} alt={rental.name} width={80} height={80} />
      <small>{rental.name}</small>
    </span>
  );
}

function SwapRow({ label, rentals, selected, onSelect }: { label: string; rentals: FactoryRental[]; selected: number | null; onSelect: (id: number) => void }) {
  return (
    <div className="factory-swap-row">
      <p>{label}</p>
      <div>{rentals.map((rental) => (
        <button key={rental.speciesId} className={selected === rental.speciesId ? "is-selected" : ""} onClick={() => onSelect(rental.speciesId)}>
          <PokemonImage src={rental.spriteUrl} speciesId={rental.speciesId} speciesName={rental.name} alt={rental.name} width={72} height={72} />
          <span>{rental.name}</span>
        </button>
      ))}</div>
    </div>
  );
}

function FactoryEnd({ run, pending, onClaim, t }: { run: FactoryRunView; pending: boolean; onClaim: () => void; t: ReturnType<typeof useTranslations<"factory">> }) {
  const won = run.status === "WON";
  return (
    <div className="factory-end">
      <span className={`material-symbols-outlined ${won ? "text-[#72f6bd]" : "text-white/45"}`}>{won ? "workspace_premium" : "flag"}</span>
      <p className="factory-eyebrow">{won ? t("streakComplete") : t("runEnded")}</p>
      <h2>{won ? t("championTitle") : t("tryAgainTitle")}</h2>
      <p>{t("endSummary", { wins: run.round, turns: run.totalTurns })}</p>
      <div className="factory-points-prize"><b>+{run.pointsAwarded}</b><span>{t("points")}</span></div>
      <button className="game-cta game-cta--primary min-w-60" disabled={pending || run.rewardClaimed} onClick={onClaim}>
        <span className="game-cta__label">{run.rewardClaimed ? t("claimed") : t("claim")}</span>
      </button>
    </div>
  );
}

function FactoryRanking({ entries, t }: { entries: FactoryRankingEntry[]; t: ReturnType<typeof useTranslations<"factory">> }) {
  return (
    <section className="factory-ranking">
      <div className="factory-ranking__head"><div><p className="factory-eyebrow">{t("dailyCompetition")}</p><h2>{t("rankingTitle")}</h2></div><span>{t("rankingRule")}</span></div>
      {entries.length === 0 ? <p className="factory-ranking__empty"><span className="material-symbols-outlined" aria-hidden="true">leaderboard</span>{t("rankingEmpty")}</p> : (
        <div className="factory-ranking__table">
          <div className="factory-ranking__labels"><span>#</span><span>{t("trainer")}</span><span>{t("wins")}</span><span>{t("turns")}</span></div>
          {entries.map((entry) => (
            <div key={`${entry.position}-${entry.username}`} className={entry.isCurrentUser ? "is-me" : ""}>
              <b>#{entry.position}</b>
              <span className="factory-ranking__trainer"><TrainerAvatar name={entry.username} src={avatarById(entry.avatarId)?.src ?? null} size="xs" framed={false} /><strong>{entry.username}</strong>{entry.completed ? <i>7/7</i> : null}</span>
              <span>{entry.wins}/7</span><span>{entry.turns}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * Canje de Puntos Fábrica.
 *
 * Sin esto los puntos eran un contador que sólo subía: se ganaban con la
 * corrida diaria y no había dónde gastarlos, así que repetir la corrida una
 * vez vista no daba nada. La lista es cerrada y vive al lado de donde se ganan
 * en vez de sumar una tercera moneda a toda la tienda.
 */
function FactoryExchange({
  points,
  pending,
  onRedeem,
  t,
}: {
  points: number;
  pending: boolean;
  onRedeem: (itemName: string) => void;
  t: ReturnType<typeof useTranslations<"factory">>;
}) {
  return (
    <section className="factory-exchange">
      <header className="factory-exchange__head">
        <div>
          <span>{t("exchangeEyebrow")}</span>
          <h2>{t("exchangeTitle")}</h2>
        </div>
        <span className="factory-exchange__balance">
          <b>{points}</b>
          {t("pointsShort")}
        </span>
      </header>
      <ul className="factory-exchange__grid">
        {FACTORY_EXCHANGE.map((entry) => {
          const affordable = points >= entry.cost;
          return (
            <li key={entry.itemName} className="factory-exchange__item">
              <span className="factory-exchange__art">
                <Image
                  src={itemHdIconUrl(entry.itemName) ?? itemSpriteUrl(entry.itemName)}
                  alt=""
                  width={64}
                  height={64}
                  unoptimized
                />
              </span>
              <strong>{entry.itemName}</strong>
              <span className="factory-exchange__qty">×{entry.quantity}</span>
              <button
                type="button"
                disabled={pending || !affordable}
                onClick={() => onRedeem(entry.itemName)}
                className="factory-exchange__cta"
              >
                {entry.cost} {t("pointsShort")}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
