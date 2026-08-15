"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useTransition } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import {
  claimWeeklyRaidReward,
  startWeeklyRaidBattle,
  type RaidActionResult,
} from "@/actions/weekly-raid";
import { PokemonImage } from "@/components/pokemon-image";
import { TrainerAvatar } from "@/components/trainer-avatar";
import { avatarById } from "@/lib/avatars";
import { seedPendingCoinDelta } from "@/lib/coin-fx";
import { showToast } from "@/lib/app-toast";
import { RewardList } from "@/components/events/reward-chip";
import { ClanEmblemBadge } from "@/components/clans/clan-emblem-badge";
import { typeColor } from "@/lib/type-colors";
import {
  RAID_ATTEMPTS_PER_WEEK,
  RAID_CLAN_BONUS_COINS,
  RAID_COMMUNITY_BONUS,
  RAID_RECOMMENDED_LEVEL,
  RAID_REWARD,
  RAID_TURNS_PER_ATTEMPT,
  raidBossBattleHp,
} from "@/lib/raids/config";
import type { RewardDef } from "@/lib/events/rewards";

type RaidLeader = {
  position: number;
  userId: string;
  username: string;
  avatarId: string | null;
  country: string;
  damage: number;
};

type LadderEntry = {
  speciesId: number;
  name: string;
  spriteUrl: string;
  level: number;
  accent: string;
  step: number;
};

type RaidData = {
  resetsAt: string;
  boss: {
    speciesId: number;
    name: string;
    spriteUrl: string;
    types: string[];
    level: number;
    accent: string;
  };
  /** Escalera completa de legendarios, en orden. */
  ladder: LadderEntry[];
  /** Escalón vigente dentro del ciclo (no el número de semana). */
  ladderStep: number;
  /** Nivel del Pokémon más alto del equipo activo (aviso de nivel recomendado). */
  teamTopLevel: number;
  score: {
    attemptsUsed: number;
    totalDamage: number;
    bestDamage: number;
    rewardClaimedAt: Date | null;
  };
  attemptsLeft: number;
  communityDamage: number;
  communityHp: number;
  communityDefeated: boolean;
  leaders: RaidLeader[];
  /** Tu fila si quedaste fuera del top; null si ya estás en la lista. */
  myRow: RaidLeader | null;
  clans: {
    id: string;
    name: string;
    tag: string;
    emblem: unknown;
    damage: number;
    members: number;
  }[];
  userClanId: string | null;
};

export function WeeklyRaidBoard({
  data,
  locale,
  userId,
}: {
  data: RaidData;
  locale: string;
  userId: string;
}) {
  const t = useTranslations("raids");
  const [pending, startTransition] = useTransition();
  const communityPct = Math.min(
    100,
    Math.round((data.communityDamage / data.communityHp) * 100),
  );
  // Sólo informativo: la incursión no se bloquea por nivel, pero avisa antes de
  // que el jugador gaste un intento contra un legendario de Nv.50+.
  const underLevelled = data.teamTopLevel < RAID_RECOMMENDED_LEVEL;
  const nextStep = data.ladder[(data.ladderStep + 1) % data.ladder.length];
  // Referencia para la barra de proporción de cada fila: el puntero de la tabla.
  const topLeaderDamage = data.leaders[0]?.damage ?? 0;
  const topClanDamage = data.clans[0]?.damage ?? 0;

  // `void`: la acción termina en `redirect()` a /battle, así que no hay
  // resultado que procesar salvo cuando falla la validación.
  function handle(result: RaidActionResult | void) {
    if (!result || result.ok) {
      if (result?.ok && result.coins) seedPendingCoinDelta(result.coins);
      return;
    }
    showToast(t(`errors.${result.error}`), result.error === "busy" ? "info" : "error");
  }

  return (
    <div className="raid-page" style={{ "--raid-accent": data.boss.accent } as CSSProperties}>
      <section className="raid-hero">
        <div className="raid-hero__aura" aria-hidden />
        <div className="raid-hero__top">
          <div className="min-w-0">
            <p className="raid-hero__eyebrow">{t("eyebrow")}</p>
            <h1 className="page-title raid-hero__title">{t("title")}</h1>
            <p className="raid-hero__subtitle">{t("subtitle")}</p>
            <div className="raid-hero__stats">
              <StatChip label={t("attempts")} value={`${data.attemptsLeft}/${RAID_ATTEMPTS_PER_WEEK}`} />
              <StatChip label={t("yourDamage")} value={data.score.totalDamage.toLocaleString()} />
              <StatChip label={t("bestAttempt")} value={data.score.bestDamage.toLocaleString()} />
              <StatChip
                label={t("resets")}
                value={new Intl.DateTimeFormat(locale, {
                  weekday: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(new Date(data.resetsAt))}
              />
            </div>
          </div>

          <figure className="raid-hero__portrait">
            <span className="raid-hero__glow" aria-hidden />
            <PokemonImage
              src={data.boss.spriteUrl}
              speciesId={data.boss.speciesId}
              speciesName={data.boss.name}
              alt={data.boss.name}
              width={240}
              height={240}
              className="raid-hero__sprite"
            />
          </figure>
        </div>

        <div className="raid-hero__body">
          {/*
            Identidad del jefe en una sola línea: nombre, nivel y tipos. Los
            tipos vivían sueltos bajo el sprite y el HP/turnos en un `dl`
            aparte, o sea dos bloques más dentro de una card que ya estaba
            llena. Los números de la pelea se dicen una sola vez, en la línea
            de abajo.
          */}
          <div className="raid-boss-line">
            <p className="raid-boss-line__label">{t("weeklyBoss")}</p>
            <h2 className="raid-boss-line__name">
              {data.boss.name}
              <span className="raid-boss-line__level">Lv. {data.boss.level}</span>
              <span className="raid-boss-line__types">
                {data.boss.types.map((type) => (
                  <span
                    key={type}
                    className="raid-type-pill"
                    style={{ "--type-color": typeColor(type) } as CSSProperties}
                  >
                    {type}
                  </span>
                ))}
              </span>
            </h2>
          </div>

          <div className={`raid-bar${data.communityDefeated ? " is-defeated" : ""}`}>
            <span className="raid-bar__track">
              <span className="raid-bar__fill" style={{ width: `${communityPct}%` }}>
                <span className="raid-bar__sheen" aria-hidden />
              </span>
            </span>
            <div className="raid-bar__legend">
              <span>{t("communityProgress", { percent: communityPct })}</span>
              <span className="raid-bar__count">
                {data.communityDamage.toLocaleString()} / {data.communityHp.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Desenlace de la barra: antes `communityDefeated` se calculaba en el
              loader y no lo leía nadie, así que llenarla entre todos no cambiaba
              nada en pantalla ni en el botín. */}
          {data.communityDefeated ? (
            <div className="raid-victory" role="status">
              <span className="raid-victory__shine" aria-hidden />
              <span className="raid-victory__medal" aria-hidden>
                <span className="material-symbols-outlined">trophy</span>
              </span>
              <span className="min-w-0">
                <strong className="raid-victory__title">
                  {t("communityDownTitle", { name: capitalizeName(data.boss.name) })}
                </strong>
                <span className="raid-victory__body">{t("communityDownBody")}</span>
              </span>
            </div>
          ) : null}

          {/* Única línea con las reglas del intento. Antes los turnos se decían
              dos veces (acá y en un `dl` al lado del jefe) y el HP vivía en ese
              mismo bloque suelto. */}
          <p className="raid-hint">
            <span className="material-symbols-outlined" aria-hidden>
              swords
            </span>
            {t("battleHint", {
              turns: RAID_TURNS_PER_ATTEMPT,
              hp: raidBossBattleHp(data.boss.level).toLocaleString(),
            })}
          </p>
          {underLevelled ? (
            <p className="raid-hint raid-hint--warn">
              <span className="material-symbols-outlined" aria-hidden>
                warning
              </span>
              {t("underLevelled", { level: RAID_RECOMMENDED_LEVEL })}
            </p>
          ) : null}

          <button
            type="button"
            disabled={pending || data.attemptsLeft <= 0}
            onClick={() => startTransition(async () => handle(await startWeeklyRaidBattle(locale)))}
            className="game-cta game-cta--red raid-cta"
          >
            {pending ? t("attacking") : data.attemptsLeft > 0 ? t("attack") : t("noAttempts")}
          </button>
        </div>
      </section>

      <LadderRail ladder={data.ladder} current={data.ladderStep} nextLevel={nextStep?.level ?? 0} />

      <section className="raid-columns">
        <div className="raid-card">
          <header className="raid-card__head">
            <div>
              <p className="raid-card__eyebrow raid-card__eyebrow--secondary">
                {t("rankingEyebrow")}
              </p>
              <h2 className="raid-card__title">{t("ranking")}</h2>
            </div>
            <span className="material-symbols-outlined text-secondary" aria-hidden>
              leaderboard
            </span>
          </header>
          {data.leaders.length ? (
            <ol className="raid-leaders">
              {data.leaders.map((row) => (
                <LeaderRow
                  key={row.userId}
                  row={row}
                  isYou={row.userId === userId}
                  top={topLeaderDamage}
                />
              ))}
              {/* Fuera del top: tu fila se ancla al pie, con un corte que deja
                  claro que hay puestos en el medio que no se listan. */}
              {data.myRow ? (
                <li className="raid-leaders__gap" aria-hidden>
                  <span />
                </li>
              ) : null}
              {data.myRow ? (
                <LeaderRow row={data.myRow} isYou top={topLeaderDamage} />
              ) : null}
            </ol>
          ) : (
            <EmptyState icon="swords" text={t("emptyRanking")} />
          )}
        </div>

        <div className="raid-side">
          <div className="raid-card">
            <header className="raid-card__head">
              <div>
                <p className="raid-card__eyebrow">{t("clansEyebrow")}</p>
                <h2 className="raid-card__title raid-card__title--sm">{t("clans")}</h2>
              </div>
              <span className="material-symbols-outlined text-primary" aria-hidden>
                groups
              </span>
            </header>
            {data.clans.length ? (
              <ol className="raid-clans">
                {data.clans.map((clan, index) => (
                  <li
                    key={clan.id}
                    className={`raid-row raid-row--clan${index < 3 ? ` is-rank-${index + 1}` : ""}${
                      clan.id === data.userClanId ? " is-you" : ""
                    }`}
                    style={
                      { "--share": `${shareOf(clan.damage, topClanDamage)}%` } as CSSProperties
                    }
                  >
                    <span className="raid-row__share" aria-hidden />
                    <span className="raid-row__rank">{index + 1}</span>
                    {/* El emblema real del clan, no un ícono genérico: es lo que
                        identifica al clan en el resto del juego. */}
                    <ClanEmblemBadge
                      emblem={clan.emblem}
                      size={32}
                      title={clan.name}
                      className="raid-row__emblem"
                    />
                    <span className="min-w-0">
                      <span className="raid-row__name">{clan.name}</span>
                      <span className="raid-row__meta">
                        [{clan.tag}] · {t("clanMembers", { count: clan.members })}
                      </span>
                    </span>
                    <span className="raid-row__value">{clan.damage.toLocaleString()}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState icon="groups" text={t("emptyClans")} compact />
            )}
          </div>

          <RewardCard
            attemptsUsed={data.score.attemptsUsed}
            claimedAt={data.score.rewardClaimedAt}
            inClan={data.userClanId != null}
            communityDefeated={data.communityDefeated}
            pending={pending}
            onClaim={() => startTransition(async () => handle(await claimWeeklyRaidReward(locale)))}
          />
        </div>
      </section>
    </div>
  );
}

/**
 * Escalera de jefes.
 *
 * La progresión (Kanto Nv.50 → Johto Nv.100) vivía sólo en la config: en
 * pantalla el jugador veía un legendario suelto y no había forma de saber que
 * había una escalera detrás, ni contra qué le va a tocar en cinco semanas. El
 * rail la hace visible de un vistazo: lo ya pasado se apaga, lo vigente se
 * ilumina con su color y lo que viene queda a la vista con su nivel.
 */
function LadderRail({
  ladder,
  current,
  nextLevel,
}: {
  ladder: LadderEntry[];
  current: number;
  /** Sólo el nivel: el nombre del próximo jefe es parte de lo que se oculta. */
  nextLevel: number;
}) {
  const t = useTranslations("raids");
  const railRef = useRef<HTMLOListElement>(null);

  /*
    En mobile el rail scrollea, así que el escalón vigente puede quedar fuera
    de cuadro (en la semana 9 arrancarías viendo sólo siluetas). Se centra a
    mano con `scrollLeft` en vez de `scrollIntoView`: éste último también
    mueve el scroll vertical de la página al montar.
  */
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const step = rail.querySelector<HTMLElement>('[data-current="true"]');
    if (!step) return;
    rail.scrollLeft = step.offsetLeft - rail.clientWidth / 2 + step.clientWidth / 2;
  }, [current]);

  return (
    <section className="raid-ladder" aria-label={t("ladder")}>
      <header className="raid-ladder__head">
        <div>
          <p className="raid-card__eyebrow raid-card__eyebrow--secondary">{t("ladderEyebrow")}</p>
          <h2 className="raid-card__title raid-card__title--sm">{t("ladder")}</h2>
        </div>
        <span className="raid-ladder__next">{t("nextUp", { level: nextLevel })}</span>
      </header>
      <ol className="raid-ladder__rail" ref={railRef}>
        {ladder.map((entry) => {
          const state =
            entry.step < current ? "is-past" : entry.step === current ? "is-current" : "is-future";
          /*
            Los que todavía no aparecieron van en silueta y sin nombre: la
            gracia de la escalera es que se sepa que sube de nivel, no contra
            qué legendario toca en la semana 9. El `alt` también se oculta, si
            no un lector de pantalla canta el nombre que la silueta esconde.
          */
          const hidden = state === "is-future";
          return (
            <li
              key={entry.speciesId}
              className={`raid-step ${state}`}
              style={{ "--step-accent": entry.accent } as CSSProperties}
              aria-current={entry.step === current ? "step" : undefined}
              data-current={entry.step === current ? "true" : undefined}
            >
              <span className="raid-step__art">
                <PokemonImage
                  src={entry.spriteUrl}
                  speciesId={entry.speciesId}
                  speciesName={entry.name}
                  alt={hidden ? "" : entry.name}
                  /* 96 y no 64: el arte se dibuja a 3.4rem (~54px) y en
                     pantallas 2× un sprite de 64 se ve blando al escalar. */
                  width={96}
                  height={96}
                  className="raid-step__sprite"
                />
              </span>
              <span className="raid-step__name">{hidden ? "???" : entry.name}</span>
              <span className="raid-step__level">Nv. {entry.level}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function LeaderRow({
  row,
  isYou,
  top,
}: {
  row: RaidLeader;
  isYou: boolean;
  top: number;
}) {
  const avatar = avatarById(row.avatarId);
  return (
    <li
      className={`raid-row${row.position <= 3 ? ` is-rank-${row.position}` : ""}${
        isYou ? " is-you" : ""
      }`}
      style={{ "--share": `${shareOf(row.damage, top)}%` } as CSSProperties}
    >
      <span className="raid-row__share" aria-hidden />
      <span className="raid-row__rank">{row.position}</span>
      <TrainerAvatar name={row.username} src={avatar?.src ?? null} size="xs" />
      <span className="min-w-0">
        <span className="raid-row__name">{row.username}</span>
      </span>
      <span className="raid-row__value">{row.damage.toLocaleString()}</span>
    </li>
  );
}

function EmptyState({
  icon,
  text,
  compact,
}: {
  icon: string;
  text: string;
  compact?: boolean;
}) {
  return (
    <p className={`raid-empty${compact ? " raid-empty--compact" : ""}`}>
      <span className="material-symbols-outlined" aria-hidden>
        {icon}
      </span>
      {text}
    </p>
  );
}

/**
 * Los nombres de especie llegan en minúscula desde PokeAPI. En el resto de la
 * app se capitalizan por CSS, pero acá el nombre va **dentro de una frase**, y
 * `text-transform: capitalize` la afectaba entera.
 */
function capitalizeName(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Proporción de la fila respecto del puntero, para la barra de fondo.
 * Con un piso del 6% para que el último de la tabla no quede sin nada visible.
 */
function shareOf(value: number, top: number): number {
  if (top <= 0) return 0;
  return Math.max(6, Math.min(100, Math.round((value / top) * 100)));
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="raid-stat">
      <span className="raid-stat__label">{label}</span>
      <strong className="raid-stat__value">{value}</strong>
    </span>
  );
}

/**
 * Premio semanal.
 *
 * Antes era una lista escrita a mano en `messages` ("750 monedas · 2 gemas ·
 * 3 Super Potion") que había que mantener sincronizada con `RAID_REWARD`. Ahora
 * se dibuja el bundle real con los mismos PNGs que el regalo diario, así que el
 * jugador ve lo que se lleva y no hay dos fuentes de verdad.
 */
function RewardCard({
  attemptsUsed,
  claimedAt,
  inClan,
  communityDefeated,
  pending,
  onClaim,
}: {
  attemptsUsed: number;
  claimedAt: Date | null;
  inClan: boolean;
  /** Si la barra global cayó, el reclamo suma el bundle comunitario. */
  communityDefeated: boolean;
  pending: boolean;
  onClaim: () => void;
}) {
  const t = useTranslations("raids");
  const unitLabels = useTranslations("events.rewards");
  const labels = {
    coins: unitLabels("coins"),
    energy: unitLabels("energy"),
    gems: unitLabels("gems"),
  };
  const ready = attemptsUsed >= RAID_ATTEMPTS_PER_WEEK && !claimedAt;

  return (
    <div className={`raid-reward${ready ? " is-ready" : ""}`}>
      <header className="raid-reward__head">
        <div className="min-w-0">
          <p className="raid-reward__eyebrow">{t("rewardEyebrow")}</p>
          <h2 className="raid-reward__title">{t("reward")}</h2>
        </div>
        {/* Medidor de intentos: los tres puntitos de antes eran casi invisibles
            y no decían de cuántos. Segmentos + cifra se leen de un vistazo. */}
        <span
          className="raid-reward__meter"
          title={t("lockedReward", { current: attemptsUsed })}
          aria-label={t("lockedReward", { current: attemptsUsed })}
        >
          <span className="raid-reward__meter-label">{t("attempts")}</span>
          <span className="raid-reward__meter-bars" aria-hidden>
            {Array.from({ length: RAID_ATTEMPTS_PER_WEEK }).map((_, i) => (
              <span key={i} className={`raid-reward__seg${i < attemptsUsed ? " is-done" : ""}`} />
            ))}
          </span>
          <span className="raid-reward__meter-count">
            {attemptsUsed}/{RAID_ATTEMPTS_PER_WEEK}
          </span>
        </span>
      </header>

      {/* Una composición plana y compacta: los tres premios base y los dos
          comunitarios comparten una sola franja, sin otra card ni otra fila. */}
      <div className={`raid-reward__content${communityDefeated ? " has-community" : ""}`}>
        <section className="raid-reward__group">
          <ul className="raid-reward__grid">
            {RAID_REWARD.map((reward, index) => (
              <li key={`${reward.kind}-${index}`} className="raid-reward__tile">
                <RewardList rewards={[reward]} layout="strip" unitLabels={labels} />
                <span className="raid-reward__tile-name">{rewardName(reward, labels)}</span>
              </li>
            ))}
          </ul>
        </section>

        {communityDefeated ? (
          <section className="raid-reward__group raid-reward__group--community">
            <p className="raid-reward__divider">
              <span className="material-symbols-outlined" aria-hidden>
                trophy
              </span>
              {t("communityBonus")}
            </p>
            <ul className="raid-reward__grid raid-reward__grid--bonus">
              {RAID_COMMUNITY_BONUS.map((reward, index) => (
                <li key={`c-${reward.kind}-${index}`} className="raid-reward__tile">
                  <RewardList rewards={[reward]} layout="strip" unitLabels={labels} />
                  <span className="raid-reward__tile-name">{rewardName(reward, labels)}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      <footer className="raid-reward__footer">
        <p className={`raid-reward__bonus${inClan ? " is-active" : ""}`}>
          <span className="raid-reward__bonus-icon" aria-hidden>
            <Image src="/items/hd/poke-coin.png" alt="" width={18} height={18} unoptimized />
            {inClan ? <span className="material-symbols-outlined">check</span> : null}
          </span>
          {t("clanBonus", { coins: RAID_CLAN_BONUS_COINS })}
        </p>

        <button type="button" disabled={pending || !ready} onClick={onClaim} className="raid-reward__cta">
          {ready ? <span className="raid-reward__cta-shine" aria-hidden /> : null}
          <span className="raid-reward__cta-label">
            {claimedAt
              ? t("claimed")
              : ready
                ? t("claim")
                : t("lockedReward", { current: attemptsUsed })}
          </span>
        </button>
      </footer>
    </div>
  );
}

/** Etiqueta corta bajo cada PNG. Los ítems ya se muestran por su nombre canónico. */
function rewardName(
  reward: RewardDef,
  labels: { coins: string; energy: string; gems: string },
): string {
  if (reward.kind === "item") return reward.itemName;
  if (reward.kind === "coins") return labels.coins;
  if (reward.kind === "energy") return labels.energy;
  return labels.gems;
}
