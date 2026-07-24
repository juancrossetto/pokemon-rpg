"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { submitBattleMove, type XpSummaryEntry } from "@/actions/battle-move";
import { fleeBattle } from "@/actions/flee-battle";
import { attemptCapture, type CapturedPokemonInfo } from "@/actions/attempt-capture";
import { switchPokemon } from "@/actions/switch-pokemon";
import { applyBattleItem } from "@/actions/use-item";
import { setPokemonNickname } from "@/actions/rename-pokemon";
import { StartEncounterButton } from "@/components/start-encounter-button";
import { PokeballIcon } from "@/components/pokeball-icon";
import { getTypeEffectiveness } from "@/lib/type-effectiveness";
import { typeColor } from "@/lib/type-colors";
import { gymBadgeImageUrl, gymLeaderImageUrl } from "@/lib/gym-art";
import type { TurnEvent } from "@/lib/battle";

const LUNGE_MS = 320;
const IMPACT_MS = 480;
const STATUS_MS = 550;
const MISS_MS = 450;
const THROW_MS = 700;
const FAINT_MS = 650;
const RECALL_MS = 450;
const ITEM_USE_MS = 550;
const SEND_OUT_BALL_MS = 700; // cuánto se ve solo la pokeball, antes de revelar al Pokémon inicial

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
type Outcome = "ongoing" | "won" | "lost" | "fled" | "caught" | "trainer_cleared";
type LogSide = "player" | "wild" | "system";
interface LogEntry {
  text: string;
  side: LogSide;
}

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
  gymId: string | null;
  gymType: string | null;
  gymName: string | null;
  gymLeaderName: string | null;
  gymBadgeName: string | null;
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
  gymId,
  gymType,
  gymName,
  gymLeaderName,
  gymBadgeName,
}: BattleArenaProps) {
  const t = useTranslations("battle");
  const tTeam = useTranslations("team");
  const isGymBattle = gymId !== null;
  const leaderImage = gymLeaderName ? gymLeaderImageUrl(gymLeaderName) : null;

  const [activePlayer, setActivePlayer] = useState({
    instanceId: player.instanceId,
    name: player.name,
    level: player.level,
    spriteUrl: player.spriteUrl,
  });
  const [playerHp, setPlayerHp] = useState(player.currentHp);
  const [playerMaxHp, setPlayerMaxHp] = useState(player.maxHp);
  const [activeWild, setActiveWild] = useState({ name: wild.name, level: wild.level, spriteUrl: wild.spriteUrl, types: wild.types });
  const [wildHp, setWildHp] = useState(wild.currentHp);
  const [wildMaxHp, setWildMaxHp] = useState(wild.maxHp);
  const [log, setLog] = useState<LogEntry[]>(() => initialLog.map((text) => ({ text, side: "system" as const })));
  const [attackingSide, setAttackingSide] = useState<"player" | "wild" | null>(null);
  const [shakingSide, setShakingSide] = useState<"player" | "wild" | null>(null);
  const [faintingSide, setFaintingSide] = useState<"player" | "wild" | null>(null);
  const [playerEntering, setPlayerEntering] = useState(true);
  const [playerHidden, setPlayerHidden] = useState(true);
  const [wildEntering, setWildEntering] = useState(true);
  const [badgeEarned, setBadgeEarned] = useState(false);
  const [ballAnim, setBallAnim] = useState<"recall" | "throw" | null>("throw");
  const [playerHealing, setPlayerHealing] = useState(false);
  const [damagePopup, setDamagePopup] = useState<{ side: "player" | "wild"; text: string; key: number } | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>("ongoing");
  const [xpSummary, setXpSummary] = useState<XpSummaryEntry[] | null>(null);
  const [view, setView] = useState<View>("menu");
  // Una vez que el jugador elige Luchar por primera vez, los turnos
  // siguientes abren directo en el menú de poderes (en vez de volver
  // siempre al menú raíz) — "volver" desde ahí sigue llevando al menú raíz.
  const [defaultView, setDefaultView] = useState<View>("menu");
  const [ballStacks, setBallStacks] = useState(pokeballs);
  const [potionStacks, setPotionStacks] = useState(potions);
  const [teamRoster, setTeamRoster] = useState(roster);
  const [mustSwitch, setMustSwitch] = useState(false);
  const [activeMoves, setActiveMoves] = useState(moves);
  const logEndRef = useRef<HTMLDivElement>(null);
  const [capturedInfo, setCapturedInfo] = useState<CapturedPokemonInfo | null>(null);
  const [nicknameInput, setNicknameInput] = useState("");
  const [savingNickname, setSavingNickname] = useState(false);

  const startErrors = {
    no_lead: t("errors.noLead"),
    fainted_lead: t("errors.faintedLead"),
    no_energy: t("errors.noEnergy"),
  };

  // Al iniciar la batalla: el rival aparece primero, y un instante después
  // se tira la ball del jugador — se ve SOLO la ball viajando durante
  // SEND_OUT_BALL_MS antes de revelar al Pokémon, en vez de mostrar ambos
  // sprites a la vez. Solo pasa una vez, al montar.
  useEffect(() => {
    const wildTimer = setTimeout(() => setWildEntering(false), 400);
    const revealTimer = setTimeout(() => setPlayerHidden(false), SEND_OUT_BALL_MS);
    const enterClearTimer = setTimeout(() => setPlayerEntering(false), SEND_OUT_BALL_MS + 400);
    const ballTimer = setTimeout(() => setBallAnim(null), SEND_OUT_BALL_MS + 150);
    return () => {
      clearTimeout(wildTimer);
      clearTimeout(revealTimer);
      clearTimeout(enterClearTimer);
      clearTimeout(ballTimer);
    };
  }, []);

  function appendLog(text: string, side: LogSide = "system") {
    setLog((prev) => [...prev.slice(-29), { text, side }]);
  }

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ block: "end" });
  }, [log]);

  function nameFor(side: "player" | "wild") {
    return side === "player" ? activePlayer.name : activeWild.name;
  }

  function effectivenessInfo(moveType: string): { label: string; className: string } {
    const multiplier = getTypeEffectiveness(moveType, activeWild.types);
    if (multiplier === 0) return { label: t("noEffect"), className: "text-on-surface-variant" };
    if (multiplier > 1) return { label: t("superEffective"), className: "text-tertiary" };
    if (multiplier < 1) return { label: t("notVeryEffective"), className: "text-error" };
    return { label: t("regularEffective"), className: "text-on-surface-variant" };
  }

  function playEvent(event: TurnEvent): Promise<void> {
    return new Promise((resolve) => {
      setAttackingSide(event.side);
      setTimeout(() => {
        setAttackingSide(null);

        if (!event.hit) {
          appendLog(`¡${nameFor(event.side)} usó ${event.moveName} pero falló!`, event.side);
          setTimeout(resolve, MISS_MS);
          return;
        }

        if (event.isStatus) {
          appendLog(`¡${nameFor(event.side)} usó ${event.moveName}!`, event.side);
          setTimeout(resolve, STATUS_MS);
          return;
        }

        const defenderSide = event.side === "player" ? "wild" : "player";
        setShakingSide(defenderSide);
        setDamagePopup({ side: defenderSide, text: `-${event.damage}`, key: Date.now() });
        if (defenderSide === "wild") setWildHp(event.hpAfter);
        else setPlayerHp(event.hpAfter);

        appendLog(`¡${nameFor(event.side)} usó ${event.moveName}!`, event.side);
        if (event.effectiveness > 1) appendLog("¡Es muy efectivo!", event.side);
        else if (event.effectiveness > 0 && event.effectiveness < 1) appendLog("No es muy efectivo...", event.side);
        else if (event.effectiveness === 0) appendLog("No tuvo efecto...", event.side);
        appendLog(`¡${nameFor(defenderSide)} recibió ${event.damage} de daño!`, defenderSide);

        const defenderMaxHp = defenderSide === "wild" ? wildMaxHp : playerMaxHp;
        if (event.hpAfter > 0 && event.hpAfter / defenderMaxHp <= 0.1) {
          appendLog(`¡${nameFor(defenderSide)} está a punto de debilitarse!`, defenderSide);
        }

        setTimeout(() => {
          setShakingSide(null);
          resolve();
        }, IMPACT_MS);
      }, LUNGE_MS);
    });
  }

  async function playFaintAndFinish(side: "player" | "wild", finalOutcome: Outcome) {
    appendLog(`¡${nameFor(side)} se debilitó!`, side);
    setFaintingSide(side);
    await delay(FAINT_MS);
    setOutcome(finalOutcome);
  }

  // El Pokémon activo se debilitó pero quedan otros con vida: los juegos
  // reales no terminan el combate acá, fuerzan a elegir un reemplazo. El
  // sprite se queda "caído" (no se limpia faintingSide) hasta que el
  // reemplazo entra, para no mostrar un parpadeo del sprite debilitado.
  async function playFaintThenForceSwitch() {
    appendLog(`¡${activePlayer.name} se debilitó!`, "player");
    setFaintingSide("player");
    await delay(FAINT_MS);
    setMustSwitch(true);
    setView("team");
  }

  // Batalla de gimnasio: el Pokémon actual del oponente (entrenador o líder)
  // cayó pero le queda equipo — el combate sigue, no termina acá.
  async function playWildFaintThenReveal(next: { name: string; level: number; spriteUrl: string; maxHp: number; types: string[] }) {
    appendLog(`¡${activeWild.name} debilitado!`, "wild");
    setFaintingSide("wild");
    await delay(FAINT_MS);
    setFaintingSide(null);
    setActiveWild({ name: next.name, level: next.level, spriteUrl: next.spriteUrl, types: next.types });
    setWildHp(next.maxHp);
    setWildMaxHp(next.maxHp);
    setWildEntering(true);
    setTimeout(() => setWildEntering(false), 400);
    appendLog(`¡Manda a ${next.name}!`, "wild");
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
    if (result.xpGained) {
      appendLog(`¡Ganaste ${result.xpGained} puntos de experiencia!`);
    }
    if (result.xpSummary) {
      setXpSummary(result.xpSummary);
    }

    if (result.badgeEarned) {
      appendLog("¡Conseguiste la medalla!");
      setBadgeEarned(true);
    }

    if (result.outcome === "won") {
      await playFaintAndFinish("wild", "won");
    } else if (result.outcome === "lost") {
      await playFaintAndFinish("player", "lost");
    } else if (result.outcome === "trainer_cleared") {
      await playFaintAndFinish("wild", "trainer_cleared");
    } else if (result.outcome === "fainted") {
      await playFaintThenForceSwitch();
    } else if (result.outcome === "gym_continues" && result.nextOpponent) {
      await playWildFaintThenReveal(result.nextOpponent);
      setView(defaultView);
    } else {
      setView(defaultView);
    }

    setIsAnimating(false);
  }

  async function handleFlee() {
    if (isAnimating || mustSwitch || isGymBattle) return;
    setIsAnimating(true);
    setView("menu");

    const result = await fleeBattle(battleId, locale);
    if (!result) {
      setIsAnimating(false);
      return;
    }

    if (result.fled) {
      appendLog("¡Escapaste con éxito!", "player");
      setOutcome("fled");
      setIsAnimating(false);
      return;
    }

    appendLog("¡No pudiste escapar!", "player");
    if (result.counterAttack) {
      await playEvent(result.counterAttack);
    }
    if (result.outcome === "lost") {
      await playFaintAndFinish("player", "lost");
    } else if (result.outcome === "fainted") {
      await playFaintThenForceSwitch();
    } else {
      setView(defaultView);
    }

    setIsAnimating(false);
  }

  async function handleThrowBall(itemId: string, ballName: string) {
    if (isAnimating || outcome !== "ongoing" || mustSwitch) return;
    setIsAnimating(true);
    setView("menu");
    appendLog(`¡Lanzaste ${ballName}!`, "player");

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
      appendLog(`¡Atrapaste a ${activeWild.name}!`, "player");
      setCapturedInfo(result.capturedPokemon);
      setNicknameInput("");
      setIsAnimating(false);
      return;
    }

    appendLog(`¡${activeWild.name} se liberó!`, "wild");
    if (result.counterAttack) {
      await playEvent(result.counterAttack);
    }
    if (result.outcome === "lost") {
      await playFaintAndFinish("player", "lost");
    } else if (result.outcome === "fainted") {
      await playFaintThenForceSwitch();
    } else {
      setView(defaultView);
    }

    setIsAnimating(false);
  }

  async function confirmCapture() {
    if (!capturedInfo) return;
    const nickname = nicknameInput.trim();
    if (nickname.length > 0) {
      setSavingNickname(true);
      await setPokemonNickname(capturedInfo.instanceId, nickname, locale);
      setSavingNickname(false);
    }
    setCapturedInfo(null);
    setOutcome("caught");
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
    appendLog(`Usaste ${result.itemName}. ${activePlayer.name} recuperó ${result.healedBy} HP.`, "player");

    if (result.counterAttack) {
      await playEvent(result.counterAttack);
    }
    if (result.outcome === "lost") {
      await playFaintAndFinish("player", "lost");
    } else if (result.outcome === "fainted") {
      await playFaintThenForceSwitch();
    } else {
      setView(defaultView);
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
      "player",
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
    } else {
      // Después de cambiar de Pokémon el turno vuelve al menú raíz (Luchar/
      // Pokémon/Mochila/Huir), no directo a los poderes del que acaba de
      // entrar — recién si volvés a elegir Luchar se recupera el atajo.
      setView("menu");
    }

    setIsAnimating(false);
  }

  if (capturedInfo) {
    return (
      <div className="flex-1 px-margin-mobile md:px-margin-desktop py-6">
        <div className="mx-auto max-w-md flex flex-col items-center gap-4 text-center">
          <p className="text-label-sm uppercase text-tertiary">{t("caughtTitle")}</p>

          <div className="w-28 h-28 rounded-full flex items-center justify-center bg-tertiary/10 border-2 border-tertiary/50 shadow-[0_0_20px_rgba(52,211,153,0.3)]">
            <Image src={capturedInfo.spriteUrl} alt={capturedInfo.name} width={96} height={96} className="w-24 h-24 object-contain" />
          </div>

          <div>
            <p className="text-headline-md text-on-surface capitalize">{capturedInfo.name}</p>
            <p className="text-label-sm text-on-surface-variant">{t("level", { level: capturedInfo.level })}</p>
          </div>

          <div className="flex gap-2">
            {capturedInfo.types.map((ty) => {
              const color = typeColor(ty);
              return (
                <span
                  key={ty}
                  className="px-3 py-1 rounded text-label-sm uppercase border"
                  style={{ backgroundColor: `${color}33`, color, borderColor: `${color}55` }}
                >
                  {ty}
                </span>
              );
            })}
          </div>

          <div className="glass-panel rounded-xl border border-white/10 p-4 w-full grid grid-cols-3 gap-3 text-left">
            <StatCell label={tTeam("stats.hp")} value={capturedInfo.maxHp} />
            <StatCell label={tTeam("stats.atk")} value={capturedInfo.stats.attack} />
            <StatCell label={tTeam("stats.def")} value={capturedInfo.stats.defense} />
            <StatCell label={tTeam("stats.spAtk")} value={capturedInfo.stats.spAtk} />
            <StatCell label={tTeam("stats.spDef")} value={capturedInfo.stats.spDef} />
            <StatCell label={tTeam("stats.speed")} value={capturedInfo.stats.speed} />
          </div>

          <div className="glass-panel rounded-xl border border-white/10 p-4 w-full text-left">
            <p className="text-label-sm uppercase text-on-surface-variant mb-2">{tTeam("moves")}</p>
            <div className="flex flex-col gap-1">
              {capturedInfo.moves.map((m) => {
                const color = typeColor(m.type);
                return (
                  <div key={m.moveId} className="flex justify-between items-center text-label-sm">
                    <span className="text-on-surface">{m.name}</span>
                    <span className="uppercase" style={{ color }}>
                      {m.type}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="w-full text-left">
            <label className="text-label-sm uppercase text-on-surface-variant mb-1 block">{t("nicknameLabel")}</label>
            <input
              type="text"
              value={nicknameInput}
              onChange={(e) => setNicknameInput(e.target.value)}
              placeholder={capturedInfo.name}
              maxLength={20}
              className="w-full glass-panel border border-white/10 rounded-lg px-3 py-2 text-label-md text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-pokeball-red/50"
            />
          </div>

          <button
            type="button"
            disabled={savingNickname}
            onClick={confirmCapture}
            className="w-full rounded-lg bg-pokeball-red px-6 py-3 text-label-md text-white font-bold hover:bg-pokeball-red/80 active:scale-[0.98] transition-all disabled:opacity-60"
          >
            {t("confirmCapture")}
          </button>
        </div>
      </div>
    );
  }

  if (outcome !== "ongoing") {
    const resultText =
      outcome === "won"
        ? t("resultWon")
        : outcome === "lost"
          ? t("resultLost")
          : outcome === "caught"
            ? t("resultCaught")
            : outcome === "trainer_cleared"
              ? t("resultTrainerCleared")
              : t("resultFled");
    const resultColor =
      outcome === "won" || outcome === "caught" || outcome === "trainer_cleared"
        ? "text-tertiary"
        : outcome === "lost"
          ? "text-error"
          : "text-on-surface-variant";

    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-margin-mobile py-8 text-center">
        <p className={`text-body-lg ${resultColor}`}>{resultText}</p>
        {xpSummary && xpSummary.length > 0 && (
          <div className="glass-panel rounded-xl border border-white/10 p-4 w-full max-w-sm text-left">
            <p className="text-label-sm uppercase text-on-surface-variant mb-2">{t("xpSummaryTitle")}</p>
            <div className="flex flex-col gap-1">
              {xpSummary.map((entry) => (
                <div key={entry.instanceId} className="flex justify-between items-center text-label-md">
                  <span className="text-on-surface capitalize">{entry.name}</span>
                  <span className="text-tertiary">
                    +{entry.xpGained} XP{entry.leveledUpTo ? ` · ${t("leveledUp", { level: entry.leveledUpTo })}` : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        {badgeEarned && gymType && (
          <div className="glass-panel rounded-xl border border-tertiary/40 p-6 w-full max-w-sm flex flex-col items-center gap-3">
            <p className="text-label-sm uppercase text-tertiary">{t("badgeEarned")}</p>
            {leaderImage && (gymName || gymLeaderName) && (
              <div className="flex items-center gap-3 w-full">
                <div className="w-16 h-20 rounded-lg overflow-hidden border-2 border-tertiary/50 shrink-0">
                  <Image src={leaderImage} alt={gymLeaderName ?? ""} width={64} height={80} className="w-full h-full object-cover object-top" />
                </div>
                <div className="text-left">
                  {gymName && <p className="text-label-md text-on-surface font-bold">{gymName}</p>}
                  {gymLeaderName && <p className="text-label-sm text-on-surface-variant">{gymLeaderName}</p>}
                </div>
              </div>
            )}
            <div className="w-24 h-24 rounded-full flex items-center justify-center animate-[pokeball-pulse_2s_ease-in-out_infinite] bg-tertiary/10 border-2 border-tertiary/50 shadow-[0_0_24px_rgba(234,179,8,0.35)]">
              <Image src={gymBadgeImageUrl(gymType)} alt={gymBadgeName ?? t("badgeEarned")} width={64} height={64} />
            </div>
            {gymBadgeName && <p className="text-headline-md text-tertiary">{gymBadgeName}</p>}
          </div>
        )}
        {outcome === "lost" ? (
          <Link
            href="/team"
            className="rounded-lg bg-pokeball-red px-6 py-2 text-label-md text-white hover:bg-pokeball-red/80 transition-colors"
          >
            {t("goHeal")}
          </Link>
        ) : outcome === "trainer_cleared" && gymId ? (
          <Link
            href={`/gyms/${gymId}/run`}
            className="rounded-lg bg-pokeball-red px-6 py-2 text-label-md text-white hover:bg-pokeball-red/80 transition-colors"
          >
            {t("backToCorridor")}
          </Link>
        ) : isGymBattle ? (
          <Link
            href="/gyms"
            className="rounded-lg bg-pokeball-red px-6 py-2 text-label-md text-white hover:bg-pokeball-red/80 transition-colors"
          >
            {t("backToGyms")}
          </Link>
        ) : (
          <StartEncounterButton locale={locale} label={t("explore")} errors={startErrors} />
        )}
      </div>
    );
  }

  const hasBalls = !isGymBattle && ballStacks.length > 0;
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
    wildEntering ? "sprite-enter" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex-1 px-margin-mobile md:px-margin-desktop py-6">
      <div className="mx-auto max-w-4xl">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <HpCard name={activePlayer.name} levelLabel={t("level", { level: activePlayer.level })} currentHp={playerHp} maxHp={playerMaxHp} labelHp={t("hp")} />
          <HpCard name={activeWild.name} levelLabel={t("level", { level: activeWild.level })} currentHp={wildHp} maxHp={wildMaxHp} labelHp={t("hp")} align="right" />
        </div>

        <div className="glass-panel rounded-xl border border-white/10 p-6 md:p-10 flex items-center justify-between gap-4 mb-4 relative overflow-hidden min-h-[180px]">
          <div className="relative">
            {damagePopup?.side === "player" && (
              <span
                key={damagePopup.key}
                className="damage-popup absolute -top-4 left-1/2 -translate-x-1/2 text-headline-md text-error font-black z-10"
              >
                {damagePopup.text}
              </span>
            )}
            {!playerHidden && activePlayer.spriteUrl && (
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
            {activeWild.spriteUrl && (
              <Image src={activeWild.spriteUrl} alt={activeWild.name} width={128} height={128} className={wildSpriteClass} />
            )}
          </div>
        </div>

        <div className="glass-panel rounded-xl border border-white/10 p-4 mb-4 h-32 overflow-y-auto flex flex-col gap-1">
          {log.map((entry, i) => (
            <p
              key={i}
              className={`text-label-md leading-snug ${
                entry.side === "player"
                  ? "text-left text-on-surface"
                  : entry.side === "wild"
                    ? "text-right text-on-surface"
                    : "text-center text-on-surface-variant italic"
              }`}
            >
              {entry.text}
            </p>
          ))}
          <div ref={logEndRef} />
        </div>

        <div key={view} className="panel-swap">
          {view === "menu" && (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={isAnimating}
                onClick={() => {
                  setView("moves");
                  setDefaultView("moves");
                }}
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
                disabled={isAnimating || isGymBattle}
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
                const color = typeColor(m.type);
                return (
                  <button
                    key={m.moveId}
                    type="button"
                    disabled={isAnimating}
                    onClick={() => handleMove(m.moveId)}
                    className="w-full glass-panel border border-white/10 rounded-lg p-3 text-left hover:border-pokeball-red/50 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <div className="flex justify-between items-center">
                      <span
                        className="px-2 py-0.5 rounded text-label-sm uppercase border"
                        style={{ backgroundColor: `${color}33`, color, borderColor: `${color}55` }}
                      >
                        {m.type}
                      </span>
                      <span className="text-label-sm text-on-surface-variant">PP {m.pp}</span>
                    </div>
                    <p className="text-label-md text-on-surface font-bold mt-1">{m.name}</p>
                    <p className={`text-label-sm mt-1 ${eff.className}`}>{eff.label}</p>
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

function StatCell({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-label-sm text-on-surface-variant">{label}</p>
      <p className="text-label-md text-on-surface font-bold">{value}</p>
    </div>
  );
}
