"use client";

import Image from "next/image";
import { useRef, useState, useTransition, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  finishSafariRun,
  searchSafariEncounter,
  skipSafariEncounter,
  startSafariRun,
  throwSafariBall,
  type SafariActionResult,
} from "@/actions/safari";
import { safariRewardProgress } from "@/lib/safari";
import { avatarById } from "@/lib/avatars";
import { TrainerAvatar } from "@/components/trainer-avatar";

type SpeciesPreview = { id: number; name: string; spriteUrl: string; rarity: string };
type SafariActionSuccess = Extract<SafariActionResult, { ok: true }>;

const SAFARI_ARTWORK_BY_BIOME: Record<string, string> = {
  verdant: "/safari/reserva-esmeralda-diorama.png",
  wetlands: "/safari/humedales-azules.png",
  badlands: "/safari/canon-ambar.png",
};

export type SafariViewData = {
  attemptsRemaining: number;
  attemptsMax: number;
  resetAt: string;
  biomes: Array<{
    id: string;
    accent: string;
    levelMin: number;
    levelMax: number;
    species: SpeciesPreview[];
  }>;
  activeRun: null | {
    id: string;
    biomeId: string;
    encountersUsed: number;
    encountersMax: number;
    ballsRemaining: number;
    catches: number;
    bestScore: number;
    best: null | { id: number; name: string; spriteUrl: string; level: number; isShiny: boolean };
    encounter: null | {
      id: number;
      name: string;
      spriteUrl: string;
      level: number;
      isShiny: boolean;
      rarity: string;
      catchChance: number;
    };
  };
  lastRun: null | {
    id: string;
    bestScore: number;
    rank: "S" | "A" | "B" | "C";
    rewardCoins: number;
    rewardGems: number;
    catches: number;
    best: null | { id: number; name: string; spriteUrl: string; level: number; isShiny: boolean };
    captured: Array<{ id: number; name: string; spriteUrl: string; level: number; isShiny: boolean }>;
  };
  playerRank: null | { position: number; score: number };
  leaderboard: Array<{
    rank: number;
    username: string;
    avatarId: string | null;
    score: number;
    speciesId: number | null;
    speciesName: string | null;
    speciesSpriteUrl: string | null;
    isShiny: boolean;
  }>;
};

function displayName(value: string): string {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function SafariExpedition({ locale, data }: { locale: string; data: SafariViewData }) {
  const t = useTranslations("safari");
  const router = useRouter();
  const biomeCarouselRef = useRef<HTMLDivElement>(null);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [selectedBiome, setSelectedBiome] = useState(data.biomes[0]?.id ?? "verdant");
  const [capturePhase, setCapturePhase] = useState<"idle" | "throwing" | "caught" | "escaped">("idle");
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [finishedRunId, setFinishedRunId] = useState<string | null>(null);

  function run(
    action: () => Promise<SafariActionResult>,
    success?: (result: SafariActionSuccess) => string,
  ) {
    setFeedback(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setFeedback(t(`errors.${result.error}`));
        return;
      }
      if (result.finishedRunId) setFinishedRunId(result.finishedRunId);
      if (success) setFeedback(success(result));
      router.refresh();
    });
  }

  const active = data.activeRun;
  const activeBiome = active ? data.biomes.find((biome) => biome.id === active.biomeId) : null;
  const rewardProgress = active ? safariRewardProgress(active.bestScore) : null;

  function handleThrow() {
    setFeedback(null);
    setCapturePhase("throwing");
    startTransition(async () => {
      const [result] = await Promise.all([
        throwSafariBall(locale),
        new Promise((resolve) => window.setTimeout(resolve, 700)),
      ]);
      if (!result.ok) {
        setCapturePhase("idle");
        setFeedback(t(`errors.${result.error}`));
        return;
      }
      setCapturePhase(result.caught ? "caught" : "escaped");
      setFeedback(result.caught ? t("caught", { score: result.score ?? 0 }) : t("escaped"));
      await new Promise((resolve) => window.setTimeout(resolve, 900));
      if (result.finishedRunId) setFinishedRunId(result.finishedRunId);
      setCapturePhase("idle");
      router.refresh();
    });
  }

  function handleFinish() {
    setConfirmFinish(false);
    run(() => finishSafariRun(locale), (result) => {
      if (result.finishedRunId) setFinishedRunId(result.finishedRunId);
      return t("runClosed");
    });
  }

  function syncBiomeFromCarousel() {
    const carousel = biomeCarouselRef.current;
    if (!carousel || window.matchMedia("(min-width: 768px)").matches) return;

    const viewportCenter = carousel.scrollLeft + carousel.clientWidth / 2;
    const cards = Array.from(carousel.children) as HTMLElement[];
    let closestIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;
    cards.forEach((card, index) => {
      const cardCenter = card.offsetLeft + card.offsetWidth / 2;
      const distance = Math.abs(cardCenter - viewportCenter);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });

    const nextId = data.biomes[closestIndex]?.id;
    if (nextId) setSelectedBiome((current) => (current === nextId ? current : nextId));
  }

  function scrollToBiome(index: number) {
    const next = data.biomes[index];
    if (!next) return;
    setSelectedBiome(next.id);
    const card = biomeCarouselRef.current?.children.item(index);
    if (card instanceof HTMLElement) {
      card.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-margin-mobile py-5 md:px-margin-desktop md:py-8">
      <section className="relative overflow-hidden rounded-[26px] border border-emerald-300/25 bg-[#07110e] px-4 py-4 shadow-[0_24px_80px_rgba(0,0,0,0.32)] md:min-h-[13.5rem] md:px-7 md:py-5">
        <Image
          src="/safari/safari-banner.png"
          alt=""
          fill
          sizes="(min-width: 1152px) 1152px, 100vw"
          className="object-cover object-[68%_center] md:object-center"
          priority
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,15,12,0.9)_0%,rgba(5,15,12,0.76)_54%,rgba(5,12,10,0.28)_100%)] md:bg-[linear-gradient(90deg,#07110e_0%,rgba(7,17,14,0.96)_45%,rgba(7,17,14,0.48)_72%,rgba(7,17,14,0.08)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(3,9,7,0.66)_0%,transparent_62%)]" />
        <div className="relative z-10 max-w-[17rem] md:max-w-[74%]">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-300">{t("eyebrow")}</p>
          <h1 className="page-title mt-1.5 text-[1.85rem] leading-[0.96] text-white md:text-[2.6rem] md:leading-none">{t("title")}</h1>
          <p className="mt-2 text-[11px] leading-[1.45] text-white/65 md:mt-2.5 md:text-xs md:leading-5 md:whitespace-nowrap">{t("subtitle")}</p>
        </div>
        <div className="relative z-10 mt-4 grid grid-cols-3 gap-2 border-t border-white/10 pt-3 md:flex md:flex-wrap md:items-center md:gap-x-7 md:gap-y-3 md:border-t-0 md:pt-0">
          <Metric imageSrc="/safari/tickets/ticket-pink.png" value={`${data.attemptsRemaining}/${data.attemptsMax}`} label={t("attempts")} />
          <Metric imageSrc="/safari/metrics/clock.png" value={new Date(data.resetAt).toLocaleDateString(locale, { weekday: "short", day: "2-digit", month: "short" })} label={t("reset")} />
          <Metric imageSrc="/safari/metrics/encounters.png" value={active ? `${active.encountersUsed}/${active.encountersMax}` : "10"} label={t("encounters")} />
        </div>
      </section>

      {feedback ? (
        <div className="mt-4 rounded-xl border border-fuchsia-300/25 bg-fuchsia-400/10 px-4 py-3 text-sm font-semibold text-fuchsia-100">{feedback}</div>
      ) : null}

      {active ? (
        <section className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.7fr)]">
          <div className="overflow-hidden rounded-[26px] border border-white/10 bg-surface-container-low">
            <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: activeBiome?.accent }}>{t(`biomes.${active.biomeId}.name`)}</p>
                <h2 className="mt-1 text-xl font-bold text-white">{active.encounter ? t("encounterTitle") : t("trailTitle")}</h2>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/25 px-3 py-1.5 text-xs font-black text-white">
                <Image src="/items/hd/safari-ball.png" alt="" width={26} height={26} className="h-6 w-6 object-contain" />
                {active.ballsRemaining}
              </div>
            </div>

            {active.encounter ? (
              <div className="relative min-h-[390px] overflow-hidden px-5 py-6 md:px-7 md:py-7">
                <div className="absolute inset-0 opacity-50" style={{ background: `radial-gradient(circle at 28% 52%, ${activeBiome?.accent ?? "#64d98b"}42, transparent 30%), radial-gradient(circle at 72% 48%, ${activeBiome?.accent ?? "#64d98b"}16, transparent 42%)` }} />
                <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                <div className="relative z-10 mx-auto grid min-h-[335px] max-w-3xl items-center gap-5 md:grid-cols-[220px_minmax(0,1fr)] md:gap-9">
                  <div className="relative mx-auto h-[190px] w-[190px] md:h-[220px] md:w-[220px]">
                    <div className="absolute inset-[16%] rounded-full border border-white/8" style={{ background: `${activeBiome?.accent ?? "#64d98b"}10`, boxShadow: `0 0 52px ${activeBiome?.accent ?? "#64d98b"}28` }} />
                    <div className="absolute inset-x-[17%] bottom-[7%] h-[10%] rounded-[50%] bg-black/75 blur-xl" />
                    <div className={`safari-encounter-reveal absolute inset-0 ${capturePhase === "caught" ? "is-caught" : capturePhase === "escaped" ? "is-escaped" : ""}`}>
                      <SafariSprite species={active.encounter} sizes="220px" className="object-contain p-2 drop-shadow-[0_20px_20px_rgba(0,0,0,0.55)]" />
                    </div>
                    {capturePhase !== "idle" ? <div className={`safari-capture-ball is-${capturePhase}`}><Image src="/items/hd/safari-ball.png" alt="" width={62} height={62} className="h-full w-full object-contain drop-shadow-[0_8px_10px_rgba(0,0,0,0.6)]" /></div> : null}
                    {capturePhase === "caught" || capturePhase === "escaped" ? <div className={`safari-capture-result is-${capturePhase}`}>{capturePhase === "caught" ? t("captureSuccess") : t("captureFailed")}</div> : null}
                  </div>
                  <div className="text-center md:text-left">
                    <div className="flex flex-wrap items-center justify-center gap-2 md:justify-start">
                      <span className={`text-[10px] font-black uppercase tracking-[0.18em] ${active.encounter.isShiny ? "text-yellow-300" : "text-white/50"}`}>{active.encounter.isShiny ? "✦ SHINY" : t(`rarity.${active.encounter.rarity}`)}</span>
                      <span className="h-1 w-1 rounded-full bg-white/25" />
                      <span className="font-mono text-[10px] font-black uppercase tracking-[0.14em] text-white/45">Lv. {active.encounter.level}</span>
                    </div>
                    <h3 className="page-title mt-2 text-[2rem] leading-none text-white md:text-[2.35rem]">{displayName(active.encounter.name)}</h3>
                    <div className="mt-4">
                      <div className="text-[11px] font-semibold text-white/48">
                        <span>{t("catchChance", { chance: active.encounter.catchChance })}</span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/8">
                        <div className="h-full rounded-full" style={{ width: `${active.encounter.catchChance}%`, background: `linear-gradient(90deg, ${activeBiome?.accent ?? "#64d98b"}, #ffffff)` }} />
                      </div>
                    </div>
                    <div className="mt-6 grid gap-2 sm:grid-cols-2">
                    <button disabled={pending || capturePhase !== "idle" || active.ballsRemaining <= 0} onClick={handleThrow} className="game-cta game-cta--primary min-h-12 disabled:opacity-45">
                      <Image src="/items/hd/safari-ball.png" alt="" width={24} height={24} className="game-cta__icon object-contain" />
                      <span className="game-cta__label">{pending ? t("working") : t("throwBall")}</span>
                    </button>
                    <button disabled={pending} onClick={() => run(() => skipSafariEncounter(locale))} className="min-h-12 rounded-xl border border-white/12 bg-white/5 px-5 text-sm font-black text-white/75 transition hover:bg-white/10 disabled:opacity-45">{t("leave")}</button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative min-h-[430px] overflow-hidden px-6 py-7">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_58%,rgba(250,204,21,0.11),transparent_30%),radial-gradient(circle_at_72%_45%,rgba(232,121,249,0.08),transparent_36%)]" />
                <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                <div className="relative z-10 mx-auto grid min-h-[370px] max-w-3xl items-center gap-2 md:grid-cols-[230px_minmax(0,1fr)] md:gap-8">
                  <div className="relative mx-auto h-[190px] w-[190px] md:h-[280px] md:w-[230px]" aria-hidden="true">
                    <div className="absolute inset-[18%] rounded-full bg-yellow-300/12 blur-3xl" />
                    <div className="absolute inset-x-[20%] bottom-[3%] h-[8%] rounded-[50%] bg-black/75 blur-lg" />
                    <div className="safari-search-guide absolute inset-0">
                      <Image
                        src="/safari/pikachu-intro.png"
                        alt=""
                        fill
                        priority
                        sizes="(min-width: 768px) 230px, 190px"
                        className="object-contain drop-shadow-[0_22px_22px_rgba(0,0,0,0.55)]"
                      />
                    </div>
                  </div>
                  <div className="max-w-md text-center md:text-left">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: activeBiome?.accent }}>{t("trailTitle")}</p>
                    <h3 className="page-title mt-2 text-2xl leading-tight text-white md:text-[2rem]">{t("searchTitle")}</h3>
                    <p className="mt-2 text-sm leading-6 text-white/55">{t("searchDescription")}</p>
                    <button disabled={pending || active.encountersUsed >= active.encountersMax} onClick={() => run(() => searchSafariEncounter(locale))} className="game-cta game-cta--primary mt-5 min-h-12 w-full disabled:opacity-45">
                      <span className="game-cta__icon material-symbols-outlined">footprint</span>
                      <span className="game-cta__label">{pending ? t("working") : t("search")}</span>
                    </button>
                    <button disabled={pending} onClick={() => setConfirmFinish(true)} className="mt-3 text-xs font-bold text-white/45 underline-offset-4 hover:text-white hover:underline">{t("finishEarly")}</button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <aside className="overflow-hidden rounded-[22px] border border-white/10 bg-surface-container-low">
            <div className="p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/45">{t("runProgress")}</p>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/8"><div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-300" style={{ width: `${(active.encountersUsed / active.encountersMax) * 100}%` }} /></div>
              <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                <SmallStat value={active.encountersUsed} label={t("seen")} />
                <SmallStat value={active.catches} label={t("captures")} />
                <SmallStat value={active.ballsRemaining} label={t("balls")} />
              </div>
            </div>
            <div className="border-t border-white/8 p-5">
              <div className="flex items-center justify-between gap-3"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/45">{t("currentReward")}</p><span className="page-title text-2xl text-white">{rewardProgress?.rank}</span></div>
              <div className="mt-2 flex items-end justify-between gap-3"><div><p className="font-mono text-xl font-black text-emerald-300">{active.bestScore} pts</p><p className="mt-1 text-xs text-white/42">{rewardProgress?.next ? t("nextRank", { points: rewardProgress.pointsRemaining, rank: rewardProgress.next.rank }) : t("maxRank")}</p></div><div className="text-right font-mono text-sm font-black"><p className="text-amber-300">+{rewardProgress?.reward.coins ?? 0} ●</p>{rewardProgress?.reward.gems ? <p className="text-fuchsia-300">+{rewardProgress.reward.gems} ◆</p> : null}</div></div>
            </div>
            <div className="border-t border-white/8 p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/45">{t("bestCatch")}</p>
              {active.best ? <BestCatch best={active.best} score={active.bestScore} /> : <p className="mt-4 text-sm text-white/45">{t("noBest")}</p>}
            </div>
            <div className="border-t border-white/8 px-5 py-4 text-xs leading-5 text-white/46">
              <span className="material-symbols-outlined mr-2 align-middle text-[16px]! text-amber-300">lightbulb</span>{t("tip")}
            </div>
          </aside>
        </section>
      ) : (
        <section className="mt-5">
          {data.lastRun ? <LastResult run={data.lastRun} /> : null}
          <div className="mt-5 text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">{t("chooseEyebrow")}</p>
            <h2 className="mt-1 text-2xl font-black text-white">{t("chooseBiome")}</h2>
            <p className="mt-2 text-xs text-white/45">{t("weeklyLimit", { count: data.attemptsMax })}</p>
          </div>
          <div
            ref={biomeCarouselRef}
            onScroll={syncBiomeFromCarousel}
            className="no-scrollbar mt-4 flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain md:mt-8 md:grid md:grid-cols-3 md:gap-x-7 md:overflow-visible lg:gap-x-10"
          >
            {data.biomes.map((biome, index) => {
              const selected = selectedBiome === biome.id;
              const artwork = SAFARI_ARTWORK_BY_BIOME[biome.id];
              return (
                <button
                  key={biome.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setSelectedBiome(biome.id)}
                  className={`safari-biome-option group relative flex w-full shrink-0 snap-center flex-col items-center text-center outline-none transition duration-500 md:w-auto md:shrink md:[scroll-snap-align:none] ${selected ? "is-selected" : "opacity-70 hover:opacity-100"}`}
                  style={{ "--safari-biome-accent": biome.accent } as CSSProperties}
                >
                  <div className="relative h-[205px] w-full sm:h-[220px] lg:h-[245px]">
                    <div className="safari-biome-option__aura absolute inset-[16%] rounded-full blur-3xl" />
                    <div className="safari-biome-option__shadow absolute inset-x-[15%] bottom-[4%] h-[10%] rounded-[50%] bg-black/80 blur-xl" />
                    {artwork ? (
                      <div
                        className="safari-zone-artwork absolute inset-0"
                        style={{ animationDelay: `${index * -1.35}s` }}
                      >
                        <Image
                          src={artwork}
                          alt=""
                          fill
                          priority
                          sizes="(min-width: 1024px) 350px, (min-width: 768px) 30vw, 92vw"
                          className="object-contain drop-shadow-[0_22px_20px_rgba(0,0,0,0.62)] transition duration-500 group-hover:scale-[1.035]"
                        />
                      </div>
                    ) : null}
                  </div>
                  <h3
                    className="page-title safari-biome-option__name -mt-1 bg-clip-text text-[clamp(1.15rem,2vw,1.5rem)] leading-none text-transparent drop-shadow-[0_4px_12px_rgba(0,0,0,0.72)]"
                    style={{ backgroundImage: `linear-gradient(135deg, #ffffff 8%, ${biome.accent} 55%, #ffffff 118%)` }}
                  >
                    {t(`biomes.${biome.id}.name`)}
                  </h3>
                  <p className="mt-1 font-mono text-[10px] font-black uppercase tracking-[0.16em] text-white/38">Lv. {biome.levelMin}–{biome.levelMax}</p>
                  <div className="mt-3 flex max-w-full flex-wrap justify-center -space-x-1.5 px-2">
                    {biome.species.map((species) => (
                      <span key={species.id} className="relative h-10 w-10 rounded-full border border-white/12 bg-black/35 transition duration-300 group-hover:-translate-y-0.5">
                        <Image src={species.spriteUrl} alt="" fill sizes="40px" className="object-contain p-1" unoptimized />
                      </span>
                    ))}
                  </div>
                  <span className={`mt-3 hidden h-1 rounded-full transition-all duration-500 md:block ${selected ? "w-16 opacity-100" : "w-0 opacity-0"}`} style={{ background: biome.accent, boxShadow: `0 0 16px ${biome.accent}` }} />
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex items-center justify-center gap-2 md:hidden" aria-label={t("chooseBiome")}>
            {data.biomes.map((biome, index) => {
              const selected = selectedBiome === biome.id;
              return (
                <button
                  key={biome.id}
                  type="button"
                  aria-label={t(`biomes.${biome.id}.name`)}
                  aria-current={selected ? "true" : undefined}
                  onClick={() => scrollToBiome(index)}
                  className={`h-1.5 rounded-full transition-[width,opacity] duration-300 ${selected ? "w-7 opacity-100" : "w-1.5 bg-white/25 opacity-70"}`}
                  style={selected ? { background: biome.accent, boxShadow: `0 0 10px ${biome.accent}` } : undefined}
                />
              );
            })}
          </div>
          <div className="mt-4 flex justify-center md:mt-5">
            <button disabled={pending || data.attemptsRemaining <= 0} onClick={() => run(() => startSafariRun(locale, selectedBiome))} className="game-cta game-cta--safari min-h-13 w-full max-w-md disabled:opacity-45"><span className="game-cta__label">{data.attemptsRemaining <= 0 ? t("noAttempts") : pending ? t("working") : t("start")}</span></button>
          </div>
        </section>
      )}

      <section className="mt-6 rounded-[22px] border border-white/10 bg-surface-container-low p-4 sm:p-5">
        <div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-fuchsia-300">{t("rankingEyebrow")}</p><h2 className="mt-1 text-xl font-black text-white">{t("rankingTitle")}</h2></div>
        {data.playerRank ? <p className="mt-2 text-xs font-semibold text-white/48">{t("yourRank", { position: data.playerRank.position, score: data.playerRank.score })}</p> : null}
        {data.leaderboard.length ? (
          <div className="mt-4 overflow-hidden sm:mt-5 sm:overflow-x-auto">
            <table className="w-full table-fixed border-collapse text-left sm:min-w-[30rem] sm:table-auto">
              <colgroup><col className="w-10 sm:w-16" /><col /><col className="w-13 sm:w-32" /><col className="w-14 sm:w-28" /></colgroup>
              <thead><tr className="border-b border-white/10 text-[7px] font-black uppercase tracking-[0.08em] text-white/32 sm:text-[9px] sm:tracking-[0.16em]"><th className="py-2 pr-1 sm:px-2">{t("rankPosition")}</th><th className="px-1 py-2 sm:px-2">{t("rankTrainer")}</th><th className="px-1 py-2 text-center sm:px-2">{t("rankCatch")}</th><th className="py-2 pl-1 text-right sm:px-2">{t("rankScore")}</th></tr></thead>
              <tbody className="divide-y divide-white/7">{data.leaderboard.map((row) => {
                const avatar = avatarById(row.avatarId);
                return <tr key={`${row.rank}-${row.username}`} className="transition-colors hover:bg-white/3"><td className={`py-3 pr-1 font-mono text-xs font-black sm:px-2 sm:text-sm ${row.rank <= 3 ? "text-amber-300" : "text-white/38"}`}>#{row.rank}</td><td className="min-w-0 px-1 py-3 sm:px-2"><div className="flex min-w-0 items-center gap-1.5 sm:gap-3"><TrainerAvatar name={row.username} src={avatar?.src ?? null} size="xs" framed={false} className="sm:h-11 sm:w-11" /><span className="min-w-0 truncate text-[11px] font-bold text-white sm:text-sm">{row.username}</span></div></td><td className="px-1 py-2 sm:px-2"><div className="mx-auto flex w-fit items-center">{row.speciesId && row.speciesSpriteUrl ? <span className="relative h-9 w-9 sm:h-12 sm:w-12"><SafariSprite species={{ id: row.speciesId, spriteUrl: row.speciesSpriteUrl, isShiny: row.isShiny }} sizes="(min-width: 640px) 48px, 36px" className="object-contain" /></span> : <span className="text-white/25">—</span>}{row.isShiny ? <span className="text-[9px] text-yellow-300 sm:text-xs">✦</span> : null}</div></td><td className="py-3 pl-1 text-right font-mono text-[11px] font-black text-emerald-300 sm:px-2 sm:text-sm">{row.score}</td></tr>;
              })}</tbody>
            </table>
          </div>
        ) : <p className="py-5 text-center text-sm text-white/40">{t("rankingEmpty")}</p>}
      </section>

      {confirmFinish && active && rewardProgress ? <ConfirmFinishDialog encountersRemaining={Math.max(0, active.encountersMax - active.encountersUsed)} reward={rewardProgress.reward} onCancel={() => setConfirmFinish(false)} onConfirm={handleFinish} pending={pending} /> : null}
      {finishedRunId && data.lastRun?.id === finishedRunId ? <SafariRunSummary run={data.lastRun} playerRank={data.playerRank} onClose={() => setFinishedRunId(null)} /> : null}
    </main>
  );
}

function Metric({ icon, imageSrc, value, label }: { icon?: string; imageSrc?: string; value: string; label: string }) { return <div className="flex min-w-0 flex-col items-center gap-1 text-center md:inline-flex md:flex-row md:gap-2 md:text-left">{imageSrc ? <Image src={imageSrc} alt="" width={30} height={30} className="h-6 w-6 shrink-0 object-contain drop-shadow-[0_3px_5px_rgba(0,0,0,0.45)] md:h-7 md:w-7" /> : <span className="material-symbols-outlined text-[18px]! text-emerald-300">{icon}</span>}<div className="min-w-0"><p className="truncate font-mono text-[10px] font-black text-white md:text-xs">{value}</p><p className="truncate text-[8px] font-bold uppercase tracking-wider text-white/40 md:text-[9px]">{label}</p></div></div>; }
function SmallStat({ value, label }: { value: number; label: string }) { return <div className="px-1 py-1"><p className="font-mono text-lg font-black text-white">{value}</p><p className="text-[9px] font-bold uppercase tracking-wider text-white/35">{label}</p></div>; }
function BestCatch({ best, score }: { best: { id: number; name: string; spriteUrl: string; level: number; isShiny: boolean }; score: number }) { return <div className="mt-3 flex items-center gap-3"><span className="relative h-16 w-16 shrink-0"><SafariSprite species={best} sizes="64px" className="object-contain p-1" /></span><div className="min-w-0"><p className="truncate font-bold text-white">{displayName(best.name)} {best.isShiny ? <span className="text-yellow-300">✦</span> : null}</p><p className="text-xs text-white/45">Lv. {best.level}</p><p className="mt-1 font-mono text-lg font-black text-emerald-300">{score} pts</p></div></div>; }
function LastResult({ run }: { run: NonNullable<SafariViewData["lastRun"]> }) {
  const t = useTranslations("safari");
  return (
    <div className="rounded-[22px] border border-white/10 bg-surface-container-low px-4 py-4 sm:px-5">
      <div className="grid grid-cols-2 items-stretch gap-y-3 sm:grid-cols-[minmax(0,1fr)_minmax(210px,0.8fr)_auto] sm:items-center sm:gap-6">
        <div className="col-span-2 min-w-0 sm:col-span-1">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/42">{t("lastResult")}</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className="font-mono text-xl font-black text-white">{run.bestScore} pts</p>
            <p className="text-xs text-white/42">{t("lastSummary", { catches: run.catches })}</p>
          </div>
        </div>
        {run.best ? (
          <div className="flex min-w-0 items-center gap-2.5 border-t border-white/8 pt-3 pr-3 sm:border-t-0 sm:border-l sm:pt-0 sm:pr-0 sm:pl-6">
            <span className="relative h-12 w-12 shrink-0 sm:h-14 sm:w-14">
              <SafariSprite species={run.best} sizes="56px" className="object-contain" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white">{displayName(run.best.name)} {run.best.isShiny ? <span className="text-yellow-300">✦</span> : null}</p>
              <p className="mt-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-white/38">Lv. {run.best.level}</p>
            </div>
          </div>
        ) : <div />}
        <div className="border-t border-l border-white/8 pt-3 pl-3 text-right sm:border-t-0 sm:pt-0 sm:pl-6">
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/38">{t("reward")}</p>
          <div className="mt-1 flex gap-3 font-mono text-sm font-black sm:justify-end">
            <span className="text-amber-300">+{run.rewardCoins} ●</span>
            {run.rewardGems ? <span className="text-fuchsia-300">+{run.rewardGems} ◆</span> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function SafariSprite({ species, sizes, className }: { species: { id: number; spriteUrl: string; isShiny: boolean }; sizes: string; className: string }) {
  const [failed, setFailed] = useState(false);
  const fallback = `/safari/species/${species.id}.png`;
  return <Image src={failed ? fallback : species.spriteUrl} alt="" fill sizes={sizes} className={className} unoptimized onError={() => setFailed(true)} />;
}

function ConfirmFinishDialog({ encountersRemaining, reward, pending, onCancel, onConfirm }: { encountersRemaining: number; reward: { coins: number; gems: number }; pending: boolean; onCancel: () => void; onConfirm: () => void }) {
  const t = useTranslations("safari");
  return <div className="fixed inset-0 z-70 grid place-items-center bg-black/72 px-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="safari-finish-title"><div className="w-full max-w-md rounded-[24px] border border-white/12 bg-[#17191f] p-6 shadow-2xl"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">{t("finishConfirmEyebrow")}</p><h2 id="safari-finish-title" className="page-title mt-2 text-2xl text-white">{t("finishConfirmTitle")}</h2><p className="mt-3 text-sm leading-6 text-white/58">{t("finishConfirmBody", { encounters: encountersRemaining })}</p><div className="mt-4 flex gap-5 font-mono text-sm font-black"><span className="text-amber-300">+{reward.coins} ●</span>{reward.gems ? <span className="text-fuchsia-300">+{reward.gems} ◆</span> : null}</div><div className="mt-6 grid gap-2 sm:grid-cols-2"><button type="button" disabled={pending} onClick={onCancel} className="min-h-11 rounded-xl border border-white/12 bg-white/5 text-sm font-bold text-white/70">{t("cancel")}</button><button type="button" disabled={pending} onClick={onConfirm} className="game-cta game-cta--primary min-h-11"><span className="game-cta__label">{pending ? t("working") : t("finishConfirm")}</span></button></div></div></div>;
}

function SafariRunSummary({ run, playerRank, onClose }: { run: NonNullable<SafariViewData["lastRun"]>; playerRank: SafariViewData["playerRank"]; onClose: () => void }) {
  const t = useTranslations("safari");
  return <div className="fixed inset-0 z-70 grid place-items-center overflow-y-auto bg-black/78 px-4 py-8 backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby="safari-summary-title"><div className="relative w-full max-w-xl overflow-hidden rounded-[28px] border border-emerald-300/22 bg-[radial-gradient(circle_at_50%_0%,rgba(52,211,153,0.16),transparent_38%),#14171b] p-6 text-center shadow-2xl sm:p-8"><p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-300">{t("summaryEyebrow")}</p><div className="page-title mx-auto mt-3 grid h-16 w-16 place-items-center rounded-full border border-white/12 bg-black/30 text-4xl text-white">{run.rank}</div><h2 id="safari-summary-title" className="page-title mt-3 text-3xl text-white">{t("summaryTitle")}</h2><p className="mt-2 font-mono text-xl font-black text-emerald-300">{run.bestScore} pts</p>{run.best ? <div className="mx-auto mt-4 w-fit"><BestCatch best={run.best} score={run.bestScore} /></div> : null}<div className="mt-5 flex flex-wrap justify-center gap-2">{run.captured.map((pokemon, index) => <span key={`${pokemon.id}-${index}`} className="relative h-12 w-12" title={`${displayName(pokemon.name)} Lv. ${pokemon.level}`}><SafariSprite species={pokemon} sizes="48px" className="object-contain" /></span>)}</div><p className="mt-3 text-xs text-white/45">{t("summaryCaptured", { count: run.catches })}</p><div className="mt-5 flex justify-center gap-6 font-mono font-black"><span className="text-amber-300">+{run.rewardCoins} ●</span>{run.rewardGems ? <span className="text-fuchsia-300">+{run.rewardGems} ◆</span> : null}</div>{playerRank ? <p className="mt-3 text-sm font-semibold text-white/55">{t("yourRank", { position: playerRank.position, score: playerRank.score })}</p> : null}<button type="button" onClick={onClose} className="game-cta game-cta--primary mx-auto mt-6 max-w-xs"><span className="game-cta__label">{t("continue")}</span></button></div></div>;
}
