"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { submitBattleMove, type XpSummaryEntry } from "@/actions/battle-move";
import { submitDoubleBattleMoves } from "@/actions/double-battle-move";
import { fleeBattle } from "@/actions/flee-battle";
import { attemptCapture, type CapturedPokemonInfo } from "@/actions/attempt-capture";
import { switchPokemon } from "@/actions/switch-pokemon";
import { applyBattleItem } from "@/actions/use-item";
import { setPokemonNickname } from "@/actions/rename-pokemon";
import { forfeitPvpBattle } from "@/actions/forfeit-pvp-battle";
import { announceCoinDelta } from "@/lib/coin-fx";
import { PokeballIcon } from "@/components/pokeball-icon";
import { BattleSprite } from "@/components/battle-sprite";
import { battleSpeciesScale } from "@/lib/battle-sprite-scale";
import { getTypeEffectiveness } from "@/lib/type-effectiveness";
import { typeColor } from "@/lib/type-colors";
import { formatMoveName } from "@/lib/format-move-name";
import { gymLeaderPortraitUrl } from "@/lib/gym-art";
import { itemSpriteUrl } from "@/lib/item-sprites";
import {
  battleSfxForMove,
  playBattleSfx,
  preloadBattleSfx,
  unlockBattleAudio,
  type SfxKind,
} from "@/lib/battle-sfx";
import {
  resumeBattleBgm,
  startBattleBgm,
  stopBattleBgm,
} from "@/lib/battle-bgm";
import { BattleAudioControls } from "@/components/battle-audio-controls";
import { BattleSpeedControl } from "@/components/battle/battle-speed-control";
import {
  getBattleSpeed,
  getServerBattleSpeed,
  scaledDelay,
  subscribeBattleSpeed,
} from "@/lib/battle-speed";
import { impactFxUrl, resolveMoveProjectile, showdownBattleBgUrl, showdownFxUrl } from "@/lib/showdown-fx";
import {
  applyStagesToStats,
  statusAbbrKey,
  statusLabelKey,
  isStatusCondition,
  clampStage,
  emptyStatStages,
  statLabelKey,
  type BattleStat,
  type StatStages,
  type StatusCondition,
} from "@/lib/status";
import type { TurnEvent } from "@/lib/battle";
import type {
  BattleArenaProps,
  LogEntry,
  LogSide,
  MoveCategory,
  Outcome,
  RosterMember,
  View,
} from "@/components/battle/arena-types";
import { forecastDamage } from "@/lib/damage-forecast";
import { EmptyPartySlot, HpPlate, PartyIcon, PartySidebar } from "@/components/battle/arena-panels";
import { CaptureSummary } from "@/components/battle/capture-summary";
import { BattleOutcomeScreen } from "@/components/battle/battle-outcome-screen";
import { BagView, MovesView, TargetView, TeamView, TurnOrderChip } from "@/components/battle/command-views";
import { needsFoeTargetPick, isSpreadMove } from "@/lib/move-target";

export type { BattleArenaProps, OpponentPartyMember } from "@/components/battle/arena-types";

function hitSfxForMove(moveType: string, category?: TurnEvent["category"]): SfxKind {
  return battleSfxForMove(moveType, category);
}

const LUNGE_MS = 380;
/** Lunge corto por golpe en multi-hit (Pin Missile, Fury Attack…). */
const MULTI_STRIKE_MS = 240;
const MULTI_IMPACT_MS = 300;
const MULTI_GAP_MS = 70;
const IMPACT_MS = 560;
const STATUS_MS = 620;
const MISS_MS = 500;
/** Beat aparte para burn/poison: que no se confunda con el daño del golpe. */
const RESIDUAL_MS = 720;
const BALL_TRAVEL_MS = 620;
/** Un temblor individual (izquierda-derecha-asienta). */
const BALL_SHAKE_MS = 720;
/** Pausa entre temblores — genera tensión. */
const BALL_SHAKE_GAP_MS = 320;
const BALL_ABSORB_MS = 280;
const BALL_CATCH_MS = 900;
const BALL_BREAK_MS = 520;
const FAINT_MS = 1100;
const RECALL_MS = 450;
const ITEM_USE_MS = 550;
/** Brillo verde de curación (Recover, drenaje, Rest). */
const HEAL_PULSE_MS = 560;
const SEND_OUT_BALL_MS = 700; // cuánto se ve solo la pokeball, antes de revelar al Pokémon inicial

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, scaledDelay(ms)));
}

const NO_STAGES: StatStages = emptyStatStages();

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
  playerStats: initialPlayerStats,
  wildStats: initialWildStats,
  playerBStats: initialPlayerBStats = null,
  wildBStats: initialWildBStats = null,
  playerChoiceLockMoveId: initialChoiceLockMoveId,
  playerChargeMoveId: initialChargeMoveId,
  playerChargeMoveIdB: initialChargeMoveIdB = null,
  gymId,
  gymRunId,
  towerRunId = null,
  gymType,
  gymName,
  gymLeaderName,
  gymBadgeName,
  battleMode = gymId ? "gym" : towerRunId ? "tower" : "wild",
  battleBg = "meadow",
  format = "SINGLE",
  playerB = null,
  wildB = null,
  movesB,
  playerBStatus: initialPlayerBStatus = null,
  wildBStatus: initialWildBStatus = null,
}: BattleArenaProps) {
  const t = useTranslations("battle");
  const tLog = useTranslations("battle.log");
  const isGymBattle = battleMode === "gym";
  const isPvpBattle = battleMode === "pvp";
  const isTowerBattle = battleMode === "tower" || Boolean(towerRunId);
  const isDouble =
    (format === "DOUBLE" || Boolean(playerB && wildB)) &&
    Boolean(playerB) &&
    Boolean(wildB);
  // Gym, PvP, Torre o entrenador de ruta: no captura / no huida “salvaje”.
  const isTrainerStyle = isGymBattle || isPvpBattle || isTowerBattle || Boolean(opponentName);
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
    if (raw.startsWith("towerFloor:")) {
      return tLog("towerFloor", { floor: raw.slice("towerFloor:".length) });
    }
    if (raw === "format:double" || raw === "format:single") return null;
    if (raw.startsWith("doubleMove:")) return null;
    if (raw === "towerDoubleWin" || raw === "towerDoubleLoss") return null;
    if (raw.startsWith("challengePvp:")) {
      return tLog("challengeTrainer", { name: raw.slice("challengePvp:".length) });
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
    if (raw.startsWith("paralyzed:")) return tLog("paralyzed", { name: raw.slice("paralyzed:".length) });
    if (raw.startsWith("asleep:")) return tLog("asleep", { name: raw.slice("asleep:".length) });
    if (raw.startsWith("frozen:")) return tLog("frozen", { name: raw.slice("frozen:".length) });
    if (raw.startsWith("flinch:")) return tLog("flinch", { name: raw.slice("flinch:".length) });
    if (raw.startsWith("disobey:")) return tLog("disobey", { name: raw.slice("disobey:".length) });
    if (raw.startsWith("woke:")) return tLog("woke", { name: raw.slice("woke:".length) });
    if (raw.startsWith("thawed:")) return tLog("thawed", { name: raw.slice("thawed:".length) });
    if (raw === "nothing") return tLog("nothingHappened");
    if (raw.startsWith("heal:")) {
      const [name, amount] = raw.slice("heal:".length).split(":");
      return tLog("healed", { name: name ?? "", amount: Number(amount) || 0 });
    }
    if (raw.startsWith("recoil:")) {
      const [name, dmg] = raw.slice("recoil:".length).split(":");
      return tLog("recoil", { name: name ?? "", damage: Number(dmg) || 0 });
    }
    if (raw.startsWith("residual:")) {
      const rest = raw.slice("residual:".length);
      const [name, dmg, kind] = rest.split(":");
      if (kind === "burn") return tLog("residualBurn", { name: name ?? "", damage: Number(dmg) || 0 });
      if (kind === "poison") return tLog("residualPoison", { name: name ?? "", damage: Number(dmg) || 0 });
      return tLog("residual", { name: name ?? "", damage: Number(dmg) || 0 });
    }
    if (raw.startsWith("used:")) {
      const rest = raw.slice("used:".length);
      const i = rest.indexOf(":");
      if (i < 0) return raw;
      return tLog("used", {
        name: rest.slice(0, i),
        move: formatMoveName(rest.slice(i + 1)),
      });
    }
    if (raw.startsWith("damage:")) {
      const rest = raw.slice("damage:".length);
      const i = rest.indexOf(":");
      if (i < 0) return raw;
      return tLog("damage", { name: rest.slice(0, i), damage: Number(rest.slice(i + 1)) || 0 });
    }
    if (raw.startsWith("miss:")) {
      const rest = raw.slice("miss:".length);
      const i = rest.indexOf(":");
      if (i < 0) return raw;
      return tLog("miss", {
        name: rest.slice(0, i),
        move: formatMoveName(rest.slice(i + 1)),
      });
    }
    if (raw.startsWith("status:")) {
      const rest = raw.slice("status:".length);
      const i = rest.indexOf(":");
      if (i < 0) return raw;
      const statusRaw = rest.slice(i + 1);
      if (!isStatusCondition(statusRaw)) return raw;
      return tLog("statusApplied", {
        name: rest.slice(0, i),
        status: t(statusLabelKey(statusRaw)),
      });
    }
    if (raw.startsWith("fainted:")) return tLog("fainted", { name: raw.slice("fainted:".length) });
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
  const activePlayerIdRef = useRef(player.instanceId);
  const [playerHp, setPlayerHp] = useState(player.currentHp);
  const [playerMaxHp, setPlayerMaxHp] = useState(player.maxHp);
  const [playerBHp, setPlayerBHp] = useState(playerB?.currentHp ?? 0);
  const [playerBMaxHp, setPlayerBMaxHp] = useState(playerB?.maxHp ?? 0);
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
  const [wildBHp, setWildBHp] = useState(wildB?.currentHp ?? 0);
  const [wildBMaxHp, setWildBMaxHp] = useState(wildB?.maxHp ?? 0);
  const [playerStatus, setPlayerStatus] = useState<string | null>(initialPlayerStatus);
  const [wildStatus, setWildStatus] = useState<string | null>(initialWildStatus);
  const [playerBStatus, setPlayerBStatus] = useState<string | null>(initialPlayerBStatus);
  const [wildBStatus, setWildBStatus] = useState<string | null>(initialWildBStatus);
  const playerHpRef = useRef(player.currentHp);
  const playerBHpRef = useRef(playerB?.currentHp ?? 0);
  const wildHpRef = useRef(wild.currentHp);
  const wildBHpRef = useRef(wildB?.currentHp ?? 0);
  // Stages y velocidad se espejan del servidor para dos avisos: los badges de
  // subida/bajada de stat y quién pega primero. No deciden nada del combate.
  const [playerStages, setPlayerStages] = useState<StatStages>(NO_STAGES);
  const [wildStages, setWildStages] = useState<StatStages>(NO_STAGES);
  const [playerStats, setPlayerStats] = useState(initialPlayerStats);
  const [wildStats, setWildStats] = useState(initialWildStats);
  const battleSpeed = useSyncExternalStore(
    subscribeBattleSpeed,
    getBattleSpeed,
    getServerBattleSpeed,
  );
  const [log, setLog] = useState<LogEntry[]>(() => {
    const entries: LogEntry[] = [];
    for (const text of initialLog) {
      const translated = translateBootLog(text);
      if (translated) entries.push({ text: translated, side: "system" });
    }
    return entries;
  });
  const [attackingSide, setAttackingSide] = useState<"player" | "wild" | null>(null);
  const [attackingLane, setAttackingLane] = useState<"A" | "B">("A");
  const [shakingSide, setShakingSide] = useState<"player" | "wild" | null>(null);
  const [shakingLane, setShakingLane] = useState<"A" | "B">("A");
  const [faintingSide, setFaintingSide] = useState<"player" | "wild" | null>(null);
  const [faintingLane, setFaintingLane] = useState<"A" | "B">("A");
  const [playerEntering, setPlayerEntering] = useState(true);
  const [playerHidden, setPlayerHidden] = useState(true);
  const [wildEntering, setWildEntering] = useState(true);
  /** Sprite oculto por Fly/Dig/Dive (semi-invulnerable), por calle. */
  const [vanishedKeys, setVanishedKeys] = useState<string[]>([]);
  const [badgeEarned, setBadgeEarned] = useState(false);
  const [showBadgePopup, setShowBadgePopup] = useState(false);
  const [tmRewardName, setTmRewardName] = useState<string | null>(null);
  const [ballAnim, setBallAnim] = useState<"recall" | "throw" | null>("throw");
  // Quién está brillando de curación: objeto del jugador, Recover o drenaje.
  const [healingTarget, setHealingTarget] = useState<{
    side: "player" | "wild";
    lane: "A" | "B";
  } | null>(null);
  const [damagePopup, setDamagePopup] = useState<{
    side: "player" | "wild";
    lane: "A" | "B";
    text: string;
    key: number;
  } | null>(null);
  const [moveFx, setMoveFx] = useState<{
    key: number;
    /** Remounta proyectil/contacto/impacto sin reiniciar el banner. */
    strikeKey: number;
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
  const [pvpResult, setPvpResult] = useState<{
    matchId: string;
    ratingBefore: number;
    ratingAfter: number;
    coinsAwarded: number;
  } | null>(null);
  const needsForcedSwitch =
    player.currentHp <= 0 &&
    initialParty.some((m) => m.instanceId !== player.instanceId && m.currentHp > 0);
  const [view, setView] = useState<View>(needsForcedSwitch ? "team" : "menu");
  // Una vez que el jugador elige Luchar por primera vez, los turnos
  // siguientes abren directo en el menú de poderes (en vez de volver
  // siempre al menú raíz) — "volver" desde ahí sigue llevando al menú raíz.
  const [defaultView, setDefaultView] = useState<View>("menu");
  const [ballStacks, setBallStacks] = useState(pokeballs);
  const [potionStacks, setPotionStacks] = useState(potions);
  const [party, setParty] = useState(initialParty);
  const [opponentParty, setOpponentParty] = useState(initialOpponentParty);
  const [mustSwitch, setMustSwitch] = useState(needsForcedSwitch);
  const [activeMoves, setActiveMoves] = useState(moves);
  const [activeMovesB, setActiveMovesB] = useState(movesB ?? []);
  /** En dobles: primero move(+target) A, luego B. */
  const [pendingDoubleMoveA, setPendingDoubleMoveA] = useState<number | null>(null);
  const [pendingDoubleTargetA, setPendingDoubleTargetA] = useState<"A" | "B" | null>(null);
  const [pendingDoubleMoveB, setPendingDoubleMoveB] = useState<number | null>(null);
  const [targetPickFor, setTargetPickFor] = useState<"A" | "B" | null>(null);
  const [choiceLockMoveId, setChoiceLockMoveId] = useState(initialChoiceLockMoveId);
  const [chargeMoveId, setChargeMoveId] = useState(initialChargeMoveId);
  const [chargeMoveIdB, setChargeMoveIdB] = useState<number | null>(
    initialChargeMoveIdB,
  );
  const logEndRef = useRef<HTMLDivElement>(null);
  const [capturedInfo, setCapturedInfo] = useState<CapturedPokemonInfo | null>(null);
  const [caughtSentToPc, setCaughtSentToPc] = useState(false);
  const [nicknameInput, setNicknameInput] = useState("");
  const [savingNickname, setSavingNickname] = useState(false);
  const [captureBall, setCaptureBall] = useState<
    "throw" | "idle" | "wobble" | "success" | "fail" | null
  >(null);
  /** Nombre del ítem lanzado — para pintar Ultra/Great/Master en la animación. */
  const [captureBallName, setCaptureBallName] = useState<string | null>(null);
  const [captureShakeKey, setCaptureShakeKey] = useState(0);
  // Sacudida/flash del golpe escalados según % de HP máximo que representó
  // el daño — un golpe débil ya no se ve idéntico a uno que casi noquea.
  const [impactIntensity, setImpactIntensity] = useState(1);
  // Los sprites se dimensionan contra el alto real del campo, no contra px
  // fijos: el campo cambia mucho de alto entre mobile, desktop y DevTools.
  const arenaFieldRef = useRef<HTMLDivElement>(null);
  const [arenaHeightPx, setArenaHeightPx] = useState(0);
  const bgmKind = isGymBattle || isPvpBattle || opponentName ? "boss" : "wild";

  const teamRoster = party.filter((m) => m.instanceId !== activePlayer.instanceId);

  useEffect(() => {
    startBattleBgm(bgmKind);
    preloadBattleSfx();
    return () => stopBattleBgm();
  }, [bgmKind]);


  useEffect(() => {
    if (outcome !== "ongoing") stopBattleBgm();
  }, [outcome]);

  useEffect(() => {
    const field = arenaFieldRef.current;
    if (!field) return;
    const observer = new ResizeObserver(() => {
      const el = arenaFieldRef.current;
      if (el) setArenaHeightPx(el.clientHeight);
    });
    observer.observe(field);
    setArenaHeightPx(field.clientHeight);
    return () => observer.disconnect();
  }, []);

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

  function nameFor(side: "player" | "wild", slot: "A" | "B" = "A") {
    if (side === "player") {
      if (slot === "B" && playerB) return playerB.name;
      return activePlayerNameRef.current;
    }
    if (slot === "B" && wildB) return wildB.name;
    return activeWild.name;
  }

  function eventLane(event: TurnEvent): "A" | "B" {
    return event.fieldSlot === "B" ? "B" : "A";
  }

  function vanishKey(side: "player" | "wild", lane: "A" | "B") {
    return `${side}:${lane}`;
  }

  function isVanished(side: "player" | "wild", lane: "A" | "B" = "A") {
    return vanishedKeys.includes(vanishKey(side, lane));
  }

  function addVanish(side: "player" | "wild", lane: "A" | "B") {
    const key = vanishKey(side, lane);
    setVanishedKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
  }

  function clearVanish(side: "player" | "wild", lane: "A" | "B") {
    const key = vanishKey(side, lane);
    setVanishedKeys((prev) => prev.filter((k) => k !== key));
  }

  function clearVanishSide(side: "player" | "wild") {
    setVanishedKeys((prev) => prev.filter((k) => !k.startsWith(`${side}:`)));
  }

  function eventTargetLane(event: TurnEvent): "A" | "B" {
    const lane: "A" | "B" =
      event.targetFieldSlot === "A" || event.targetFieldSlot === "B"
        ? event.targetFieldSlot
        : event.fieldSlot === "B"
          ? "B"
          : "A";
    // Si el evento apunta a un mon ya a 0, redirigir al partner vivo (animación).
    // El defensor no siempre es el bando contrario: Earthquake pega al aliado
    // y un auto-boost se apunta a uno mismo.
    const side = event.targetSide ?? (event.side === "player" ? "wild" : "player");
    if (readHp(side, lane) <= 0) {
      const other: "A" | "B" = lane === "A" ? "B" : "A";
      if (readHp(side, other) > 0) return other;
    }
    return lane;
  }

  function readHp(side: "player" | "wild", lane: "A" | "B"): number {
    if (side === "player") return lane === "B" ? playerBHpRef.current : playerHpRef.current;
    return lane === "B" ? wildBHpRef.current : wildHpRef.current;
  }

  function readMaxHp(side: "player" | "wild", lane: "A" | "B"): number {
    if (side === "player") return lane === "B" ? playerBMaxHp : playerMaxHp;
    return lane === "B" ? wildBMaxHp : wildMaxHp;
  }

  function writeHp(side: "player" | "wild", lane: "A" | "B", hp: number) {
    const next = Math.max(0, hp);
    if (side === "player") {
      if (lane === "B") {
        playerBHpRef.current = next;
        setPlayerBHp(next);
        if (playerB) {
          setParty((prev) =>
            prev.map((m) =>
              m.instanceId === playerB.instanceId ? { ...m, currentHp: next } : m,
            ),
          );
        }
      } else {
        playerHpRef.current = next;
        setPlayerHp(next);
        const activeId = activePlayerIdRef.current;
        setParty((prev) =>
          prev.map((m) => (m.instanceId === activeId ? { ...m, currentHp: next } : m)),
        );
      }
    } else if (lane === "B") {
      wildBHpRef.current = next;
      setWildBHp(next);
    } else {
      wildHpRef.current = next;
      setWildHp(next);
    }
  }

  function writeStatus(side: "player" | "wild", lane: "A" | "B", status: string | null) {
    if (side === "player") {
      if (lane === "B") setPlayerBStatus(status);
      else setPlayerStatus(status);
    } else if (lane === "B") {
      setWildBStatus(status);
    } else {
      setWildStatus(status);
    }
  }

  /** Objeto equipado del jugador que se activó esta acción (Leftovers, Focus Sash, etc.) — siempre del lado jugador. */
  function appendItemTriggerLog(event: TurnEvent) {
    if (!event.itemEffect || !event.itemName) return;
    const activeId = activePlayerIdRef.current;
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

  function shakeStyle(side: "player" | "wild", lane: "A" | "B" = "A"): CSSProperties | undefined {
    return shakingSide === side && shakingLane === lane
      ? ({ "--shake-amt": `${10 * impactIntensity}px` } as CSSProperties)
      : undefined;
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

  /** Stats efectivos: base del servidor + stages y estado vistos en el log.
   *  Solo alimentan avisos (orden de turno, daño estimado); el servidor sigue
   *  siendo el único que resuelve el turno. */
  function withStages(
    base: { atk: number; def: number; spAtk: number; spDef: number; speed: number },
    stages: StatStages,
    status: string | null,
  ) {
    const condition = status && isStatusCondition(status) ? (status as StatusCondition) : null;
    return applyStagesToStats(base, stages, condition);
  }

  /** Brillo verde + barra que sube. Lo comparten Recover, Rest y el drenaje. */
  async function playHealBeat(
    side: "player" | "wild",
    lane: "A" | "B",
    amount: number,
    hpAfter: number,
  ) {
    playBattleSfx("heal");
    setHealingTarget({ side, lane });
    writeHp(side, lane, hpAfter);
    appendLog(tLog("healed", { name: nameFor(side, lane), amount }), side);
    await delay(HEAL_PULSE_MS);
    setHealingTarget(null);
  }

  /** Refleja un cambio de stage en los chips del panel y lo escribe en el log. */
  function applyStageChange(
    side: "player" | "wild",
    lane: "A" | "B",
    stat: BattleStat,
    stages: number,
  ) {
    const bump = (prev: StatStages): StatStages => ({
      ...prev,
      [stat]: clampStage(prev[stat] + stages),
    });
    // Los paneles del slot B todavía no muestran chips de stage.
    if (lane === "A") {
      if (side === "player") setPlayerStages(bump);
      else setWildStages(bump);
    }
    appendLog(
      tLog("statChange", {
        name: nameFor(side, lane),
        stat: tLog(statLabelKey(stat)),
        dir: stages < 0 ? tLog("statDown") : tLog("statUp"),
      }),
      side,
    );
  }

  const stagedPlayer = withStages(
    { atk: playerStats.atk, def: 1, spAtk: playerStats.spAtk, spDef: 1, speed: playerStats.speed },
    playerStages,
    playerStatus,
  );
  const stagedWild = withStages(
    { atk: 1, def: wildStats.def, spAtk: 1, spDef: wildStats.spDef, speed: wildStats.speed },
    wildStages,
    wildStatus,
  );

  // El servidor desempata a favor del jugador (playerActsFirst usa >=).
  const playerOutspeeds = stagedPlayer.speed >= stagedWild.speed;

  const activePlayerTypes =
    party.find((m) => m.instanceId === activePlayer.instanceId)?.types ?? [];

  function moveForecast(move: {
    name?: string;
    type: string;
    power?: number | null;
    category?: MoveCategory;
  }) {
    return forecastDamage(
      {
        level: activePlayer.level,
        atk: stagedPlayer.atk,
        spAtk: stagedPlayer.spAtk,
        types: activePlayerTypes,
        burned: playerStatus === "BURN",
      },
      {
        def: stagedWild.def,
        spDef: stagedWild.spDef,
        types: activeWild.types,
        maxHp: wildMaxHp,
      },
      move,
      wildHp,
    );
  }

  function matchupInfo(multiplier: number): { label: string; className: string } {
    if (multiplier === 0) return { label: t("noEffect"), className: "text-on-surface-variant" };
    if (multiplier > 1) return { label: t("superEffective"), className: "text-tertiary" };
    if (multiplier < 1) return { label: t("notVeryEffective"), className: "text-error" };
    return { label: t("regularEffective"), className: "text-on-surface-variant" };
  }

  /** Info de matchup + daño al elegir target en dobles. */
  function doubleTargetFoes() {
    const fromB = targetPickFor === "B";
    const pendingId = fromB ? pendingDoubleMoveB : pendingDoubleMoveA;
    const movePool = fromB ? activeMovesB : activeMoves;
    const move = movePool.find((m) => m.moveId === pendingId) ?? null;
    const isStatus = move?.category === "STATUS";

    const attackerTypes = fromB
      ? (party.find((m) => m.instanceId === playerB?.instanceId)?.types ?? [])
      : activePlayerTypes;
    const attackerLevel = fromB ? (playerB?.level ?? activePlayer.level) : activePlayer.level;
    const attackerAtk = fromB
      ? (initialPlayerBStats?.atk ?? playerStats.atk)
      : stagedPlayer.atk;
    const attackerSpAtk = fromB
      ? (initialPlayerBStats?.spAtk ?? playerStats.spAtk)
      : stagedPlayer.spAtk;
    const attackerBurned = fromB ? playerBStatus === "BURN" : playerStatus === "BURN";

    const attacker = {
      level: attackerLevel,
      atk: attackerAtk,
      spAtk: attackerSpAtk,
      types: attackerTypes,
      burned: attackerBurned,
    };

    // Un spread reparte: el pronóstico por calle tiene que bajar ×0.75 igual
    // que el servidor, si no promete un KO que no ocurre.
    const spreadTargets =
      move && isSpreadMove(null, move.name) && wildHp > 0 && wildBHp > 0 ? 2 : 1;
    const forecastCtx = { targetCount: spreadTargets };

    const laneA = {
      lane: "A" as const,
      name: activeWild.name,
      spriteUrl: activeWild.spriteUrl,
      currentHp: wildHp,
      maxHp: wildMaxHp,
      fainted: wildHp <= 0,
      types: activeWild.types,
      matchup: move
        ? matchupInfo(getTypeEffectiveness(move.type, activeWild.types))
        : matchupInfo(1),
      forecast:
        move && !isStatus
          ? forecastDamage(
              attacker,
              {
                def: stagedWild.def,
                spDef: stagedWild.spDef,
                types: activeWild.types,
                maxHp: wildMaxHp,
              },
              move,
              wildHp,
              forecastCtx,
            )
          : null,
      isStatus: Boolean(isStatus),
    };

    const bTypes = wildB?.types ?? [];
    const laneB = {
      lane: "B" as const,
      name: wildB?.name ?? "—",
      spriteUrl: wildB?.spriteUrl ?? "",
      currentHp: wildBHp,
      maxHp: wildBMaxHp,
      fainted: wildBHp <= 0,
      types: bTypes,
      matchup: move
        ? matchupInfo(getTypeEffectiveness(move.type, bTypes))
        : matchupInfo(1),
      forecast:
        move && !isStatus
          ? forecastDamage(
              attacker,
              {
                def: initialWildBStats?.def ?? stagedWild.def,
                spDef: initialWildBStats?.spDef ?? stagedWild.spDef,
                types: bTypes,
                maxHp: wildBMaxHp,
              },
              move,
              wildBHp,
              forecastCtx,
            )
          : null,
      isStatus: Boolean(isStatus),
    };

    return { move, foes: [laneA, laneB] };
  }

  /** Daño residual (burn/poison): beat visual propio, DESPUÉS del ataque. */
  async function playResidualBeat(event: TurnEvent) {
    if (!event.residualDamage || event.residualHpAfter == null) return;

    const side = event.side;
    const lane = eventLane(event);
    const status =
      event.residualStatus ??
      (side === "player"
        ? lane === "B"
          ? playerBStatus
          : playerStatus
        : lane === "B"
          ? wildBStatus
          : wildStatus);
    const flash =
      status === "BURN" ? "#E85D04" : status === "POISON" ? "#A040A0" : "#9CA3AF";
    const abbr =
      status && isStatusCondition(status) ? t(statusAbbrKey(status)) : null;

    // Pausa corta para que el golpe “asiente” antes del residual.
    await delay(280);
    playBattleSfx("status");
    const residualKey =
      status === "BURN"
        ? "residualBurn"
        : status === "POISON"
          ? "residualPoison"
          : "residual";
    appendLog(
      tLog(residualKey, { name: nameFor(side, lane), damage: event.residualDamage }),
      side,
    );
    setMoveFx(null);
    setEffPopup(null);
    setArenaFlash(flash);
    setShakingSide(side);
    setShakingLane(eventLane(event));
    setImpactIntensity(0.75);
    setDamagePopup({
      side,
      lane: eventLane(event),
      text: abbr ? `${abbr} -${event.residualDamage}` : `-${event.residualDamage}`,
      key: Date.now(),
    });
    writeHp(side, lane, event.residualHpAfter);

    await delay(RESIDUAL_MS);
    setShakingSide(null);
    setArenaFlash(null);
    setDamagePopup(null);
  }

  function playEvent(event: TurnEvent): Promise<void> {
    const lane = eventLane(event);
    const targetLane = eventTargetLane(event);
    return new Promise((resolve) => {
      const color = typeColor(event.moveType);
      const fxKey = Date.now();
      const isChargeStart = event.chargePhase === "start";
      const mode = event.skipped
        ? "miss"
        : isChargeStart
          ? "status"
          : !event.hit
            ? "miss"
            : event.isStatus
              ? "status"
              : "hit";
      const projectile =
        mode === "hit" ? resolveMoveProjectile(event.moveType, event.category) : null;
      const previewDamages =
        mode === "hit" && event.hitDamages && event.hitDamages.length > 0
          ? event.hitDamages
          : mode === "hit"
            ? [event.damage]
            : [];
      const multiHit = previewDamages.length > 1;

      // Miss / skip / status suenan al inicio; el hit tipado espera al impacto.
      if (
        event.skipped === "asleep" ||
        event.skipped === "paralyzed" ||
        event.skipped === "frozen" ||
        event.skipped === "disobey" ||
        event.skipped === "flinch"
      ) {
        playBattleSfx("status");
      } else if (!event.hit) {
        playBattleSfx("miss");
      } else if (event.isStatus || isChargeStart) {
        playBattleSfx("status");
      }

      setMoveFx({
        key: fxKey,
        strikeKey: fxKey,
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
        if (event.statusNote === "woke") appendLog(tLog("woke", { name: nameFor(event.side, lane) }), event.side);
        if (event.statusNote === "thawed") appendLog(tLog("thawed", { name: nameFor(event.side, lane) }), event.side);
        if (event.skipped === "asleep") appendLog(tLog("asleep", { name: nameFor(event.side, lane) }), event.side);
        else if (event.skipped === "paralyzed") appendLog(tLog("paralyzed", { name: nameFor(event.side, lane) }), event.side);
        else if (event.skipped === "frozen") appendLog(tLog("frozen", { name: nameFor(event.side, lane) }), event.side);
        else if (event.skipped === "flinch") appendLog(tLog("flinch", { name: nameFor(event.side, lane) }), event.side);
        else appendLog(tLog("disobey", { name: nameFor(event.side, lane) }), event.side);
        // Un status corta la carga: el sprite vuelve a verse.
        clearVanish(event.side, lane);
        void (async () => {
          await delay(STATUS_MS);
          setMoveFx(null);
          await playResidualBeat(event);
          appendItemTriggerLog(event);
          resolve();
        })();
        return;
      }

      // Turno 1 de Fly/Dig/Solar Beam: no pega; vanish oculta el sprite.
      if (event.chargePhase === "start") {
        appendLog(tLog("used", { name: nameFor(event.side, lane), move: formatMoveName(event.moveName) }), event.side);
        const moveKey = event.moveName.trim().toLowerCase().replace(/\s+/g, "-");
        if (event.semiInvuln === "air") {
          appendLog(tLog("flewUp", { name: nameFor(event.side, lane) }), event.side);
        } else if (event.semiInvuln === "underground") {
          appendLog(tLog("dugDown", { name: nameFor(event.side, lane) }), event.side);
        } else if (event.semiInvuln === "underwater") {
          appendLog(tLog("doveUnder", { name: nameFor(event.side, lane) }), event.side);
        } else if (moveKey === "skull-bash") {
          appendLog(tLog("tuckedHead", { name: nameFor(event.side, lane) }), event.side);
        } else {
          appendLog(tLog("charging", { name: nameFor(event.side, lane) }), event.side);
        }
        if (event.selfStatChange) {
          const { stat, stages } = event.selfStatChange;
          applyStageChange(event.side, lane, stat, stages);
        }
        if (event.semiInvuln) {
          setAttackingSide(event.side);
          setAttackingLane(lane);
          void (async () => {
            await delay(MULTI_STRIKE_MS);
            setAttackingSide(null);
            addVanish(event.side, lane);
            await delay(STATUS_MS);
            setMoveFx(null);
            await playResidualBeat(event);
            appendItemTriggerLog(event);
            resolve();
          })();
        } else {
          void (async () => {
            await delay(STATUS_MS);
            setMoveFx(null);
            await playResidualBeat(event);
            appendItemTriggerLog(event);
            resolve();
          })();
        }
        return;
      }

      // Turno 2: reaparece antes del golpe.
      if (event.chargePhase === "finish") {
        clearVanish(event.side, lane);
      }

      // Multi-hit: un strike por golpe adentro del loop (no un solo lunge al inicio).
      if (!multiHit) {
        setAttackingSide(event.side);
        setAttackingLane(lane);
      }

      void (async () => {
        await delay(multiHit ? 120 : LUNGE_MS);
        if (!multiHit) setAttackingSide(null);

        if (event.statusNote === "woke") appendLog(tLog("woke", { name: nameFor(event.side, lane) }), event.side);
        if (event.statusNote === "thawed") appendLog(tLog("thawed", { name: nameFor(event.side, lane) }), event.side);

        if (!event.hit) {
          // "Falló" e "inmune" son cosas distintas: Fissure contra un Flying no
          // erró la puntería, simplemente no le hace nada.
          if (event.noEffect) {
            appendLog(tLog("used", { name: nameFor(event.side, lane), move: formatMoveName(event.moveName) }), event.side);
            appendLog(tLog("noEffect"), event.side);
            setEffPopup({ text: tLog("noEffect"), key: fxKey });
            void delay(MISS_MS).then(() => setEffPopup(null));
          } else {
            appendLog(tLog("miss", { name: nameFor(event.side, lane), move: formatMoveName(event.moveName) }), event.side);
          }
          await delay(MISS_MS);
          setMoveFx(null);
          await playResidualBeat(event);
          appendItemTriggerLog(event);
          resolve();
          return;
        }

        if (event.isStatus) {
          appendLog(tLog("used", { name: nameFor(event.side, lane), move: formatMoveName(event.moveName) }), event.side);
          if (event.statusApplied) {
            const foe = event.targetSide ?? (event.side === "player" ? "wild" : "player");
            const label = t(statusLabelKey(event.statusApplied as StatusCondition));
            appendLog(tLog("statusApplied", { name: nameFor(foe, targetLane), status: label }), foe);
            writeStatus(foe, targetLane, event.statusApplied);
          }
          if (event.statChange) {
            const foe = event.targetSide ?? (event.side === "player" ? "wild" : "player");
            const { stat, stages } = event.statChange;
            applyStageChange(foe, targetLane, stat, stages);
          }
          for (const boost of event.selfStatChanges ?? []) {
            applyStageChange(event.side, lane, boost.stat, boost.stages);
          }
          if (event.healAmount && event.healHpAfter != null) {
            await playHealBeat(event.side, lane, event.healAmount, event.healHpAfter);
          }
          if (event.noEffect) {
            appendLog(tLog("nothingHappened"), event.side);
          }
          setArenaFlash(color);
          void delay(320).then(() => setArenaFlash(null));
          await delay(STATUS_MS);
          setMoveFx(null);
          await playResidualBeat(event);
          appendItemTriggerLog(event);
          resolve();
          return;
        }

        // SFX tipado + thud de daño al impacto (más audible).
        const typed = hitSfxForMove(event.moveType, event.category);
        const defenderSide =
          event.targetSide ?? (event.side === "player" ? "wild" : "player");
        const defenderMaxHpNow = readMaxHp(defenderSide, targetLane);
        const hitDamages = previewDamages;

        appendLog(tLog("used", { name: nameFor(event.side, lane), move: formatMoveName(event.moveName) }), event.side);

        let hpCursor = readHp(defenderSide, targetLane);

        for (let i = 0; i < hitDamages.length; i++) {
          const chunk = hitDamages[i]!;
          const fxHitKey = fxKey + i + 1;

          if (multiHit) {
            // Strike + FX de ataque por golpe (lunge / proyectil / contacto).
            setMoveFx((prev) => (prev ? { ...prev, strikeKey: fxHitKey } : prev));
            setAttackingSide(event.side);
            setAttackingLane(lane);
            await delay(MULTI_STRIKE_MS);
            setAttackingSide(null);
            await delay(40);
          }

          playBattleSfx(typed);
          if (typed !== "contact" && typed !== "hit") playBattleSfx("damage");
          if (i === 0 && event.critical) playBattleSfx("crit");
          else if (i === 0 && event.effectiveness > 1) playBattleSfx("superEffective");

          const impactRatio = defenderMaxHpNow > 0 ? chunk / defenderMaxHpNow : 0;
          setShakingSide(defenderSide);
          setShakingLane(targetLane);
          setImpactIntensity(Math.min(1.7, Math.max(0.55, 0.55 + impactRatio * 2.3)));
          setArenaFlash(color);
          setDamagePopup({
            side: defenderSide,
            lane: targetLane,
            text: `-${chunk}`,
            key: fxHitKey,
          });

          hpCursor = Math.max(0, hpCursor - chunk);
          // Último golpe: HP final del server para no desincronizar.
          const hpShow = i === hitDamages.length - 1 ? event.hpAfter : hpCursor;
          writeHp(defenderSide, targetLane, hpShow);

          if (i === 0) {
            if (event.effectiveness > 1) {
              setEffPopup({ text: tLog("superEffective"), key: fxHitKey });
            } else if (event.effectiveness > 0 && event.effectiveness < 1) {
              setEffPopup({ text: tLog("notVeryEffective"), key: fxHitKey });
            } else if (event.effectiveness === 0) {
              setEffPopup({ text: tLog("noEffect"), key: fxHitKey });
            } else if (event.critical) {
              setEffPopup({ text: tLog("critical"), key: fxHitKey });
            }
          }

          await delay(multiHit ? MULTI_IMPACT_MS : IMPACT_MS);
          setShakingSide(null);
          setArenaFlash(null);
          setDamagePopup(null);
          if (i === 0) setEffPopup(null);
          if (multiHit && i < hitDamages.length - 1) {
            await delay(MULTI_GAP_MS);
          }
        }

        if (multiHit) {
          appendLog(tLog("hitTimes", { count: hitDamages.length }), event.side);
        }
        if (event.critical) appendLog(tLog("critical"), event.side);
        if (event.effectiveness > 1) appendLog(tLog("superEffective"), event.side);
        else if (event.effectiveness > 0 && event.effectiveness < 1) appendLog(tLog("notVeryEffective"), event.side);
        else if (event.effectiveness === 0) appendLog(tLog("noEffect"), event.side);
        appendLog(tLog("damage", { name: nameFor(defenderSide, targetLane), damage: event.damage }), defenderSide);

        if (event.statusApplied) {
          const label = t(statusLabelKey(event.statusApplied as StatusCondition));
          appendLog(tLog("statusApplied", { name: nameFor(defenderSide, targetLane), status: label }), defenderSide);
          writeStatus(defenderSide, targetLane, event.statusApplied);
        }

        if (event.ohko) {
          appendLog(tLog("ohko", { name: nameFor(defenderSide, targetLane) }), defenderSide);
        }

        if (event.healAmount && event.healHpAfter != null) {
          await playHealBeat(event.side, lane, event.healAmount, event.healHpAfter);
        }

        if (event.recoilDamage) {
          appendLog(tLog("recoil", { name: nameFor(event.side, lane), damage: event.recoilDamage }), event.side);
          // El servidor manda el HP exacto: recalcularlo acá desfasaba cuando
          // el mismo golpe curaba (drenaje) y hacía retroceso.
          writeHp(
            event.side,
            lane,
            event.recoilHpAfter ??
              Math.max(0, readHp(event.side, lane) - event.recoilDamage),
          );
        }

        const defenderMaxHp = readMaxHp(defenderSide, targetLane);
        if (event.hpAfter > 0 && event.hpAfter / defenderMaxHp <= 0.1) {
          appendLog(tLog("lowHp", { name: nameFor(defenderSide, targetLane) }), defenderSide);
        }

        setMoveFx(null);
        await playResidualBeat(event);
        appendItemTriggerLog(event);
        resolve();
      })();
    });
  }

  async function playFaintAndFinish(
    side: "player" | "wild",
    finalOutcome: Outcome,
    opts?: { skipFaintBeat?: boolean },
  ) {
    if (!opts?.skipFaintBeat) {
      appendLog(tLog("fainted", { name: nameFor(side) }), side);
      playBattleSfx("faint");
      setFaintingSide(side);
    }
    if (side === "wild") {
      setOpponentParty((prev) =>
        prev.map((m) => (m.active ? { ...m, fainted: true, active: false } : m)),
      );
    } else {
      setParty((prev) =>
        prev.map((m) =>
          m.instanceId === activePlayerIdRef.current ? { ...m, currentHp: 0 } : m,
        ),
      );
    }
    if (!opts?.skipFaintBeat) await delay(FAINT_MS);
    // Un beat corto para que el KO asiente antes del cartel.
    await delay(450);
    setOutcome(finalOutcome);
    // No refrescar acá: un refresh RSC (o revalidate de /battle) puede
    // mandar a /run y cortar el resumen. SoftLeave hace el push/refresh.
  }

  async function playFaintThenForceSwitch() {
    appendLog(tLog("fainted", { name: activePlayer.name }), "player");
    playBattleSfx("faint");
    setFaintingSide("player");
    setParty((prev) =>
      prev.map((m) =>
        m.instanceId === activePlayerIdRef.current ? { ...m, currentHp: 0 } : m,
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
    stats: { def: number; spDef: number; speed: number };
  }) {
    appendLog(tLog("fainted", { name: activeWild.name }), "wild");
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
    setWildStages(NO_STAGES);
    setWildStatus(null);
    setWildStats(next.stats);
    setWildEntering(true);
    setTimeout(() => setWildEntering(false), 400);
    appendLog(t("trainerSendOut", { name: next.name }), "wild");
  }

  playerHpRef.current = playerHp;
  playerBHpRef.current = playerBHp;
  wildHpRef.current = wildHp;
  wildBHpRef.current = wildBHp;

  function livingFoeLanes(): ("A" | "B")[] {
    const out: ("A" | "B")[] = [];
    if (wildHpRef.current > 0) out.push("A");
    if (wildBHpRef.current > 0) out.push("B");
    return out;
  }

  function clampFoeLane(lane: "A" | "B" | null | undefined): "A" | "B" | null {
    const living = livingFoeLanes();
    if (living.length === 0) return null;
    if (lane === "A" || lane === "B") {
      if (living.includes(lane)) return lane;
    }
    return living[0] ?? null;
  }

  function moveNeedsTargetPick(moveId: number, fromB: boolean): boolean {
    if (livingFoeLanes().length < 2) return false;
    const pool = fromB ? activeMovesB : activeMoves;
    const m = pool.find((x) => x.moveId === moveId);
    // Sin data de move: igual pedimos target (mejor que auto-pegarle al A).
    if (!m) return true;
    return needsFoeTargetPick(m.target, m.name);
  }

  /** KO de una calle suelta en dobles: el combate sigue, pero el sprite cae. */
  async function playLaneFaint(side: "player" | "wild", lane: "A" | "B") {
    appendLog(tLog("fainted", { name: nameFor(side, lane) }), side);
    playBattleSfx("faint");
    setFaintingSide(side);
    setFaintingLane(lane);
    await delay(FAINT_MS);
    setFaintingSide(null);
    setFaintingLane("A");
  }

  /**
   * En dobles, un mon en carga (Fly/Dig…) no elige move ni target: quedan
   * forzados del turno 1 (si el target murió, el finish falla solo).
   */
  async function enterDoubleFight(opts?: {
    lockA?: number | null;
    lockB?: number | null;
  }) {
    const lockA = opts?.lockA !== undefined ? opts.lockA : chargeMoveId;
    const lockB = opts?.lockB !== undefined ? opts.lockB : chargeMoveIdB;
    const aAlive = playerHpRef.current > 0;
    const bAlive = playerBHpRef.current > 0;

    setPendingDoubleMoveA(null);
    setPendingDoubleTargetA(null);
    setPendingDoubleMoveB(null);
    setTargetPickFor(null);

    if (aAlive && lockA != null) {
      // Target ya locked en servidor; no pedimos de nuevo.
      setPendingDoubleMoveA(lockA);
      setPendingDoubleTargetA(null);

      if (bAlive && lockB != null) {
        await runDoubleTurn(lockA, lockB, null, null);
        return;
      }
      if (!bAlive) {
        await runDoubleTurn(lockA, -1, null, null);
        return;
      }
      setView("moves");
      return;
    }

    if (!aAlive && bAlive && lockB != null) {
      await runDoubleTurn(-1, lockB, null, null);
      return;
    }

    setView("moves");
  }

  async function runDoubleTurn(
    moveA: number,
    moveB: number,
    targetA: "A" | "B" | null,
    targetB: "A" | "B" | null,
  ) {
    setPendingDoubleMoveA(null);
    setPendingDoubleTargetA(null);
    setPendingDoubleMoveB(null);
    setTargetPickFor(null);
    setIsAnimating(true);
    setView("menu");

    const hpBefore = {
      playerA: playerHpRef.current,
      playerB: playerBHpRef.current,
      wildA: wildHpRef.current,
      wildB: wildBHpRef.current,
    };

    const result = await submitDoubleBattleMoves(
      battleId,
      moveA,
      moveB,
      locale,
      clampFoeLane(targetA),
      clampFoeLane(targetB),
    );
    if (!result) {
      setIsAnimating(false);
      return;
    }

    for (const event of result.events) {
      await playEvent(event);
    }

    setPlayerMaxHp(result.playerMaxHp);
    setWildMaxHp(result.wildMaxHp);
    setPlayerHp(result.playerHp);
    setWildHp(result.wildHp);
    playerHpRef.current = result.playerHp;
    wildHpRef.current = result.wildHp;
    if (result.playerBMaxHp != null) setPlayerBMaxHp(result.playerBMaxHp);
    if (result.wildBMaxHp != null) setWildBMaxHp(result.wildBMaxHp);
    if (result.playerBHp != null) {
      playerBHpRef.current = result.playerBHp;
      setPlayerBHp(result.playerBHp);
    }
    if (result.wildBHp != null) {
      wildBHpRef.current = result.wildBHp;
      setWildBHp(result.wildBHp);
    }
    setPlayerStatus(result.playerStatus);
    setWildStatus(result.wildStatus);
    setPlayerBStatus(result.playerBStatus);
    setWildBStatus(result.wildBStatus);
    setChargeMoveId(result.playerChargeMoveId);
    setChargeMoveIdB(result.playerChargeMoveIdB ?? null);
    setActiveMoves((prev) =>
      prev.map((m) => {
        const upd = result.playerMovesPp.find((p) => p.moveId === m.moveId);
        return upd ? { ...m, pp: upd.pp } : m;
      }),
    );
    setActiveMovesB((prev) =>
      prev.map((m) => {
        const upd = result.playerMovesPpB.find((p) => p.moveId === m.moveId);
        return upd ? { ...m, pp: upd.pp } : m;
      }),
    );

    // Cada calle que cayó en este turno se anima por separado; sin esto el
    // sprite noqueado se quedaba en pantalla hasta el final del combate.
    const laneKos: { side: "player" | "wild"; lane: "A" | "B" }[] = [];
    if (hpBefore.wildA > 0 && result.wildHp <= 0) laneKos.push({ side: "wild", lane: "A" });
    if (hpBefore.wildB > 0 && (result.wildBHp ?? 0) <= 0) {
      laneKos.push({ side: "wild", lane: "B" });
    }
    if (hpBefore.playerA > 0 && result.playerHp <= 0) {
      laneKos.push({ side: "player", lane: "A" });
    }
    if (hpBefore.playerB > 0 && (result.playerBHp ?? 0) <= 0) {
      laneKos.push({ side: "player", lane: "B" });
    }
    for (const ko of laneKos) {
      await playLaneFaint(ko.side, ko.lane);
    }

    const bothFoesDown =
      result.wildHp <= 0 && (result.wildBHp == null || result.wildBHp <= 0);
    const bothPlayersDown =
      result.playerHp <= 0 && (result.playerBHp == null || result.playerBHp <= 0);

    // Los KO ya se animaron arriba: el cierre sólo marca el resultado.
    if (result.outcome === "won" || bothFoesDown) {
      await playFaintAndFinish("wild", "won", { skipFaintBeat: true });
    } else if (result.outcome === "lost" || bothPlayersDown) {
      await playFaintAndFinish("player", "lost", { skipFaintBeat: true });
    } else {
      setIsAnimating(false);
      if (defaultView === "moves") {
        await enterDoubleFight({
          lockA: result.playerChargeMoveId,
          lockB: result.playerChargeMoveIdB ?? null,
        });
      } else {
        setView(defaultView);
      }
    }
  }

  async function handleDoubleTarget(lane: "A" | "B") {
    if (isAnimating || outcome !== "ongoing") return;
    unlockBattleAudio();
    resumeBattleBgm();

    if (targetPickFor === "A" && pendingDoubleMoveA != null) {
      const aAlive = playerHp > 0;
      const bAlive = playerBHp > 0;
      if (aAlive && bAlive) {
        setPendingDoubleTargetA(lane);
        setTargetPickFor(null);
        if (chargeMoveIdB != null) {
          // B en carga: target ya locked; no pedir.
          await runDoubleTurn(pendingDoubleMoveA, chargeMoveIdB, lane, null);
          return;
        }
        setView("moves");
        return;
      }
      await runDoubleTurn(
        aAlive ? pendingDoubleMoveA : -1,
        bAlive ? pendingDoubleMoveA : -1,
        aAlive ? lane : null,
        bAlive ? lane : null,
      );
      return;
    }

    if (targetPickFor === "B" && pendingDoubleMoveA != null && pendingDoubleMoveB != null) {
      await runDoubleTurn(
        pendingDoubleMoveA,
        pendingDoubleMoveB,
        pendingDoubleTargetA,
        lane,
      );
    }
  }

  async function handleMove(moveId: number) {
    if (isAnimating || outcome !== "ongoing" || mustSwitch) return;
    unlockBattleAudio();
    resumeBattleBgm();

    if (isDouble) {
      const aAlive = playerHpRef.current > 0;
      const bAlive = playerBHpRef.current > 0;
      const foes = livingFoeLanes();

      // Fase A: aún no hay move A confirmado.
      if (pendingDoubleMoveA == null) {
        // Si A está en carga, el servidor fuerza el move — no dejamos elegir otro.
        const effectiveA = chargeMoveId ?? moveId;
        // Spread y auto-target (Swords Dance, Recover) no eligen rival.
        // Target solo al empezar; en el finish de carga no se vuelve a pedir.
        if (chargeMoveId == null && moveNeedsTargetPick(effectiveA, false)) {
          setPendingDoubleMoveA(effectiveA);
          setTargetPickFor("A");
          setView("targets");
          return;
        }
        if (aAlive && bAlive) {
          setPendingDoubleMoveA(effectiveA);
          setPendingDoubleTargetA(null);
          if (chargeMoveIdB != null) {
            await runDoubleTurn(effectiveA, chargeMoveIdB, null, null);
            return;
          }
          setView("moves");
          return;
        }
        const onlyLane = foes[0] ?? null;
        await runDoubleTurn(
          aAlive ? effectiveA : -1,
          bAlive ? (chargeMoveIdB ?? effectiveA) : -1,
          aAlive && chargeMoveId == null ? onlyLane : null,
          bAlive && chargeMoveIdB == null ? onlyLane : null,
        );
        return;
      }

      // Fase B: move del partner (o carga forzada).
      const effectiveB = chargeMoveIdB ?? moveId;
      // Si B está en carga, no re-elige target.
      if (chargeMoveIdB == null && moveNeedsTargetPick(effectiveB, true)) {
        setPendingDoubleMoveB(effectiveB);
        setTargetPickFor("B");
        setView("targets");
        return;
      }
      await runDoubleTurn(
        pendingDoubleMoveA,
        effectiveB,
        pendingDoubleTargetA,
        chargeMoveIdB != null ? null : (foes[0] ?? null),
      );
      return;
    }

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
    setChargeMoveId(result.playerChargeMoveId);
    setActiveMoves((prev) =>
      prev.map((m) => {
        const upd = result.playerMovesPp.find((p) => p.moveId === m.moveId);
        return upd ? { ...m, pp: upd.pp } : m;
      }),
    );
    if (result.xpGained) {
      appendLog(t("xpGained", { xp: result.xpGained }));
    }
    if (result.xpSummary) {
      setXpSummary(result.xpSummary);
    }
    if (result.coinsGained > 0) {
      setCoinsGained(result.coinsGained);
      announceCoinDelta(result.coinsGained);
    }
    if (result.pvpResult) {
      setPvpResult(result.pvpResult);
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
      clearVanishSide("wild");
      setView(defaultView);
    } else if (result.playerChargeMoveId != null) {
      // 2º turno automático (como en los juegos): no pedimos otro click.
      setView("menu");
      const finishId = result.playerChargeMoveId;
      const finish = await submitBattleMove(battleId, finishId, locale);
      if (finish) {
        for (const event of finish.events) {
          await playEvent(event);
        }
        setPlayerMaxHp(finish.playerMaxHp);
        setPlayerStatus(finish.playerStatus);
        setWildStatus(finish.wildStatus);
        setChoiceLockMoveId(finish.playerChoiceLockMoveId);
        setChargeMoveId(finish.playerChargeMoveId);
        setActiveMoves((prev) =>
          prev.map((m) => {
            const upd = finish.playerMovesPp.find((p) => p.moveId === m.moveId);
            return upd ? { ...m, pp: upd.pp } : m;
          }),
        );
        if (finish.xpGained) appendLog(t("xpGained", { xp: finish.xpGained }));
        if (finish.xpSummary) setXpSummary(finish.xpSummary);
        if (finish.coinsGained > 0) {
          setCoinsGained(finish.coinsGained);
          announceCoinDelta(finish.coinsGained);
        }
        if (finish.pvpResult) setPvpResult(finish.pvpResult);
        if (finish.badgeEarned) {
          appendLog(t("badgeEarned"));
          playBattleSfx("badge");
          setBadgeEarned(true);
          setShowBadgePopup(true);
        }
        if (finish.tmRewardName) {
          appendLog(t("tmEarned", { code: finish.tmRewardName }));
          setTmRewardName(finish.tmRewardName);
        }
        if (finish.outcome === "won") {
          await playFaintAndFinish("wild", "won");
        } else if (finish.outcome === "lost") {
          await playFaintAndFinish("player", "lost");
        } else if (finish.outcome === "trainer_cleared") {
          await playFaintAndFinish("wild", "trainer_cleared");
        } else if (finish.outcome === "fainted") {
          await playFaintThenForceSwitch();
        } else if (finish.outcome === "gym_continues" && finish.nextOpponent) {
          await playWildFaintThenReveal(finish.nextOpponent);
          clearVanishSide("wild");
          setView(defaultView);
        } else {
          setView(defaultView);
        }
      } else {
        setView(defaultView);
      }
    } else {
      setView(defaultView);
    }

    setIsAnimating(false);
  }

  async function handleFlee() {
    if (isAnimating || mustSwitch || outcome !== "ongoing") return;
    if (isGymBattle) return;
    setIsAnimating(true);
    setView("menu");

    try {
      if (isPvpBattle) {
        await forfeitPvpBattle(locale);
        return;
      }
      const result = await fleeBattle(battleId, locale);
      if (!result) {
        appendLog(tLog("fleeFailed"), "system");
        setView(defaultView);
        return;
      }

      if (result.fled) {
        appendLog(tLog("fled"), "player");
        setOutcome("fled");
        return;
      }

      appendLog(tLog("fleeFailed"), "system");
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
    } catch {
      appendLog(tLog("fleeFailed"), "system");
      setView(defaultView);
    } finally {
      setIsAnimating(false);
    }
  }

  async function handleThrowBall(itemId: string, ballName: string) {
    if (isAnimating || outcome !== "ongoing" || mustSwitch || isTrainerStyle) return;
    setIsAnimating(true);
    setView("menu");
    appendLog(tLog("threwBall", { name: ballName }), "player");
    playBattleSfx("ball");

    const prevBalls = ballStacks;
    setBallStacks((prev) =>
      prev.map((b) => (b.itemId === itemId ? { ...b, quantity: b.quantity - 1 } : b)).filter((b) => b.quantity > 0),
    );

    // Tirada en paralelo al viaje de la ball — el resultado manda los temblores.
    const resultPromise = attemptCapture(battleId, itemId, locale);

    setCaptureBallName(ballName);
    setCaptureBall("throw");
    await delay(BALL_TRAVEL_MS);
    setCaptureBall("idle");
    await delay(BALL_ABSORB_MS);

    const result = await resultPromise;
    if (!result) {
      setBallStacks(prevBalls);
      setCaptureBall(null);
      setCaptureBallName(null);
      setIsAnimating(false);
      setView(defaultView);
      return;
    }

    // Hasta 3 temblores visibles; el 4º check es el “click” de captura.
    const visibleShakes = Math.min(result.shakes, 3);
    for (let i = 0; i < visibleShakes; i++) {
      setCaptureShakeKey((k) => k + 1);
      setCaptureBall("wobble");
      playBattleSfx("ball");
      await delay(BALL_SHAKE_MS);
      setCaptureBall("idle");
      if (i < visibleShakes - 1 || result.caught) {
        await delay(BALL_SHAKE_GAP_MS);
      }
    }

    if (result.caught) {
      setCaptureBall("success");
      playBattleSfx("crit");
      await delay(BALL_CATCH_MS);
      appendLog(tLog("caught", { name: activeWild.name }), "player");
      if (result.capturedPokemon?.sentToPc) {
        appendLog(t("sentToPcHint"), "system");
        setCaughtSentToPc(true);
      }
      setCapturedInfo(result.capturedPokemon);
      setNicknameInput("");
      setCaptureBall(null);
      setCaptureBallName(null);
      setIsAnimating(false);
      return;
    }

    setCaptureBall("fail");
    playBattleSfx("miss");
    await delay(BALL_BREAK_MS);
    setCaptureBall(null);
    setCaptureBallName(null);
    appendLog(tLog("brokeFreeNamed", { name: activeWild.name }), "wild");
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

    const prevPotions = potionStacks;
    const used = potionStacks.find((p) => p.itemId === itemId);
    setPotionStacks((prev) =>
      prev.map((p) => (p.itemId === itemId ? { ...p, quantity: p.quantity - 1 } : p)).filter((p) => p.quantity > 0),
    );

    setHealingTarget({ side: "player", lane: "A" });
    playBattleSfx("heal");
    await delay(ITEM_USE_MS);
    setHealingTarget(null);

    const result = await applyBattleItem(battleId, itemId, locale);
    if (!result) {
      setPotionStacks(prevPotions);
      setIsAnimating(false);
      setView(defaultView);
      return;
    }

    // Primero la cura completa (barra + ref), después el contraataque baja el HP.
    // Antes healedTo venía ya con el daño del rival aplicado: la animación del
    // golpe no movía la barra y parecía que el rival no atacaba.
    writeHp("player", "A", result.healedTo);
    appendLog(tLog("usedItem", { name: result.itemName ?? used?.name ?? "?" }), "player");
    appendLog(t("healedBy", { name: activePlayer.name, hp: result.healedBy }), "player");
    if (result.statusCured) {
      writeStatus("player", "A", null);
    }

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
    const outgoingHpSnapshot = playerHp;
    const outgoingMaxHpSnapshot = playerMaxHp;
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
        ? t("switchForcedOut", { out: outgoing.name, into: result.newPlayer.name })
        : t("switchRecall", { out: outgoing.name, into: result.newPlayer.name }),
      "player",
    );

    // Ref sync BEFORE playEvent — counter damage must hit the incoming mon,
    // not the one that just left (stale activePlayer closure).
    activePlayerNameRef.current = result.newPlayer.name;
    activePlayerIdRef.current = result.newPlayer.instanceId;
    setActivePlayer({
      instanceId: result.newPlayer.instanceId,
      name: result.newPlayer.name,
      speciesName: result.newPlayer.speciesName,
      level: result.newPlayer.level,
      spriteUrl: result.newPlayer.spriteUrl,
    });
    // Server already applied wild counter into newPlayer.currentHp.
    setPlayerHp(result.newPlayer.currentHp);
    setPlayerMaxHp(result.newPlayer.maxHp);
    setActiveMoves(result.newPlayer.moves);
    // Status/stages/Choice son del Pokémon activo: al entrar limpio el badge
    // (si el contraataque aplica estado, playEvent lo setea de nuevo).
    setPlayerStatus(null);
    setPlayerStages(NO_STAGES);
    setPlayerStats(result.newPlayer.stats);
    setChoiceLockMoveId(null);
    setChargeMoveId(null);
    clearVanishSide("player");
    setParty((prev) =>
      prev.map((m) => {
        if (m.instanceId === outgoing.instanceId) {
          return {
            ...m,
            currentHp: forced ? 0 : Math.max(0, outgoingHpSnapshot),
            maxHp: outgoingMaxHpSnapshot,
          };
        }
        if (m.instanceId === result.newPlayer.instanceId) {
          return {
            ...m,
            currentHp: result.newPlayer.currentHp,
            maxHp: result.newPlayer.maxHp,
          };
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
      <CaptureSummary
        info={capturedInfo}
        nickname={nicknameInput}
        onNicknameChange={setNicknameInput}
        saving={savingNickname}
        onConfirm={confirmCapture}
      />
    );
  }

  if (outcome !== "ongoing") {
    return (
      <BattleOutcomeScreen
        outcome={outcome}
        caughtSentToPc={caughtSentToPc}
        locale={locale}
        player={activePlayer}
        foe={activeWild}
        xpSummary={xpSummary}
        coinsGained={coinsGained}
        isPvpBattle={isPvpBattle}
        isGymBattle={isGymBattle}
        isTowerBattle={isTowerBattle}
        pvpResult={pvpResult}
        showBadgePopup={showBadgePopup}
        onBadgeContinue={() => setShowBadgePopup(false)}
        badgeEarned={badgeEarned}
        tmRewardName={tmRewardName}
        gymId={gymId}
        gymRunId={gymRunId}
        towerRunId={towerRunId}
        gymType={gymType}
        gymName={gymName}
        gymLeaderName={gymLeaderName}
        gymBadgeName={gymBadgeName}
        leaderPortrait={leaderPortrait}
      />
    );
  }

  const hasBalls = !isTrainerStyle && ballStacks.length > 0;
  const hasPotions = potionStacks.length > 0;
  const hasHealthyBackup = teamRoster.some((m) => m.currentHp > 0);

  const seFlash = moveFx?.mode === "hit" && (moveFx.effectiveness ?? 1) > 1;
  const physicalLunge = moveFx?.mode === "hit" && moveFx.category === "PHYSICAL";
  const wildAbsorbedByBall =
    captureBall === "idle" || captureBall === "wobble" || captureBall === "success";
  const playerIdle =
    !attackingSide && !shakingSide && !faintingSide && !playerEntering && !healingTarget && !ballAnim;
  const wildIdle =
    !attackingSide && !shakingSide && !faintingSide && !wildEntering && !wildAbsorbedByBall && !captureBall;
  // Tamaño relativo al alto del campo: el jugador ocupa el primer plano
  // (58–88% del alto) y el rival el fondo (32–48%), y dentro de cada rango
  // la especie define dónde cae. Fallback para el primer render/SSR.
  const isAlphaWild = initialLog.some((line) => line === "alpha");
  const arenaH = arenaHeightPx || 400;
  const playerSpeciesScale = battleSpeciesScale(activePlayer.speciesName);
  const wildSpeciesScale = battleSpeciesScale(activeWild.speciesName);
  const playerT = Math.min(1, Math.max(0, (playerSpeciesScale - 0.52) / (1.3 - 0.52)));
  const wildT = Math.min(1, Math.max(0, (wildSpeciesScale - 0.52) / (1.3 - 0.52)));
  const playerSpritePx = Math.round(arenaH * (0.62 + playerT * 0.28));
  const wildSpritePx = Math.round(arenaH * (0.3 + wildT * 0.14) * (isAlphaWild ? 1.1 : 1));
  const playerSpriteClass = [
    "h-full w-full object-contain object-bottom drop-shadow-lg origin-bottom",
    attackingSide === "player" && attackingLane === "A"
      ? physicalLunge
        ? "sprite-lunge-right-hard"
        : "sprite-lunge-right"
      : "",
    shakingSide === "player" && shakingLane === "A"
      ? `sprite-shake ${seFlash ? "sprite-flash-heavy" : "sprite-flash"}`
      : "",
    faintingSide === "player" && faintingLane === "A" ? "sprite-faint" : "",
    ballAnim === "recall" ? "sprite-recall" : "",
    playerEntering ? "sprite-enter" : "",
    healingTarget?.side === "player" && healingTarget.lane === "A" ? "sprite-heal" : "",
    playerIdle ? "sprite-idle-bob" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const playerBSpriteClass = [
    "h-full w-full object-contain object-bottom drop-shadow-lg origin-bottom",
    attackingSide === "player" && attackingLane === "B"
      ? physicalLunge
        ? "sprite-lunge-right-hard"
        : "sprite-lunge-right"
      : "",
    shakingSide === "player" && shakingLane === "B"
      ? `sprite-shake ${seFlash ? "sprite-flash-heavy" : "sprite-flash"}`
      : "",
    faintingSide === "player" && faintingLane === "B" ? "sprite-faint" : "",
    healingTarget?.side === "player" && healingTarget.lane === "B" ? "sprite-heal" : "",
    playerIdle ? "sprite-idle-bob" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const wildSpriteClass = [
    "h-full w-full object-contain object-bottom drop-shadow-lg origin-bottom",
    attackingSide === "wild" && attackingLane === "A"
      ? physicalLunge
        ? "sprite-lunge-left-hard"
        : "sprite-lunge-left"
      : "",
    shakingSide === "wild" && shakingLane === "A"
      ? `sprite-shake ${seFlash ? "sprite-flash-heavy" : "sprite-flash"}`
      : "",
    faintingSide === "wild" && faintingLane === "A" ? "sprite-faint" : "",
    wildEntering ? "sprite-enter" : "",
    wildAbsorbedByBall ? "sprite-absorb-ball" : "",
    captureBall === "fail" ? "sprite-enter" : "",
    healingTarget?.side === "wild" && healingTarget.lane === "A" ? "sprite-heal" : "",
    wildIdle ? "sprite-idle-bob" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const wildBSpriteClass = [
    "h-full w-full object-contain object-bottom drop-shadow-lg origin-bottom",
    attackingSide === "wild" && attackingLane === "B"
      ? physicalLunge
        ? "sprite-lunge-left-hard"
        : "sprite-lunge-left"
      : "",
    shakingSide === "wild" && shakingLane === "B"
      ? `sprite-shake ${seFlash ? "sprite-flash-heavy" : "sprite-flash"}`
      : "",
    faintingSide === "wild" && faintingLane === "B" ? "sprite-faint" : "",
    healingTarget?.side === "wild" && healingTarget.lane === "B" ? "sprite-heal" : "",
    wildIdle ? "sprite-idle-bob" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const emptyPlayerSlots = Math.max(0, 6 - party.length);
  const emptyOpponentSlots = Math.max(0, 6 - opponentParty.length);
  const commandExpanded = view !== "menu";
  const lastLogEntry = log[log.length - 1];

  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden px-2 py-1 sm:px-margin-mobile md:px-margin-desktop md:py-4 h-full max-h-full">
      <div className="mx-auto w-full max-w-6xl flex flex-col gap-1 md:gap-2 flex-1 min-h-0 overflow-hidden">
        {/* Top — mayor parte del alto en mobile */}
        <div className="flex min-h-0 flex-col gap-1 md:gap-2 flex-1">
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
            ref={arenaFieldRef}
            data-battle-speed={battleSpeed}
            className={`battle-arena-field relative mx-auto w-full max-w-[44rem] overflow-hidden rounded-xl border border-white/10 flex-1 min-h-0 md:min-h-[380px] ${
              arenaFlash ? "arena-type-flash" : ""
            }`}
            style={
              {
                "--arena-bg-image": `url(${showdownBattleBgUrl(battleBg)})`,
                ...(arenaFlash ? { "--arena-flash-color": arenaFlash } : {}),
              } as CSSProperties
            }
          >
            {/* Mute + velocidad en una sola pastilla horizontal: ocupan menos
                alto bajo la placa del rival y no se pelean por la misma columna. */}
            <div className="absolute top-16 left-2 z-30 flex items-center gap-1 md:top-[4.5rem] md:left-3">
              <BattleAudioControls bgmKind={bgmKind} />
              <BattleSpeedControl />
            </div>
            {/* Plates sit opposite their sprite (FireRed layout): foe plate
                top-left vs foe sprite top-right, player plate bottom-right vs
                player sprite bottom-left. Same-corner plates were covering the
                sprites, which is why the player looked cropped and small. */}
            <HpPlate
              className="absolute top-2 left-2 z-20 w-[min(100%,160px)] md:top-3 md:left-3 md:w-[min(100%,220px)]"
              name={activeWild.name}
              levelLabel={t("level", { level: activeWild.level })}
              currentHp={wildHp}
              maxHp={wildMaxHp}
              status={wildStatus}
              stages={wildStages}
              align="left"
            />
            {isDouble && wildB && (
              <HpPlate
                className="absolute top-2 left-[calc(min(100%,160px)+0.75rem)] z-20 w-[min(100%,140px)] md:top-3 md:left-[calc(min(100%,220px)+0.85rem)] md:w-[min(100%,190px)]"
                name={wildB.name}
                levelLabel={t("level", { level: wildB.level })}
                currentHp={wildBHp}
                maxHp={wildBMaxHp}
                status={wildBStatus}
                stages={NO_STAGES}
                align="left"
              />
            )}
            <HpPlate
              className="absolute bottom-2 right-2 z-20 w-[min(100%,160px)] md:bottom-3 md:right-3 md:w-[min(100%,220px)]"
              name={activePlayer.name}
              levelLabel={t("level", { level: activePlayer.level })}
              currentHp={playerHp}
              maxHp={playerMaxHp}
              status={playerStatus}
              stages={playerStages}
              align="right"
            />
            {isDouble && playerB && (
              <HpPlate
                className="absolute bottom-2 right-[calc(min(100%,160px)+0.75rem)] z-20 w-[min(100%,140px)] md:bottom-3 md:right-[calc(min(100%,220px)+0.85rem)] md:w-[min(100%,190px)]"
                name={playerB.name}
                levelLabel={t("level", { level: playerB.level })}
                currentHp={playerBHp}
                maxHp={playerBMaxHp}
                status={playerBStatus}
                stages={NO_STAGES}
                align="right"
              />
            )}

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
                key={`proj-${moveFx.strikeKey}`}
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
                key={`bolt-${moveFx.strikeKey}`}
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
                key={`contact-${moveFx.strikeKey}`}
                src={showdownFxUrl(moveFx.fxFile)}
                alt=""
                aria-hidden
                className={`fx-contact absolute z-10 pointer-events-none ${
                  moveFx.side === "player" ? "fx-contact-right" : "fx-contact-left"
                }`}
              />
            )}

            {captureBall && captureBallName && (
              <div
                key={`${captureBall}-${captureShakeKey}`}
                className={`absolute pointer-events-none z-20 ${
                  captureBall === "throw"
                    ? "ball-throw-travel w-10 h-10"
                    : captureBall === "idle"
                      ? "ball-capture-idle w-9 h-9"
                      : captureBall === "wobble"
                        ? "ball-shake-once w-9 h-9"
                        : captureBall === "success"
                          ? "ball-catch-flash w-11 h-11"
                          : "ball-break w-10 h-10"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- item sprite CDN */}
                <img
                  src={itemSpriteUrl(captureBallName)}
                  alt=""
                  aria-hidden
                  className="w-full h-full object-contain [image-rendering:pixelated] drop-shadow-[0_4px_8px_rgba(0,0,0,0.45)]"
                />
                {captureBall === "success" && (
                  <>
                    <span className="ball-catch-ring" aria-hidden />
                    <span className="ball-catch-ring ball-catch-ring-delay" aria-hidden />
                  </>
                )}
                {captureBall === "fail" && <span className="ball-break-burst" aria-hidden />}
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

            {/* Opponent sprite — far plate, lower so it sits on the grass */}
            <div
              className={`absolute z-[1] origin-bottom ${
                isDouble
                  ? "right-[4%] top-[14%] md:top-[12%]"
                  : "right-[6%] top-[18%] md:top-[16%]"
              } ${view === "targets" && wildHp > 0 ? "cursor-pointer ring-2 ring-amber-300/80 rounded-lg" : ""}`}
              style={{
                width: isDouble ? Math.round(wildSpritePx * 0.82) : wildSpritePx,
                height: isDouble ? Math.round(wildSpritePx * 0.82) : wildSpritePx,
                opacity: wildHp <= 0 ? 0.35 : 1,
              }}
              onClick={() => {
                if (view === "targets" && wildHp > 0) void handleDoubleTarget("A");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && view === "targets" && wildHp > 0) {
                  void handleDoubleTarget("A");
                }
              }}
              role={view === "targets" ? "button" : undefined}
              tabIndex={view === "targets" && wildHp > 0 ? 0 : undefined}
            >
              <span className="sprite-ground-shadow sprite-ground-shadow-wild absolute left-1/2 bottom-0 -translate-x-1/2" aria-hidden />
              {damagePopup?.side === "wild" && damagePopup.lane === "A" && (
                <span
                  key={damagePopup.key}
                  className="damage-popup absolute -top-4 left-1/2 -translate-x-1/2 text-headline-md text-error font-black z-10"
                >
                  {damagePopup.text}
                </span>
              )}
              {moveFx?.mode === "hit" && shakingSide === "wild" && shakingLane === "A" && (
                <>
                  <span
                    key={`burst-w-${moveFx.strikeKey}`}
                    className="move-impact absolute inset-0 m-auto pointer-events-none"
                    style={{
                      background: `radial-gradient(circle, ${typeColor(moveFx.moveType)}cc 0%, transparent 70%)`,
                    }}
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    key={`impact-w-${moveFx.strikeKey}`}
                    src={impactFxUrl()}
                    alt=""
                    aria-hidden
                    className="fx-impact absolute inset-0 m-auto pointer-events-none"
                  />
                </>
              )}
              {activeWild.spriteUrl && !isVanished("wild", "A") && (
                <BattleSprite
                  speciesName={activeWild.speciesName}
                  facing="front"
                  isShiny={activeWild.isShiny}
                  fallbackUrl={activeWild.spriteUrl}
                  alt={activeWild.name}
                  width={isDouble ? Math.round(wildSpritePx * 0.82) : wildSpritePx}
                  height={isDouble ? Math.round(wildSpritePx * 0.82) : wildSpritePx}
                  className={wildSpriteClass}
                  style={shakeStyle("wild", "A")}
                />
              )}
            </div>

            {isDouble && wildB && (
              <div
                className={`absolute right-[28%] top-[22%] z-[1] origin-bottom md:right-[30%] md:top-[20%] ${
                  view === "targets" && wildBHp > 0
                    ? "cursor-pointer ring-2 ring-amber-300/80 rounded-lg"
                    : ""
                }`}
                style={{
                  width: Math.round(wildSpritePx * 0.78),
                  height: Math.round(wildSpritePx * 0.78),
                  opacity: wildBHp <= 0 ? 0.35 : 1,
                }}
                onClick={() => {
                  if (view === "targets" && wildBHp > 0) void handleDoubleTarget("B");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && view === "targets" && wildBHp > 0) {
                    void handleDoubleTarget("B");
                  }
                }}
                role={view === "targets" ? "button" : undefined}
                tabIndex={view === "targets" && wildBHp > 0 ? 0 : undefined}
              >
                <span className="sprite-ground-shadow sprite-ground-shadow-wild absolute left-1/2 bottom-0 -translate-x-1/2" aria-hidden />
                {damagePopup?.side === "wild" && damagePopup.lane === "B" && (
                  <span
                    key={damagePopup.key}
                    className="damage-popup absolute -top-4 left-1/2 -translate-x-1/2 text-headline-md text-error font-black z-10"
                  >
                    {damagePopup.text}
                  </span>
                )}
                {moveFx?.mode === "hit" && shakingSide === "wild" && shakingLane === "B" && (
                  <>
                    <span
                      key={`burst-wb-${moveFx.strikeKey}`}
                      className="move-impact absolute inset-0 m-auto pointer-events-none"
                      style={{
                        background: `radial-gradient(circle, ${typeColor(moveFx.moveType)}cc 0%, transparent 70%)`,
                      }}
                    />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      key={`impact-wb-${moveFx.strikeKey}`}
                      src={impactFxUrl()}
                      alt=""
                      aria-hidden
                      className="fx-impact absolute inset-0 m-auto pointer-events-none"
                    />
                  </>
                )}
                {!isVanished("wild", "B") && (
                  <BattleSprite
                    speciesName={wildB.speciesName}
                    facing="front"
                    isShiny={wildB.isShiny ?? false}
                    fallbackUrl={wildB.spriteUrl}
                    alt={wildB.name}
                    width={Math.round(wildSpritePx * 0.78)}
                    height={Math.round(wildSpritePx * 0.78)}
                    className={wildBSpriteClass}
                    style={shakeStyle("wild", "B")}
                  />
                )}
              </div>
            )}

            {/* Player sprite — near plate, bottom-left */}
            <div
              className={`absolute z-[1] origin-bottom ${
                isDouble ? "left-[2%] bottom-[2%]" : "left-[2%] bottom-[2%]"
              }`}
              style={{
                width: isDouble ? Math.round(playerSpritePx * 0.82) : playerSpritePx,
                height: isDouble ? Math.round(playerSpritePx * 0.82) : playerSpritePx,
                opacity: playerHp <= 0 ? 0.35 : 1,
              }}
            >
              <span className="sprite-ground-shadow sprite-ground-shadow-player absolute left-1/2 bottom-0 -translate-x-1/2" aria-hidden />
              {damagePopup?.side === "player" && damagePopup.lane === "A" && (
                <span
                  key={damagePopup.key}
                  className="damage-popup absolute -top-4 left-1/2 -translate-x-1/2 text-headline-md text-error font-black z-10"
                >
                  {damagePopup.text}
                </span>
              )}
              {moveFx?.mode === "hit" && shakingSide === "player" && shakingLane === "A" && (
                <>
                  <span
                    key={`burst-p-${moveFx.strikeKey}`}
                    className="move-impact absolute inset-0 m-auto pointer-events-none"
                    style={{
                      background: `radial-gradient(circle, ${typeColor(moveFx.moveType)}cc 0%, transparent 70%)`,
                    }}
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    key={`impact-p-${moveFx.strikeKey}`}
                    src={impactFxUrl()}
                    alt=""
                    aria-hidden
                    className="fx-impact absolute inset-0 m-auto pointer-events-none"
                  />
                </>
              )}
              {!playerHidden && !isVanished("player", "A") && activePlayer.spriteUrl && (
                <BattleSprite
                  speciesName={activePlayer.speciesName}
                  facing="back"
                  fallbackUrl={activePlayer.spriteUrl}
                  alt={activePlayer.name}
                  width={isDouble ? Math.round(playerSpritePx * 0.82) : playerSpritePx}
                  height={isDouble ? Math.round(playerSpritePx * 0.82) : playerSpritePx}
                  className={playerSpriteClass}
                  style={shakeStyle("player", "A")}
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

            {isDouble && playerB && (
              <div
                className="absolute left-[30%] bottom-[6%] z-[1] origin-bottom md:left-[32%]"
                style={{
                  width: Math.round(playerSpritePx * 0.78),
                  height: Math.round(playerSpritePx * 0.78),
                  opacity: playerBHp <= 0 ? 0.35 : 1,
                }}
              >
                <span className="sprite-ground-shadow sprite-ground-shadow-player absolute left-1/2 bottom-0 -translate-x-1/2" aria-hidden />
                {damagePopup?.side === "player" && damagePopup.lane === "B" && (
                  <span
                    key={damagePopup.key}
                    className="damage-popup absolute -top-4 left-1/2 -translate-x-1/2 text-headline-md text-error font-black z-10"
                  >
                    {damagePopup.text}
                  </span>
                )}
                {!isVanished("player", "B") && (
                  <BattleSprite
                    speciesName={playerB.speciesName}
                    facing="back"
                    fallbackUrl={playerB.spriteUrl}
                    alt={playerB.name}
                    width={Math.round(playerSpritePx * 0.78)}
                    height={Math.round(playerSpritePx * 0.78)}
                    className={playerBSpriteClass}
                    style={shakeStyle("player", "B")}
                  />
                )}
              </div>
            )}
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

        {/* En submenús mobile el log completo cede espacio a los comandos, pero
            quedarse sin ninguna referencia de lo que pasó es peor: sobrevive la
            última línea. */}
        {commandExpanded && lastLogEntry && (
          <p className="md:hidden shrink-0 truncate rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-[10px] leading-snug text-white/80">
            {lastLogEntry.text}
          </p>
        )}

        <div
          className={`grid min-w-0 gap-1 md:gap-2 min-h-0 shrink-0 items-stretch md:h-[13rem] md:max-h-[13rem] ${
            commandExpanded
              ? "max-md:h-[12rem] max-md:max-h-[12rem]"
              : "max-md:h-[7.5rem] max-md:max-h-[7.5rem]"
          } ${commandExpanded ? "grid-cols-1 md:grid-cols-2" : "grid-cols-2"}`}
        >
          {/* Log — en submenús mobile cede espacio a los comandos */}
          <div
            aria-live="polite"
            aria-label={t("battleLogLabel")}
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
              <div className="mt-auto flex items-center justify-between gap-2 border-t border-dashed border-white/15 pt-1">
                <p className="text-[10px] md:text-label-md font-bold text-on-surface leading-snug break-words [overflow-wrap:anywhere]">
                  {isDouble
                    ? t("whatWillDo", {
                        name: (
                          pendingDoubleMoveA != null && playerB
                            ? playerB.name
                            : activePlayer.name
                        ).toUpperCase(),
                      })
                    : t("whatWillDo", { name: activePlayer.name.toUpperCase() })}
                </p>
                {!isDouble && <TurnOrderChip playerFirst={playerOutspeeds} />}
              </div>
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
                    setDefaultView("moves");
                    if (isDouble) {
                      void enterDoubleFight();
                    } else {
                      setView("moves");
                    }
                  }}
                  className="battle-cmd-btn battle-cmd-fight"
                >
                  <span className="material-symbols-outlined text-[18px]! md:text-[22px]!">bolt</span>
                  {t("fight")}
                </button>
                <button
                  type="button"
                  disabled={isAnimating || isDouble || !hasHealthyBackup}
                  onClick={() => setView("team")}
                  className="battle-cmd-btn"
                >
                  <PokeballIcon className="w-5 h-5 md:w-6 md:h-6" />
                  {t("pokemonMenu")}
                </button>
                <button
                  type="button"
                  disabled={isAnimating || isDouble || (!hasBalls && !hasPotions)}
                  onClick={() => setView("bag")}
                  className="battle-cmd-btn"
                >
                  <span className="material-symbols-outlined text-[18px]! md:text-[22px]!">backpack</span>
                  {t("bag")}
                </button>
                <button
                  type="button"
                  disabled={isAnimating || isGymBattle || (Boolean(opponentName) && !isPvpBattle)}
                  onClick={handleFlee}
                  className="battle-cmd-btn"
                >
                  <span className="material-symbols-outlined text-[18px]! md:text-[22px]!">
                    {isPvpBattle ? "flag" : "directions_run"}
                  </span>
                  {isPvpBattle ? t("forfeit") : t("run")}
                </button>
              </div>
            )}

            {view === "moves" && (
              <MovesView
                activePlayerName={
                  isDouble && pendingDoubleMoveA != null && playerB
                    ? playerB.name
                    : activePlayer.name
                }
                moves={
                  isDouble && pendingDoubleMoveA != null ? activeMovesB : activeMoves
                }
                choiceLockMoveId={
                  isDouble && pendingDoubleMoveA != null
                    ? chargeMoveIdB
                    : (chargeMoveId ?? choiceLockMoveId)
                }
                isAnimating={isAnimating}
                effectivenessInfo={effectivenessInfo}
                playerFirst={playerOutspeeds}
                forecast={moveForecast}
                onSelect={handleMove}
                onBack={() => {
                  if (isDouble && pendingDoubleMoveA != null) {
                    setPendingDoubleMoveA(null);
                    setPendingDoubleTargetA(null);
                    setPendingDoubleMoveB(null);
                    setTargetPickFor(null);
                    setView("moves");
                    return;
                  }
                  setView("menu");
                }}
              />
            )}

            {view === "targets" && isDouble && (() => {
              const { move, foes } = doubleTargetFoes();
              return (
                <TargetView
                  moveName={move?.name ?? ""}
                  moveType={move?.type ?? null}
                  foes={foes}
                  isAnimating={isAnimating}
                  onSelect={handleDoubleTarget}
                  onBack={() => {
                    if (targetPickFor === "B") {
                      setPendingDoubleMoveB(null);
                      setTargetPickFor(null);
                      setView("moves");
                      return;
                    }
                    setPendingDoubleMoveA(null);
                    setPendingDoubleTargetA(null);
                    setTargetPickFor(null);
                    setView("moves");
                  }}
                />
              );
            })()}

            {view === "bag" && (
              <BagView
                isAnimating={isAnimating}
                showBalls={!isTrainerStyle}
                ballStacks={ballStacks}
                potionStacks={potionStacks}
                potionsDisabled={playerHp >= playerMaxHp}
                onThrowBall={handleThrowBall}
                onUsePotion={handleUsePotion}
                onBack={() => setView("menu")}
              />
            )}

            {view === "team" && (
              <TeamView
                isAnimating={isAnimating}
                mustSwitch={mustSwitch}
                roster={teamRoster}
                foeName={activeWild.name}
                foeTypes={activeWild.types}
                matchupInfo={switchMatchupInfo}
                onSwitch={handleSwitchTo}
                onBack={() => setView("menu")}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
