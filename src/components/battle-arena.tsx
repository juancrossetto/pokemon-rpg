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
import { formatMoveName } from "@/lib/format-move-name";
import { gymLeaderPortraitUrl } from "@/lib/gym-art";
import { itemSpriteUrl } from "@/lib/item-sprites";
import { playBattleSfx, unlockBattleAudio, type SfxKind } from "@/lib/battle-sfx";
import {
  resumeBattleBgm,
  startBattleBgm,
  stopBattleBgm,
} from "@/lib/battle-bgm";
import { BattleAudioControls } from "@/components/battle-audio-controls";
import {
  impactFxUrl,
  moveFxFamily,
  resolveMoveProjectile,
  showdownBattleBgUrl,
  showdownFxUrl,
} from "@/lib/showdown-fx";
import { statusLabelKey, type StatusCondition } from "@/lib/status";
import type { TurnEvent } from "@/lib/battle";

function hitSfxForMove(moveType: string, category?: TurnEvent["category"]): SfxKind {
  if (category === "PHYSICAL") return "contact";
  return moveFxFamily(moveType);
}

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
  types: string[];
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
  trainerPortraitUrl: string | null;
  opponentPortraitUrl: string | null;
  opponentName: string | null;
  player: Combatant & { instanceId: string; currentHp: number; maxHp: number };
  wild: Combatant & { currentHp: number; maxHp: number; types: string[]; isShiny?: boolean };
  moves: { moveId: number; name: string; type: string; power?: number | null; pp: number; maxPp: number }[];
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
  trainerPortraitUrl,
  opponentPortraitUrl,
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

  function translateBootLog(raw: string): string | null {
    // Metadata interna (stage de farming) — no mostrar al jugador.
    if (raw.startsWith("stage:")) return null;
    if (raw === "alpha") return t("alphaEncounter");
    if (raw.startsWith("appear:")) return tLog("appear", { name: raw.slice(7) });
    if (raw.startsWith("switch:")) return tLog("switchIn", { name: raw.slice(7) });
    if (raw.startsWith("switchForced:")) return tLog("switchForced", { name: raw.slice(14) });
    if (raw.startsWith("challengeTrainer:")) {
      return tLog("challengeTrainer", { name: raw.slice("challengeTrainer:".length) });
    }
    if (raw.startsWith("challengeLeader:")) {
      const rest = raw.slice("challengeLeader:".length);
      const [leader, gym] = rest.split(":");
      return tLog("challengeLeader", { leader: leader ?? rest, gym: gym ?? "" });
    }
    if (raw.startsWith("sendOut:")) return tLog("sendOut", { name: raw.slice(8) });
    if (raw === "tutorial") return tLog("tutorial");
    if (raw === "fled") return tLog("fled");
    if (raw === "brokeFree") return tLog("brokeFree");
    if (raw.startsWith("ball:")) return tLog("threwBall", { name: raw.slice(5) });
    if (raw.startsWith("caught:")) return tLog("caught", { name: raw.slice(7) });
    if (raw.startsWith("item:")) return tLog("usedItem", { name: raw.slice(5) });
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
  const [log, setLog] = useState<LogEntry[]>(() => {
    const entries: LogEntry[] = [];
    for (const text of initialLog) {
      const translated = translateBootLog(text);
      if (translated) entries.push({ text: translated, side: "system" });
    }
    return entries;
  });
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
    category?: TurnEvent["category"];
    fxFile?: string;
    fxStyle?: "projectile" | "contact" | "bolt";
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
  const bgmKind = isGymBattle || opponentName ? "boss" : "wild";

  const teamRoster = party.filter((m) => m.instanceId !== activePlayer.instanceId);

  const startErrors = {
    no_lead: t("errors.noLead"),
    fainted_lead: t("errors.faintedLead"),
    no_energy: t("errors.noEnergy"),
    no_stage: t("errors.noStage"),
  };

  useEffect(() => {
    startBattleBgm(bgmKind);
    return () => stopBattleBgm();
  }, [bgmKind]);

  useEffect(() => {
    if (outcome !== "ongoing") stopBattleBgm();
  }, [outcome]);

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
    return matchupInfo(getTypeEffectiveness(moveType, activeWild.types));
  }

  /** Mejor STAB del candidato vs el rival actual (para el menú de cambio). */
  function switchMatchupInfo(attackerTypes: string[]): { label: string; className: string } {
    if (attackerTypes.length === 0) return matchupInfo(1);
    const best = Math.max(
      ...attackerTypes.map((type) => getTypeEffectiveness(type, activeWild.types)),
    );
    return matchupInfo(best);
  }

  function matchupInfo(multiplier: number): { label: string; className: string } {
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
      const projectile =
        mode === "hit" ? resolveMoveProjectile(event.moveType, event.category) : null;

      // Miss / skip / status suenan al inicio; el hit tipado espera al impacto.
      if (
        event.skipped === "asleep" ||
        event.skipped === "paralyzed" ||
        event.skipped === "disobey" ||
        event.skipped === "flinch"
      ) {
        playBattleSfx("status");
      } else if (!event.hit) {
        playBattleSfx("miss");
      } else if (event.isStatus) {
        playBattleSfx("status");
      }

      setMoveFx({
        key: fxKey,
        side: event.side,
        moveName: event.moveName,
        moveType: event.moveType,
        mode: mode === "miss" ? "miss" : mode === "status" ? "status" : "hit",
        effectiveness: event.effectiveness,
        category: event.category,
        fxFile: projectile?.file,
        fxStyle: projectile?.style,
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
          appendLog(tLog("miss", { name: nameFor(event.side), move: formatMoveName(event.moveName) }), event.side);
          setTimeout(() => {
            setMoveFx(null);
            resolve();
          }, MISS_MS);
          return;
        }

        if (event.isStatus) {
          appendLog(tLog("used", { name: nameFor(event.side), move: formatMoveName(event.moveName) }), event.side);
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

        // SFX tipado + thud de daño al impacto (más audible).
        const typed = hitSfxForMove(event.moveType, event.category);
        playBattleSfx(typed);
        if (typed !== "contact" && typed !== "hit") playBattleSfx("damage");
        if (event.critical) playBattleSfx("crit");
        else if (event.effectiveness > 1) playBattleSfx("superEffective");

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

        appendLog(tLog("used", { name: nameFor(event.side), move: formatMoveName(event.moveName) }), event.side);
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
    resumeBattleBgm();
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
    // Ocultar el sprite saliente: si no, al pasar de recall → throw
    // pierde la clase sprite-recall y el Pokémon viejo reaparece un frame.
    setPlayerHidden(true);
    setBallAnim("throw");
    await delay(SEND_OUT_BALL_MS * 0.45);

    const result = await switchPokemon(battleId, member.instanceId, locale, forced);
    if (!result) {
      setIsAnimating(false);
      setBallAnim(null);
      setPlayerHidden(false);
      return;
    }

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

    setBallAnim(null);
    setPlayerEntering(true);
    setPlayerHidden(false);
    await delay(400);
    setPlayerEntering(false);
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
  const physicalLunge = moveFx?.mode === "hit" && moveFx.category === "PHYSICAL";
  const wildAbsorbedByBall = captureBall === "wobble" || captureBall === "success";
  const playerIdle =
    !attackingSide && !shakingSide && !faintingSide && !playerEntering && !playerHealing && !ballAnim;
  const wildIdle =
    !attackingSide && !shakingSide && !faintingSide && !wildEntering && !wildAbsorbedByBall && !captureBall;
  const playerSpriteClass = [
    // Más grande en primer plano: los ani-back de Showdown se ven más chicos
    // que los ani front del rival con el mismo box.
    "w-[5.25rem] h-[5.25rem] md:w-[13.5rem] md:h-[13.5rem] object-contain drop-shadow-lg origin-bottom",
    attackingSide === "player" ? (physicalLunge ? "sprite-lunge-right-hard" : "sprite-lunge-right") : "",
    shakingSide === "player" ? `sprite-shake ${seFlash ? "sprite-flash-heavy" : "sprite-flash"}` : "",
    faintingSide === "player" ? "sprite-faint" : "",
    ballAnim === "recall" ? "sprite-recall" : "",
    playerEntering ? "sprite-enter" : "",
    playerHealing ? "sprite-heal" : "",
    playerIdle ? "sprite-idle-bob" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const wildSpriteClass = [
    "w-[5.25rem] h-[5.25rem] md:w-40 md:h-40 object-contain drop-shadow-lg origin-bottom",
    attackingSide === "wild" ? (physicalLunge ? "sprite-lunge-left-hard" : "sprite-lunge-left") : "",
    shakingSide === "wild" ? `sprite-shake ${seFlash ? "sprite-flash-heavy" : "sprite-flash"}` : "",
    faintingSide === "wild" ? "sprite-faint" : "",
    wildEntering ? "sprite-enter" : "",
    wildAbsorbedByBall ? "sprite-recall" : "",
    captureBall === "fail" ? "sprite-enter" : "",
    wildIdle ? "sprite-idle-bob" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const emptyPlayerSlots = Math.max(0, 6 - party.length);
  const emptyOpponentSlots = Math.max(0, 6 - opponentParty.length);
  const commandExpanded = view !== "menu";

  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden px-2 py-1 sm:px-margin-mobile md:px-margin-desktop md:py-4 max-md:h-[calc(100dvh-6.5rem)] max-md:max-h-[calc(100dvh-6.5rem)] md:h-[calc(100dvh-4rem)] md:max-h-[calc(100dvh-4rem)]">
      <div className="mx-auto w-full max-w-6xl flex flex-col gap-1 md:gap-2 flex-1 min-h-0 overflow-hidden md:h-full">
        {/* Top — mayor parte del alto en mobile */}
        <div className="flex min-h-0 flex-col gap-1 md:gap-2 max-md:flex-1 max-md:min-h-[52%] md:flex-1 md:min-h-0">
        {/* Mobile: opponent balls — solo íconos, sin título largo */}
        <div className="lg:hidden shrink-0">
          <div
            className="flex items-center justify-end gap-1 px-1"
            title={foeLabel}
            aria-label={foeLabel}
          >
            {opponentParty.map((m) => (
              <PartyIcon
                key={`o-${m.slot}`}
                spriteUrl={m.spriteUrl}
                name={m.name}
                fainted={m.fainted}
                active={m.active}
                compact
              />
            ))}
            {Array.from({ length: emptyOpponentSlots }).map((_, i) => (
              <EmptyPartySlot key={`oe-${i}`} compact />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[148px_minmax(0,1fr)_148px] gap-1 md:gap-2 items-stretch flex-1 min-h-0 min-w-0">
          {/* Player sidebar (desktop) */}
          <div className="hidden lg:block">
            <PartySidebar name={trainerName} portraitUrl={trainerPortraitUrl} align="left">
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
            className={`battle-arena-field relative overflow-hidden rounded-xl border border-white/10 flex-1 min-h-0 md:min-h-[272px] ${
              arenaFlash ? "arena-type-flash" : ""
            }`}
            style={
              {
                "--arena-bg-image": `url(${showdownBattleBgUrl(isGymBattle ? "mountain" : "meadow")})`,
                ...(arenaFlash ? { "--arena-flash-color": arenaFlash } : {}),
              } as CSSProperties
            }
          >
            <BattleAudioControls bgmKind={bgmKind} />
            <HpPlate
              className="absolute top-2 right-2 z-20 w-[min(100%,160px)] md:top-3 md:right-3 md:w-[min(100%,220px)]"
              name={activeWild.name}
              levelLabel={t("level", { level: activeWild.level })}
              currentHp={wildHp}
              maxHp={wildMaxHp}
              status={wildStatus}
              align="right"
            />
            <HpPlate
              className="absolute bottom-2 left-2 z-20 w-[min(100%,160px)] md:bottom-3 md:left-3 md:w-[min(100%,220px)]"
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
                <span className="font-black text-sm md:text-base">{formatMoveName(moveFx.moveName)}</span>
              </div>
            )}

            {moveFx?.mode === "hit" && moveFx.fxFile && moveFx.fxStyle === "projectile" && (
              // eslint-disable-next-line @next/next/no-img-element -- FX particle from Showdown CDN
              <img
                key={`proj-${moveFx.key}`}
                src={showdownFxUrl(moveFx.fxFile)}
                alt=""
                aria-hidden
                className={`fx-projectile absolute top-[42%] z-10 pointer-events-none ${
                  moveFx.side === "player" ? "fx-projectile-right" : "fx-projectile-left"
                }`}
              />
            )}

            {moveFx?.mode === "hit" && moveFx.fxFile && moveFx.fxStyle === "bolt" && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={`bolt-${moveFx.key}`}
                src={showdownFxUrl(moveFx.fxFile)}
                alt=""
                aria-hidden
                className={`fx-bolt absolute z-10 pointer-events-none ${
                  moveFx.side === "player" ? "fx-bolt-on-wild" : "fx-bolt-on-player"
                }`}
              />
            )}

            {moveFx?.mode === "hit" && moveFx.fxFile && moveFx.fxStyle === "contact" && attackingSide && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={`contact-${moveFx.key}`}
                src={showdownFxUrl(moveFx.fxFile)}
                alt=""
                aria-hidden
                className={`fx-contact absolute z-10 pointer-events-none ${
                  moveFx.side === "player" ? "fx-contact-right" : "fx-contact-left"
                }`}
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
            <div className="absolute right-[6%] top-[14%] md:right-[12%] md:top-[14%] z-[1]">
              <span className="sprite-ground-shadow absolute left-1/2 bottom-0 -translate-x-1/2" aria-hidden />
              {damagePopup?.side === "wild" && (
                <span
                  key={damagePopup.key}
                  className="damage-popup absolute -top-4 left-1/2 -translate-x-1/2 text-headline-md text-error font-black z-10"
                >
                  {damagePopup.text}
                </span>
              )}
              {moveFx?.mode === "hit" && shakingSide === "wild" && (
                <>
                  <span
                    key={`burst-w-${moveFx.key}`}
                    className="move-impact absolute inset-0 m-auto pointer-events-none"
                    style={{
                      background: `radial-gradient(circle, ${typeColor(moveFx.moveType)}cc 0%, transparent 70%)`,
                    }}
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    key={`impact-w-${moveFx.key}`}
                    src={impactFxUrl()}
                    alt=""
                    aria-hidden
                    className="fx-impact absolute inset-0 m-auto pointer-events-none"
                  />
                </>
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
            <div className="absolute left-[3%] bottom-[6%] md:left-[8%] md:bottom-[8%] z-[1]">
              <span className="sprite-ground-shadow sprite-ground-shadow-player absolute left-1/2 bottom-0 -translate-x-1/2" aria-hidden />
              {damagePopup?.side === "player" && (
                <span
                  key={damagePopup.key}
                  className="damage-popup absolute -top-4 left-1/2 -translate-x-1/2 text-headline-md text-error font-black z-10"
                >
                  {damagePopup.text}
                </span>
              )}
              {moveFx?.mode === "hit" && shakingSide === "player" && (
                <>
                  <span
                    key={`burst-p-${moveFx.key}`}
                    className="move-impact absolute inset-0 m-auto pointer-events-none"
                    style={{
                      background: `radial-gradient(circle, ${typeColor(moveFx.moveType)}cc 0%, transparent 70%)`,
                    }}
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    key={`impact-p-${moveFx.key}`}
                    src={impactFxUrl()}
                    alt=""
                    aria-hidden
                    className="fx-impact absolute inset-0 m-auto pointer-events-none"
                  />
                </>
              )}
              {!playerHidden && activePlayer.spriteUrl && (
                <BattleSprite
                  speciesName={activePlayer.speciesName}
                  facing="back"
                  fallbackUrl={activePlayer.spriteUrl}
                  alt={activePlayer.name}
                  width={216}
                  height={216}
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
            <PartySidebar name={foeLabel} portraitUrl={opponentPortraitUrl} align="right">
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

        {/* Mobile: player balls */}
        <div className="lg:hidden shrink-0">
          <div
            className="flex items-center justify-start gap-1 px-1"
            title={trainerName}
            aria-label={trainerName}
          >
            {party.map((m) => (
              <PartyIcon
                key={m.instanceId}
                spriteUrl={m.spriteUrl}
                name={m.name}
                fainted={m.currentHp <= 0}
                active={m.instanceId === activePlayer.instanceId}
                hpPct={(m.currentHp / m.maxHp) * 100}
                compact
              />
            ))}
            {Array.from({ length: emptyPlayerSlots }).map((_, i) => (
              <EmptyPartySlot key={`pe-${i}`} compact />
            ))}
          </div>
        </div>
        </div>

        <div
          className={`grid min-w-0 gap-1 md:gap-2 min-h-0 shrink-0 items-stretch md:h-[13rem] md:max-h-[13rem] ${
            commandExpanded
              ? "max-md:h-[11rem] max-md:max-h-[11rem]"
              : "max-md:h-[7.5rem] max-md:max-h-[7.5rem]"
          } ${commandExpanded ? "grid-cols-1 md:grid-cols-2" : "grid-cols-2"}`}
        >
          {/* Log — en submenús mobile cede espacio a los comandos */}
          <div
            className={`glass-panel rounded-xl border border-white/10 px-2 py-1.5 md:px-4 md:py-3 overflow-y-auto overflow-x-hidden flex flex-col gap-0.5 bg-black/35 h-full min-h-0 min-w-0 ${
              commandExpanded ? "hidden md:flex" : ""
            }`}
          >
            {log.map((entry, i) => (
              <p
                key={i}
                className={`text-[10px] md:text-label-md leading-snug md:leading-relaxed break-words [overflow-wrap:anywhere] ${
                  entry.side === "player"
                    ? "text-left text-on-surface"
                    : entry.side === "wild"
                      ? "text-right text-on-surface"
                      : "text-left text-on-surface-variant"
                }`}
              >
                <span className="text-pokeball-red/80 mr-1">&gt;</span>
                {entry.text}
              </p>
            ))}
            {view === "menu" && !isAnimating && outcome === "ongoing" && (
              <p className="mt-auto pt-1 border-t border-dashed border-white/15 text-[10px] md:text-label-md font-bold text-on-surface leading-snug break-words [overflow-wrap:anywhere]">
                {t("whatWillDo", { name: activePlayer.name.toUpperCase() })}
              </p>
            )}
            <div ref={logEndRef} />
          </div>

          {/* Comandos */}
          <div key={view} className="panel-swap min-h-0 min-w-0 flex-1 overflow-hidden flex flex-col">
            {view === "menu" && (
              <div className="grid grid-cols-2 gap-1 md:gap-2 h-full min-h-0 max-md:auto-rows-fr">
                <button
                  type="button"
                  disabled={isAnimating}
                  onClick={() => {
                    unlockBattleAudio();
                    resumeBattleBgm();
                    setView("moves");
                    setDefaultView("moves");
                  }}
                  className="battle-cmd-btn battle-cmd-fight"
                >
                  <span className="material-symbols-outlined text-[18px]! md:text-[22px]!">bolt</span>
                  {t("fight")}
                </button>
                <button
                  type="button"
                  disabled={isAnimating || !hasHealthyBackup}
                  onClick={() => setView("team")}
                  className="battle-cmd-btn"
                >
                  <PokeballIcon className="w-5 h-5 md:w-6 md:h-6" />
                  {t("pokemonMenu")}
                </button>
                <button
                  type="button"
                  disabled={isAnimating || (!hasBalls && !hasPotions)}
                  onClick={() => setView("bag")}
                  className="battle-cmd-btn"
                >
                  <span className="material-symbols-outlined text-[18px]! md:text-[22px]!">backpack</span>
                  {t("bag")}
                </button>
                <button
                  type="button"
                  disabled={isAnimating || isGymBattle}
                  onClick={handleFlee}
                  className="battle-cmd-btn"
                >
                  <span className="material-symbols-outlined text-[18px]! md:text-[22px]!">directions_run</span>
                  {t("run")}
                </button>
              </div>
            )}

            {view === "moves" && (
              <div className="flex flex-col gap-1 h-full min-h-0">
                <div className="flex items-center justify-between gap-2 px-0.5 shrink-0">
                  <div className="min-w-0 flex items-baseline gap-2">
                    <p className="text-xs md:text-sm font-bold text-primary capitalize truncate">{activePlayer.name}</p>
                    <p className="hidden md:block text-[10px] uppercase text-on-surface-variant tracking-wider shrink-0">
                      {t("selectCommand")}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isAnimating}
                    onClick={() => setView("menu")}
                    className="flex h-7 w-7 md:h-7 md:w-7 items-center justify-center rounded-full border border-white/15 bg-black/40 text-white/80 hover:bg-black/60 disabled:opacity-40 shrink-0"
                    aria-label={t("back")}
                  >
                    <span className="material-symbols-outlined text-[16px]!">arrow_back</span>
                  </button>
                </div>
                <p className="text-[10px] uppercase text-on-surface-variant tracking-wider px-0.5 shrink-0 md:hidden">
                  {t("selectCommand")}
                </p>
                <div className="grid grid-cols-2 grid-rows-2 gap-1 md:gap-1.5 flex-1 min-h-0 min-w-0 overflow-x-hidden overflow-y-auto md:overflow-hidden content-stretch">
                  {activeMoves.every((m) => m.pp <= 0) && (
                    <button
                      type="button"
                      disabled={isAnimating}
                      onClick={() => handleMove(activeMoves[0]?.moveId ?? 0)}
                      className="col-span-2 battle-move-card border-error/40"
                    >
                      <p className="text-base font-bold text-error">Struggle</p>
                      <p className="text-label-sm text-on-surface-variant mt-1">PP 0 — recoil</p>
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
                        className="battle-move-card battle-move-card-compact battle-move-card-dense text-left disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ borderColor: `${color}55` }}
                      >
                        <div className="flex justify-between items-start gap-1 min-w-0 shrink-0">
                          <span className="text-xs md:text-sm font-bold text-white leading-tight truncate">{formatMoveName(m.name)}</span>
                          <span
                            className="shrink-0 px-1.5 py-0.5 rounded-full text-[9px] md:text-[10px] uppercase font-bold tracking-wide border"
                            style={{ backgroundColor: `${color}33`, color, borderColor: `${color}66` }}
                          >
                            {m.type}
                          </span>
                        </div>
                        <div className="mt-auto pt-1 flex justify-between items-end gap-1 shrink-0">
                          <div>
                            <p className="text-[9px] uppercase tracking-wider text-white/45">{t("powerLabel")}</p>
                            <p className="text-[11px] md:text-xs text-white font-bold tabular-nums">
                              {m.power ?? "—"}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-[9px] uppercase tracking-wider text-white/45">{t("ppLabel")}</p>
                            <p className="text-[11px] md:text-xs text-white/90 font-bold tabular-nums flex items-center justify-end gap-1">
                              {lockedOut && (
                                <span className="material-symbols-outlined text-[14px]! text-amber-300">lock</span>
                              )}
                              {m.pp}/{m.maxPp ?? m.pp}
                            </p>
                          </div>
                        </div>
                        <p className={`text-[9px] md:text-[10px] mt-0.5 leading-tight truncate shrink-0 ${eff.className}`}>
                          {eff.label}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {view === "bag" && (
              <div className="flex flex-col gap-1 md:gap-2 h-full min-h-0">
                <div className="flex items-center justify-between gap-2 px-0.5 shrink-0">
                  <div>
                    <p className="text-xs md:text-sm font-bold text-primary">{t("bagTitle")}</p>
                    <p className="text-[10px] md:text-label-sm uppercase text-on-surface-variant tracking-wider">
                      {t("selectCommand")}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isAnimating}
                    onClick={() => setView("menu")}
                    className="flex h-7 w-7 md:h-8 md:w-8 items-center justify-center rounded-full border border-white/15 bg-black/40 text-white/80 hover:bg-black/60 disabled:opacity-40 shrink-0"
                    aria-label={t("back")}
                  >
                    <span className="material-symbols-outlined text-[16px]! md:text-[18px]!">arrow_back</span>
                  </button>
                </div>
                <div className="flex flex-col gap-1.5 md:gap-2 flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden">
                  {!hasBalls && !hasPotions && (
                    <p className="text-label-md text-on-surface-variant text-center py-6">{t("bagEmpty")}</p>
                  )}
                  {hasBalls && (
                    <div className="flex flex-col gap-2">
                      <span className="text-label-sm uppercase text-on-surface-variant">{t("pokeballsLabel")}</span>
                      {ballStacks.map((b) => (
                        <button
                          key={b.itemId}
                          type="button"
                          disabled={isAnimating}
                          onClick={() => handleThrowBall(b.itemId, b.name)}
                          className="battle-bag-card disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Image
                            src={itemSpriteUrl(b.name)}
                            alt=""
                            width={32}
                            height={32}
                            unoptimized
                            className="w-8 h-8 object-contain [image-rendering:pixelated] shrink-0"
                          />
                          <span className="flex-1 text-left text-label-md text-on-surface font-bold">{b.name}</span>
                          <span className="text-label-sm text-on-surface-variant tabular-nums">×{b.quantity}</span>
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
                          className="battle-bag-card disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Image
                            src={itemSpriteUrl(p.name)}
                            alt=""
                            width={32}
                            height={32}
                            unoptimized
                            className="w-8 h-8 object-contain [image-rendering:pixelated] shrink-0"
                          />
                          <div className="flex-1 text-left">
                            <p className="text-label-md text-on-surface font-bold">{p.name}</p>
                            <p className="text-label-sm text-on-surface-variant">+{p.healAmount} HP</p>
                          </div>
                          <span className="text-label-sm text-on-surface-variant tabular-nums">×{p.quantity}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {view === "team" && (
              <div className="flex flex-col gap-1 md:gap-2 h-full min-h-0">
                <div className="flex items-center justify-between gap-2 px-0.5 shrink-0">
                  <p className="text-xs md:text-sm font-bold text-primary">{t("pokemonMenu")}</p>
                  {!mustSwitch && (
                    <button
                      type="button"
                      disabled={isAnimating}
                      onClick={() => setView("menu")}
                      className="flex h-7 w-7 md:h-8 md:w-8 items-center justify-center rounded-full border border-white/15 bg-black/40 text-white/80 hover:bg-black/60 disabled:opacity-40 shrink-0"
                      aria-label={t("back")}
                    >
                      <span className="material-symbols-outlined text-[16px]! md:text-[18px]!">arrow_back</span>
                    </button>
                  )}
                </div>
                {mustSwitch && (
                  <p className="text-label-sm text-error text-center shrink-0">{t("mustSwitchPrompt")}</p>
                )}
                <div className="flex flex-col gap-1.5 md:gap-2 flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden">
                  {teamRoster.map((m) => {
                    const fainted = m.currentHp <= 0;
                    const hpPct = Math.max(0, Math.min(100, (m.currentHp / m.maxHp) * 100));
                    const matchup = switchMatchupInfo(m.types);
                    return (
                      <button
                        key={m.instanceId}
                        type="button"
                        disabled={isAnimating || fainted}
                        onClick={() => handleSwitchTo(m)}
                        className="battle-bag-card disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {m.spriteUrl && (
                          <Image
                            src={m.spriteUrl}
                            alt={m.name}
                            width={40}
                            height={40}
                            className="w-10 h-10 object-contain"
                          />
                        )}
                        <div className="flex-1 text-left min-w-0">
                          <div className="flex justify-between items-baseline gap-2">
                            <span className="text-label-md text-on-surface font-bold capitalize truncate">
                              {m.name}
                            </span>
                            <span className="text-label-sm text-on-surface-variant shrink-0">
                              {t("level", { level: m.level })}
                            </span>
                          </div>
                          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mt-1">
                            <div
                              className={`h-full health-bar-fill ${hpPct > 50 ? "" : hpPct > 20 ? "yellow" : "red"}`}
                              style={{ width: `${hpPct}%` }}
                            />
                          </div>
                          <div className="mt-0.5 flex items-center justify-between gap-2">
                            <span className="text-label-sm text-on-surface-variant">
                              {fainted ? t("fainted") : `${m.currentHp}/${m.maxHp}`}
                            </span>
                            {!fainted && (
                              <span className={`text-[10px] font-bold leading-tight truncate ${matchup.className}`}>
                                {matchup.label}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="max-md:h-[100px] max-md:shrink-0 md:hidden" aria-hidden="true" />
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
  const portraitIsRemote = portraitUrl?.startsWith("http") ?? false;

  if (compact) {
    return (
      <div className="glass-panel rounded-lg border border-white/10 px-3 py-2 flex items-center gap-3">
        {portraitUrl && (
          <div className="w-10 h-12 rounded overflow-hidden border border-white/15 shrink-0 bg-surface-container-high">
            <Image
              src={portraitUrl}
              alt={name}
              width={40}
              height={48}
              unoptimized={portraitIsRemote}
              className="w-full h-full object-cover object-top"
            />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p
            title={name}
            className={`text-label-sm text-on-surface font-bold leading-tight line-clamp-2 ${
              align === "right" ? "text-right" : ""
            }`}
          >
            {name}
          </p>
          <div className={`mt-1 flex gap-1.5 ${align === "right" ? "justify-end" : ""}`}>{children}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-xl border border-white/10 p-2.5 h-full flex flex-col gap-2 min-w-0">
      <p
        title={name}
        className={`text-label-sm text-on-surface font-bold leading-tight px-0.5 line-clamp-2 ${
          align === "right" ? "text-right" : ""
        }`}
      >
        {name}
      </p>
      {portraitUrl && (
        <div className="mx-auto w-20 h-24 shrink-0 rounded-lg overflow-hidden border border-white/15 bg-surface-container-high">
          <Image
            src={portraitUrl}
            alt={name}
            width={80}
            height={96}
            unoptimized={portraitIsRemote}
            className="w-full h-full object-cover object-top"
          />
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
  compact = false,
}: {
  spriteUrl: string;
  name: string;
  fainted: boolean;
  active: boolean;
  hpPct?: number;
  compact?: boolean;
}) {
  return (
    <div
      title={name}
      className={`relative rounded-md border bg-surface-container-high/80 flex items-center justify-center overflow-hidden ${
        compact ? "h-7 w-7 shrink-0" : "aspect-square"
      } ${
        active ? "border-pokeball-red/70 ring-1 ring-pokeball-red/40" : "border-white/10"
      } ${fainted ? "opacity-35 grayscale" : ""}`}
    >
      {spriteUrl ? (
        <Image
          src={spriteUrl}
          alt={name}
          width={compact ? 28 : 40}
          height={compact ? 28 : 40}
          className={compact ? "w-6 h-6 object-contain" : "w-9 h-9 object-contain"}
        />
      ) : (
        <PokeballIcon className={compact ? "w-3.5 h-3.5 opacity-40" : "w-5 h-5 opacity-40"} />
      )}
      {typeof hpPct === "number" && !fainted && (
        <div className={`absolute bottom-0 left-0 right-0 bg-black/50 ${compact ? "h-0.5" : "h-1"}`}>
          <div
            className={`h-full ${hpPct > 50 ? "bg-emerald-400" : hpPct > 20 ? "bg-amber-400" : "bg-red-500"}`}
            style={{ width: `${Math.max(0, Math.min(100, hpPct))}%` }}
          />
        </div>
      )}
    </div>
  );
}

function EmptyPartySlot({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`rounded-md border border-dashed border-white/10 bg-black/20 flex items-center justify-center ${
        compact ? "h-7 w-7 shrink-0" : "aspect-square"
      }`}
    >
      <PokeballIcon className={compact ? "w-3 h-3 opacity-25" : "w-4 h-4 opacity-25"} />
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
  const critical = hpPct > 0 && hpPct <= 20;

  return (
    <div
      className={`rounded-lg border bg-black/55 backdrop-blur-sm px-2 py-1 md:px-2.5 md:py-1.5 shadow-lg ${
        critical ? "border-red-500/70 hp-plate-critical" : "border-white/15"
      } ${className}`}
    >
      <div className={`flex items-baseline gap-1.5 md:gap-2 ${align === "right" ? "flex-row-reverse" : ""}`}>
        <span className="text-[11px] md:text-label-md text-white font-bold capitalize truncate">{name}</span>
        <span className="text-[10px] md:text-label-sm text-white/70 shrink-0">{levelLabel}</span>
        {status && (
          <span className="text-[9px] md:text-[10px] uppercase tracking-wide text-amber-300 shrink-0">{status}</span>
        )}
      </div>
      <div className="h-1.5 md:h-2 bg-white/15 rounded-full overflow-hidden mt-0.5 md:mt-1">
        <div
          className={`h-full health-bar-fill ${hpClass}${critical ? " hp-bar-critical" : ""}`}
          style={{ width: `${hpPct}%` }}
        />
      </div>
      <p
        className={`text-[9px] md:text-[10px] mt-0.5 ${align === "right" ? "text-right" : ""} ${
          critical ? "text-red-300 font-bold" : "text-white/70"
        }`}
      >
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
