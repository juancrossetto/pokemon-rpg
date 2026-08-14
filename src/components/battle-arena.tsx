"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  type CSSProperties,
} from "react";
import { useTranslations } from "next-intl";
import {
  submitBattleMove,
  type GymFirstWinReward,
  type XpSummaryEntry,
} from "@/actions/battle-move";
import { submitDoubleBattleMoves } from "@/actions/double-battle-move";
import { fleeBattle } from "@/actions/flee-battle";
import { abandonWeeklyRaidBattle } from "@/actions/weekly-raid";
import { ConfirmModal } from "@/components/confirm-modal";
import { attemptCapture, type CapturedPokemonInfo } from "@/actions/attempt-capture";
import { switchPokemon } from "@/actions/switch-pokemon";
import { applyBattleItem } from "@/actions/use-item";
import { setPokemonNickname } from "@/actions/rename-pokemon";
import { forfeitPvpBattle } from "@/actions/forfeit-pvp-battle";
import { forfeitClanWarBattle } from "@/actions/forfeit-clan-war-battle";
import { seedPendingCoinDelta } from "@/lib/coin-fx";
import { PokeballIcon } from "@/components/pokeball-icon";
import { BattleSprite } from "@/components/battle-sprite";
import { getTypeEffectiveness } from "@/lib/type-effectiveness";
import { typeColor } from "@/lib/type-colors";
import { formatMoveName } from "@/lib/format-move-name";
import { gymLeaderPortraitUrl } from "@/lib/gym-art";
import { itemDisplayUrl } from "@/lib/item-sprites";
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
import { BattleAutoControl } from "@/components/battle/battle-auto-control";
import { BattleSpeedControl } from "@/components/battle/battle-speed-control";
import {
  getBattleAuto,
  getServerBattleAuto,
  pickAutoPotion,
  pickAutoSwitchCandidate,
  setBattleAuto,
  shouldStopAutoBattle,
  subscribeBattleAuto,
} from "@/lib/battle-auto";
import {
  getGameSettings,
  getServerGameSettings,
  subscribeGameSettings,
} from "@/lib/game-settings";
import { showToast } from "@/lib/app-toast";
import {
  getBattleSpeed,
  getServerBattleSpeed,
  scaledDelay,
  setBattleFxCompact,
  subscribeBattleSpeed,
} from "@/lib/battle-speed";
import { noteBattleChainStart } from "@/lib/battle-farm";
import {
  createHighlightsState,
  recordFoeBreaksSeStreak,
  recordPlayerHit,
  type BattleHighlight,
  type BattleHighlightsState,
} from "@/lib/battle-highlights";
import { pickAutoPlayerMoveId } from "@/lib/battle-ai";
import { BattleAutoTelegraph } from "@/components/battle/battle-auto-telegraph";
import { impactFxUrl, resolveMoveFx, showdownBattleBgUrl, showdownFxUrl } from "@/lib/showdown-fx";
import type { MoveFxGlow, MoveFxStyle } from "@/lib/showdown-fx";
import { battleAnimatedSpriteUrl } from "@/lib/showdown-sprites";
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
  RaidSummary,
  PotionStack,
  RosterMember,
  View,
} from "@/components/battle/arena-types";
import { forecastDamage } from "@/lib/damage-forecast";
import { EmptyPartySlot, HpPlate, PartyIcon, PartySidebar } from "@/components/battle/arena-panels";
import { SpriteStatusFx } from "@/components/battle/status-fx";
import { CaptureSummary } from "@/components/battle/capture-summary";
import { BattleOutcomeScreen } from "@/components/battle/battle-outcome-screen";
import { BattleTurnTimer } from "@/components/battle/battle-turn-timer";
import { BattleItemUseFx } from "@/components/battle/battle-item-use-fx";
import {
  BattleVsIntro,
  isFreshBattleBoot,
} from "@/components/battle/battle-vs-intro";
import type { PvpTier } from "@/lib/pvp/tiers";
import { scrollElementIntoViewSafe } from "@/lib/scroll-lock";
import {
  BagView,
  MustSwitchSheet,
  MovesView,
  ReviveTargetView,
  TargetView,
  TeamView,
  YourTurnStatus,
} from "@/components/battle/command-views";
import { needsFoeTargetPick, isSpreadMove } from "@/lib/move-target";
import { reviveHpFraction } from "@/lib/squad-bag";
import {
  BATTLE_PLAYER_SPRITE_FRAC,
  BATTLE_PLAYER_SPRITE_WIDTH_CAP,
  BATTLE_WILD_SPRITE_FRAC,
  BATTLE_WILD_SPRITE_WIDTH_CAP,
  battleSpeciesScale,
  spriteBoxFromNatural,
  BATTLE_ARENA_BASE_W,
} from "@/lib/battle-sprite-scale";
import { spriteNaturalPx } from "@/lib/battle-sprite-natural";
import { fleeChancePercent } from "@/lib/flee";
import {
  appendBattleItemUsage,
  type BattleItemUsage,
} from "@/lib/battle-item-usage";

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
/*
  Captura. El vuelo termina en el CUERPO del rival, no en el piso: de ahí
  salen el golpe, la absorción y el cierre, y recién después la ball cae.
  Los ~1.2s de coreografía previos al primer temblor corren en paralelo a la
  tirada del server, así que su latencia queda tapada por animación en vez de
  por una ball congelada.
*/
const BALL_TRAVEL_MS = 460;
/** Impacto contra el Pokémon: destello + retroceso. */
const BALL_HIT_MS = 140;
/** El rival se convierte en energía y entra. */
const BALL_ABSORB_MS = 320;
/** Click de cierre + caída al piso con rebote. */
const BALL_SEAL_MS = 260;
/** Beat de tensión antes del primer temblor. */
const BALL_SETTLE_MS = 150;
/** Un temblor individual (pivotea sobre la base). */
const BALL_SHAKE_MS = 460;
/** Pausa entre temblores — genera tensión. */
const BALL_SHAKE_GAP_MS = 200;
const BALL_CATCH_MS = 760;
/** Cubre la ball reventando + el rival volviendo a materializarse
 *  (= SPRITE_MATERIALIZE_MS, declarado más abajo). */
const BALL_BREAK_MS = 560;
const FAINT_MS = 1100;
const RECALL_MS = 450;
const ITEM_USE_MS = 1100;
/** Brillo verde de curación (Recover, drenaje, Rest). */
const HEAL_PULSE_MS = 560;
/** Viaje de la ball al enviar Pokémon. */
const SEND_OUT_TRAVEL_MS = 420;
/** Rebote con squash en el piso: corto, la ball se abre casi al tocar. */
const SEND_OUT_LAND_MS = 120;
/** Destello de apertura; el sprite sale al empezar, no al terminar. */
const SEND_OUT_OPEN_MS = 200;
const SEND_OUT_BALL_MS = SEND_OUT_TRAVEL_MS + SEND_OUT_LAND_MS + SEND_OUT_OPEN_MS;
/** El Pokémon aparece con el flash de apertura, no después. */
const SEND_OUT_REVEAL_MS = SEND_OUT_TRAVEL_MS + SEND_OUT_LAND_MS;
const SPRITE_ENTER_MS = 280;
/** Silueta blanca → color al salir de la ball; arranca junto con la apertura.
 *  Larga a propósito: es el beat que se tiene que poder mirar. */
const SPRITE_MATERIALIZE_MS = 560;
const SEND_OUT_BALL_SRC = itemDisplayUrl("Poke Ball", "hd");
/** Banner del poder: más largo que el golpe para que el slide se lea. */
const MOVE_BANNER_MS = 2400;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, scaledDelay(ms)));
}

/** Partículas Showdown tipadas / por move (chorro, hojas, drain…). */
function MoveHitFx({
  strikeKey,
  side,
  file,
  files,
  style,
  count,
  glow = "neutral",
}: {
  strikeKey: number;
  side: "player" | "wild";
  file: string;
  files?: string[];
  style: MoveFxStyle;
  count: number;
  glow?: MoveFxGlow;
}) {
  const fromPlayer = side === "player";
  const n = Math.max(1, Math.min(8, count));
  const glowClass = `fx-glow-${glow}`;
  const srcAt = (i: number) =>
    showdownFxUrl(files && files.length > 0 ? files[i % files.length]! : file);

  if (style === "bolt") {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- FX particle from Showdown CDN
      <img
        key={`bolt-${strikeKey}`}
        src={showdownFxUrl(file)}
        alt=""
        aria-hidden
        className={`fx-bolt absolute z-10 pointer-events-none ${glowClass} ${
          fromPlayer ? "fx-bolt-on-wild" : "fx-bolt-on-player"
        }`}
      />
    );
  }

  if (style === "contact") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        key={`contact-${strikeKey}`}
        src={showdownFxUrl(file)}
        alt=""
        aria-hidden
        className={`fx-contact absolute z-10 pointer-events-none ${glowClass} ${
          fromPlayer ? "fx-contact-right" : "fx-contact-left"
        }`}
      />
    );
  }

  if (style === "slash") {
    let slashFile = file;
    if (!fromPlayer) {
      if (file === "leftchop.png") slashFile = "rightchop.png";
      else if (file === "leftslash.png") slashFile = "rightslash.png";
      else if (file === "leftclaw.png") slashFile = "rightclaw.png";
    }
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        key={`slash-${strikeKey}`}
        src={showdownFxUrl(slashFile)}
        alt=""
        aria-hidden
        className={`fx-slash absolute z-10 pointer-events-none ${glowClass} ${
          fromPlayer ? "fx-slash-on-wild" : "fx-slash-on-player"
        }`}
      />
    );
  }

  if (style === "drain") {
    return (
      <>
        {Array.from({ length: n }, (_, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`drain-${strikeKey}-${i}`}
            src={srcAt(i)}
            alt=""
            aria-hidden
            className={`fx-projectile fx-drain absolute z-10 pointer-events-none ${glowClass} ${
              fromPlayer ? "fx-drain-to-player" : "fx-drain-to-wild"
            }`}
            style={
              {
                "--fx-i": i,
                "--fx-dy": `${(i - (n - 1) / 2) * 10}px`,
              } as CSSProperties
            }
          />
        ))}
      </>
    );
  }

  if (style === "stream" || style === "scatter" || style === "projectile") {
    const dirClass = fromPlayer ? "fx-projectile-right" : "fx-projectile-left";
    const extra =
      style === "stream" ? "fx-stream" : style === "scatter" ? "fx-scatter" : "";
    return (
      <>
        {Array.from({ length: n }, (_, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`proj-${strikeKey}-${i}`}
            src={srcAt(i)}
            alt=""
            aria-hidden
            className={`fx-projectile absolute z-10 pointer-events-none ${dirClass} ${extra} ${glowClass}`}
            style={
              {
                "--fx-i": i,
                "--fx-dy": `${(i - (n - 1) / 2) * (style === "scatter" ? 14 : 8)}px`,
                "--fx-rot": `${(i - (n - 1) / 2) * (style === "scatter" ? 18 : 6)}deg`,
              } as CSSProperties
            }
          />
        ))}
      </>
    );
  }

  return null;
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
  raidTurnsLeft: initialRaidTurnsLeft = null,
  battleBg = "meadow",
  encounterPlace = null,
  format = "SINGLE",
  playerB = null,
  wildB = null,
  movesB,
  playerBStatus: initialPlayerBStatus = null,
  wildBStatus: initialWildBStatus = null,
  pvpMatchId = null,
  turnDeadlineAt: initialTurnDeadlineAt = null,
  fleeAttempts: initialFleeAttempts = 0,
  autoBattleUnlocked = true,
  farmingLocationId = null,
  trainerLevel,
  trainerPvpTier,
  trainerPvpDivision,
  opponentLevel,
  opponentPvpTier = null,
  opponentPvpDivision = null,
}: BattleArenaProps) {
  const t = useTranslations("battle");
  const tLog = useTranslations("battle.log");
  const isGymBattle = battleMode === "gym";
  const isPvpBattle = battleMode === "pvp";
  const isTowerBattle = battleMode === "tower" || Boolean(towerRunId);
  const isRaidBattle = battleMode === "raid";
  const farmMode =
    battleMode === "pvp"
      ? "pvp"
      : battleMode === "gym"
        ? "gym"
        : isTowerBattle
          ? "tower"
          : "wild";
  const farmLocationKey =
    farmMode === "wild"
      ? (farmingLocationId ?? "wild")
      : farmMode === "tower"
        ? (towerRunId ?? "tower")
        : farmMode === "gym"
          ? (gymId ?? "gym")
          : "pvp";
  const isDouble =
    (format === "DOUBLE" || Boolean(playerB && wildB)) &&
    Boolean(playerB) &&
    Boolean(wildB);
  // Gym, PvP, Torre, incursión o entrenador de ruta: no captura / no huida
  // “salvaje”. En la incursión además el intento ya se cobró: escaparse sólo
  // serviría para no gastar turnos, así que el límite de turnos es la salida.
  const isTrainerStyle =
    isGymBattle || isPvpBattle || isTowerBattle || isRaidBattle || Boolean(opponentName);
  const leaderPortrait = gymLeaderName ? gymLeaderPortraitUrl(gymLeaderName) : null;
  const foeLabel =
    opponentName ?? (isTowerBattle ? t("towerFoe") : isRaidBattle ? t("raidFoe") : t("wildFoe"));

  function translateBootLog(raw: string): string | null {
    // Metadata interna (stage de farming / id de entrenador) — no mostrar.
    if (raw.startsWith("stage:")) return null;
    if (raw.startsWith("trainer:")) return null;
    if (raw === "alpha") return t("alphaEncounter");
    if (raw === "shiny") return t("shinyEncounter");
    if (raw.startsWith("appear:")) {
      const name = raw.slice(7);
      // Combates con entrenador (ruta / tutorial / gym mal logueados): no digas "salvaje".
      if (opponentName) return tLog("sendOut", { name });
      return tLog("appear", { name });
    }
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
    if (raw === "towerAegis:ready" || raw === "towerAegis:used") return null;
    if (raw.startsWith("aegis:")) {
      return tLog("aegis", { name: raw.slice("aegis:".length) });
    }
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
        move: formatMoveName(rest.slice(i + 1), locale),
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
        move: formatMoveName(rest.slice(i + 1), locale),
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
    isShiny: player.isShiny ?? false,
  });
  // playEvent() lee nombres vía nameFor() dentro de funciones async que ya
  // arrancaron con un closure viejo de activePlayer (setActivePlayer no lo
  // actualiza hasta el próximo render) — un ref sincrónico evita que el
  // contraataque tras un switch muestre el nombre del Pokémon que se fue.
  const activePlayerNameRef = useRef(player.name);
  const activePlayerIdRef = useRef(player.instanceId);
  const itemFxKeyRef = useRef(0);
  const nextItemFxKey = () => {
    itemFxKeyRef.current += 1;
    return itemFxKeyRef.current;
  };
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
  const autoBattlePref = useSyncExternalStore(
    subscribeBattleAuto,
    getBattleAuto,
    getServerBattleAuto,
  );
  const gameSettings = useSyncExternalStore(
    subscribeGameSettings,
    getGameSettings,
    getServerGameSettings,
  );
  const autoBattle = autoBattleUnlocked && autoBattlePref;

  useEffect(() => {
    setBattleFxCompact(autoBattle);
    return () => setBattleFxCompact(false);
  }, [autoBattle]);

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
  /*
    Intro VS + send-out sólo en el primer paint de una batalla fresca.
    Si el jugador recarga a mitad, saltamos directo al campo operativo.
  */
  const freshBoot = isFreshBattleBoot(initialLog);
  const [farmChainCount] = useState(() =>
    freshBoot ? noteBattleChainStart(farmMode, farmLocationKey) : 0,
  );
  const vsIntroVariant =
    freshBoot && farmChainCount >= 2 && (farmMode === "wild" || farmMode === "tower")
      ? "short"
      : "full";
  const [vsIntroDone, setVsIntroDone] = useState(!freshBoot);
  /** Contenido del campo (sprites/placas) oculto hasta el send-out. */
  const [fieldRevealed, setFieldRevealed] = useState(!freshBoot);
  /** Comandos bloqueados hasta que termine VS + salida de la ball. */
  const [bootFxDone, setBootFxDone] = useState(!freshBoot);
  const [playerEntering, setPlayerEntering] = useState(freshBoot);
  const [playerHidden, setPlayerHidden] = useState(freshBoot);
  const [wildEntering, setWildEntering] = useState(freshBoot);
  /** Sprite oculto por Fly/Dig/Dive (semi-invulnerable), por calle. */
  const [vanishedKeys, setVanishedKeys] = useState<string[]>([]);
  const [badgeEarned, setBadgeEarned] = useState(false);
  const [showBadgePopup, setShowBadgePopup] = useState(false);
  const [tmRewardName, setTmRewardName] = useState<string | null>(null);
  const [heldRewardName, setHeldRewardName] = useState<string | null>(null);
  const [gymFirstWin, setGymFirstWin] = useState<GymFirstWinReward | null>(null);
  // Arranca en null: el lanzamiento inicial lo dispara el efecto de send-out
  // cuando la página terminó de cargar (ver más abajo).
  const [ballAnim, setBallAnim] = useState<"recall" | "throw" | "land" | "open" | null>(null);
  // Quién está brillando de curación: objeto del jugador, Recover o drenaje.
  const [healingTarget, setHealingTarget] = useState<{
    side: "player" | "wild";
    lane: "A" | "B";
  } | null>(null);
  const [itemUseFx, setItemUseFx] = useState<{
    kind: "heal" | "revive";
    side: "player" | "wild";
    lane: "A" | "B";
    itemName: string;
    label: string;
    key: number;
    partyInstanceId?: string;
  } | null>(null);
  const [damagePopup, setDamagePopup] = useState<{
    side: "player" | "wild";
    lane: "A" | "B";
    text: string;
    key: number;
    tone?: "damage" | "heal";
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
    fxFiles?: string[];
    fxStyle?: MoveFxStyle;
    fxCount?: number;
    fxGlow?: MoveFxGlow;
  } | null>(null);
  /** Vive más que moveFx: el golpe puede terminar antes de que el slide salga. */
  const [moveBanner, setMoveBanner] = useState<{
    key: number;
    moveName: string;
    moveType: string;
  } | null>(null);
  const [arenaFlash, setArenaFlash] = useState<string | null>(null);
  const [arenaShake, setArenaShake] = useState<"soft" | "hard" | null>(null);
  const [autoTelegraph, setAutoTelegraph] = useState<{
    moveName: string;
    moveType: string;
    key: number;
  } | null>(null);
  const [koSting, setKoSting] = useState(false);
  const highlightsRef = useRef<BattleHighlightsState>(createHighlightsState());
  const [highlights, setHighlights] = useState<BattleHighlight[]>([]);
  const [effPopup, setEffPopup] = useState<{ text: string; key: number } | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>("ongoing");
  /** Distingue derrota por KO vs reloj de inactividad (copy del resultado). */
  const [lossReason, setLossReason] = useState<"faint" | "idle" | null>(null);
  /** Incursión: turnos restantes del intento y resumen al cerrarlo. */
  const [raidTurns, setRaidTurns] = useState<number | null>(initialRaidTurnsLeft ?? null);
  const [raidSummary, setRaidSummary] = useState<RaidSummary | null>(null);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [withdrawing, startWithdraw] = useTransition();
  const [turnDeadlineAt, setTurnDeadlineAt] = useState<string | null>(
    initialTurnDeadlineAt ?? null,
  );
  const [fleeAttempts, setFleeAttempts] = useState(initialFleeAttempts);
  /** Último poder usado con éxito (singles) — atajo "Repetir". */
  const [lastMoveId, setLastMoveId] = useState<number | null>(null);
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
  /**
   * A dónde vuelve el comando al terminar un turno.
   *
   * Sólo es `"moves"` si el turno anterior fue un poder: así pelear → pelear
   * salta el menú raíz, pero mochila/cambio vuelven a Luchar/Pokémon/Mochila.
   * Antes se seteaba a `"moves"` la primera vez que tocaban Luchar y se
   * quedaba pegado — por eso después de una poción abría poderes de nuevo.
   */
  const [ballStacks, setBallStacks] = useState(pokeballs);
  const [potionStacks, setPotionStacks] = useState(potions);
  const [itemUsage, setItemUsage] = useState<BattleItemUsage[]>([]);
  const [pendingReviveItemId, setPendingReviveItemId] = useState<string | null>(null);
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
  const logEndRef = useRef<HTMLLIElement>(null);
  const [capturedInfo, setCapturedInfo] = useState<CapturedPokemonInfo | null>(null);
  const [caughtSentToPc, setCaughtSentToPc] = useState(false);
  const [nicknameInput, setNicknameInput] = useState("");
  const [savingNickname, setSavingNickname] = useState(false);
  const [captureBall, setCaptureBall] = useState<
    "throw" | "hit" | "absorb" | "seal" | "idle" | "wobble" | "success" | "fail" | null
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
  const [arenaWidthPx, setArenaWidthPx] = useState(0);
  // La incursión entra acá: es un legendario de jefe, no un encuentro de ruta.
  // Sin esto sonaba la música de salvaje contra un Nv.100.
  const bgmKind =
    isGymBattle || isPvpBattle || isRaidBattle || opponentName ? "boss" : "wild";
  const showVsIntro = freshBoot && !vsIntroDone;
  const combatBusy = isAnimating || showVsIntro || (freshBoot && !bootFxDone);
  const fieldAssembling = freshBoot && !fieldRevealed;

  const teamRoster = party.filter((m) => m.instanceId !== activePlayer.instanceId);

  useEffect(() => {
    startBattleBgm(bgmKind);
    preloadBattleSfx();
    return () => stopBattleBgm();
  }, [bgmKind]);

  // El banner del poder dura más que el FX del golpe: si lo desmontamos con
  // moveFx, el slide de salida no se llega a ver.
  useEffect(() => {
    if (!moveBanner) return;
    let cancelled = false;
    void (async () => {
      await delay(MOVE_BANNER_MS);
      if (!cancelled) setMoveBanner(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [moveBanner]);


  useEffect(() => {
    if (outcome !== "ongoing") stopBattleBgm();
  }, [outcome]);

  useEffect(() => {
    const field = arenaFieldRef.current;
    if (!field) return;
    const observer = new ResizeObserver(() => {
      const el = arenaFieldRef.current;
      if (!el) return;
      setArenaHeightPx(el.clientHeight);
      setArenaWidthPx(el.clientWidth);
    });
    observer.observe(field);
    setArenaHeightPx(field.clientHeight);
    setArenaWidthPx(field.clientWidth);
    return () => observer.disconnect();
  }, []);

  /*
    Precarga de todo lo que aparece de golpe durante el send-out. Sin esto el
    GIF del Pokémon se descarga y decodifica justo en el frame en que se revela
    —y la animación se traba—, porque el sprite recién se monta cuando
    `playerHidden` pasa a false. Los del equipo también: un cambio dispara la
    misma descarga en medio del vuelo de la ball.
    Espera a que termine la intro VS (si hubo) para no solapar ball + banners.
  */
  useEffect(() => {
    if (!vsIntroDone || !freshBoot) return;

    const urls = new Set<string>([SEND_OUT_BALL_SRC]);
    const activeUrl = battleAnimatedSpriteUrl(
      player.speciesName,
      "back",
      player.isShiny ?? false,
    );
    urls.add(activeUrl);
    for (const m of initialParty) {
      urls.add(battleAnimatedSpriteUrl(m.speciesName, "back", m.isShiny ?? false));
    }
    const images: HTMLImageElement[] = [];
    const ready: Promise<unknown>[] = [];
    for (const url of urls) {
      const img = new Image();
      img.decoding = "async";
      img.src = url;
      images.push(img);
      // Sólo bloqueamos el arranque en el que sale de la ball; el resto del
      // equipo se precarga en segundo plano para los cambios.
      if (url === activeUrl || url === SEND_OUT_BALL_SRC) {
        ready.push(img.decode().catch(() => undefined));
      }
    }

    let cancelled = false;
    const timers: number[] = [];
    const at = (ms: number, fn: () => void) => {
      timers.push(window.setTimeout(fn, scaledDelay(ms)));
    };

    // El timeline arranca cuando el hilo principal está libre. En una recarga
    // dura el mount ocurre en plena hidratación de la página: si largamos acá,
    // la ball vuela contra un main thread ocupado y se ve a los saltos.
    const startTimeline = () => {
      if (cancelled) return;
      setFieldRevealed(true);
      setBallAnim("throw");
      playBattleSfx("ball");
      at(SPRITE_ENTER_MS, () => setWildEntering(false));
      at(SEND_OUT_TRAVEL_MS, () => setBallAnim("land"));
      at(SEND_OUT_REVEAL_MS, () => {
        setBallAnim("open");
        playBattleSfx("sendOut");
        setPlayerHidden(false);
      });
      at(SEND_OUT_REVEAL_MS + SPRITE_MATERIALIZE_MS, () => setPlayerEntering(false));
      at(SEND_OUT_BALL_MS + 80, () => {
        setBallAnim(null);
        setBootFxDone(true);
      });
    };

    const pageLoaded =
      document.readyState === "complete"
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            window.addEventListener("load", () => resolve(), { once: true });
          });

    // Tope duro: si algo no resuelve (CDN caído, decode que nunca vuelve), la
    // batalla igual arranca.
    const cap = new Promise<void>((resolve) => {
      timers.push(window.setTimeout(resolve, 1200));
    });

    void Promise.race([Promise.all([pageLoaded, ...ready]), cap]).then(() => {
      if (cancelled) return;
      // Dos frames: el primero cierra el trabajo pendiente del navegador, el
      // segundo ya es un frame limpio donde empezar a animar.
      requestAnimationFrame(() => requestAnimationFrame(startTimeline));
    });

    return () => {
      cancelled = true;
      for (const id of timers) clearTimeout(id);
      for (const img of images) img.src = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vsIntroDone]);

  function appendLog(text: string, side: LogSide = "system") {
    setLog((prev) => [...prev.slice(-29), { text, side }]);
  }

  useEffect(() => {
    const end = logEndRef.current;
    if (!end) return;
    scrollElementIntoViewSafe(end, { block: "end", behavior: "auto" });
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
      key: nextItemFxKey(),
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
        mode === "hit" ? resolveMoveFx(event.moveType, event.category, event.moveName) : null;
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
        fxFiles: projectile?.files,
        fxStyle: projectile?.style,
        fxCount: projectile?.count,
        fxGlow: projectile?.glow,
      });
      setMoveBanner({
        key: fxKey,
        moveName: event.moveName,
        moveType: event.moveType,
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
        appendLog(tLog("used", { name: nameFor(event.side, lane), move: formatMoveName(event.moveName, locale) }), event.side);
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
            appendLog(tLog("used", { name: nameFor(event.side, lane), move: formatMoveName(event.moveName, locale) }), event.side);
            appendLog(tLog("noEffect"), event.side);
            setEffPopup({ text: tLog("noEffect"), key: fxKey });
            void delay(MISS_MS).then(() => setEffPopup(null));
          } else {
            appendLog(tLog("miss", { name: nameFor(event.side, lane), move: formatMoveName(event.moveName, locale) }), event.side);
          }
          await delay(MISS_MS);
          setMoveFx(null);
          await playResidualBeat(event);
          appendItemTriggerLog(event);
          resolve();
          return;
        }

        if (event.isStatus) {
          appendLog(tLog("used", { name: nameFor(event.side, lane), move: formatMoveName(event.moveName, locale) }), event.side);
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

        appendLog(tLog("used", { name: nameFor(event.side, lane), move: formatMoveName(event.moveName, locale) }), event.side);

        if (event.shielded) {
          appendLog(tLog("aegis", { name: nameFor(defenderSide, targetLane) }), defenderSide);
          setEffPopup({ text: tLog("aegis", { name: nameFor(defenderSide, targetLane) }), key: fxKey });
          setArenaFlash("#a78bfa");
          await delay(520);
          setArenaFlash(null);
          setEffPopup(null);
          setMoveFx(null);
          await playResidualBeat(event);
          appendItemTriggerLog(event);
          resolve();
          return;
        }

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
          // Sacudida del campo: siempre en hit con daño real (antes sólo SE/crit).
          if (i === 0 && chunk > 0) {
            const hard =
              event.critical ||
              event.effectiveness > 1 ||
              impactRatio >= 0.35 ||
              event.hpAfter <= 0;
            setArenaShake(hard ? "hard" : "soft");
            window.setTimeout(
              () => setArenaShake(null),
              hard ? 520 : 380,
            );
          }
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

        if (event.side === "player") {
          const totalDmg = hitDamages.reduce((s, d) => s + d, 0);
          const causedKo = event.hpAfter <= 0;
          highlightsRef.current = recordPlayerHit(highlightsRef.current, {
            moveName: formatMoveName(event.moveName, locale),
            critical: Boolean(event.critical),
            effectiveness: event.effectiveness,
            hitCount: hitDamages.length,
            damage: totalDmg,
            defenderMaxHp: defenderMaxHpNow,
            causedKo,
          });
        } else {
          highlightsRef.current = recordFoeBreaksSeStreak(highlightsRef.current);
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
      if (finalOutcome === "won" || finalOutcome === "trainer_cleared") {
        setArenaShake("hard");
        setKoSting(true);
        playBattleSfx("badge");
        playBattleSfx("crit");
      }
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
    const stingExtra =
      finalOutcome === "won" || finalOutcome === "trainer_cleared" ? 900 : 450;
    await delay(stingExtra);
    setKoSting(false);
    setArenaShake(null);
    {
      let items = highlightsRef.current.items;
      if (
        (finalOutcome === "won" || finalOutcome === "trainer_cleared") &&
        items.length === 0
      ) {
        items = [{ kind: "ko" }];
      }
      setHighlights(items);
    }
    if (finalOutcome === "lost") setLossReason("faint");
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

  useEffect(() => {
    playerHpRef.current = playerHp;
    playerBHpRef.current = playerBHp;
    wildHpRef.current = wildHp;
    wildBHpRef.current = wildBHp;
  }, [playerHp, playerBHp, wildHp, wildBHp]);

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
      // Última acción fue un poder → el próximo turno abre pelear directo.
      setIsAnimating(false);
      await enterDoubleFight({
        lockA: result.playerChargeMoveId,
        lockB: result.playerChargeMoveIdB ?? null,
      });
    }
  }

  async function handleDoubleTarget(lane: "A" | "B") {
    if (combatBusy || outcome !== "ongoing") return;
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
    if (combatBusy || outcome !== "ongoing" || mustSwitch) return;
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

    let result;
    try {
      result = await submitBattleMove(battleId, moveId, locale);
    } catch (error) {
      console.error("[battle] move failed", error);
      showToast(t("serverBusyRetry"), "info");
      setView("moves");
      setIsAnimating(false);
      return;
    }
    if (!result) {
      setIsAnimating(false);
      return;
    }
    setLastMoveId(moveId);
    // Sembrar YA: el action revalidó el layout y el badge puede recibir el
    // saldo nuevo durante playEvent. Sin pending, el header suma sin el vuelo.
    if (result.coinsGained > 0) {
      setCoinsGained(result.coinsGained);
      seedPendingCoinDelta(result.coinsGained);
    }
    if (result.pvpResult) {
      setPvpResult(result.pvpResult);
      if (result.coinsGained <= 0 && result.pvpResult.coinsAwarded > 0) {
        setCoinsGained(result.pvpResult.coinsAwarded);
        seedPendingCoinDelta(result.pvpResult.coinsAwarded);
      }
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
    if (result.heldRewardName) {
      appendLog(t("heldEarned", { name: result.heldRewardName }));
      setHeldRewardName(result.heldRewardName);
    }
    if (result.gymFirstWin) {
      setGymFirstWin(result.gymFirstWin);
    }

    if (result.turnDeadlineAt !== undefined) {
      setTurnDeadlineAt(result.turnDeadlineAt);
    }

    if (result.raidResult) {
      const raid = result.raidResult;
      setRaidTurns(raid.turnsLeft);
      if (raid.ended) {
        const teamWiped = !raid.bossDefeated && playerHpRef.current <= 0;
        setRaidSummary({
          damage: raid.damage,
          bossDefeated: raid.bossDefeated,
          teamWiped,
        });
        // El KO que corresponda se anima antes del cartel; si el intento se
        // acabó por turnos no cae nadie y se muestra el resumen directo.
        if (raid.bossDefeated) {
          await playFaintAndFinish("wild", "raid_ended");
        } else if (teamWiped) {
          await playFaintAndFinish("player", "raid_ended");
        } else {
          setOutcome("raid_ended");
        }
        return;
      }
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
      setView("moves");
    } else if (result.playerChargeMoveId != null) {
      // 2º turno automático (como en los juegos): no pedimos otro click.
      setView("menu");
      const finishId = result.playerChargeMoveId;
      let finish;
      try {
        finish = await submitBattleMove(battleId, finishId, locale);
      } catch (error) {
        console.error("[battle] charged move failed", error);
        showToast(t("serverBusyRetry"), "info");
        setView("moves");
        setIsAnimating(false);
        return;
      }
      if (finish) {
        if (finish.coinsGained > 0) {
          setCoinsGained(finish.coinsGained);
          seedPendingCoinDelta(finish.coinsGained);
        }
        if (finish.pvpResult) {
          setPvpResult(finish.pvpResult);
          if (finish.coinsGained <= 0 && finish.pvpResult.coinsAwarded > 0) {
            setCoinsGained(finish.pvpResult.coinsAwarded);
            seedPendingCoinDelta(finish.pvpResult.coinsAwarded);
          }
        }
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
        if (finish.heldRewardName) {
          appendLog(t("heldEarned", { name: finish.heldRewardName }));
          setHeldRewardName(finish.heldRewardName);
        }
        if (finish.gymFirstWin) {
          setGymFirstWin(finish.gymFirstWin);
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
          setView("moves");
        } else {
          setView("moves");
        }
      } else {
        setView("menu");
      }
    } else {
      setView("moves");
    }

    setIsAnimating(false);
  }

  function pickAutoMoveId(forB: boolean): number {
    const pool = forB ? activeMovesB : activeMoves;
    if (!forB && chargeMoveId != null) return chargeMoveId;
    if (forB && chargeMoveIdB != null) return chargeMoveIdB;

    const attackerTypes = forB
      ? (party.find((m) => m.instanceId === playerB?.instanceId)?.types ?? [])
      : activePlayerTypes;
    const attackerLevel = forB ? (playerB?.level ?? activePlayer.level) : activePlayer.level;
    const atk = forB ? (initialPlayerBStats?.atk ?? playerStats.atk) : stagedPlayer.atk;
    const spAtk = forB
      ? (initialPlayerBStats?.spAtk ?? playerStats.spAtk)
      : stagedPlayer.spAtk;
    const speed = forB
      ? (initialPlayerBStats?.speed ?? playerStats.speed)
      : stagedPlayer.speed;

    // Si solo B del rival sigue en pie, puntuar contra ese.
    const foeIsB = isDouble && wildHp <= 0 && (wildBHp > 0);
    const defender = foeIsB
      ? {
          level: wildB?.level ?? activeWild.level,
          types: wildB?.types ?? [],
          atk: 1,
          def: initialWildBStats?.def ?? stagedWild.def,
          spAtk: 1,
          spDef: initialWildBStats?.spDef ?? stagedWild.spDef,
          speed: initialWildBStats?.speed ?? stagedWild.speed,
        }
      : {
          level: activeWild.level,
          types: activeWild.types,
          atk: 1,
          def: stagedWild.def,
          spAtk: 1,
          spDef: stagedWild.spDef,
          speed: stagedWild.speed,
        };
    const defenderHp = foeIsB ? wildBHp : wildHp;
    const attackerHp = forB ? playerBHp : playerHp;
    const attackerMaxHp = forB ? playerBMaxHp : playerMaxHp;
    const recentKey = forB ? "B" : "A";
    const recentMoveIds = autoRecentMoveIdsRef.current[recentKey] ?? [];

    const picked = pickAutoPlayerMoveId(
      pool,
      {
        level: attackerLevel,
        types: attackerTypes,
        atk,
        def: 1,
        spAtk,
        spDef: 1,
        speed,
      },
      defender,
      defenderHp,
      forB ? null : choiceLockMoveId,
      {
        attackerHp,
        attackerMaxHp,
        recentMoveIds,
      },
    );
    const next = [...recentMoveIds, picked].slice(-6);
    autoRecentMoveIdsRef.current = {
      ...autoRecentMoveIdsRef.current,
      [recentKey]: next,
    };
    return picked;
  }

  function pickAutoTargetLane(): "A" | "B" {
    const { foes } = doubleTargetFoes();
    const living = foes.filter((f) => !f.fainted);
    if (living.length === 0) return livingFoeLanes()[0] ?? "A";
    let best = living[0]!;
    let bestScore = -Infinity;
    for (const f of living) {
      // Desempate estable: AUTO no debe cambiar de objetivo por un re-render.
      let score = f.lane === "A" ? 0.01 : 0;
      if (f.forecast?.guaranteedKo) score += 1000;
      if (f.forecast) score += f.forecast.maxPct;
      if (score > bestScore) {
        bestScore = score;
        best = f;
      }
    }
    return best.lane;
  }

  function pickAutoSwitchMember(): RosterMember | null {
    if (isDouble || isTrainerStyle) return null;
    return pickAutoSwitchCandidate(
      party,
      activePlayer.instanceId,
      activeWild.types,
      gameSettings.autoStrategy,
    );
  }

  const autoActionsRef = useRef({
    handleMove,
    handleUsePotion,
    handleSwitchTo,
    handleDoubleTarget,
    enterDoubleFight,
    pickAutoMoveId,
    pickAutoSwitchMember,
    pickAutoTargetLane,
    pickAutoPotionItem(): PotionStack | null {
      return null;
    },
    resolveMoveMeta(moveId: number, forB: boolean) {
      void moveId;
      void forB;
      return null as { name: string; type: string } | null;
    },
  });
  // Handlers imperativos consumidos por el timer de AUTO; el ref evita que
  // cada render cancele/rearme el temporizador por identidades nuevas.
  // eslint-disable-next-line react-hooks/refs
  autoActionsRef.current = {
    handleMove,
    handleUsePotion,
    handleSwitchTo,
    handleDoubleTarget,
    enterDoubleFight,
    pickAutoMoveId,
    pickAutoSwitchMember,
    pickAutoTargetLane,
    pickAutoPotionItem: () =>
      chargeMoveId == null
        ? pickAutoPotion(
            potionStacks,
            playerHp,
            playerMaxHp,
            gameSettings.autoStrategy,
          )
        : null,
    resolveMoveMeta: (moveId: number, forB: boolean) => {
      const pool = forB ? activeMovesB : activeMoves;
      const opt = pool.find((m) => m.moveId === moveId);
      return opt ? { name: opt.name, type: opt.type } : null;
    },
  };

  // AUTO: elige pelea → move (→ target en dobles) sin tocar el menú.
  // Pausa en mochila/equipo y en cambio forzado.
  // AUTO: historial corto de moves para romper bucles Absorber↔Absorber.
  const autoRecentMoveIdsRef = useRef<{ A: number[]; B: number[] }>({ A: [], B: [] });
  const autoGraceUntilRef = useRef<number | null>(null);
  useEffect(() => {
    autoGraceUntilRef.current = null;
    autoRecentMoveIdsRef.current = { A: [], B: [] };
  }, [battleId]);

  useEffect(() => {
    if (!autoBattle || combatBusy || outcome !== "ongoing" || mustSwitch) return;
    if (view === "bag" || view === "team") return;

    if (
      shouldStopAutoBattle(
        playerHp,
        playerMaxHp,
        gameSettings.autoStopHpPercent,
        potionStacks.some((stack) => stack.kind === "heal" && stack.quantity > 0),
      )
    ) {
      setBattleAuto(false);
      showToast(t("autoBattleStopped"), "info");
      return;
    }

    // Antes 2800 ms: se sentía a "AUTO colgado". 900 ms alcanza para cancelar.
    const AUTO_START_GRACE_MS = 900;
    const AUTO_STEP_MS = scaledDelay(220);
    const firstStep = autoGraceUntilRef.current == null;
    if (firstStep) autoGraceUntilRef.current = 1;
    const delay = firstStep ? AUTO_START_GRACE_MS : AUTO_STEP_MS;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      const actions = autoActionsRef.current;

      const fireMove = (moveId: number, forB: boolean) => {
        const meta = actions.resolveMoveMeta(moveId, forB);
        if (meta && !isDouble) {
          setAutoTelegraph({
            moveName: formatMoveName(meta.name, locale),
            moveType: meta.type,
            key: nextItemFxKey(),
          });
          // Reloj real — NO scaledDelay: a 3× AUTO el chip duraba ~80ms.
          window.setTimeout(() => {
            if (cancelled) return;
            setAutoTelegraph(null);
            void actions.handleMove(moveId);
          }, 850);
          return;
        }
        void actions.handleMove(moveId);
      };

      if (view === "menu") {
        if (isDouble) {
          void actions.enterDoubleFight();
        } else {
          const switchTarget = actions.pickAutoSwitchMember();
          if (switchTarget) {
            void actions.handleSwitchTo(switchTarget);
            return;
          }
          const potion = actions.pickAutoPotionItem();
          if (potion) {
            void actions.handleUsePotion(potion.itemId, true);
            return;
          }
          fireMove(actions.pickAutoMoveId(false), false);
        }
        return;
      }
      if (view === "moves") {
        const forB = isDouble && pendingDoubleMoveA != null;
        if (!isDouble) {
          const potion = actions.pickAutoPotionItem();
          if (potion) {
            void actions.handleUsePotion(potion.itemId, true);
            return;
          }
        }
        fireMove(actions.pickAutoMoveId(forB), forB);
        return;
      }
      if (view === "targets" && isDouble) {
        void actions.handleDoubleTarget(actions.pickAutoTargetLane());
      }
    }, delay);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    autoBattle,
    isAnimating,
    vsIntroDone,
    bootFxDone,
    combatBusy,
    outcome,
    mustSwitch,
    view,
    isDouble,
    pendingDoubleMoveA,
    playerHp,
    playerMaxHp,
    potionStacks,
    gameSettings,
    t,
    locale,
  ]);

  async function handleFlee() {
    if (combatBusy || mustSwitch || outcome !== "ongoing") return;
    if (isGymBattle) return;
    setIsAnimating(true);
    setView("menu");

    try {
      if (isPvpBattle) {
        if (pvpMatchId) {
          await forfeitPvpBattle(locale);
        } else {
          await forfeitClanWarBattle(locale);
        }
        return;
      }
      const result = await fleeBattle(battleId, locale);
      if (!result) {
        appendLog(tLog("fleeFailed"), "system");
        setView("menu");
        return;
      }

      if (typeof result.fleeAttempts === "number") {
        setFleeAttempts(result.fleeAttempts);
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
        setView("menu");
      }
    } catch {
      appendLog(tLog("fleeFailed"), "system");
      setView("menu");
    } finally {
      setIsAnimating(false);
    }
  }

  async function handleThrowBall(itemId: string, ballName: string) {
    if (combatBusy || outcome !== "ongoing" || mustSwitch || isTrainerStyle) return;
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

    // Pega en el cuerpo.
    setCaptureBall("hit");
    playBattleSfx("hit");
    await delay(BALL_HIT_MS);

    // Se abre y lo absorbe como energía.
    setCaptureBall("absorb");
    playBattleSfx("ball");
    await delay(BALL_ABSORB_MS);

    // Cierra, cae al piso y rebota. El server viene corriendo desde el
    // lanzamiento: acá se lo espera con animación encima, no en seco.
    setCaptureBall("seal");
    playBattleSfx("ball");
    const [result] = await Promise.all([resultPromise, delay(BALL_SEAL_MS)]);
    if (!result) {
      setBallStacks(prevBalls);
      setCaptureBall(null);
      setCaptureBallName(null);
      setIsAnimating(false);
      setView("menu");
      return;
    }

    // La ball queda en el piso con la luz latiendo antes del primer forcejeo.
    setCaptureBall("idle");
    await delay(BALL_SETTLE_MS);

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
      setView("menu");
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
    setHighlights(highlightsRef.current.items);
  }

  async function handleUsePotion(itemId: string, automatic = false) {
    if (combatBusy || outcome !== "ongoing" || mustSwitch) return;
    setIsAnimating(true);
    setView("menu");

    const prevPotions = potionStacks;
    const used = potionStacks.find((p) => p.itemId === itemId);
    const itemName = used?.name ?? "Potion";
    const rawHeal = used?.healAmount ?? 20;
    const optimisticHeal = Math.max(
      0,
      Math.min(playerMaxHp - playerHp, rawHeal >= 9999 ? playerMaxHp - playerHp : rawHeal),
    );
    const optimisticHp = Math.min(playerMaxHp, playerHp + optimisticHeal);

    setPotionStacks((prev) =>
      prev.map((p) => (p.itemId === itemId ? { ...p, quantity: p.quantity - 1 } : p)).filter((p) => p.quantity > 0),
    );

    setHealingTarget({ side: "player", lane: "A" });
    setItemUseFx({
      kind: "heal",
      side: "player",
      lane: "A",
      itemName,
      label: optimisticHeal > 0 ? `+${optimisticHeal}` : itemName,
      key: nextItemFxKey(),
    });
    if (optimisticHeal > 0) {
      writeHp("player", "A", optimisticHp);
      setDamagePopup({
        side: "player",
        lane: "A",
        text: `+${optimisticHeal}`,
        key: nextItemFxKey(),
        tone: "heal",
      });
    }
    playBattleSfx("heal");
    await delay(ITEM_USE_MS);
    setHealingTarget(null);
    setItemUseFx(null);
    setDamagePopup(null);

    const result = await applyBattleItem(battleId, itemId, locale);
    if (!result) {
      setPotionStacks(prevPotions);
      writeHp("player", "A", playerHp);
      setIsAnimating(false);
      setView("menu");
      return;
    }

    // Confirmar HP real (por si Max Potion / clamp del server difiere).
    writeHp("player", "A", result.healedTo);
    setItemUsage((current) =>
      appendBattleItemUsage(current, {
        itemName: result.itemName ?? itemName,
        targetInstanceId: activePlayer.instanceId,
        targetName: activePlayer.name,
        targetSpriteUrl: activePlayer.spriteUrl,
        kind: "heal",
        amount: result.healedBy,
        automatic,
      }),
    );
    appendLog(tLog("usedItem", { name: result.itemName ?? itemName }), "player");
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
      setView("menu");
    }

    setIsAnimating(false);
  }

  function handlePickRevive(itemId: string) {
    if (combatBusy || outcome !== "ongoing" || mustSwitch) return;
    setPendingReviveItemId(itemId);
    setView("reviveTargets");
  }

  async function handleConfirmRevive(member: RosterMember) {
    if (combatBusy || outcome !== "ongoing" || mustSwitch || !pendingReviveItemId) return;
    const itemId = pendingReviveItemId;
    setIsAnimating(true);
    setView("menu");
    setPendingReviveItemId(null);

    const prevPotions = potionStacks;
    const used = potionStacks.find((p) => p.itemId === itemId);
    const itemName = used?.name ?? "Revive";
    const fraction = reviveHpFraction(itemName) ?? 0.5;
    const optimisticHp = Math.max(1, Math.floor(member.maxHp * fraction));

    setPotionStacks((prev) =>
      prev
        .map((p) => (p.itemId === itemId ? { ...p, quantity: p.quantity - 1 } : p))
        .filter((p) => p.quantity > 0),
    );

    // FX sobre el ícono del party (columna), no sobre el mon en campo.
    setItemUseFx({
      kind: "revive",
      side: "player",
      lane: "A",
      itemName,
      label: `+${optimisticHp}`,
      key: nextItemFxKey(),
      partyInstanceId: member.instanceId,
    });
    playBattleSfx("heal");
    // Primero el destello con el mon todavía debilitado; a mitad despierta.
    await delay(ITEM_USE_MS * 0.42);
    setParty((prev) =>
      prev.map((m) =>
        m.instanceId === member.instanceId ? { ...m, currentHp: optimisticHp } : m,
      ),
    );
    await delay(ITEM_USE_MS * 0.58);
    setItemUseFx(null);

    const result = await applyBattleItem(battleId, itemId, locale, member.instanceId);
    if (!result || !result.revivedTargetId) {
      setPotionStacks(prevPotions);
      setParty((prev) =>
        prev.map((m) =>
          m.instanceId === member.instanceId
            ? { ...m, currentHp: member.currentHp }
            : m,
        ),
      );
      setIsAnimating(false);
      setView("menu");
      return;
    }

    setParty((prev) =>
      prev.map((m) =>
        m.instanceId === result.revivedTargetId
          ? { ...m, currentHp: result.healedTo }
          : m,
      ),
    );
    setItemUsage((current) =>
      appendBattleItemUsage(current, {
        itemName: result.itemName ?? itemName,
        targetInstanceId: member.instanceId,
        targetName: member.name,
        targetSpriteUrl: member.spriteUrl,
        kind: "revive",
        amount: result.healedTo,
        automatic: false,
      }),
    );
    appendLog(tLog("usedItem", { name: result.itemName ?? itemName }), "player");
    appendLog(
      t("revivedBy", { name: member.name, hp: result.healedTo }),
      "player",
    );

    if (result.counterAttack) {
      await playEvent(result.counterAttack);
    }
    if (result.outcome === "lost") {
      await playFaintAndFinish("player", "lost");
    } else if (result.outcome === "fainted") {
      await playFaintThenForceSwitch();
    } else {
      setView("menu");
    }

    setIsAnimating(false);
  }

  async function handleSwitchTo(member: RosterMember) {
    if (combatBusy || outcome !== "ongoing" || member.currentHp <= 0) return;
    setIsAnimating(true);
    setView("menu");

    const outgoing = activePlayer;
    const outgoingHpSnapshot = playerHp;
    const outgoingMaxHpSnapshot = playerMaxHp;
    const forced = mustSwitch;
    // Cerrar el sheet ya: no esperar a que termine la animación de salida.
    if (forced) setMustSwitch(false);

    if (!forced) {
      setBallAnim("recall");
      await delay(RECALL_MS);
    }
    // Ocultar el sprite saliente: si no, al pasar de recall → throw
    // pierde la clase sprite-recall y el Pokémon viejo reaparece un frame.
    setPlayerHidden(true);
    setBallAnim("throw");
    playBattleSfx("ball");
    // Server en paralelo al vuelo: no sumar latencia encima de la animación.
    const resultPromise = switchPokemon(battleId, member.instanceId, locale, forced);
    await delay(SEND_OUT_TRAVEL_MS);
    setBallAnim("land");
    // El resultado se espera durante el rebote, no después de la apertura: así
    // el Pokémon puede salir en el mismo frame en que la ball se abre.
    const [result] = await Promise.all([resultPromise, delay(SEND_OUT_LAND_MS)]);
    if (!result) {
      setIsAnimating(false);
      setBallAnim(null);
      setPlayerHidden(false);
      if (forced) setMustSwitch(true);
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
      isShiny: result.newPlayer.isShiny ?? false,
    });
    setLastMoveId(null);
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

    // Apertura y salida arrancan juntas: el chorro de luz de la ball es el
    // mismo que arma la silueta.
    setBallAnim("open");
    playBattleSfx("sendOut");
    setPlayerEntering(true);
    setPlayerHidden(false);
    await delay(SEND_OUT_OPEN_MS);
    setBallAnim(null);
    await delay(SPRITE_MATERIALIZE_MS - SEND_OUT_OPEN_MS);
    setPlayerEntering(false);

    if (result.counterAttack) {
      await playEvent(result.counterAttack);
    }
    if (result.outcome === "lost") {
      await playFaintAndFinish("player", "lost");
    } else if (result.outcome === "fainted") {
      await playFaintThenForceSwitch();
    } else {
      // Mochila / cambio: el próximo turno arranca en el menú raíz, no en poderes.
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
        lossReason={lossReason}
        caughtSentToPc={caughtSentToPc}
        locale={locale}
        player={activePlayer}
        foe={activeWild}
        xpSummary={xpSummary}
        coinsGained={coinsGained}
        isPvpBattle={isPvpBattle}
        isGymBattle={isGymBattle}
        isTowerBattle={isTowerBattle}
        raidSummary={raidSummary}
        pvpResult={pvpResult}
        showBadgePopup={showBadgePopup}
        onBadgeContinue={() => setShowBadgePopup(false)}
        badgeEarned={badgeEarned}
        tmRewardName={tmRewardName}
        heldRewardName={heldRewardName}
        gymFirstWin={gymFirstWin}
        gymId={gymId}
        gymRunId={gymRunId}
        towerRunId={towerRunId}
        gymType={gymType}
        gymName={gymName}
        gymLeaderName={gymLeaderName}
        gymBadgeName={gymBadgeName}
        leaderPortrait={leaderPortrait}
        highlights={highlights}
        farmStreak={farmChainCount}
        itemUsage={itemUsage}
      />
    );
  }

  const hasBalls = !isTrainerStyle && ballStacks.length > 0;
  const hasPotions = potionStacks.length > 0;
  const hasFaintedBench = teamRoster.some((m) => m.currentHp <= 0);
  const pendingReviveName =
    potionStacks.find((p) => p.itemId === pendingReviveItemId)?.name ?? "Revive";
  const hasHealthyBackup = teamRoster.some((m) => m.currentHp > 0);

  const lastMoveOption =
    !isDouble && lastMoveId != null
      ? activeMoves.find((m) => m.moveId === lastMoveId) ?? null
      : null;
  const canRepeatLast =
    Boolean(lastMoveOption) &&
    (lastMoveOption?.pp ?? 0) > 0 &&
    (choiceLockMoveId == null || choiceLockMoveId === lastMoveId) &&
    (chargeMoveId == null || chargeMoveId === lastMoveId);

  const showFleeChance = !isTrainerStyle && !isPvpBattle && !isGymBattle;
  const fleePct = showFleeChance
    ? fleeChancePercent(stagedPlayer.speed, stagedWild.speed, fleeAttempts)
    : null;

  const seFlash = moveFx?.mode === "hit" && (moveFx.effectiveness ?? 1) > 1;
  const physicalLunge = moveFx?.mode === "hit" && moveFx.category === "PHYSICAL";
  /** El rival ya no está en el campo: entró en la ball (o está entrando). */
  const wildAbsorbedByBall =
    captureBall === "absorb" ||
    captureBall === "seal" ||
    captureBall === "idle" ||
    captureBall === "wobble" ||
    captureBall === "success";
  // Caja relativa al alto del campo + escala por especie, capeada por ancho
  // para que en mobile alto/angosto no se estiren ni se corten.
  const isAlphaWild = initialLog.some((line) => line === "alpha");
  const arenaH = arenaHeightPx || 400;
  const arenaW = arenaWidthPx || 360;
  /*
    Zoom del escenario, sólo en pasos **enteros**. El fondo nativo es 753px y
    el arte de sprites va de 45px a 172px: cualquier factor intermedio (1.4×)
    deja píxeles de tamaño desparejo y se ve peor que no escalar. A 2× exacto
    con `image-rendering: pixelated` el conjunto se lee como un juego retro
    ampliado, que es la única forma de pasar de 753px sin ensuciar.
  */
  const arenaZoom = arenaW >= BATTLE_ARENA_BASE_W * 1.9 ? 2 : 1;
  /*
    Modelo Showdown: el tamaño sale del arte nativo (que ya codifica cuán
    grande es la especie), no de una fracción del campo. La rama por
    `battleSpeciesScale` queda sólo para especies que no estén en la tabla
    de tamaños nativos, y ahí sí se capea el agrandado a 3× entero.
  */
  function spriteBoxPx(
    fracH: number,
    widthCap: number,
    speciesName: string,
    facing: "front" | "back",
    alpha = false,
  ) {
    const byWidth = arenaW * widthCap;
    const natural = spriteNaturalPx(speciesName, facing);
    if (natural) {
      // 0.75 y no 0.62: con el tope justo, un Charizard de espalda (258px en
      // Showdown) quedaba recortado a 223px y perdía la presencia que le toca.
      const maxPx = Math.min(byWidth, arenaH * 0.75);
      const box = spriteBoxFromNatural(natural, facing, maxPx) * arenaZoom;
      return alpha ? Math.round(box * 1.1) : box;
    }
    const byHeight = arenaH * fracH * battleSpeciesScale(speciesName) * (alpha ? 1.1 : 1);
    return Math.round(Math.min(byHeight, byWidth));
  }
  const playerSpritePx = spriteBoxPx(
    BATTLE_PLAYER_SPRITE_FRAC,
    BATTLE_PLAYER_SPRITE_WIDTH_CAP,
    activePlayer.speciesName,
    "back",
  );
  const wildSpritePx = spriteBoxPx(
    BATTLE_WILD_SPRITE_FRAC,
    BATTLE_WILD_SPRITE_WIDTH_CAP,
    activeWild.speciesName,
    "front",
    isAlphaWild,
  );
  const playerBSpritePx = playerB
    ? Math.round(
        spriteBoxPx(
          BATTLE_PLAYER_SPRITE_FRAC,
          BATTLE_PLAYER_SPRITE_WIDTH_CAP,
          playerB.speciesName,
          "back",
        ) * 0.82,
      )
    : Math.round(playerSpritePx * 0.82);
  const wildBSpritePx = wildB
    ? Math.round(
        spriteBoxPx(
          BATTLE_WILD_SPRITE_FRAC,
          BATTLE_WILD_SPRITE_WIDTH_CAP,
          wildB.speciesName,
          "front",
        ) * 0.78,
      )
    : Math.round(wildSpritePx * 0.78);
  const playerSpriteClass = [
    "absolute inset-0 z-[1] h-full w-full object-contain object-bottom drop-shadow-lg origin-bottom",
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
    playerEntering ? "sprite-materialize" : "",
    healingTarget?.side === "player" && healingTarget.lane === "A" ? "sprite-heal" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const playerBSpriteClass = [
    "absolute inset-0 z-[1] h-full w-full object-contain object-bottom drop-shadow-lg origin-bottom",
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
  ]
    .filter(Boolean)
    .join(" ");

  const wildSpriteClass = [
    "absolute inset-0 z-[1] h-full w-full object-contain object-bottom drop-shadow-lg origin-bottom",
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
    captureBall === "fail" ? "sprite-materialize" : "",
    healingTarget?.side === "wild" && healingTarget.lane === "A" ? "sprite-heal" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const wildBSpriteClass = [
    "absolute inset-0 z-[1] h-full w-full object-contain object-bottom drop-shadow-lg origin-bottom",
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
  ]
    .filter(Boolean)
    .join(" ");

  const emptyPlayerSlots = Math.max(0, 6 - party.length);
  const isWildEncounter = battleMode === "wild";
  // Torre o salvaje puro: sidebar de “encuentro”. Entrenador de ruta / tutorial
  // traen `opponentName` y usan el panel de entrenador (no el tag Salvaje).
  const foeSidebarWild =
    isTowerBattle || (isWildEncounter && !opponentName);
  /** Strip mobile: nombre real + lugar (no entrenador de ruta). */
  const wildEncounterHeader =
    (isWildEncounter && !opponentName) || isTowerBattle;
  // Ruta / tutorial: 1 mon real — no rellenar 5 pokebolas vacías como si fueran un gym.
  const emptyOpponentSlots =
    foeSidebarWild || (!isGymBattle && !isPvpBattle)
      ? 0
      : Math.max(0, 6 - opponentParty.length);
  const wildFeaturedSprite = foeSidebarWild
    ? activeWild.spriteUrl
    : (opponentParty.find((m) => m.active)?.spriteUrl ??
      opponentParty[0]?.spriteUrl ??
      activeWild.spriteUrl);
  const foePartyIconsCompact = opponentParty.map((m) => (
    <PartyIcon
      key={`o-${m.slot}`}
      spriteUrl={m.spriteUrl}
      name={m.name}
      fainted={m.fainted}
      active={m.active}
      compact
    />
  ));
  const selectPartyMember = (m: (typeof party)[number]) => {
    if (combatBusy || isDouble) return undefined;
    if (mustSwitch) {
      if (m.currentHp <= 0 || m.instanceId === activePlayer.instanceId) return undefined;
      return () => {
        void handleSwitchTo(m);
      };
    }
    if (!hasHealthyBackup) return undefined;
    return () => setView("team");
  };
  const commandExpanded = view !== "menu";
  const lastLogEntry = log[log.length - 1];

  const vsPlaceLabel =
    encounterPlace?.title ??
    (isGymBattle ? gymName : null) ??
    null;
  const vsFoePortrait = opponentPortraitUrl ?? leaderPortrait;

  return (
    <div
      className="battle-shell relative flex h-full max-h-full min-h-0 flex-1 flex-col overflow-hidden"
      style={
        {
          "--arena-bg-image": `url(${showdownBattleBgUrl(battleBg)})`,
        } as CSSProperties
      }
    >
      {/* Bioma a full-bleed: sólo desktop (no altera mobile). */}
      <div
        className={`battle-biome-bleed${fieldAssembling ? " battle-biome-bleed--assembling" : ""}`}
        aria-hidden
      />
      {isRaidBattle ? (
        <ConfirmModal
          open={confirmWithdraw}
          title={t("raidWithdrawTitle")}
          body={t("raidWithdrawBody")}
          confirmLabel={t("raidWithdrawConfirm")}
          cancelLabel={t("raidWithdrawCancel")}
          tone="danger"
          pending={withdrawing}
          onCancel={() => {
            if (!withdrawing) setConfirmWithdraw(false);
          }}
          onConfirm={() => {
            startWithdraw(async () => {
              await abandonWeeklyRaidBattle(locale);
            });
          }}
        />
      ) : null}
      {mustSwitch ? (
        <MustSwitchSheet
          isAnimating={combatBusy}
          roster={teamRoster}
          foeName={activeWild.name}
          foeTypes={activeWild.types}
          matchupInfo={switchMatchupInfo}
          onSwitch={handleSwitchTo}
        />
      ) : null}
      {/* La mochila no se monta acá: vive dentro de `.battle-arena-field` para
          no taparle las placas de HP al jugador. Ver más abajo. */}
      {view === "reviveTargets" ? (
        <ReviveTargetView
          isAnimating={combatBusy}
          itemName={pendingReviveName}
          roster={teamRoster}
          onRevive={handleConfirmRevive}
          onBack={() => {
            setPendingReviveItemId(null);
            setView("bag");
          }}
        />
      ) : null}
      {view === "team" && !mustSwitch ? (
        <TeamView
          isAnimating={combatBusy}
          mustSwitch={mustSwitch}
          roster={teamRoster}
          foeName={activeWild.name}
          foeTypes={activeWild.types}
          matchupInfo={switchMatchupInfo}
          onSwitch={handleSwitchTo}
          onBack={() => setView("menu")}
        />
      ) : null}
      <div className="battle-layout relative z-[1] mx-auto w-full max-w-7xl px-1.5 py-0.5 sm:px-2 md:px-3 md:py-1.5 lg:max-w-[100rem]">
        {/*
          < lg: stage centrado 753 + party, como antes.
          ≥ lg: display:contents → arena/moves/info en el grid padre.
        */}
        <div className="battle-layout__stage battle-stage flex min-h-0 w-full flex-col gap-0.5 overflow-hidden md:gap-1.5">
        {/* Rival — mobile/tablet; en desktop vive en la columna info. */}
        <div className="shrink-0 lg:hidden">
          <PartySidebar
            name={wildEncounterHeader ? activeWild.name : foeLabel}
            portraitUrl={opponentPortraitUrl}
            align="right"
            compact
            variant={foeSidebarWild ? "wild" : "party"}
            featuredSpriteUrl={wildFeaturedSprite}
            featuredLevel={wildEncounterHeader ? activeWild.level : null}
            featuredIsShiny={wildEncounterHeader ? Boolean(activeWild.isShiny) : false}
            encounterPlace={wildEncounterHeader ? encounterPlace : null}
          >
            {foeSidebarWild
              ? opponentParty.length > 1
                ? foePartyIconsCompact
                : null
              : [
                  ...foePartyIconsCompact,
                  ...Array.from({ length: emptyOpponentSlots }).map((_, i) => (
                    <EmptyPartySlot key={`oe-${i}`} compact />
                  )),
                ]}
          </PartySidebar>
        </div>

          {/* Arena */}
          <div className="battle-layout__arena relative flex min-h-0 min-w-0 flex-1 flex-col">
          <div
            ref={arenaFieldRef}
            data-battle-speed={battleSpeed}
            /*
              753px = ancho nativo de los fondos de Showdown (753×500). El
              grid `.battle-layout` ya fija ese tope (o 1506 a 2×); acá el
              campo llena el ancho de la columna central.
            */
            className={`battle-arena-field relative mx-auto max-h-full w-full min-h-0 min-w-0 overflow-hidden rounded-xl border border-white/10 max-lg:h-full max-lg:max-h-none max-lg:aspect-auto lg:m-auto lg:aspect-[753/500] ${
              showVsIntro || fieldAssembling ? "battle-arena-field--assembling" : ""
            } ${arenaFlash ? "arena-type-flash" : ""} ${
              arenaShake === "hard"
                ? "battle-arena-shake-hard"
                : arenaShake === "soft"
                  ? "battle-arena-shake-soft"
                  : ""
            } ${koSting ? "battle-arena-ko-sting" : ""}`}
            style={
              arenaFlash
                ? ({ "--arena-flash-color": arenaFlash } as CSSProperties)
                : undefined
            }
          >
            {showVsIntro ? (
              <BattleVsIntro
                mode={
                  isPvpBattle
                    ? "pvp"
                    : isGymBattle
                      ? "gym"
                      : isTowerBattle
                        ? "tower"
                        : "wild"
                }
                variant={vsIntroVariant}
                player={{
                  name: trainerName,
                  portraitUrl: trainerPortraitUrl,
                  level: trainerLevel,
                  team: initialParty.map((m) => ({
                    spriteUrl: m.spriteUrl,
                    fainted: m.currentHp <= 0,
                  })),
                  pvpTier: trainerPvpTier as PvpTier,
                  pvpDivision: trainerPvpDivision,
                }}
                foe={{
                  name: foeLabel,
                  portraitUrl: vsFoePortrait,
                  level: opponentLevel,
                  team:
                    initialOpponentParty.length > 0
                      ? initialOpponentParty.map((m) => ({
                          spriteUrl: m.spriteUrl,
                          fainted: m.fainted,
                        }))
                      : [{ spriteUrl: wild.spriteUrl }],
                  pvpTier: (opponentPvpTier as PvpTier | null) ?? null,
                  pvpDivision: opponentPvpDivision,
                }}
                placeLabel={vsPlaceLabel}
                onComplete={() => setVsIntroDone(true)}
              />
            ) : null}
            {autoTelegraph ? (
              <BattleAutoTelegraph
                key={autoTelegraph.key}
                moveName={autoTelegraph.moveName}
                moveType={autoTelegraph.moveType}
                label={t("autoTelegraphLabel")}
              />
            ) : null}
            {koSting ? (
              <div className="battle-ko-sting-label" aria-hidden>
                <span>{t("koStingLabel")}</span>
              </div>
            ) : null}
            {isPvpBattle ? (
              <BattleTurnTimer
                battleId={battleId}
                locale={locale}
                deadlineAt={turnDeadlineAt}
                paused={combatBusy || outcome !== "ongoing"}
                onExpired={() => {
                  setTurnDeadlineAt(null);
                  appendLog(t("idleTimeout"));
                  setLossReason("idle");
                  setOutcome("lost");
                }}
              />
            ) : null}
            {/* Placas HP sobre el campo (también en desktop — la columna info
                sólo lleva party/encuentro, sin duplicar estas barras). */}
            <div className="absolute top-2.5 right-2 left-2.5 z-30 flex flex-col items-start gap-3.5 md:top-3 md:right-1.5 md:left-3 md:gap-4">
              <div className="flex w-full items-stretch gap-1.5 md:gap-2">
                <HpPlate
                  className="relative z-20 w-[min(52vw,11.5rem)] shrink-0 sm:w-[min(48vw,12.75rem)] md:w-[min(100%,19.5rem)]"
                  name={activeWild.name}
                  levelLabel={t("level", { level: activeWild.level })}
                  currentHp={wildHp}
                  maxHp={wildMaxHp}
                  status={wildStatus}
                  stages={wildStages}
                  isShiny={activeWild.isShiny}
                  align="left"
                />
                {moveBanner ? (
                  <div
                    key={`banner-${moveBanner.key}`}
                    className="move-banner pointer-events-none min-w-0 flex-1 self-center md:flex-none"
                    style={
                      {
                        "--move-banner-accent": typeColor(moveBanner.moveType),
                      } as CSSProperties
                    }
                  >
                    <span className="move-banner__shell">
                      <span className="move-banner__panel">
                        <span className="move-banner__accent" aria-hidden />
                        <span className="move-banner__content">
                          <span className="move-banner__type">{moveBanner.moveType}</span>
                          <span className="move-banner__name">
                            {formatMoveName(moveBanner.moveName, locale)}
                          </span>
                        </span>
                      </span>
                    </span>
                  </div>
                ) : null}
              </div>
              {/* Incursión: los turnos son el recurso escaso del intento, así
                  que van sobre el campo y no enterrados en el log. */}
              {isRaidBattle && raidTurns != null ? (
                <span className="raid-turn-chip">
                  <span className="material-symbols-outlined" aria-hidden>
                    timer
                  </span>
                  {t("raidTurnsLeft", { turns: raidTurns })}
                  {/*
                    Daño acumulado del intento. La barra del jefe tiene decenas
                    de miles de HP y casi no se mueve, así que sin este número
                    el jugador no sabía si estaba haciendo algo hasta el cartel
                    final.
                  */}
                  <span className="raid-turn-chip__damage">
                    {Math.max(0, wildMaxHp - wildHp).toLocaleString()}
                  </span>
                </span>
              ) : null}
              <div className="mt-1 flex flex-col items-start gap-1.5 md:mt-1.5 md:gap-2">
                <BattleSpeedControl />
                <BattleAutoControl unlocked={autoBattleUnlocked} />
                <BattleAudioControls bgmKind={bgmKind} />
              </div>
            </div>
            {isDouble && wildB && (
              <HpPlate
                className="absolute top-2 left-[calc(min(52vw,11.5rem)+0.45rem)] z-20 w-[min(36vw,8.25rem)] sm:left-[calc(min(48vw,12.75rem)+0.55rem)] sm:w-[min(40vw,9.5rem)] md:top-3 md:left-[calc(min(100%,19.5rem)+0.9rem)] md:w-[min(100%,15.5rem)]"
                name={wildB.name}
                levelLabel={t("level", { level: wildB.level })}
                currentHp={wildBHp}
                maxHp={wildBMaxHp}
                status={wildBStatus}
                stages={NO_STAGES}
                isShiny={wildB.isShiny}
                align="left"
              />
            )}
            {/* Plates sit opposite their sprite (FireRed layout): foe plate
                top-left vs foe sprite top-right, player plate bottom-right vs
                player sprite bottom-left. Same-corner plates were covering the
                sprites, which is why the player looked cropped and small. */}
            <HpPlate
              className="absolute bottom-2 right-2 z-30 w-[min(52vw,11.5rem)] sm:bottom-2.5 sm:right-2.5 sm:w-[min(48vw,12.75rem)] md:bottom-3 md:right-3 md:w-[min(100%,19.5rem)]"
              name={activePlayer.name}
              levelLabel={t("level", { level: activePlayer.level })}
              currentHp={playerHp}
              maxHp={playerMaxHp}
              status={playerStatus}
              stages={playerStages}
              isShiny={activePlayer.isShiny}
              align="right"
            />
            {isDouble && playerB && (
              <HpPlate
                className="absolute bottom-2 right-[calc(min(52vw,11.5rem)+0.45rem)] z-30 w-[min(36vw,8.25rem)] sm:right-[calc(min(48vw,12.75rem)+0.55rem)] sm:w-[min(40vw,9.5rem)] md:bottom-3 md:right-[calc(min(100%,19.5rem)+0.9rem)] md:w-[min(100%,15.5rem)]"
                name={playerB.name}
                levelLabel={t("level", { level: playerB.level })}
                currentHp={playerBHp}
                maxHp={playerBMaxHp}
                status={playerBStatus}
                stages={NO_STAGES}
                isShiny={playerB.isShiny}
                align="right"
              />
            )}

            {moveFx?.mode === "hit" &&
            moveFx.fxFile &&
            moveFx.fxStyle &&
            ((moveFx.fxStyle !== "contact" && moveFx.fxStyle !== "slash") ||
              attackingSide) ? (
              <MoveHitFx
                strikeKey={moveFx.strikeKey}
                side={moveFx.side}
                file={moveFx.fxFile}
                files={moveFx.fxFiles}
                style={moveFx.fxStyle}
                count={moveFx.fxCount ?? 1}
                glow={moveFx.fxGlow}
              />
            ) : null}

            {effPopup && (
              <span
                key={`eff-${effPopup.key}`}
                className="eff-popup absolute top-1/2 left-1/2 z-30 pointer-events-none text-label-md font-black tracking-wide"
              >
                {effPopup.text}
              </span>
            )}

            {/* Opponent sprite — pies sobre plataforma lejana. */}
            <div
              className={`absolute z-[1] origin-bottom ${
                isDouble
                  ? "right-[10%] bottom-[46%] md:right-[12%] md:bottom-[48%] lg:right-[14%] lg:bottom-[46%]"
                  : "right-[16%] bottom-[44%] md:right-[18%] md:bottom-[46%] lg:right-[22%] lg:bottom-[42%]"
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
              {/* Plataforma + sombra: ancla visual tipo Gen 5 / Showdown. Se
                  mantiene mientras la ball descansa sobre ella. */}
              {!wildAbsorbedByBall || captureBall === "seal" || captureBall === "idle" ||
              captureBall === "wobble" || captureBall === "success" ? (
                <span
                  className="battle-platform battle-platform--wild"
                  aria-hidden
                >
                  <span className="battle-platform__core" />
                </span>
              ) : null}
              {/* Ball de captura: vuelo al cuerpo → golpe → absorción → cierre
                  → caída al piso → forcejeo → click. Ver `.capture-ball`. */}
              {captureBall && captureBallName && (
                <div
                  key={`${captureBall}-${captureShakeKey}`}
                  className={`capture-ball h-6 w-6 md:h-7 md:w-7 ${
                    captureBall === "throw"
                      ? "is-throwing"
                      : captureBall === "hit"
                        ? "is-hit"
                        : captureBall === "absorb"
                          ? "is-absorbing"
                          : captureBall === "seal"
                            ? "is-sealing"
                            : captureBall === "wobble"
                              ? "is-wobbling"
                              : captureBall === "success"
                                ? "is-caught"
                                : captureBall === "fail"
                                  ? "is-breaking"
                                  : "is-idle"
                  }`}
                  style={
                    {
                      // Altura del cuerpo del rival: hasta acá vuela la ball.
                      "--capture-lift": `${Math.round(
                        (isDouble ? wildSpritePx * 0.82 : wildSpritePx) * 0.42,
                      )}px`,
                    } as CSSProperties
                  }
                >
                  {captureBall === "throw" && (
                    <span className="capture-ball__shadow" aria-hidden />
                  )}
                  {captureBall === "absorb" && <span className="capture-beam" aria-hidden />}
                  <span className="capture-ball__hop">
                    {captureBall === "throw" && (
                      <span className="capture-ball__trail" aria-hidden />
                    )}
                    <span className="capture-ball__spin">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={itemDisplayUrl(captureBallName, "hd")}
                        alt=""
                        aria-hidden
                        className="h-full w-full object-contain"
                      />
                      {(captureBall === "idle" || captureBall === "wobble") && (
                        <span className="capture-ball__light" aria-hidden />
                      )}
                    </span>
                    {captureBall === "wobble" && <span className="capture-spark" aria-hidden />}
                  </span>
                  {captureBall === "hit" && (
                    <>
                      <span className="capture-hit-flash" aria-hidden />
                      <span className="capture-hit-ring" aria-hidden />
                    </>
                  )}
                  {captureBall === "seal" && (
                    <>
                      <span className="capture-seal-flash" aria-hidden />
                      <span className="capture-ball__dust" aria-hidden />
                    </>
                  )}
                  {captureBall === "success" && (
                    <>
                      <span className="ball-catch-ring" aria-hidden />
                      <span className="ball-catch-ring ball-catch-ring-delay" aria-hidden />
                      <span className="capture-stars" aria-hidden />
                      <span className="capture-ground-glow" aria-hidden />
                    </>
                  )}
                  {captureBall === "fail" && <span className="ball-break-burst" aria-hidden />}
                </div>
              )}
              {damagePopup?.side === "wild" && damagePopup.lane === "A" && (
                <span
                  key={damagePopup.key}
                  className={`damage-popup absolute -top-4 left-1/2 -translate-x-1/2 text-headline-md font-black z-10 ${damagePopup.tone === "heal" ? "damage-popup--heal" : "text-error"}`}
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
                <>
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
                  {!wildEntering && !captureBall && <SpriteStatusFx status={wildStatus} />}
                  {/* Capa roja de "energía" mientras entra en la ball, y silueta
                      blanca cuando se escapa y vuelve a salir. */}
                  {captureBall === "absorb" && (
                    <BattleSprite
                      speciesName={activeWild.speciesName}
                      facing="front"
                      isShiny={activeWild.isShiny}
                      fallbackUrl={activeWild.spriteUrl}
                      alt=""
                      width={isDouble ? Math.round(wildSpritePx * 0.82) : wildSpritePx}
                      height={isDouble ? Math.round(wildSpritePx * 0.82) : wildSpritePx}
                      className="sprite-absorb-energy"
                    />
                  )}
                  {captureBall === "fail" && (
                    <BattleSprite
                      speciesName={activeWild.speciesName}
                      facing="front"
                      isShiny={activeWild.isShiny}
                      fallbackUrl={activeWild.spriteUrl}
                      alt=""
                      width={isDouble ? Math.round(wildSpritePx * 0.82) : wildSpritePx}
                      height={isDouble ? Math.round(wildSpritePx * 0.82) : wildSpritePx}
                      className="sprite-materialize-ghost"
                    />
                  )}
                </>
              )}
            </div>

            {isDouble && wildB && (
              <div
                className={`absolute right-[32%] bottom-[38%] z-[1] origin-bottom md:right-[34%] md:bottom-[40%] lg:right-[36%] lg:bottom-[38%] ${
                  view === "targets" && wildBHp > 0
                    ? "cursor-pointer ring-2 ring-amber-300/80 rounded-lg"
                    : ""
                }`}
                style={{
                  width: wildBSpritePx,
                  height: wildBSpritePx,
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
                <span className="battle-platform battle-platform--wild" aria-hidden>
                  <span className="battle-platform__core" />
                </span>
                {damagePopup?.side === "wild" && damagePopup.lane === "B" && (
                  <span
                    key={damagePopup.key}
                    className={`damage-popup absolute -top-4 left-1/2 -translate-x-1/2 text-headline-md font-black z-10 ${damagePopup.tone === "heal" ? "damage-popup--heal" : "text-error"}`}
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
                <SpriteStatusFx status={wildBStatus} />
                {!isVanished("wild", "B") && (
                  <BattleSprite
                    speciesName={wildB.speciesName}
                    facing="front"
                    isShiny={wildB.isShiny ?? false}
                    fallbackUrl={wildB.spriteUrl}
                    alt={wildB.name}
                    width={wildBSpritePx}
                    height={wildBSpritePx}
                    className={wildBSpriteClass}
                    style={shakeStyle("wild", "B")}
                  />
                )}
              </div>
            )}

            {/* Player sprite — pies sobre plataforma cercana. */}
            <div
              className={`absolute z-[1] origin-bottom ${
                isDouble
                  ? "left-[8%] bottom-[10%] lg:left-[10%] lg:bottom-[12%]"
                  : "left-[12%] bottom-[11%] md:left-[14%] md:bottom-[12%] lg:left-[18%] lg:bottom-[15%]"
              }`}
              style={{
                width: isDouble ? Math.round(playerSpritePx * 0.82) : playerSpritePx,
                height: isDouble ? Math.round(playerSpritePx * 0.82) : playerSpritePx,
                opacity: playerHp <= 0 ? 0.35 : 1,
              }}
            >
              {/* Plataforma del jugador: con el Pokémon en campo, o bajo la ball apoyada. */}
              {(!playerHidden || ballAnim === "land" || ballAnim === "open") && (
                <span
                  className="battle-platform battle-platform--player"
                  aria-hidden
                >
                  <span className="battle-platform__core" />
                </span>
              )}
              {(ballAnim === "throw" || ballAnim === "land" || ballAnim === "open") && (
                <div
                  className={`ball-sendout h-7 w-7 md:h-8 md:w-8 ${
                    ballAnim === "throw"
                      ? "is-traveling"
                      : ballAnim === "land"
                        ? "is-landing"
                        : "is-opening"
                  }`}
                >
                  <span className="ball-sendout__shadow" aria-hidden />
                  <span className="ball-sendout__hop">
                    {ballAnim === "throw" && (
                      <span className="ball-sendout__trail" aria-hidden />
                    )}
                    <span className="ball-sendout__spin">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={SEND_OUT_BALL_SRC}
                        alt=""
                        aria-hidden
                        className="h-full w-full object-contain"
                      />
                    </span>
                  </span>
                  {ballAnim === "land" && <span className="ball-sendout__dust" aria-hidden />}
                  {ballAnim === "open" ? (
                    <>
                      <span className="ball-open-burst" aria-hidden />
                      <span className="ball-sendout-shock" aria-hidden />
                      <span className="ball-sendout-wisp ball-sendout-wisp--left" aria-hidden />
                      <span className="ball-sendout-wisp ball-sendout-wisp--right" aria-hidden />
                      <span className="ball-sendout-beam" aria-hidden />
                      <span className="ball-sendout-ground-glow" aria-hidden />
                    </>
                  ) : null}
                </div>
              )}
              {damagePopup?.side === "player" && damagePopup.lane === "A" && (
                <span
                  key={damagePopup.key}
                  className={`damage-popup absolute -top-4 left-1/2 -translate-x-1/2 text-headline-md font-black z-10 ${
                    damagePopup.tone === "heal" ? "damage-popup--heal" : "text-error"
                  }`}
                >
                  {damagePopup.text}
                </span>
              )}
              {itemUseFx?.kind === "heal" &&
                itemUseFx.side === "player" &&
                itemUseFx.lane === "A" && (
                <BattleItemUseFx
                  key={itemUseFx.key}
                  kind={itemUseFx.kind}
                  itemName={itemUseFx.itemName}
                  label={itemUseFx.label}
                  size="field"
                />
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
                <>
                  <BattleSprite
                    speciesName={activePlayer.speciesName}
                    facing="back"
                    isShiny={activePlayer.isShiny}
                    fallbackUrl={activePlayer.spriteUrl}
                    alt={activePlayer.name}
                    width={isDouble ? Math.round(playerSpritePx * 0.82) : playerSpritePx}
                    height={isDouble ? Math.round(playerSpritePx * 0.82) : playerSpritePx}
                    className={playerSpriteClass}
                    style={shakeStyle("player", "A")}
                  />
                  {/* El FX de estado va sobre el sprite pero debajo de los
                      popups de daño; se apaga mientras entra de la ball. */}
                  {!playerEntering && <SpriteStatusFx status={playerStatus} />}
                  {/* Capa de silueta: mismo sprite con filtro fijo, sólo cruza
                      opacidad con el de color. Ver `.sprite-materialize`. */}
                  {playerEntering && (
                    <BattleSprite
                      speciesName={activePlayer.speciesName}
                      facing="back"
                      isShiny={activePlayer.isShiny}
                      fallbackUrl={activePlayer.spriteUrl}
                      alt=""
                      width={isDouble ? Math.round(playerSpritePx * 0.82) : playerSpritePx}
                      height={isDouble ? Math.round(playerSpritePx * 0.82) : playerSpritePx}
                      className="sprite-materialize-ghost"
                    />
                  )}
                </>
              )}
            </div>

            {isDouble && playerB && (
              <div
                className="absolute left-[28%] bottom-[12%] z-[1] origin-bottom md:left-[30%] md:bottom-[13%] lg:left-[32%] lg:bottom-[14%]"
                style={{
                  width: playerBSpritePx,
                  height: playerBSpritePx,
                  opacity: playerBHp <= 0 ? 0.35 : 1,
                }}
              >
                <span className="battle-platform battle-platform--player" aria-hidden>
                  <span className="battle-platform__core" />
                </span>
                {damagePopup?.side === "player" && damagePopup.lane === "B" && (
                  <span
                    key={damagePopup.key}
                    className={`damage-popup absolute -top-4 left-1/2 -translate-x-1/2 text-headline-md font-black z-10 ${damagePopup.tone === "heal" ? "damage-popup--heal" : "text-error"}`}
                  >
                    {damagePopup.text}
                  </span>
                )}
                <SpriteStatusFx status={playerBStatus} />
                {!isVanished("player", "B") && (
                  <BattleSprite
                    speciesName={playerB.speciesName}
                    facing="back"
                    isShiny={playerB.isShiny ?? false}
                    fallbackUrl={playerB.spriteUrl}
                    alt={playerB.name}
                    width={playerBSpritePx}
                    height={playerBSpritePx}
                    className={playerBSpriteClass}
                    style={shakeStyle("player", "B")}
                  />
                )}
              </div>
            )}

            {/*
              Mochila: última capa del campo, centrada entre las placas de HP.
              Vive acá y no junto a las otras hojas porque `inset: 0` tiene que
              resolver contra el campo — anclada al shell tapaba la placa del
              jugador (esquina inferior derecha) justo al elegir una poción.
            */}
            {view === "bag" ? (
              <BagView
                isAnimating={combatBusy}
                showBalls={!isTrainerStyle}
                ballStacks={ballStacks}
                potionStacks={potionStacks}
                potionsDisabled={playerHp >= playerMaxHp}
                revivesDisabled={!hasFaintedBench}
                onThrowBall={handleThrowBall}
                onUsePotion={handleUsePotion}
                onUseRevive={handlePickRevive}
                onBack={() => setView("menu")}
              />
            ) : null}
          </div>
          </div>

        {/* Jugador — mobile/tablet; en desktop vive en la columna info. */}
        <div className="shrink-0 lg:hidden">
          <PartySidebar
            name={trainerName}
            portraitUrl={trainerPortraitUrl}
            align="left"
            compact
          >
            {party.map((m) => (
              <PartyIcon
                key={m.instanceId}
                spriteUrl={m.spriteUrl}
                name={m.name}
                fainted={m.currentHp <= 0}
                active={m.instanceId === activePlayer.instanceId}
                hpPct={(m.currentHp / m.maxHp) * 100}
                level={m.level}
                types={m.types}
                isShiny={m.isShiny}
                compact
                reviving={itemUseFx?.partyInstanceId === m.instanceId}
                reviveFx={
                  itemUseFx?.partyInstanceId === m.instanceId
                    ? {
                        kind: itemUseFx.kind,
                        itemName: itemUseFx.itemName,
                        label: itemUseFx.label,
                      }
                    : null
                }
                selectHint={
                  mustSwitch ? t("mustSwitchPrompt") : t("partyTapHint")
                }
                onSelect={selectPartyMember(m)}
              />
            ))}
            {Array.from({ length: emptyPlayerSlots }).map((_, i) => (
              <EmptyPartySlot key={`pe-${i}`} compact />
            ))}
          </PartySidebar>
        </div>
        </div>

        {/* Footer mobile: log|cmds al ancho del stage (753). En lg, display:contents. */}
        <div className="battle-layout__footer">
        {/* Log — franja inferior mobile (como antes); columna izq. en desktop. */}
        <div
          aria-live="polite"
          aria-label={t("battleLogLabel")}
          className={`battle-layout__log glass-panel h-full min-h-0 min-w-0 flex-col overflow-hidden px-2 py-1.5 md:px-4 md:py-3 lg:px-3 ${
            commandExpanded ? "hidden md:flex" : "flex"
          }`}
        >
          {view === "menu" && !combatBusy && outcome === "ongoing" && (
            <div className="mb-1 flex shrink-0 flex-col gap-1 border-b border-white/12 pb-1.5 md:mb-0 md:hidden">
              <YourTurnStatus playerFirst={playerOutspeeds} showOrder={!isDouble} />
            </div>
          )}
          {/* Encabezado sólo en la columna vertical de desktop. */}
          <p className="battle-log__caption">{t("battleLogLabel")}</p>
          <ol className="battle-log">
            {log.map((entry, i) => {
              const isLatest = i === log.length - 1;
              return (
                <li
                  key={`${i}-${entry.text}`}
                  className={`battle-log-line battle-log-line--${entry.side}${
                    isLatest ? " battle-log-line--latest is-latest" : ""
                  }`}
                >
                  <span className="battle-log-line__rail" aria-hidden />
                  <span className="battle-log-line__text">{entry.text}</span>
                </li>
              );
            })}
            <li ref={logEndRef} aria-hidden />
          </ol>
          {view === "menu" && !combatBusy && outcome === "ongoing" && (
            /*
              En md (franja horizontal) la pregunta y los chips comparten fila;
              en lg la columna mide ~15rem y no entran los dos, así que se
              apilan. Antes iban siempre en fila y el chip de orden de turno
              quedaba cortado por el `overflow-hidden` del panel.
            */
            <div className="mt-auto hidden shrink-0 flex-col gap-1.5 border-t border-dashed border-white/15 pt-1.5 md:flex md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-x-2 md:gap-y-1 lg:flex-col lg:items-start">
              <p className="min-w-0 text-label-md font-bold leading-snug break-words [overflow-wrap:anywhere] text-on-surface md:flex-1 lg:flex-none lg:text-[12px]">
                {t("whatWillDo", {
                  name: (
                    isDouble && pendingDoubleMoveA != null && playerB
                      ? playerB.name
                      : activePlayer.name
                  ).toUpperCase(),
                })}
              </p>
              {!isDouble && <YourTurnStatus playerFirst={playerOutspeeds} />}
            </div>
          )}
        </div>

        {/* Comandos: sin glass en mobile (como antes); bajo el mapa + glass en lg. */}
        <div
          key={view}
          className={`battle-layout__cmds panel-swap glass-panel flex h-full min-h-0 min-w-0 flex-col overflow-hidden max-lg:border-0 max-lg:bg-transparent max-lg:rounded-none lg:px-4 lg:py-3 ${
            commandExpanded ? "max-md:col-span-2" : ""
          }`}
        >
          {commandExpanded && lastLogEntry ? (
            <p
              className="mb-1 shrink-0 truncate rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-[10px] leading-snug text-white/80 md:hidden"
              aria-live="polite"
            >
              {lastLogEntry.text}
            </p>
          ) : null}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {view === "menu" && (
              <div className="flex h-full min-h-0 flex-col gap-1.5 md:gap-2">
                {canRepeatLast && lastMoveOption ? (
                  <button
                    type="button"
                    disabled={combatBusy}
                    onClick={() => {
                      unlockBattleAudio();
                      resumeBattleBgm();
                      void handleMove(lastMoveOption.moveId);
                    }}
                    className="flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-primary/40 bg-primary/15 px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide text-primary hover:bg-primary/25 disabled:opacity-40"
                  >
                    <span className="material-symbols-outlined text-[16px]!" aria-hidden>
                      replay
                    </span>
                    {t("repeatMove", { move: formatMoveName(lastMoveOption.name, locale) })}
                  </button>
                ) : null}
                <div className="grid min-h-0 flex-1 grid-cols-2 gap-1.5 max-md:auto-rows-fr md:gap-2">
                <button
                  type="button"
                  disabled={combatBusy}
                  onClick={() => {
                    unlockBattleAudio();
                    resumeBattleBgm();
                    if (isDouble) {
                      void enterDoubleFight();
                    } else {
                      setView("moves");
                    }
                  }}
                  className="battle-cmd-btn battle-cmd-fight"
                >
                  <span className="battle-cmd-btn__icon" aria-hidden>
                    <span className="material-symbols-outlined">swords</span>
                  </span>
                  <span className="battle-cmd-btn__label">{t("fight")}</span>
                </button>
                <button
                  type="button"
                  disabled={combatBusy || isDouble || !hasHealthyBackup}
                  onClick={() => setView("team")}
                  className="battle-cmd-btn battle-cmd-pokemon"
                >
                  <span className="battle-cmd-btn__icon" aria-hidden>
                    <PokeballIcon mono className="h-5 w-5 md:h-6 md:w-6" />
                  </span>
                  <span className="battle-cmd-btn__label">{t("pokemonMenu")}</span>
                </button>
                <button
                  type="button"
                  disabled={combatBusy || isDouble || (!hasBalls && !hasPotions)}
                  onClick={() => setView("bag")}
                  className="battle-cmd-btn battle-cmd-bag"
                >
                  <span className="battle-cmd-btn__icon" aria-hidden>
                    <span className="material-symbols-outlined">backpack</span>
                  </span>
                  <span className="battle-cmd-btn__label">{t("bag")}</span>
                </button>
                {/*
                  En incursión este slot era un botón muerto: `flee-battle`
                  rechaza las incursiones, así que quedaba habilitado y no hacía
                  nada. Pasa a ser la retirada del intento — la única salida que
                  faltaba, porque una sesión de incursión abierta bloquea todo
                  otro combate.
                */}
                <button
                  type="button"
                  disabled={
                    combatBusy ||
                    (!isRaidBattle &&
                      (isGymBattle || (Boolean(opponentName) && !isPvpBattle)))
                  }
                  onClick={() => (isRaidBattle ? setConfirmWithdraw(true) : handleFlee())}
                  className="battle-cmd-btn battle-cmd-run"
                  title={
                    !isRaidBattle && fleePct != null
                      ? t("fleeChanceHint", { pct: fleePct })
                      : undefined
                  }
                >
                  <span className="battle-cmd-btn__icon" aria-hidden>
                    <span className="material-symbols-outlined">
                      {isRaidBattle ? "logout" : isPvpBattle ? "flag" : "directions_run"}
                    </span>
                  </span>
                  <span className="battle-cmd-btn__label">
                    {isRaidBattle ? (
                      t("raidWithdraw")
                    ) : isPvpBattle ? (
                      t("forfeit")
                    ) : fleePct != null ? (
                      <>
                        {t("run")}
                        <span className="mt-0.5 block text-[9px] font-semibold normal-case tracking-normal text-white/65 tabular-nums">
                          {t("fleeChance", { pct: fleePct })}
                        </span>
                      </>
                    ) : (
                      t("run")
                    )}
                  </span>
                </button>
                </div>
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
                isAnimating={combatBusy}
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
                  isAnimating={combatBusy}
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

            {view === "bag" || view === "reviveTargets" || view === "team" ? (
              <div className="flex h-full min-h-0 flex-col items-center justify-center gap-1 px-2 text-center">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/35">
                  {view === "bag"
                    ? t("bagTitle")
                    : view === "team"
                      ? t("pokemonMenu")
                      : pendingReviveName}
                </p>
                <p className="text-[12px] text-white/45">{t("selectCommand")}</p>
              </div>
            ) : null}
          </div>
        </div>
        </div>
        {/*
          Info desktop: una card rival + una card tuya (sidebar vertical).
          Sin placas HP acá — viven en el campo. Mobile no usa este bloque.
        */}
        <div className="battle-layout__info">
          <div className="battle-layout__info-card min-h-0">
            <PartySidebar
              name={wildEncounterHeader ? activeWild.name : foeLabel}
              portraitUrl={opponentPortraitUrl}
              align="right"
              variant={foeSidebarWild ? "wild" : "party"}
              featuredSpriteUrl={wildFeaturedSprite}
              featuredLevel={wildEncounterHeader ? activeWild.level : null}
              featuredIsShiny={wildEncounterHeader ? Boolean(activeWild.isShiny) : false}
              encounterPlace={wildEncounterHeader ? encounterPlace : null}
            >
              {foeSidebarWild
                ? opponentParty.length > 1
                  ? opponentParty.map((m) => (
                      <PartyIcon
                        key={`oe-d-${m.slot}`}
                        spriteUrl={m.spriteUrl}
                        name={m.name}
                        fainted={m.fainted}
                        active={m.active}
                      />
                    ))
                  : null
                : [
                    ...opponentParty.map((m) => (
                      <PartyIcon
                        key={`oe-d-${m.slot}`}
                        spriteUrl={m.spriteUrl}
                        name={m.name}
                        fainted={m.fainted}
                        active={m.active}
                      />
                    )),
                    ...Array.from({ length: emptyOpponentSlots }).map((_, i) => (
                      <EmptyPartySlot key={`oe-d-empty-${i}`} />
                    )),
                  ]}
            </PartySidebar>
          </div>
          <div className="battle-layout__info-card min-h-0">
            <PartySidebar
              name={trainerName}
              portraitUrl={trainerPortraitUrl}
              align="left"
            >
              {party.map((m) => (
                <PartyIcon
                  key={`d-${m.instanceId}`}
                  spriteUrl={m.spriteUrl}
                  name={m.name}
                  fainted={m.currentHp <= 0}
                  active={m.instanceId === activePlayer.instanceId}
                  hpPct={(m.currentHp / m.maxHp) * 100}
                  level={m.level}
                  types={m.types}
                  isShiny={m.isShiny}
                  reviving={itemUseFx?.partyInstanceId === m.instanceId}
                  reviveFx={
                    itemUseFx?.partyInstanceId === m.instanceId
                      ? {
                          kind: itemUseFx.kind,
                          itemName: itemUseFx.itemName,
                          label: itemUseFx.label,
                        }
                      : null
                  }
                  selectHint={
                    mustSwitch ? t("mustSwitchPrompt") : t("partyTapHint")
                  }
                  onSelect={selectPartyMember(m)}
                />
              ))}
              {Array.from({ length: emptyPlayerSlots }).map((_, i) => (
                <EmptyPartySlot key={`pe-d-${i}`} />
              ))}
            </PartySidebar>
          </div>
        </div>


      </div>
    </div>
  );
}
