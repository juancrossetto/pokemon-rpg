"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { submitBattleMove, type XpSummaryEntry } from "@/actions/battle-move";
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
import { impactFxUrl, resolveMoveProjectile, showdownBattleBgUrl, showdownFxUrl } from "@/lib/showdown-fx";
import { statusAbbrKey, statusLabelKey, isStatusCondition, type StatusCondition } from "@/lib/status";
import type { TurnEvent } from "@/lib/battle";
import type {
  BattleArenaProps,
  LogEntry,
  LogSide,
  Outcome,
  RosterMember,
  View,
} from "@/components/battle/arena-types";
import { EmptyPartySlot, HpPlate, PartyIcon, PartySidebar } from "@/components/battle/arena-panels";
import { CaptureSummary } from "@/components/battle/capture-summary";
import { BattleOutcomeScreen } from "@/components/battle/battle-outcome-screen";
import { BagView, MovesView, TeamView } from "@/components/battle/command-views";

export type { BattleArenaProps, OpponentPartyMember } from "@/components/battle/arena-types";

function hitSfxForMove(moveType: string, category?: TurnEvent["category"]): SfxKind {
  return battleSfxForMove(moveType, category);
}

const LUNGE_MS = 380;
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
const SEND_OUT_BALL_MS = 700; // cuánto se ve solo la pokeball, antes de revelar al Pokémon inicial

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  battleMode = gymId ? "gym" : "wild",
}: BattleArenaProps) {
  const t = useTranslations("battle");
  const tLog = useTranslations("battle.log");
  const isGymBattle = battleMode === "gym";
  const isPvpBattle = battleMode === "pvp";
  // Gym, PvP o entrenador de ruta: no captura / no huida “salvaje”.
  const isTrainerStyle = isGymBattle || isPvpBattle || Boolean(opponentName);
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
  const [choiceLockMoveId, setChoiceLockMoveId] = useState(initialChoiceLockMoveId);
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

  function nameFor(side: "player" | "wild") {
    return side === "player" ? activePlayerNameRef.current : activeWild.name;
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

  /** Daño residual (burn/poison): beat visual propio, DESPUÉS del ataque. */
  async function playResidualBeat(event: TurnEvent) {
    if (!event.residualDamage || event.residualHpAfter == null) return;

    const side = event.side;
    const activeId = activePlayerIdRef.current;
    const status =
      event.residualStatus ?? (side === "player" ? playerStatus : wildStatus);
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
      tLog(residualKey, { name: nameFor(side), damage: event.residualDamage }),
      side,
    );
    setMoveFx(null);
    setEffPopup(null);
    setArenaFlash(flash);
    setShakingSide(side);
    setImpactIntensity(0.75);
    setDamagePopup({
      side,
      text: abbr ? `${abbr} -${event.residualDamage}` : `-${event.residualDamage}`,
      key: Date.now(),
    });
    if (side === "player") {
      setPlayerHp(event.residualHpAfter);
      setParty((prev) =>
        prev.map((m) =>
          m.instanceId === activeId ? { ...m, currentHp: event.residualHpAfter! } : m,
        ),
      );
    } else {
      setWildHp(event.residualHpAfter);
    }

    await delay(RESIDUAL_MS);
    setShakingSide(null);
    setArenaFlash(null);
    setDamagePopup(null);
  }

  function playEvent(event: TurnEvent): Promise<void> {
    const activeId = activePlayerIdRef.current;
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
        event.skipped === "frozen" ||
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
        if (event.statusNote === "woke") appendLog(tLog("woke", { name: nameFor(event.side) }), event.side);
        if (event.statusNote === "thawed") appendLog(tLog("thawed", { name: nameFor(event.side) }), event.side);
        if (event.skipped === "asleep") appendLog(tLog("asleep", { name: nameFor(event.side) }), event.side);
        else if (event.skipped === "paralyzed") appendLog(tLog("paralyzed", { name: nameFor(event.side) }), event.side);
        else if (event.skipped === "frozen") appendLog(tLog("frozen", { name: nameFor(event.side) }), event.side);
        else if (event.skipped === "flinch") appendLog(tLog("flinch", { name: nameFor(event.side) }), event.side);
        else appendLog(tLog("disobey", { name: nameFor(event.side) }), event.side);
        void (async () => {
          await delay(STATUS_MS);
          setMoveFx(null);
          await playResidualBeat(event);
          appendItemTriggerLog(event);
          resolve();
        })();
        return;
      }

      setAttackingSide(event.side);

      setTimeout(() => {
        setAttackingSide(null);

        if (event.statusNote === "woke") appendLog(tLog("woke", { name: nameFor(event.side) }), event.side);
        if (event.statusNote === "thawed") appendLog(tLog("thawed", { name: nameFor(event.side) }), event.side);

        if (!event.hit) {
          appendLog(tLog("miss", { name: nameFor(event.side), move: formatMoveName(event.moveName) }), event.side);
          void (async () => {
            await delay(MISS_MS);
            setMoveFx(null);
            await playResidualBeat(event);
            appendItemTriggerLog(event);
            resolve();
          })();
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
          setArenaFlash(color);
          setTimeout(() => setArenaFlash(null), 320);
          void (async () => {
            await delay(STATUS_MS);
            setMoveFx(null);
            await playResidualBeat(event);
            appendItemTriggerLog(event);
            resolve();
          })();
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

        if (event.statusApplied) {
          const label = t(statusLabelKey(event.statusApplied as StatusCondition));
          appendLog(tLog("statusApplied", { name: nameFor(defenderSide), status: label }), defenderSide);
          if (defenderSide === "wild") setWildStatus(event.statusApplied);
          else setPlayerStatus(event.statusApplied);
        }

        if (event.recoilDamage) {
          appendLog(tLog("recoil", { name: nameFor(event.side), damage: event.recoilDamage }), event.side);
          if (event.side === "player") setPlayerHp((hp) => Math.max(0, hp - (event.recoilDamage ?? 0)));
          else setWildHp((hp) => Math.max(0, hp - (event.recoilDamage ?? 0)));
        }

        const defenderMaxHp = defenderSide === "wild" ? wildMaxHp : playerMaxHp;
        if (event.hpAfter > 0 && event.hpAfter / defenderMaxHp <= 0.1) {
          appendLog(tLog("lowHp", { name: nameFor(defenderSide) }), defenderSide);
        }

        setTimeout(() => setArenaFlash(null), 280);
        void (async () => {
          await delay(IMPACT_MS);
          setShakingSide(null);
          setMoveFx(null);
          setEffPopup(null);
          setDamagePopup(null);
          await playResidualBeat(event);
          appendItemTriggerLog(event);
          resolve();
        })();
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
          m.instanceId === activePlayerIdRef.current ? { ...m, currentHp: 0 } : m,
        ),
      );
    }
    await delay(FAINT_MS);
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
    setWildEntering(true);
    setTimeout(() => setWildEntering(false), 400);
    appendLog(t("trainerSendOut", { name: next.name }), "wild");
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
      setView(defaultView);
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

    setPlayerHealing(true);
    playBattleSfx("heal");
    await delay(ITEM_USE_MS);
    setPlayerHealing(false);

    const result = await applyBattleItem(battleId, itemId, locale);
    if (!result) {
      setPotionStacks(prevPotions);
      setIsAnimating(false);
      setView(defaultView);
      return;
    }

    setPlayerHp(result.healedTo);
    setParty((prev) =>
      prev.map((m) =>
        m.instanceId === activePlayer.instanceId ? { ...m, currentHp: result.healedTo } : m,
      ),
    );
    appendLog(tLog("usedItem", { name: result.itemName ?? used?.name ?? "?" }), "player");
    appendLog(t("healedBy", { name: activePlayer.name, hp: result.healedBy }), "player");

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
    setChoiceLockMoveId(null);
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
        pvpResult={pvpResult}
        showBadgePopup={showBadgePopup}
        onBadgeContinue={() => setShowBadgePopup(false)}
        badgeEarned={badgeEarned}
        tmRewardName={tmRewardName}
        gymId={gymId}
        gymRunId={gymRunId}
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
    !attackingSide && !shakingSide && !faintingSide && !playerEntering && !playerHealing && !ballAnim;
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
  const playerSpritePx = Math.round(arenaH * (0.58 + playerT * 0.3));
  const wildSpritePx = Math.round(arenaH * (0.32 + wildT * 0.16) * (isAlphaWild ? 1.1 : 1));
  const playerSpriteClass = [
    "h-full w-full object-contain object-bottom drop-shadow-lg origin-bottom",
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
    "h-full w-full object-contain object-bottom drop-shadow-lg origin-bottom",
    attackingSide === "wild" ? (physicalLunge ? "sprite-lunge-left-hard" : "sprite-lunge-left") : "",
    shakingSide === "wild" ? `sprite-shake ${seFlash ? "sprite-flash-heavy" : "sprite-flash"}` : "",
    faintingSide === "wild" ? "sprite-faint" : "",
    wildEntering ? "sprite-enter" : "",
    wildAbsorbedByBall ? "sprite-absorb-ball" : "",
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
            ref={arenaFieldRef}
            className={`battle-arena-field relative overflow-hidden rounded-xl border border-white/10 flex-1 min-h-0 md:min-h-[360px] ${
              arenaFlash ? "arena-type-flash" : ""
            }`}
            style={
              {
                "--arena-bg-image": `url(${showdownBattleBgUrl(isTrainerStyle ? "mountain" : "meadow")})`,
                ...(arenaFlash ? { "--arena-flash-color": arenaFlash } : {}),
              } as CSSProperties
            }
          >
            <BattleAudioControls bgmKind={bgmKind} />
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
              align="left"
            />
            <HpPlate
              className="absolute bottom-2 right-2 z-20 w-[min(100%,160px)] md:bottom-3 md:right-3 md:w-[min(100%,220px)]"
              name={activePlayer.name}
              levelLabel={t("level", { level: activePlayer.level })}
              currentHp={playerHp}
              maxHp={playerMaxHp}
              status={playerStatus}
              align="right"
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

            {/* Opponent sprite — far plate (px from arena height) */}
            <div
              className="absolute right-[5%] top-[8%] z-[1] origin-bottom"
              style={{ width: wildSpritePx, height: wildSpritePx }}
            >
              <span className="sprite-ground-shadow sprite-ground-shadow-wild absolute left-1/2 bottom-0 -translate-x-1/2" aria-hidden />
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
                  width={wildSpritePx}
                  height={wildSpritePx}
                  className={wildSpriteClass}
                  style={shakeStyle("wild")}
                />
              )}
            </div>

            {/* Player sprite — near plate, bottom-left */}
            <div
              className="absolute left-[2%] bottom-[2%] z-[1] origin-bottom"
              style={{ width: playerSpritePx, height: playerSpritePx }}
            >
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
                  width={playerSpritePx}
                  height={playerSpritePx}
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
                activePlayerName={activePlayer.name}
                moves={activeMoves}
                choiceLockMoveId={choiceLockMoveId}
                isAnimating={isAnimating}
                effectivenessInfo={effectivenessInfo}
                onSelect={handleMove}
                onBack={() => setView("menu")}
              />
            )}

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
                matchupInfo={switchMatchupInfo}
                onSwitch={handleSwitchTo}
                onBack={() => setView("menu")}
              />
            )}
          </div>
        </div>
        <div className="max-md:h-[100px] max-md:shrink-0 md:hidden" aria-hidden="true" />
      </div>
    </div>
  );
}
