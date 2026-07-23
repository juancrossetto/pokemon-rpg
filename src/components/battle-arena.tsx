"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { submitBattleMove } from "@/actions/battle-move";
import { fleeBattle } from "@/actions/flee-battle";
import { attemptCapture } from "@/actions/attempt-capture";
import { switchPokemon } from "@/actions/switch-pokemon";
import { applyBattleItem } from "@/actions/use-item";
import { StartEncounterButton } from "@/components/start-encounter-button";
import { PokeballIcon } from "@/components/pokeball-icon";
import { getTypeEffectiveness } from "@/lib/type-effectiveness";
import type { TurnEvent } from "@/lib/battle";

const LUNGE_MS = 320;
const IMPACT_MS = 480;
const STATUS_MS = 550;
const MISS_MS = 450;
const THROW_MS = 700;
const FAINT_MS = 650;
const RECALL_MS = 450;
const ITEM_USE_MS = 550;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface Combatant {
  name: string;
  level: number;
  spriteUrl: string;
}

interface PokeballStack {
  itemId: string;
  name: string;
  quantity: number;
}

interface PotionStack {
  itemId: string;
  name: string;
  quantity: number;
  healAmount: number;
}

interface RosterMember {
  instanceId: string;
  name: string;
  level: number;
  spriteUrl: string;
  currentHp: number;
  maxHp: number;
}

type View = "menu" | "moves" | "bag" | "team";
type Outcome = "ongoing" | "won" | "lost" | "fled" | "caught";

export interface BattleArenaProps {
  battleId: string;
  locale: string;
  player: Combatant & { instanceId: string; currentHp: number; maxHp: number };
  wild: Combatant & { currentHp: number; maxHp: number; types: string[] };
  moves: { moveId: number; name: string; type: string; pp: number }[];
  initialLog: string[];
  pokeballs: PokeballStack[];
  potions: PotionStack[];
  roster: RosterMember[];
}

export function BattleArena({
  battleId,
  locale,
  player,
  wild,
  moves,
  initialLog,
  pokeballs,
  potions,
  roster,
}: BattleArenaProps) {
  const t = useTranslations("battle");

  const [activePlayer, setActivePlayer] = useState({
    instanceId: player.instanceId,
    name: player.name,
    level: player.level,
    spriteUrl: player.spriteUrl,
  });
  const [playerHp, setPlayerHp] = useState(player.currentHp);
  const [playerMaxHp, setPlayerMaxHp] = useState(player.maxHp);
  const [wildHp, setWildHp] = useState(wild.currentHp);
  const [log, setLog] = useState(initialLog);
  const [attackingSide, setAttackingSide] = useState<"player" | "wild" | null>(null);
  const [shakingSide, setShakingSide] = useState<"player" | "wild" | null>(null);
  const [faintingSide, setFaintingSide] = useState<"player" | "wild" | null>(null);
  const [playerEntering, setPlayerEntering] = useState(false);
  const [ballAnim, setBallAnim] = useState<"recall" | "throw" | null>(null);
  const [playerHealing, setPlayerHealing] = useState(false);
  const [damagePopup, setDamagePopup] = useState<{ side: "player" | "wild"; text: string; key: number } | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>("ongoing");
  const [levelUpToast, setLevelUpToast] = useState<number | null>(null);
  const [view, setView] = useState<View>("menu");
  const [ballStacks, setBallStacks] = useState(pokeballs);
  const [potionStacks, setPotionStacks] = useState(potions);
  const [teamRoster, setTeamRoster] = useState(roster);
  const [mustSwitch, setMustSwitch] = useState(false);
  const [activeMoves, setActiveMoves] = useState(moves);

  const startErrors = {
    no_lead: t("errors.noLead"),
    fainted_lead: t("errors.faintedLead"),
    no_energy: t("errors.noEnergy"),
  };

  function appendLog(line: string) {
    setLog((prev) => [...prev.slice(-19), line]);
  }

  function nameFor(side: "player" | "wild") {
    return side === "player" ? activePlayer.name : wild.name;
  }

  function effectivenessInfo(moveType: string): { label: string; className: string } | null {
    const multiplier = getTypeEffectiveness(moveType, wild.types);
    if (multiplier === 0) return { label: t("noEffect"), className: "text-on-surface-variant" };
    if (multiplier > 1) return { label: t("superEffective"), className: "text-tertiary" };
    if (multiplier < 1) return { label: t("notVeryEffective"), className: "text-error" };
    return null;
  }

  function playEvent(event: TurnEvent): Promise<void> {
    return new Promise((resolve) => {
      setAttackingSide(event.side);
      setTimeout(() => {
        setAttackingSide(null);

        if (!event.hit) {
          appendLog(`${nameFor(event.side)} usó ${event.moveName} pero falló.`);
          setTimeout(resolve, MISS_MS);
          return;
        }

        if (event.isStatus) {
          appendLog(`${nameFor(event.side)} usó ${event.moveName}.`);
          setTimeout(resolve, STATUS_MS);
          return;
        }

        const defenderSide = event.side === "player" ? "wild" : "player";
        setShakingSide(defenderSide);
        setDamagePopup({ side: defenderSide, text: `-${event.damage}`, key: Date.now() });
        if (defenderSide === "wild") setWildHp(event.hpAfter);
        else setPlayerHp(event.hpAfter);

        appendLog(`${nameFor(event.side)} usó ${event.moveName} e hizo ${event.damage} de daño.`);
        if (event.effectiveness > 1) appendLog("¡Es súper efectivo!");
        else if (event.effectiveness > 0 && event.effectiveness < 1) appendLog("No es muy efectivo...");
        else if (event.effectiveness === 0) appendLog("No tuvo efecto...");

        setTimeout(() => {
          setShakingSide(null);
          resolve();
        }, IMPACT_MS);
      }, LUNGE_MS);
    });
  }

  async function playFaintAndFinish(side: "player" | "wild", finalOutcome: Outcome) {
    setFaintingSide(side);
    await delay(FAINT_MS);
    setOutcome(finalOutcome);
  }

  // El Pokémon activo se debilitó pero quedan otros con vida: los juegos
  // reales no terminan el combate acá, fuerzan a elegir un reemplazo. El
  // sprite se queda "caído" (no se limpia faintingSide) hasta que el
  // reemplazo entra, para no mostrar un parpadeo del sprite debilitado.
  async function playFaintThenForceSwitch() {
    setFaintingSide("player");
    await delay(FAINT_MS);
    setMustSwitch(true);
    setView("team");
  }

  async function handleMove(moveId: number) {
    if (isAnimating || outcome !== "ongoing" || mustSwitch) return;
    setIsAnimating(true);
    setView("menu");

    const result = await submitBattleMove(battleId, moveId, locale);
    if (!result) {
      setIsAnimating(false);
      return;
    }

    for (const event of result.events) {
      await playEvent(event);
    }

    setPlayerMaxHp(result.playerMaxHp);
    if (result.leveledUpTo) {
      setLevelUpToast(result.leveledUpTo);
      setTimeout(() => setLevelUpToast(null), 2200);
    }

    if (result.outcome === "won") {
      await playFaintAndFinish("wild", "won");
    } else if (result.outcome === "lost") {
      await playFaintAndFinish("player", "lost");
    } else if (result.outcome === "fainted") {
      await playFaintThenForceSwitch();
    }

    setIsAnimating(false);
  }

  async function handleFlee() {
    if (isAnimating || mustSwitch) return;
    setIsAnimating(true);
    await fleeBattle(battleId);
    setOutcome("fled");
    setIsAnimating(false);
  }

  async function handleThrowBall(itemId: string, ballName: string) {
    if (isAnimating || outcome !== "ongoing" || mustSwitch) return;
    setIsAnimating(true);
    setView("menu");
    appendLog(`¡Lanzaste ${ballName}!`);

    setBallStacks((prev) =>
      prev.map((b) => (b.itemId === itemId ? { ...b, quantity: b.quantity - 1 } : b)).filter((b) => b.quantity > 0),
    );

    await delay(THROW_MS);

    const result = await attemptCapture(battleId, itemId, locale);
    if (!result) {
      setIsAnimating(false);
      return;
    }

    if (result.caught) {
      appendLog(`¡Atrapaste a ${wild.name}!`);
      setOutcome("caught");
      setIsAnimating(false);
      return;
    }

    appendLog(`${wild.name} se liberó...`);
    if (result.counterAttack) {
      await playEvent(result.counterAttack);
    }
    if (result.outcome === "lost") {
      await playFaintAndFinish("player", "lost");
    } else if (result.outcome === "fainted") {
      await playFaintThenForceSwitch();
    }

    setIsAnimating(false);
  }

  async function handleUsePotion(itemId: string) {
    if (isAnimating || outcome !== "ongoing" || mustSwitch) return;
    setIsAnimating(true);
    setView("menu");

    setPotionStacks((prev) =>
      prev.map((p) => (p.itemId === itemId ? { ...p, quantity: p.quantity - 1 } : p)).filter((p) => p.quantity > 0),
    );

    setPlayerHealing(true);
    await delay(ITEM_USE_MS);
    setPlayerHealing(false);

    const result = await applyBattleItem(battleId, itemId, locale);
    if (!result) {
      setIsAnimating(false);
      return;
    }

    setPlayerHp(result.healedTo);
    appendLog(`Usaste ${result.itemName}. ${activePlayer.name} recuperó ${result.healedBy} HP.`);

    if (result.counterAttack) {
      await playEvent(result.counterAttack);
    }
    if (result.outcome === "lost") {
      await playFaintAndFinish("player", "lost");
    } else if (result.outcome === "fainted") {
      await playFaintThenForceSwitch();
    }

    setIsAnimating(false);
  }

  async function handleSwitchTo(member: RosterMember) {
    if (isAnimating || outcome !== "ongoing" || member.currentHp <= 0) return;
    setIsAnimating(true);
    setView("menu");

    const outgoing = activePlayer;
    const forced = mustSwitch;

    if (!forced) {
      setBallAnim("recall");
      await delay(RECALL_MS);
    }
    setBallAnim("throw");

    const result = await switchPokemon(battleId, member.instanceId, locale, forced);
    if (!result) {
      setIsAnimating(false);
      setBallAnim(null);
      return;
    }

    setBallAnim(null);
    setFaintingSide(null);
    appendLog(
      forced
        ? `${outgoing.name} no puede continuar. ¡Adelante, ${result.newPlayer.name}!`
        : `¡Volvé, ${outgoing.name}! ¡Adelante, ${result.newPlayer.name}!`,
    );

    setActivePlayer({
      instanceId: result.newPlayer.instanceId,
      name: result.newPlayer.name,
      level: result.newPlayer.level,
      spriteUrl: result.newPlayer.spriteUrl,
    });
    setPlayerHp(member.currentHp);
    setPlayerMaxHp(result.newPlayer.maxHp);
    setActiveMoves(result.newPlayer.moves);
    setTeamRoster((prev) => [
      ...prev.filter((m) => m.instanceId !== member.instanceId),
      { instanceId: outgoing.instanceId, name: outgoing.name, level: outgoing.level, spriteUrl: outgoing.spriteUrl, currentHp: playerHp, maxHp: playerMaxHp },
    ]);
    setPlayerEntering(true);
    setTimeout(() => setPlayerEntering(false), 400);
    if (forced) setMustSwitch(false);

    if (result.counterAttack) {
      await playEvent(result.counterAttack);
    }
    if (result.outcome === "lost") {
      await playFaintAndFinish("player", "lost");
    } else if (result.outcome === "fainted") {
      await playFaintThenForceSwitch();
    }

    setIsAnimating(false);
  }

  if (outcome !== "ongoing") {
    const resultText =
      outcome === "won"
        ? t("resultWon")
        : outcome === "lost"
          ? t("resultLost")
          : outcome === "caught"
            ? t("resultCaught")
            : t("resultFled");
    const resultColor =
      outcome === "won" || outcome === "caught"
        ? "text-tertiary"
        : outcome === "lost"
          ? "text-error"
          : "text-on-surface-variant";

    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-margin-mobile py-8 text-center">
        <p className={`text-body-lg ${resultColor}`}>{resultText}</p>
        {outcome === "lost" ? (
          <Link
            href="/team"
            className="rounded-lg bg-pokeball-red px-6 py-2 text-label-md text-white hover:bg-pokeball-red/80 transition-colors"
          >
            {t("goHeal")}
          </Link>
        ) : (
          <StartEncounterButton locale={locale} label={t("explore")} errors={startErrors} />
        )}
      </div>
    );
  }

  const hasBalls = ballStacks.length > 0;
  const hasPotions = potionStacks.length > 0;
  const hasHealthyBackup = teamRoster.some((m) => m.currentHp > 0);

  const playerSpriteClass = [
    "w-24 h-24 md:w-32 md:h-32 object-contain",
    attackingSide === "player" ? "sprite-lunge-right" : "",
    shakingSide === "player" ? "sprite-shake sprite-flash" : "",
    faintingSide === "player" ? "sprite-faint" : "",
    ballAnim === "recall" ? "sprite-recall" : "",
    playerEntering ? "sprite-enter" : "",
    playerHealing ? "sprite-heal" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const wildSpriteClass = [
    "w-24 h-24 md:w-32 md:h-32 object-contain scale-x-[-1]",
    attackingSide === "wild" ? "sprite-lunge-left" : "",
    shakingSide === "wild" ? "sprite-shake sprite-flash" : "",
    faintingSide === "wild" ? "sprite-faint" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex-1 px-margin-mobile md:px-margin-desktop py-6">
      <div className="mx-auto max-w-4xl">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <HpCard name={activePlayer.name} levelLabel={t("level", { level: activePlayer.level })} currentHp={playerHp} maxHp={playerMaxHp} labelHp={t("hp")} />
          <HpCard name={wild.name} levelLabel={t("level", { level: wild.level })} currentHp={wildHp} maxHp={wild.maxHp} labelHp={t("hp")} align="right" />
        </div>

        <div className="glass-panel rounded-xl border border-white/10 p-6 md:p-10 flex items-center justify-between gap-4 mb-4 relative overflow-hidden min-h-[180px]">
          {levelUpToast && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-tertiary/20 border border-tertiary/40 rounded-full px-4 py-1 text-label-sm text-tertiary z-10">
              {t("leveledUp", { level: levelUpToast })}
            </div>
          )}

          <div className="relative">
            {damagePopup?.side === "player" && (
              <span
                key={damagePopup.key}
                className="damage-popup absolute -top-4 left-1/2 -translate-x-1/2 text-headline-md text-error font-black z-10"
              >
                {damagePopup.text}
              </span>
            )}
            {activePlayer.spriteUrl && (
              <Image src={activePlayer.spriteUrl} alt={activePlayer.name} width={128} height={128} className={playerSpriteClass} />
            )}
            {ballAnim && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <PokeballIcon
                  className={`w-10 h-10 drop-shadow-[0_0_8px_rgba(238,21,21,0.6)] ${
                    ballAnim === "throw" ? "pokeball-throw-icon" : "pokeball-appear-icon"
                  }`}
                />
              </div>
            )}
          </div>

          <span className="text-headline-md text-pokeball-red font-black shrink-0">VS</span>

          <div className="relative">
            {damagePopup?.side === "wild" && (
              <span
                key={damagePopup.key}
                className="damage-popup absolute -top-4 left-1/2 -translate-x-1/2 text-headline-md text-error font-black z-10"
              >
                {damagePopup.text}
              </span>
            )}
            {wild.spriteUrl && (
              <Image src={wild.spriteUrl} alt={wild.name} width={128} height={128} className={wildSpriteClass} />
            )}
          </div>
        </div>

        <div className="glass-panel rounded-xl border border-white/10 p-4 mb-4 min-h-[72px] flex flex-col justify-center gap-1">
          {log.slice(-3).map((line, i) => (
            <p key={i} className="text-label-md text-on-surface">
              {line}
            </p>
          ))}
        </div>

        <div key={view} className="panel-swap">
          {view === "menu" && (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={isAnimating}
                onClick={() => setView("moves")}
                className="w-full glass-panel border border-white/10 rounded-lg p-4 text-label-md text-on-surface font-bold hover:border-pokeball-red/50 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t("fight")}
              </button>
              <button
                type="button"
                disabled={isAnimating || !hasHealthyBackup}
                onClick={() => setView("team")}
                className="w-full glass-panel border border-white/10 rounded-lg p-4 text-label-md text-on-surface font-bold hover:border-pokeball-red/50 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t("pokemonMenu")}
              </button>
              <button
                type="button"
                disabled={isAnimating || (!hasBalls && !hasPotions)}
                onClick={() => setView("bag")}
                className="w-full glass-panel border border-white/10 rounded-lg p-4 text-label-md text-on-surface font-bold hover:border-pokeball-red/50 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t("bag")}
              </button>
              <button
                type="button"
                disabled={isAnimating}
                onClick={handleFlee}
                className="w-full glass-panel border border-white/10 rounded-lg p-4 text-label-md text-on-surface font-bold hover:border-pokeball-red/50 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t("run")}
              </button>
            </div>
          )}

          {view === "moves" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {activeMoves.map((m) => {
                const eff = effectivenessInfo(m.type);
                return (
                  <button
                    key={m.moveId}
                    type="button"
                    disabled={isAnimating}
                    onClick={() => handleMove(m.moveId)}
                    className="w-full glass-panel border border-white/10 rounded-lg p-3 text-left hover:border-pokeball-red/50 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-label-sm uppercase text-on-surface-variant">{m.type}</span>
                      <span className="text-label-sm text-on-surface-variant">PP {m.pp}</span>
                    </div>
                    <p className="text-label-md text-on-surface font-bold mt-1">{m.name}</p>
                    {eff && <p className={`text-label-sm mt-1 ${eff.className}`}>{eff.label}</p>}
                  </button>
                );
              })}
              <button
                type="button"
                disabled={isAnimating}
                onClick={() => setView("menu")}
                className="w-full sm:col-span-2 glass-panel border border-white/10 rounded-lg p-3 text-label-md text-on-surface-variant hover:text-white active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t("back")}
              </button>
            </div>
          )}

          {view === "bag" && (
            <div className="flex flex-col gap-3">
              {hasBalls && (
                <div className="flex flex-col gap-2">
                  <span className="text-label-sm uppercase text-on-surface-variant">{t("pokeballsLabel")}</span>
                  {ballStacks.map((b) => (
                    <button
                      key={b.itemId}
                      type="button"
                      disabled={isAnimating}
                      onClick={() => handleThrowBall(b.itemId, b.name)}
                      className="w-full glass-panel border border-white/10 rounded-lg p-3 flex justify-between items-center hover:border-pokeball-red/50 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <span className="text-label-md text-on-surface font-bold">{b.name}</span>
                      <span className="text-label-sm text-on-surface-variant">×{b.quantity}</span>
                    </button>
                  ))}
                </div>
              )}
              {hasPotions && (
                <div className="flex flex-col gap-2">
                  <span className="text-label-sm uppercase text-on-surface-variant">{t("potionsLabel")}</span>
                  {potionStacks.map((p) => (
                    <button
                      key={p.itemId}
                      type="button"
                      disabled={isAnimating || playerHp >= playerMaxHp}
                      onClick={() => handleUsePotion(p.itemId)}
                      className="w-full glass-panel border border-white/10 rounded-lg p-3 flex justify-between items-center hover:border-tertiary/50 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <span className="text-label-md text-on-surface font-bold">{p.name}</span>
                      <span className="text-label-sm text-on-surface-variant">×{p.quantity}</span>
                    </button>
                  ))}
                </div>
              )}
              <button
                type="button"
                disabled={isAnimating}
                onClick={() => setView("menu")}
                className="w-full glass-panel border border-white/10 rounded-lg p-3 text-label-md text-on-surface-variant hover:text-white active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t("back")}
              </button>
            </div>
          )}

          {view === "team" && (
            <div className="flex flex-col gap-2">
              {mustSwitch && (
                <p className="text-label-md text-error text-center mb-1">{t("mustSwitchPrompt")}</p>
              )}
              {teamRoster.map((m) => {
                const fainted = m.currentHp <= 0;
                const hpPct = Math.max(0, Math.min(100, (m.currentHp / m.maxHp) * 100));
                return (
                  <button
                    key={m.instanceId}
                    type="button"
                    disabled={isAnimating || fainted}
                    onClick={() => handleSwitchTo(m)}
                    className="w-full glass-panel border border-white/10 rounded-lg p-3 flex items-center gap-3 hover:border-pokeball-red/50 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {m.spriteUrl && (
                      <Image src={m.spriteUrl} alt={m.name} width={40} height={40} className="w-10 h-10 object-contain" />
                    )}
                    <div className="flex-1 text-left">
                      <div className="flex justify-between items-baseline">
                        <span className="text-label-md text-on-surface font-bold capitalize">{m.name}</span>
                        <span className="text-label-sm text-on-surface-variant">{t("level", { level: m.level })}</span>
                      </div>
                      <div className="h-1.5 bg-surface-container-highest rounded-full overflow-hidden mt-1">
                        <div
                          className={`h-full health-bar-fill ${hpPct > 50 ? "" : hpPct > 20 ? "yellow" : "red"}`}
                          style={{ width: `${hpPct}%` }}
                        />
                      </div>
                      <span className="text-label-sm text-on-surface-variant">
                        {fainted ? t("fainted") : `${m.currentHp}/${m.maxHp}`}
                      </span>
                    </div>
                  </button>
                );
              })}
              {!mustSwitch && (
                <button
                  type="button"
                  disabled={isAnimating}
                  onClick={() => setView("menu")}
                  className="w-full glass-panel border border-white/10 rounded-lg p-3 text-label-md text-on-surface-variant hover:text-white active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {t("back")}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function HpCard({
  name,
  levelLabel,
  currentHp,
  maxHp,
  labelHp,
  align = "left",
}: {
  name: string;
  levelLabel: string;
  currentHp: number;
  maxHp: number;
  labelHp: string;
  align?: "left" | "right";
}) {
  const hpPct = Math.max(0, Math.min(100, (currentHp / maxHp) * 100));
  const hpClass = hpPct > 50 ? "" : hpPct > 20 ? "yellow" : "red";

  return (
    <div className={`glass-panel rounded-xl border border-white/10 p-3 ${align === "right" ? "text-right" : ""}`}>
      <div className="flex justify-between items-baseline">
        <span className="text-label-md text-on-surface font-bold capitalize">{name}</span>
        <span className="text-label-sm text-on-surface-variant">{levelLabel}</span>
      </div>
      <div className="h-2 bg-surface-container-highest rounded-full overflow-hidden mt-2">
        <div className={`h-full health-bar-fill ${hpClass}`} style={{ width: `${hpPct}%` }} />
      </div>
      <div className={`flex justify-between text-label-sm mt-1 text-on-surface-variant ${align === "right" ? "flex-row-reverse" : ""}`}>
        <span>{labelHp}</span>
        <span className="text-on-surface">
          {currentHp}/{maxHp}
        </span>
      </div>
    </div>
  );
}
