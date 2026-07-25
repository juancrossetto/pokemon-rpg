"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { submitBattleMove, type XpSummaryEntry } from "@/actions/battle-move";
import { fleeBattle } from "@/actions/flee-battle";
import { attemptCapture, type CapturedPokemonInfo } from "@/actions/attempt-capture";
import { switchPokemon } from "@/actions/switch-pokemon";
import { applyBattleItem } from "@/actions/use-item";
import { setPokemonNickname } from "@/actions/rename-pokemon";
import { abandonGymRun } from "@/actions/abandon-gym-run";
import { StartEncounterButton } from "@/components/start-encounter-button";
import { BattleResult } from "@/components/battle-result";
import { GymBadgePopup } from "@/components/gym-badge-popup";
import { PokeballIcon } from "@/components/pokeball-icon";
import { BattleSprite } from "@/components/battle-sprite";
import { getTypeEffectiveness } from "@/lib/type-effectiveness";
import { typeColor } from "@/lib/type-colors";
import { gymLeaderPortraitUrl } from "@/lib/gym-art";
import { playBattleSfx, unlockBattleAudio } from "@/lib/battle-sfx";
import { statusLabelKey, type StatusCondition } from "@/lib/status";
import type { TurnEvent } from "@/lib/battle";

const LUNGE_MS = 380;
const IMPACT_MS = 560;
const STATUS_MS = 620;
const MISS_MS = 500;
const BALL_TRAVEL_MS = 500;
const BALL_WOBBLE_MS = 1100;
const BALL_CATCH_MS = 550;
const BALL_BREAK_MS = 450;
const FAINT_MS = 650;
const RECALL_MS = 450;
const ITEM_USE_MS = 550;
const SEND_OUT_BALL_MS = 700; // cuánto se ve solo la pokeball, antes de revelar al Pokémon inicial

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface Combatant {
  name: string;
  /** Nombre de especie (PokeAPI) — para el GIF animado de Showdown. */
  speciesName: string;
  level: number;
  /** Official artwork — fallback si el GIF falla. */
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
  speciesName: string;
  level: number;
  spriteUrl: string;
  currentHp: number;
  maxHp: number;
}

export interface OpponentPartyMember {
  slot: number;
  name: string;
  spriteUrl: string;
  fainted: boolean;
  active: boolean;
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
  trainerName: string;
  opponentName: string | null;
  player: Combatant & { instanceId: string; currentHp: number; maxHp: number };
  wild: Combatant & { currentHp: number; maxHp: number; types: string[]; isShiny?: boolean };
  moves: { moveId: number; name: string; type: string; pp: number; maxPp: number }[];
  initialLog: string[];
  pokeballs: PokeballStack[];
  potions: PotionStack[];
  /** Equipo completo del jugador (incluye el activo). */
  party: RosterMember[];
  opponentParty: OpponentPartyMember[];
  playerStatus: string | null;
  wildStatus: string | null;
  /** Si porta un objeto Choice, el movimiento al que ya quedó atado (o null). */
  playerChoiceLockMoveId: number | null;
  gymId: string | null;
  gymRunId: string | null;
  gymType: string | null;
  gymName: string | null;
  gymLeaderName: string | null;
  gymBadgeName: string | null;
}

export function BattleArena({
  battleId,
  locale,
  trainerName,
  opponentName,
  player,
  wild,
  moves,
  initialLog,
  pokeballs,
  potions,
  party: initialParty,
  opponentParty: initialOpponentParty,
  playerStatus: initialPlayerStatus,
  wildStatus: initialWildStatus,
  playerChoiceLockMoveId: initialChoiceLockMoveId,
  gymId,
  gymRunId,
  gymType,
  gymName,
  gymLeaderName,
  gymBadgeName,
}: BattleArenaProps) {
  const t = useTranslations("battle");
  const tLog = useTranslations("battle.log");
  const tTeam = useTranslations("team");
  const router = useRouter();
  const isGymBattle = gymId !== null;
  const leaderPortrait = gymLeaderName ? gymLeaderPortraitUrl(gymLeaderName) : null;
  const foeLabel = opponentName ?? t("wildFoe");

  function translateBootLog(raw: string): string {
    if (raw.startsWith("appear:")) return tLog("appear", { name: raw.slice(7) });
    if (raw.startsWith("challengeTrainer:")) return raw; // shown as-is key fallback
    if (raw.startsWith("sendOut:")) return tLog("used", { name: raw.slice(8), move: "—" }).replace("—", "");
    return raw;
  }

  const [activePlayer, setActivePlayer] = useState({
    instanceId: player.instanceId,
    name: player.name,
    speciesName: player.speciesName,
    level: player.level,
    spriteUrl: player.spriteUrl,
  });
  // playEvent() lee nombres vía nameFor() dentro de funciones async que ya
  // arrancaron con un closure viejo de activePlayer (setActivePlayer no lo
  // actualiza hasta el próximo render) — un ref sincrónico evita que el
  // contraataque tras un switch muestre el nombre del Pokémon que se fue.
  const activePlayerNameRef = useRef(player.name);
  const [playerHp, setPlayerHp] = useState(player.currentHp);
  const [playerMaxHp, setPlayerMaxHp] = useState(player.maxHp);
  const [activeWild, setActiveWild] = useState({
    name: wild.name,
    speciesName: wild.speciesName,
    level: wild.level,
    spriteUrl: wild.spriteUrl,
    types: wild.types,
    isShiny: wild.isShiny ?? false,
  });
  const [wildHp, setWildHp] = useState(wild.currentHp);
  const [wildMaxHp, setWildMaxHp] = useState(wild.maxHp);
  const [playerStatus, setPlayerStatus] = useState<string | null>(initialPlayerStatus);
  const [wildStatus, setWildStatus] = useState<string | null>(initialWildStatus);
  const [log, setLog] = useState<LogEntry[]>(() =>
    initialLog.map((text) => ({ text: translateBootLog(text), side: "system" as const })),
  );
  const [attackingSide, setAttackingSide] = useState<"player" | "wild" | null>(null);
  const [shakingSide, setShakingSide] = useState<"player" | "wild" | null>(null);
  const [faintingSide, setFaintingSide] = useState<"player" | "wild" | null>(null);
  const [playerEntering, setPlayerEntering] = useState(true);
  const [playerHidden, setPlayerHidden] = useState(true);
  const [wildEntering, setWildEntering] = useState(true);
  const [badgeEarned, setBadgeEarned] = useState(false);
  const [showBadgePopup, setShowBadgePopup] = useState(false);
  const [tmRewardName, setTmRewardName] = useState<string | null>(null);
  const [ballAnim, setBallAnim] = useState<"recall" | "throw" | null>("throw");
  const [playerHealing, setPlayerHealing] = useState(false);
  const [damagePopup, setDamagePopup] = useState<{ side: "player" | "wild"; text: string; key: number } | null>(null);
  const [moveFx, setMoveFx] = useState<{
    key: number;
    side: "player" | "wild";
    moveName: string;
    moveType: string;
    mode: "hit" | "status" | "miss";
    effectiveness: number;
  } | null>(null);
  const [arenaFlash, setArenaFlash] = useState<string | null>(null);
  const [effPopup, setEffPopup] = useState<{ text: string; key: number } | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>("ongoing");
  const [xpSummary, setXpSummary] = useState<XpSummaryEntry[] | null>(null);
  const [coinsGained, setCoinsGained] = useState(0);
  const [view, setView] = useState<View>("menu");
  // Una vez que el jugador elige Luchar por primera vez, los turnos
  // siguientes abren directo en el menú de poderes (en vez de volver
  // siempre al menú raíz) — "volver" desde ahí sigue llevando al menú raíz.
  const [defaultView, setDefaultView] = useState<View>("menu");
  const [ballStacks, setBallStacks] = useState(pokeballs);
  const [potionStacks, setPotionStacks] = useState(potions);
  const [party, setParty] = useState(initialParty);
  const [opponentParty, setOpponentParty] = useState(initialOpponentParty);
  const [mustSwitch, setMustSwitch] = useState(false);
  const [activeMoves, setActiveMoves] = useState(moves);
  const [choiceLockMoveId, setChoiceLockMoveId] = useState(initialChoiceLockMoveId);
  const logEndRef = useRef<HTMLDivElement>(null);
  const [capturedInfo, setCapturedInfo] = useState<CapturedPokemonInfo | null>(null);
  const [nicknameInput, setNicknameInput] = useState("");
  const [savingNickname, setSavingNickname] = useState(false);
  const [captureBall, setCaptureBall] = useState<"throw" | "wobble" | "success" | "fail" | null>(null);
  // Sacudida/flash del golpe escalados según % de HP máximo que representó
  // el daño — un golpe débil ya no se ve idéntico a uno que casi noquea.
  const [impactIntensity, setImpactIntensity] = useState(1);
  const [confirmLeaveGym, setConfirmLeaveGym] = useState(false);

  const teamRoster = party.filter((m) => m.instanceId !== activePlayer.instanceId);

  const startErrors = {
    no_lead: t("errors.noLead"),
    fainted_lead: t("errors.faintedLead"),
    no_energy: t("errors.noEnergy"),
    no_stage: t("errors.noStage"),
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
    return side === "player" ? activePlayerNameRef.current : activeWild.name;
  }

  /** Objeto equipado del jugador que se activó esta acción (Leftovers, Focus Sash, etc.) — siempre del lado jugador. */
  function appendItemTriggerLog(event: TurnEvent) {
    if (!event.itemEffect || !event.itemName) return;
    const activeId = activePlayer.instanceId;
    const playerName = nameFor("player");

    if (event.itemEffect === "leftovers" && event.itemAmount != null) {
      appendLog(
        tLog("itemLeftovers", { name: playerName, item: event.itemName, damage: event.itemAmount }),
        "player",
      );
    } else if (event.itemEffect === "focus_sash") {
      appendLog(tLog("itemFocusSash", { name: playerName, item: event.itemName }), "player");
    } else if (event.itemEffect === "sitrus_berry" && event.itemAmount != null) {
      appendLog(
        tLog("itemSitrusBerry", { name: playerName, item: event.itemName, damage: event.itemAmount }),
        "player",
      );
    } else if (event.itemEffect === "lum_berry" && event.itemCuredStatus) {
      appendLog(
        tLog("itemLumBerry", {
          name: playerName,
          item: event.itemName,
          status: t(statusLabelKey(event.itemCuredStatus)),
        }),
        "player",
      );
      setPlayerStatus(null);
    }

    if (event.itemHpAfter != null) {
      setPlayerHp(event.itemHpAfter);
      setParty((prev) =>
        prev.map((m) => (m.instanceId === activeId ? { ...m, currentHp: event.itemHpAfter! } : m)),
      );
    }
  }

  function shakeStyle(side: "player" | "wild"): CSSProperties | undefined {
    return shakingSide === side ? ({ "--shake-amt": `${10 * impactIntensity}px` } as CSSProperties) : undefined;
  }

  function effectivenessInfo(moveType: string): { label: string; className: string } {
    const multiplier = getTypeEffectiveness(moveType, activeWild.types);
    if (multiplier === 0) return { label: t("noEffect"), className: "text-on-surface-variant" };
    if (multiplier > 1) return { label: t("superEffective"), className: "text-tertiary" };
    if (multiplier < 1) return { label: t("notVeryEffective"), className: "text-error" };
    return { label: t("regularEffective"), className: "text-on-surface-variant" };
  }

  function playEvent(event: TurnEvent): Promise<void> {
    const activeId = activePlayer.instanceId;
    return new Promise((resolve) => {
      const color = typeColor(event.moveType);
      const fxKey = Date.now();
      const mode = event.skipped ? "miss" : !event.hit ? "miss" : event.isStatus ? "status" : "hit";

      if (
        event.skipped === "asleep" ||
        event.skipped === "paralyzed" ||
        event.skipped === "disobey" ||
        event.skipped === "flinch"
      ) {
        playBattleSfx("status");
      } else if (!event.hit) {
        playBattleSfx("miss");
      } else if (event.critical) {
        playBattleSfx("crit");
      } else if (event.effectiveness > 1) {
        playBattleSfx("superEffective");
      } else if (!event.isStatus) {
        playBattleSfx("hit");
      } else {
        playBattleSfx("status");
      }

      setMoveFx({
        key: fxKey,
        side: event.side,
        moveName: event.moveName,
        moveType: event.moveType,
        mode: mode === "miss" ? "miss" : mode === "status" ? "status" : "hit",
        effectiveness: event.effectiveness,
      });

      if (event.skipped) {
        if (event.skipped === "asleep") appendLog(tLog("asleep", { name: nameFor(event.side) }), event.side);
        else if (event.skipped === "paralyzed") appendLog(tLog("paralyzed", { name: nameFor(event.side) }), event.side);
        else if (event.skipped === "flinch") appendLog(tLog("flinch", { name: nameFor(event.side) }), event.side);
        else appendLog(tLog("disobey", { name: nameFor(event.side) }), event.side);
        setTimeout(() => {
          setMoveFx(null);
          resolve();
        }, STATUS_MS);
        return;
      }

      setAttackingSide(event.side);

      setTimeout(() => {
        setAttackingSide(null);

        if (!event.hit) {
          appendLog(tLog("miss", { name: nameFor(event.side), move: event.moveName }), event.side);
          setTimeout(() => {
            setMoveFx(null);
            resolve();
          }, MISS_MS);
          return;
        }

        if (event.isStatus) {
          appendLog(tLog("used", { name: nameFor(event.side), move: event.moveName }), event.side);
          if (event.statusApplied) {
            const foe = event.side === "player" ? "wild" : "player";
            const label = t(statusLabelKey(event.statusApplied as StatusCondition));
            appendLog(tLog("statusApplied", { name: nameFor(foe), status: label }), foe);
            if (foe === "wild") setWildStatus(event.statusApplied);
            else setPlayerStatus(event.statusApplied);
          }
          if (event.statChange) {
            const foe = event.side === "player" ? "wild" : "player";
            const statKey =
              event.statChange.stat === "atk"
                ? "statAtk"
                : event.statChange.stat === "def"
                  ? "statDef"
                  : "statSpe";
            appendLog(
              tLog("statChange", {
                name: nameFor(foe),
                stat: tLog(statKey),
                dir: event.statChange.stages < 0 ? tLog("statDown") : tLog("statUp"),
              }),
              foe,
            );
          }
          appendItemTriggerLog(event);
          setArenaFlash(color);
          setTimeout(() => setArenaFlash(null), 320);
          setTimeout(() => {
            setMoveFx(null);
            resolve();
          }, STATUS_MS);
          return;
        }

        const defenderSide = event.side === "player" ? "wild" : "player";
        const defenderMaxHpNow = defenderSide === "wild" ? wildMaxHp : playerMaxHp;
        const impactRatio = defenderMaxHpNow > 0 ? event.damage / defenderMaxHpNow : 0;
        setShakingSide(defenderSide);
        setImpactIntensity(Math.min(1.7, Math.max(0.55, 0.55 + impactRatio * 2.3)));
        setArenaFlash(color);
        setDamagePopup({ side: defenderSide, text: `-${event.damage}`, key: fxKey });
        if (defenderSide === "wild") setWildHp(event.hpAfter);
        else {
          setPlayerHp(event.hpAfter);
          setParty((prev) =>
            prev.map((m) => (m.instanceId === activeId ? { ...m, currentHp: event.hpAfter } : m)),
          );
        }

        if (event.effectiveness > 1) {
          setEffPopup({ text: tLog("superEffective"), key: fxKey });
        } else if (event.effectiveness > 0 && event.effectiveness < 1) {
          setEffPopup({ text: tLog("notVeryEffective"), key: fxKey });
        } else if (event.effectiveness === 0) {
          setEffPopup({ text: tLog("noEffect"), key: fxKey });
        } else if (event.critical) {
          setEffPopup({ text: tLog("critical"), key: fxKey });
        }

        appendLog(tLog("used", { name: nameFor(event.side), move: event.moveName }), event.side);
        if (event.critical) appendLog(tLog("critical"), event.side);
        if (event.effectiveness > 1) appendLog(tLog("superEffective"), event.side);
        else if (event.effectiveness > 0 && event.effectiveness < 1) appendLog(tLog("notVeryEffective"), event.side);
        else if (event.effectiveness === 0) appendLog(tLog("noEffect"), event.side);
        appendLog(tLog("damage", { name: nameFor(defenderSide), damage: event.damage }), defenderSide);

        if (event.recoilDamage) {
          appendLog(tLog("recoil", { name: nameFor(event.side), damage: event.recoilDamage }), event.side);
          if (event.side === "player") setPlayerHp((hp) => Math.max(0, hp - (event.recoilDamage ?? 0)));
          else setWildHp((hp) => Math.max(0, hp - (event.recoilDamage ?? 0)));
        }
        if (event.residualDamage && event.residualHpAfter != null) {
          appendLog(
            tLog("residual", { name: nameFor(event.side), damage: event.residualDamage }),
            event.side,
          );
          if (event.side === "player") setPlayerHp(event.residualHpAfter);
          else setWildHp(event.residualHpAfter);
        }

        appendItemTriggerLog(event);

        const defenderMaxHp = defenderSide === "wild" ? wildMaxHp : playerMaxHp;
        if (event.hpAfter > 0 && event.hpAfter / defenderMaxHp <= 0.1) {
          appendLog(tLog("lowHp", { name: nameFor(defenderSide) }), defenderSide);
        }

        setTimeout(() => setArenaFlash(null), 280);
        setTimeout(() => {
          setShakingSide(null);
          setMoveFx(null);
          setEffPopup(null);
          resolve();
        }, IMPACT_MS);
      }, LUNGE_MS);
    });
  }

  async function playFaintAndFinish(side: "player" | "wild", finalOutcome: Outcome) {
    appendLog(tLog("fainted", { name: nameFor(side) }), side);
    playBattleSfx("faint");
    setFaintingSide(side);
    if (side === "wild") {
      setOpponentParty((prev) =>
        prev.map((m) => (m.active ? { ...m, fainted: true, active: false } : m)),
      );
    } else {
      setParty((prev) =>
        prev.map((m) =>
          m.instanceId === activePlayer.instanceId ? { ...m, currentHp: 0 } : m,
        ),
      );
    }
    await delay(FAINT_MS);
    setOutcome(finalOutcome);
    if (finalOutcome === "won" || finalOutcome === "lost" || finalOutcome === "trainer_cleared") {
      router.refresh();
    }
  }

  async function playFaintThenForceSwitch() {
    appendLog(tLog("fainted", { name: activePlayer.name }), "player");
    playBattleSfx("faint");
    setFaintingSide("player");
    setParty((prev) =>
      prev.map((m) =>
        m.instanceId === activePlayer.instanceId ? { ...m, currentHp: 0 } : m,
      ),
    );
    await delay(FAINT_MS);
    setMustSwitch(true);
    setView("team");
  }

  // Batalla de gimnasio: el Pokémon actual del oponente (entrenador o líder)
  // cayó pero le queda equipo — el combate sigue, no termina acá.
  async function playWildFaintThenReveal(next: {
    name: string;
    speciesName: string;
    level: number;
    spriteUrl: string;
    maxHp: number;
    types: string[];
  }) {
    appendLog(`¡${activeWild.name} debilitado!`, "wild");
    setFaintingSide("wild");
    setOpponentParty((prev) => {
      let promoted = false;
      return prev.map((m) => {
        if (m.active) return { ...m, fainted: true, active: false };
        if (!m.fainted && !promoted) {
          promoted = true;
          return { ...m, active: true };
        }
        return m;
      });
    });
    await delay(FAINT_MS);
    setFaintingSide(null);
    setActiveWild({
      isShiny: false,
      name: next.name,
      speciesName: next.speciesName,
      level: next.level,
      spriteUrl: next.spriteUrl,
      types: next.types,
    });
    setWildHp(next.maxHp);
    setWildMaxHp(next.maxHp);
    setWildEntering(true);
    setTimeout(() => setWildEntering(false), 400);
    appendLog(`¡Manda a ${next.name}!`, "wild");
  }

  async function handleMove(moveId: number) {
    if (isAnimating || outcome !== "ongoing" || mustSwitch) return;
    unlockBattleAudio();
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
    setPlayerStatus(result.playerStatus);
    setWildStatus(result.wildStatus);
    setChoiceLockMoveId(result.playerChoiceLockMoveId);
    setActiveMoves((prev) =>
      prev.map((m) => {
        const upd = result.playerMovesPp.find((p) => p.moveId === m.moveId);
        return upd ? { ...m, pp: upd.pp } : m;
      }),
    );
    if (result.xpGained) {
      appendLog(`+${result.xpGained} XP`);
    }
    if (result.xpSummary) {
      setXpSummary(result.xpSummary);
    }
    if (result.coinsGained > 0) {
      setCoinsGained(result.coinsGained);
    }

    if (result.badgeEarned) {
      appendLog(t("badgeEarned"));
      playBattleSfx("badge");
      setBadgeEarned(true);
      setShowBadgePopup(true);
    }
    if (result.tmRewardName) {
      appendLog(t("tmEarned", { code: result.tmRewardName }));
      setTmRewardName(result.tmRewardName);
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
    if (isAnimating || mustSwitch || isGymBattle || outcome !== "ongoing") return;
    setIsAnimating(true);
    setView("menu");

    try {
      const result = await fleeBattle(battleId, locale);
      if (!result?.fled) return;

      appendLog(tLog("fled"), "player");
      setOutcome("fled");
      // Refresca el layout para desbloquear el navbar ("In battle").
      router.refresh();
    } catch {
      appendLog(tLog("fleeFailed"), "system");
    } finally {
      setIsAnimating(false);
    }
  }

  async function handleThrowBall(itemId: string, ballName: string) {
    if (isAnimating || outcome !== "ongoing" || mustSwitch) return;
    setIsAnimating(true);
    setView("menu");
    appendLog(`¡Lanzaste ${ballName}!`, "player");
    playBattleSfx("ball");

    setBallStacks((prev) =>
      prev.map((b) => (b.itemId === itemId ? { ...b, quantity: b.quantity - 1 } : b)).filter((b) => b.quantity > 0),
    );

    setCaptureBall("throw");
    await delay(BALL_TRAVEL_MS);
    setCaptureBall("wobble");
    await delay(BALL_WOBBLE_MS);

    const result = await attemptCapture(battleId, itemId, locale);
    if (!result) {
      setCaptureBall(null);
      setIsAnimating(false);
      return;
    }

    if (result.caught) {
      setCaptureBall("success");
      await delay(BALL_CATCH_MS);
      appendLog(`¡Atrapaste a ${activeWild.name}!`, "player");
      setCapturedInfo(result.capturedPokemon);
      setNicknameInput("");
      setCaptureBall(null);
      setIsAnimating(false);
      return;
    }

    setCaptureBall("fail");
    await delay(BALL_BREAK_MS);
    setCaptureBall(null);
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
    router.refresh();
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
    setParty((prev) =>
      prev.map((m) =>
        m.instanceId === activePlayer.instanceId ? { ...m, currentHp: result.healedTo } : m,
      ),
    );
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

    activePlayerNameRef.current = result.newPlayer.name;
    setActivePlayer({
      instanceId: result.newPlayer.instanceId,
      name: result.newPlayer.name,
      speciesName: result.newPlayer.speciesName,
      level: result.newPlayer.level,
      spriteUrl: result.newPlayer.spriteUrl,
    });
    setPlayerHp(member.currentHp);
    setPlayerMaxHp(result.newPlayer.maxHp);
    setActiveMoves(result.newPlayer.moves);
    // El servidor resetea el lock de Choice/consumo de objeto al cambiar de Pokémon.
    setChoiceLockMoveId(null);
    setParty((prev) =>
      prev.map((m) => {
        if (m.instanceId === outgoing.instanceId) {
          return { ...m, currentHp: playerHp, maxHp: playerMaxHp };
        }
        if (m.instanceId === member.instanceId) {
          return { ...m, maxHp: result.newPlayer.maxHp };
        }
        return m;
      }),
    );
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
          ? t("resultLostTitle")
          : outcome === "caught"
            ? t("resultCaught")
            : outcome === "trainer_cleared"
              ? t("resultTrainerCleared")
              : t("resultFled");
    // El texto largo de derrota explica el próximo paso — va como bajada.
    const resultSubText = outcome === "lost" ? t("resultLost") : null;
    return (
      <BattleResult
        mode={outcome}
        resultText={resultText}
        subText={resultSubText}
        player={{
          name: activePlayer.name,
          speciesName: activePlayer.speciesName,
          level:
            xpSummary?.find((e) => e.instanceId === activePlayer.instanceId)?.leveledUpTo ??
            activePlayer.level,
          spriteUrl: activePlayer.spriteUrl,
        }}
        foe={{
          name: activeWild.name,
          speciesName: activeWild.speciesName,
          level: activeWild.level,
          spriteUrl: activeWild.spriteUrl,
        }}
        xpSummary={xpSummary}
        coinsGained={coinsGained}
      >
        {showBadgePopup && badgeEarned && gymType && (
          <GymBadgePopup
            gymType={gymType}
            gymName={gymName}
            leaderName={gymLeaderName}
            badgeName={gymBadgeName}
            portraitUrl={leaderPortrait}
            labels={{
              badgeEarned: t("badgeEarned"),
              tmEarned: tmRewardName ? t("tmEarned", { code: tmRewardName }) : null,
              continue: t("badgeContinue"),
            }}
            onContinue={() => setShowBadgePopup(false)}
          />
        )}
        {outcome === "lost" ? (
          <Link
            href="/team"
            className="w-full max-w-sm rounded-lg bg-pokeball-red px-6 py-3 text-center text-label-md font-bold text-white hover:bg-pokeball-red/80 transition-colors"
          >
            {t("goHeal")}
          </Link>
        ) : outcome === "trainer_cleared" && gymId && gymRunId ? (
          <div className="w-full max-w-sm flex flex-col gap-3">
            <p className="text-label-md text-on-surface-variant">{t("advancePrompt")}</p>
            {!confirmLeaveGym ? (
              <>
                <Link
                  href={`/gyms/${gymId}/run`}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-pokeball-red px-6 py-3 text-label-md text-white font-bold hover:bg-pokeball-red/80 transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]!">arrow_forward</span>
                  {t("continueChallenge")}
                </Link>
                <button
                  type="button"
                  onClick={() => setConfirmLeaveGym(true)}
                  className="w-full rounded-lg border border-white/20 px-6 py-2.5 text-label-md text-on-surface-variant hover:text-error hover:border-error/40 transition-colors"
                >
                  {t("leaveGym")}
                </button>
              </>
            ) : (
              <div className="glass-panel rounded-xl border border-error/40 p-4 text-left flex flex-col gap-3">
                <p className="text-label-md text-error font-bold">{t("leaveGymTitle")}</p>
                <p className="text-label-sm text-on-surface-variant">{t("leaveGymBody")}</p>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmLeaveGym(false)}
                    className="w-full rounded-lg bg-pokeball-red px-4 py-2 text-label-md text-white hover:bg-pokeball-red/80 transition-colors"
                  >
                    {t("continueChallenge")}
                  </button>
                  <form action={abandonGymRun.bind(null, gymRunId, locale)}>
                    <button
                      type="submit"
                      className="w-full rounded-lg border border-error/40 px-4 py-2 text-label-md text-error hover:bg-error/10 transition-colors"
                    >
                      {t("confirmLeaveGym")}
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        ) : isGymBattle ? (
          <Link
            href="/gyms"
            className="w-full max-w-sm rounded-lg bg-pokeball-red px-6 py-3 text-center text-label-md font-bold text-white hover:bg-pokeball-red/80 transition-colors"
          >
            {t("backToGyms")}
          </Link>
        ) : (
          <div className="w-full max-w-sm">
            <StartEncounterButton
              locale={locale}
              label={t("explore")}
              errors={startErrors}
              className="w-full rounded-lg bg-pokeball-red px-6 py-3 text-label-md font-bold text-white transition-colors hover:bg-pokeball-red/80 disabled:opacity-50"
            />
            <Link
              href="/"
              className="mt-2 block text-center text-label-sm text-on-surface-variant transition-colors hover:text-white"
            >
              {t("backHome")}
            </Link>
          </div>
        )}
      </BattleResult>
    );
  }

  const hasBalls = !isGymBattle && ballStacks.length > 0;
  const hasPotions = potionStacks.length > 0;
  const hasHealthyBackup = teamRoster.some((m) => m.currentHp > 0);

  const seFlash = moveFx?.mode === "hit" && (moveFx.effectiveness ?? 1) > 1;
  const playerSpriteClass = [
    "w-28 h-28 md:w-40 md:h-40 object-contain drop-shadow-lg",
    attackingSide === "player" ? "sprite-lunge-right" : "",
    shakingSide === "player" ? `sprite-shake ${seFlash ? "sprite-flash-heavy" : "sprite-flash"}` : "",
    faintingSide === "player" ? "sprite-faint" : "",
    ballAnim === "recall" ? "sprite-recall" : "",
    playerEntering ? "sprite-enter" : "",
    playerHealing ? "sprite-heal" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const wildAbsorbedByBall = captureBall === "wobble" || captureBall === "success";

  const wildSpriteClass = [
    "w-28 h-28 md:w-40 md:h-40 object-contain drop-shadow-lg",
    attackingSide === "wild" ? "sprite-lunge-left" : "",
    shakingSide === "wild" ? `sprite-shake ${seFlash ? "sprite-flash-heavy" : "sprite-flash"}` : "",
    faintingSide === "wild" ? "sprite-faint" : "",
    wildEntering ? "sprite-enter" : "",
    wildAbsorbedByBall ? "sprite-recall" : "",
    captureBall === "fail" ? "sprite-enter" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const emptyPlayerSlots = Math.max(0, 6 - party.length);
  const emptyOpponentSlots = Math.max(0, 6 - opponentParty.length);

  return (
    <div className="flex-1 px-margin-mobile md:px-margin-desktop py-4 md:py-6">
      <div className="mx-auto max-w-6xl flex flex-col gap-3">
        {/* Mobile: opponent party strip */}
        <div className="lg:hidden">
          <PartySidebar
            name={foeLabel}
            portraitUrl={isGymBattle ? leaderPortrait : null}
            align="right"
            compact
          >
            {opponentParty.map((m) => (
              <PartyIcon
                key={`o-${m.slot}`}
                spriteUrl={m.spriteUrl}
                name={m.name}
                fainted={m.fainted}
                active={m.active}
              />
            ))}
            {Array.from({ length: emptyOpponentSlots }).map((_, i) => (
              <EmptyPartySlot key={`oe-${i}`} />
            ))}
          </PartySidebar>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[132px_minmax(0,1fr)_132px] gap-3 items-stretch">
          {/* Player sidebar (desktop) */}
          <div className="hidden lg:block">
            <PartySidebar name={trainerName} portraitUrl={null} align="left">
              {party.map((m) => (
                <PartyIcon
                  key={m.instanceId}
                  spriteUrl={m.spriteUrl}
                  name={m.name}
                  fainted={m.currentHp <= 0}
                  active={m.instanceId === activePlayer.instanceId}
                  hpPct={(m.currentHp / m.maxHp) * 100}
                />
              ))}
              {Array.from({ length: emptyPlayerSlots }).map((_, i) => (
                <EmptyPartySlot key={`pe-${i}`} />
              ))}
            </PartySidebar>
          </div>

          {/* Arena */}
          <div
            className={`battle-arena-field relative overflow-hidden rounded-xl border border-white/10 min-h-[260px] md:min-h-[320px] ${
              arenaFlash ? "arena-type-flash" : ""
            }`}
            style={arenaFlash ? ({ "--arena-flash-color": arenaFlash } as CSSProperties) : undefined}
          >
            <HpPlate
              className="absolute top-3 right-3 z-20 w-[min(100%,220px)]"
              name={activeWild.name}
              levelLabel={t("level", { level: activeWild.level })}
              currentHp={wildHp}
              maxHp={wildMaxHp}
              status={wildStatus}
              align="right"
            />
            <HpPlate
              className="absolute bottom-3 left-3 z-20 w-[min(100%,220px)]"
              name={activePlayer.name}
              levelLabel={t("level", { level: activePlayer.level })}
              currentHp={playerHp}
              maxHp={playerMaxHp}
              status={playerStatus}
              align="left"
            />

            {moveFx && (
              <div
                key={`banner-${moveFx.key}`}
                className="move-banner absolute top-14 left-1/2 z-30 pointer-events-none"
                style={{
                  backgroundColor: `${typeColor(moveFx.moveType)}ee`,
                  boxShadow: `0 0 18px ${typeColor(moveFx.moveType)}88`,
                }}
              >
                <span className="uppercase text-[10px] tracking-wider opacity-90">{moveFx.moveType}</span>
                <span className="font-black text-sm md:text-base">{moveFx.moveName}</span>
              </div>
            )}

            {moveFx?.mode === "hit" && (
              <div
                key={`beam-${moveFx.key}`}
                className={`move-beam absolute top-[42%] z-10 pointer-events-none ${
                  moveFx.side === "player" ? "move-beam-right" : "move-beam-left"
                }`}
                style={{
                  background: `linear-gradient(90deg, transparent, ${typeColor(moveFx.moveType)}, transparent)`,
                  boxShadow: `0 0 12px ${typeColor(moveFx.moveType)}`,
                }}
              />
            )}

            {moveFx?.mode === "hit" && (
              <div
                key={`orb-${moveFx.key}`}
                className={`move-orb absolute top-[42%] z-10 pointer-events-none ${
                  moveFx.side === "player" ? "move-orb-right" : "move-orb-left"
                }`}
                style={{
                  backgroundColor: typeColor(moveFx.moveType),
                  boxShadow: `0 0 16px 4px ${typeColor(moveFx.moveType)}`,
                }}
              />
            )}

            {captureBall && (
              <div
                key={captureBall}
                className={`absolute w-10 h-10 pointer-events-none z-20 ${
                  captureBall === "throw"
                    ? "ball-throw-travel"
                    : captureBall === "wobble"
                      ? "ball-wobble"
                      : captureBall === "success"
                        ? "ball-catch-flash"
                        : "ball-break"
                }`}
              >
                <PokeballIcon className="w-full h-full drop-shadow-[0_0_8px_rgba(238,21,21,0.6)]" />
              </div>
            )}

            {effPopup && (
              <span
                key={`eff-${effPopup.key}`}
                className="eff-popup absolute top-1/2 left-1/2 z-30 pointer-events-none text-label-md font-black tracking-wide"
              >
                {effPopup.text}
              </span>
            )}

            {/* Opponent sprite — upper right */}
            <div className="absolute right-[8%] top-[18%] md:right-[12%] md:top-[14%] z-[1]">
              {damagePopup?.side === "wild" && (
                <span
                  key={damagePopup.key}
                  className="damage-popup absolute -top-4 left-1/2 -translate-x-1/2 text-headline-md text-error font-black z-10"
                >
                  {damagePopup.text}
                </span>
              )}
              {moveFx?.mode === "hit" && shakingSide === "wild" && (
                <span
                  key={`burst-w-${moveFx.key}`}
                  className="move-impact absolute inset-0 m-auto pointer-events-none"
                  style={{
                    background: `radial-gradient(circle, ${typeColor(moveFx.moveType)}cc 0%, transparent 70%)`,
                  }}
                />
              )}
              {activeWild.spriteUrl && (
                <BattleSprite
                  speciesName={activeWild.speciesName}
                  facing="front"
                  isShiny={activeWild.isShiny}
                  fallbackUrl={activeWild.spriteUrl}
                  alt={activeWild.name}
                  width={160}
                  height={160}
                  className={wildSpriteClass}
                  style={shakeStyle("wild")}
                />
              )}
            </div>

            {/* Player sprite — lower left */}
            <div className="absolute left-[6%] bottom-[14%] md:left-[10%] md:bottom-[12%] z-[1]">
              {damagePopup?.side === "player" && (
                <span
                  key={damagePopup.key}
                  className="damage-popup absolute -top-4 left-1/2 -translate-x-1/2 text-headline-md text-error font-black z-10"
                >
                  {damagePopup.text}
                </span>
              )}
              {moveFx?.mode === "hit" && shakingSide === "player" && (
                <span
                  key={`burst-p-${moveFx.key}`}
                  className="move-impact absolute inset-0 m-auto pointer-events-none"
                  style={{
                    background: `radial-gradient(circle, ${typeColor(moveFx.moveType)}cc 0%, transparent 70%)`,
                  }}
                />
              )}
              {!playerHidden && activePlayer.spriteUrl && (
                <BattleSprite
                  speciesName={activePlayer.speciesName}
                  facing="back"
                  fallbackUrl={activePlayer.spriteUrl}
                  alt={activePlayer.name}
                  width={160}
                  height={160}
                  className={playerSpriteClass}
                  style={shakeStyle("player")}
                />
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
          </div>

          {/* Opponent sidebar (desktop) */}
          <div className="hidden lg:block">
            <PartySidebar
              name={foeLabel}
              portraitUrl={isGymBattle ? leaderPortrait : null}
              align="right"
            >
              {opponentParty.map((m) => (
                <PartyIcon
                  key={`o-${m.slot}`}
                  spriteUrl={m.spriteUrl}
                  name={m.name}
                  fainted={m.fainted}
                  active={m.active}
                />
              ))}
              {Array.from({ length: emptyOpponentSlots }).map((_, i) => (
                <EmptyPartySlot key={`oe-${i}`} />
              ))}
            </PartySidebar>
          </div>
        </div>

        {/* Mobile: player party strip */}
        <div className="lg:hidden">
          <PartySidebar name={trainerName} portraitUrl={null} align="left" compact>
            {party.map((m) => (
              <PartyIcon
                key={m.instanceId}
                spriteUrl={m.spriteUrl}
                name={m.name}
                fainted={m.currentHp <= 0}
                active={m.instanceId === activePlayer.instanceId}
                hpPct={(m.currentHp / m.maxHp) * 100}
              />
            ))}
            {Array.from({ length: emptyPlayerSlots }).map((_, i) => (
              <EmptyPartySlot key={`pe-${i}`} />
            ))}
          </PartySidebar>
        </div>

        {/* Compact battle log */}
        <div className="glass-panel rounded-lg border border-white/10 px-3 py-2 h-14 overflow-y-auto flex flex-col gap-0.5">
          {log.map((entry, i) => (
            <p
              key={i}
              className={`text-label-sm leading-snug ${
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
              {activeMoves.every((m) => m.pp <= 0) && (
                <button
                  type="button"
                  disabled={isAnimating}
                  onClick={() => handleMove(activeMoves[0]?.moveId ?? 0)}
                  className="w-full sm:col-span-2 glass-panel border border-error/40 rounded-lg p-3 text-left hover:border-error/70 active:scale-[0.98] transition-all disabled:opacity-40"
                >
                  <p className="text-label-md text-error font-bold">Struggle</p>
                  <p className="text-label-sm text-on-surface-variant">PP 0 — recoil damage</p>
                </button>
              )}
              {activeMoves.map((m) => {
                const eff = effectivenessInfo(m.type);
                const color = typeColor(m.type);
                const lockedOut = choiceLockMoveId != null && choiceLockMoveId !== m.moveId;
                return (
                  <button
                    key={m.moveId}
                    type="button"
                    disabled={isAnimating || m.pp <= 0 || lockedOut}
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
                      <span className="flex items-center gap-1 text-label-sm text-on-surface-variant">
                        {lockedOut && (
                          <span className="material-symbols-outlined text-[14px]!">lock</span>
                        )}
                        PP {m.pp}/{m.maxPp ?? m.pp}
                      </span>
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

function PartySidebar({
  name,
  portraitUrl,
  align,
  compact,
  children,
}: {
  name: string;
  portraitUrl: string | null;
  align: "left" | "right";
  compact?: boolean;
  children: ReactNode;
}) {
  if (compact) {
    return (
      <div className="glass-panel rounded-lg border border-white/10 px-3 py-2 flex items-center gap-3">
        {portraitUrl && (
          <div className="w-10 h-12 rounded overflow-hidden border border-white/15 shrink-0 bg-surface-container-high">
            <Image src={portraitUrl} alt={name} width={40} height={48} className="w-full h-full object-cover object-top" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className={`text-label-sm text-on-surface font-bold truncate ${align === "right" ? "text-right" : ""}`}>
            {name}
          </p>
          <div className={`mt-1 flex gap-1.5 ${align === "right" ? "justify-end" : ""}`}>{children}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-xl border border-white/10 p-2.5 h-full flex flex-col gap-2">
      <p className={`text-label-sm text-on-surface font-bold truncate px-0.5 ${align === "right" ? "text-right" : ""}`}>
        {name}
      </p>
      {portraitUrl && (
        <div className="mx-auto w-16 h-20 rounded-lg overflow-hidden border border-white/15 bg-surface-container-high">
          <Image src={portraitUrl} alt={name} width={64} height={80} className="w-full h-full object-cover object-top" />
        </div>
      )}
      <div className="grid grid-cols-2 gap-1.5 mt-auto">{children}</div>
    </div>
  );
}

function PartyIcon({
  spriteUrl,
  name,
  fainted,
  active,
  hpPct,
}: {
  spriteUrl: string;
  name: string;
  fainted: boolean;
  active: boolean;
  hpPct?: number;
}) {
  return (
    <div
      title={name}
      className={`relative aspect-square rounded-md border bg-surface-container-high/80 flex items-center justify-center overflow-hidden ${
        active ? "border-pokeball-red/70 ring-1 ring-pokeball-red/40" : "border-white/10"
      } ${fainted ? "opacity-35 grayscale" : ""}`}
    >
      {spriteUrl ? (
        <Image src={spriteUrl} alt={name} width={40} height={40} className="w-9 h-9 object-contain" />
      ) : (
        <PokeballIcon className="w-5 h-5 opacity-40" />
      )}
      {typeof hpPct === "number" && !fainted && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
          <div
            className={`h-full ${hpPct > 50 ? "bg-emerald-400" : hpPct > 20 ? "bg-amber-400" : "bg-red-500"}`}
            style={{ width: `${Math.max(0, Math.min(100, hpPct))}%` }}
          />
        </div>
      )}
    </div>
  );
}

function EmptyPartySlot() {
  return (
    <div className="aspect-square rounded-md border border-dashed border-white/10 bg-black/20 flex items-center justify-center">
      <PokeballIcon className="w-4 h-4 opacity-25" />
    </div>
  );
}

function HpPlate({
  name,
  levelLabel,
  currentHp,
  maxHp,
  status,
  align = "left",
  className = "",
}: {
  name: string;
  levelLabel: string;
  currentHp: number;
  maxHp: number;
  status?: string | null;
  align?: "left" | "right";
  className?: string;
}) {
  const hpPct = Math.max(0, Math.min(100, (currentHp / maxHp) * 100));
  const hpClass = hpPct > 50 ? "" : hpPct > 20 ? "yellow" : "red";

  return (
    <div
      className={`rounded-lg border border-white/15 bg-black/55 backdrop-blur-sm px-2.5 py-1.5 shadow-lg ${className}`}
    >
      <div className={`flex items-baseline gap-2 ${align === "right" ? "flex-row-reverse" : ""}`}>
        <span className="text-label-md text-white font-bold capitalize truncate">{name}</span>
        <span className="text-label-sm text-white/70 shrink-0">{levelLabel}</span>
        {status && (
          <span className="text-[10px] uppercase tracking-wide text-amber-300 shrink-0">{status}</span>
        )}
      </div>
      <div className="h-2 bg-white/15 rounded-full overflow-hidden mt-1">
        <div className={`h-full health-bar-fill ${hpClass}`} style={{ width: `${hpPct}%` }} />
      </div>
      <p className={`text-[10px] text-white/70 mt-0.5 ${align === "right" ? "text-right" : ""}`}>
        {Math.round(hpPct)}% · {currentHp}/{maxHp}
      </p>
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
