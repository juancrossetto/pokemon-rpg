"use client";

import { CdnImage as Image } from "@/components/cdn-image";
import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { CampaignPrimaryObjective, CampaignJourneyMenuTrigger } from "@/components/campaign-primary-objective";
import {
  CampaignPartyDock,
  type CampaignDockMember,
  type CampaignPartyHeal,
} from "@/components/campaign-party-dock";
import type { HeldItemLabels, OwnedHeldItem } from "@/components/held-item-panel";
import type { SquadContextLabels } from "@/components/squad-card-context-menu";
import type { SquadBagCounts } from "@/lib/squad-bag";
import { selectLocation, setFarmingStage } from "@/actions/campaign";
import { startTrainerBattle } from "@/actions/route-trainer";
import { claimZoneObjective } from "@/actions/zone-rewards";
import {
  scrollAppMainToElement,
  scrollChildIntoHorizontalCenter,
} from "@/lib/scroll-lock";
import {
  evaluateObjectives,
  type ZoneObjectiveId,
  type ZoneObjectiveState,
} from "@/lib/campaign/objectives";
import { type Rarity } from "@/lib/campaign/rarity";
import { itemDisplayUrl } from "@/lib/item-sprites";
import { resolveItemDisplayName } from "@/lib/shop";
import { MasteryIcon, PokeballIcon } from "@/components/zone-icons";
import { gymBadgeImageUrl } from "@/lib/gym-art";
import type { Chapter } from "@/lib/campaign/chapters";
import { activeChapterIndex } from "@/lib/campaign/chapters";
import type { MapEncounter, MapLocation } from "@/lib/campaign/map-selection";
import type { CampaignLocationKind } from "@/lib/campaign/types";
import {
  campaignBannerForChapter,
  campaignMapHasArt,
  campaignMapSrc,
  countTeamReadyAtLevel,
  GYM_READY_TEAM_SIZE,
  getCampaignPrimaryAction,
  getCampaignActionForZone,
  getZoneUnlockRequirements,
  gymReadyLevel,
  recommendedChapterZoneId,
  defaultChapterZoneId,
  resolveZoneNodeStatus,
  type CampaignProgressRow,
  type CampaignRequirement,
} from "@/lib/campaign";
import { masteryBonuses, masteryProgressPercent } from "@/lib/mastery";
import { playLootCollectFx, rewardToLootPiece } from "@/lib/loot-fly-fx";
import { showToast } from "@/lib/app-toast";
import {
  campaignClaimErrorKey,
  campaignTrainerErrorKey,
} from "@/lib/campaign/client-errors";
import { HubHelpPanel, CoachMark } from "@/components/journey-guidance";
import { ExpeditionAmbient } from "@/components/home/expedition-ambient";
import { UnlockCelebration } from "@/components/unlock-celebration";
import { CampaignUnlockFeedback } from "@/components/campaign-unlock-feedback";
import { GameCtaButton } from "@/components/game-cta-button";
import { CampaignPath } from "@/components/campaign/campaign-path";
import { stageShortName, zoneAsk } from "@/lib/campaign/zone-ask";
import type { CampaignMilestone } from "@/lib/campaign/types";

function translateRequirement(
  t: (key: string, values?: Record<string, string | number>) => string,
  req: CampaignRequirement,
): string {
  const raw = req.descriptionParams ?? {};
  const params: Record<string, string | number> = { ...raw };
  for (const key of ["location", "stage"] as const) {
    const val = raw[key];
    if (typeof val === "string" && val.includes(".")) {
      /*
        El nombre del stage ya trae la zona ("Ruta 1 · tramo 3"), y la frase la
        vuelve a nombrar: "Completá Ruta 1 · tramo 3 en Ruta 1". Se recorta el
        prefijo y queda "Completá tramo 3 en Ruta 1", que además entra sin
        cortarse debajo de un nodo bloqueado.
      */
      params[key] = key === "stage" ? stageShortName(t(val)) : t(val);
    }
  }
  return t(req.descriptionKey, params);
}

/** Orden Kanto → tipo de medalla (arte local, no trainers). */
const BADGE_TYPE_BY_ORDER: Record<number, string> = {
  1: "rock",
  2: "water",
  3: "electric",
  4: "grass",
  5: "poison",
  6: "psychic",
  7: "fire",
  8: "ground",
};

const PATH_PROGRESS_FILL = "campaign-warm-bar";

/**
 * Paleta de la campaña — color solo cuando informa:
 *
 * - Neutro (blancos) → estructura y tipo de zona (identidad = ícono).
 * - Primary         → progreso del path, dónde estás y la acción principal.
 * - Tertiary        → gimnasios / recompensas (cierre de capítulo).
 * - Verde           → capturado / entrenador vencido / objetivo cumplido.
 */

/** Rareza sobre un solo tono: la jerarquía se lee por intensidad, no por color. */
const RARITY_STYLE: Record<Rarity, string> = {
  common: "border-white/10",
  uncommon: "border-white/25",
  rare: "border-tertiary/35",
  veryRare: "border-tertiary/60",
  elite: "border-electric-yellow shadow-[0_0_10px_color-mix(in_srgb,var(--color-electric-yellow)_35%,transparent)]",
};

/*
  Rótulo de sección en mono, con el mismo tracking que el resto de la app
  (banner del home, Parque, popup diario). Antes era Inter semibold: se leía
  como un párrafo chiquito y no como una etiqueta de HUD.
*/
const SECTION_LABEL =
  "font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-white/40";

/*
  Rótulo dentro del panel de zona: el mismo rol, con la mitad de la voz.

  El panel llegó a tener cinco rótulos en mono, mayúsculas y tracking .18em, y
  entre ellos apenas dos renglones de contenido. Un rótulo así compite en peso
  con lo que rotula: se lee la etiqueta antes que el dato, que es al revés de
  lo que sirve. Más chico, con menos tracking y más apagado, sigue separando
  secciones sin pedir atención.
*/
const ZONE_LABEL =
  "font-mono text-[9.5px] font-semibold uppercase tracking-[0.1em] text-white/28";

/*
  Escala tipográfica del panel de zona: cuatro roles y nada más.

  Medido en el navegador, el panel llegó a tener **22 tratamientos de texto
  distintos en 320px de ancho** — nueve tamaños de mono y siete de Inter. Ese
  era el desorden real: no la cantidad de información sino que cada dato traía
  su propio tamaño, peso y color, así que nada agrupaba con nada.

  Los cuatro roles: título de zona, etiqueta de sección, texto de fila y dato
  numérico. Todo lo que aparezca en el panel tiene que entrar en uno de ellos.
*/
const ZONE_TITLE = "text-[19px] font-bold leading-tight tracking-tight text-white";
const ZONE_META = "font-mono text-[11px] leading-snug tracking-[0.04em] text-white/45";
const ZONE_ROW_TITLE = "text-[13px] font-semibold leading-snug text-white/85";
const ZONE_ROW_META = "font-mono text-[11px] font-bold tabular-nums text-white/55";
const ZONE_CHIP =
  "inline-flex items-center gap-1 rounded-md bg-pokeball-red/18 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-pokeball-red";

/**
 * Traduce los parámetros de `zoneAsk` que son claves i18n.
 *
 * `zoneAsk` es puro y no conoce next-intl, así que devuelve `trainers.youngster`
 * y no "Joven Timmy". Sin este paso la frase salía con la clave cruda a la
 * vista. Mismo criterio que `translateRequirement`: se traduce lo que parece
 * una clave (tiene punto y no espacios) y se deja pasar el resto.
 */
function resolveAskParams(
  t: (key: string, values?: Record<string, string | number>) => string,
  params?: Record<string, string | number>,
): Record<string, string | number> | undefined {
  if (!params) return undefined;
  const out: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(params)) {
    out[key] =
      typeof value === "string" && value.includes(".") && !value.includes(" ")
        ? t(value)
        : value;
  }
  return out;
}

function kindOf(zone: MapLocation | null): CampaignLocationKind {
  if (!zone) return "route";
  return zone.kindKey.replace("kinds.", "") as CampaignLocationKind;
}

/**
 * Sendero entre dos nodos: una S suave en vez de una barra recta.
 * `preserveAspectRatio="none"` estira el trazo a la altura real de la fila, y
 * `vector-effect="non-scaling-stroke"` evita que ese estirado deforme el grosor.
 */
export type JourneySummary = {
  badges: number;
  badgesTotal: number;
  speciesCaught: number;
  speciesTotal: number;
  zonesUnlocked: number;
  zonesTotal: number;
  shinies: number;
  journeyPercent: number;
  teamMaxLevel: number;
  /** Niveles del equipo activo — para el gate “2 Pokémon listos”. */
  teamLevels: number[];
};

export type GymRequirement = {
  /** Nivel máximo del equipo del líder — referencia para el jugador. */
  recommendedLevel: number;
  badgeName: string;
  /** Orden del gimnasio en la región → `gyms.badges.{order}`. */
  gymOrder: number;
  /** Tipo del gimnasio → `/gyms/badges/{type}.png`. */
  badgeType: string;
  gymId: string;
  /** Sprite del líder. `null` si el gimnasio no tiene arte asociado. */
  leaderSpriteUrl: string | null;
};

export function CampaignJourney({
  locale,
  chapters,
  initialChapter,
  farmingLocationId,
  farmingStageId,
  summary,
  gymRequirements,
  regionMapSrc,
  milestone,
  progress,
  earnedGymOrders,
  party = null,
}: {
  locale: string;
  chapters: Chapter[];
  initialChapter: number;
  farmingLocationId: string;
  farmingStageId: string;
  summary: JourneySummary;
  gymRequirements: Record<string, GymRequirement>;
  regionMapSrc: string;
  milestone: CampaignMilestone;
  progress: CampaignProgressRow;
  earnedGymOrders: number[];
  party?: {
    members: CampaignDockMember[];
    bagCounts: SquadBagCounts;
    ownedHeldItems: OwnedHeldItem[];
    heal: CampaignPartyHeal;
    menuLabels: SquadContextLabels;
    heldLabels: HeldItemLabels;
  } | null;
}) {
  const t = useTranslations("campaign");
  const tUx = useTranslations("ux");
  const router = useRouter();
  const [chapterIndex, setChapterIndex] = useState(initialChapter);
  /** Zona enfocada en el path y el panel. Nunca `zones[0]` a ciegas. */
  const [zoneId, setZoneId] = useState<string | null>(() => {
    const ch = chapters[initialChapter];
    return ch
      ? defaultChapterZoneId({
          chapter: ch,
          farmingLocationId,
          earnedGymOrders,
          milestoneLocationId:
            milestone.kind === "complete" ? null : milestone.locationId,
        })
      : null;
  });
  const [pending, startTransition] = useTransition();
  const [unlockToast, setUnlockToast] = useState<{ id: string; name: string } | null>(null);
  /** El panel de detalle vive debajo de toda la lista en mobile. */
  const panelRef = useRef<HTMLDivElement>(null);
  const chapterTabsRef = useRef<HTMLElement>(null);

  // Dónde está el viaje de verdad (≠ el capítulo que estás hojeando).
  const currentChapterIdx = activeChapterIndex(chapters, farmingLocationId);
  const chapter = chapters[chapterIndex] ?? chapters[0];
  const viewingCurrentChapter = chapterIndex === currentChapterIdx;
  const focusZoneId =
    zoneId ??
    (chapter
      ? defaultChapterZoneId({
          chapter,
          farmingLocationId,
          earnedGymOrders,
          milestoneLocationId:
            milestone.kind === "complete" ? null : milestone.locationId,
        })
      : null);
  const selectedZone = focusZoneId
    ? (chapter?.zones.find((z) => z.id === focusZoneId) ?? null)
    : null;
  const zone =
    selectedZone ??
    chapter?.zones.find((z) => z.id === farmingLocationId) ??
    chapter?.zones[0] ??
    null;
  const farmingZone =
    chapters.flatMap((c) => c.zones).find((z) => z.id === farmingLocationId) ?? null;
  const defeatedTrainerIds = chapters.flatMap((c) =>
    c.zones.flatMap((z) => z.trainers.filter((tr) => tr.defeated).map((tr) => tr.id)),
  );

  /** Ambientación de la escena: la toma la zona donde está parado el jugador. */
  const sceneKind = kindOf(farmingZone ?? zone ?? chapter?.zones[0] ?? null);

  /**
   * Sprite que camina el mapa: el primero del equipo que pueda pelear. Poner al
   * Pokémon real del jugador sobre el sendero es lo que convierte el recorrido
   * en "mi viaje" y no en un índice de zonas.
   */
  const leadSpriteUrl =
    party?.members.find((m) => m.currentHp > 0)?.spriteUrl ??
    party?.members[0]?.spriteUrl ??
    null;

  /**
   * Único nodo señalado como "siguiente". Sólo en el capítulo donde está el
   * viaje de verdad: hojeando un capítulo futuro, un "Siguiente" ahí sería
   * mentira (nada de eso se puede jugar todavía).
   */
  const recommendedZoneId =
    chapter && viewingCurrentChapter
      ? recommendedChapterZoneId({
          chapter,
          farmingLocationId,
          earnedGymOrders,
          milestoneLocationId:
            milestone.kind === "complete" ? null : milestone.locationId,
        })
      : null;

  const gymRecLevel =
    milestone.kind === "gym" && milestone.locationId
      ? gymRequirements[milestone.locationId]?.recommendedLevel
      : chapter?.gym
        ? gymRequirements[chapter.gym.id]?.recommendedLevel
        : null;

  const readyForLevel = (recommended: number | null | undefined) =>
    recommended != null && recommended > 0
      ? countTeamReadyAtLevel(summary.teamLevels, gymReadyLevel(recommended))
      : 0;

  const primaryAction = getCampaignPrimaryAction({
    progress,
    earnedGymOrders,
    teamMaxLevel: summary.teamMaxLevel,
    teamReadyCount: readyForLevel(gymRecLevel),
    chapter: chapter ?? null,
    gymRecommendedLevel: gymRecLevel,
    defeatedTrainerIds,
  });

  const selectedGymHref =
    selectedZone?.kindKey === "kinds.gym" && selectedZone.id
      ? gymRequirements[selectedZone.id]?.gymId
        ? `/gyms/${gymRequirements[selectedZone.id].gymId}`
        : null
      : null;

  const selectedGymRec =
    selectedZone?.kindKey === "kinds.gym"
      ? gymRequirements[selectedZone.id]?.recommendedLevel
      : null;

  const barAction =
    selectedZone && chapter
      ? getCampaignActionForZone({
          zone: selectedZone,
          farmingLocationId,
          progress,
          earnedGymOrders,
          teamMaxLevel: summary.teamMaxLevel,
          teamReadyCount: readyForLevel(selectedGymRec ?? gymRecLevel),
          chapter,
          storyMilestone: milestone,
          gymRecommendedLevel: selectedGymRec ?? gymRecLevel,
          gymHref: selectedGymHref,
          defeatedTrainerIds,
        })
      : primaryAction;

  const storyGymHref =
    primaryAction.milestone.kind === "gym" && primaryAction.milestone.locationId
      ? gymRequirements[primaryAction.milestone.locationId]?.gymId
        ? `/gyms/${gymRequirements[primaryAction.milestone.locationId].gymId}`
        : primaryAction.href
      : chapter?.gym
        ? gymRequirements[chapter.gym.id]?.gymId
          ? `/gyms/${gymRequirements[chapter.gym.id].gymId}`
          : null
        : null;

  const gymChallengeHref =
    barAction.action === "challenge_gym"
      ? selectedGymHref ?? storyGymHref ?? barAction.href
      : null;

  const gymChallengeBadgeSrc = (() => {
    if (barAction.action !== "challenge_gym") return null;
    const locationId =
      selectedZone?.kindKey === "kinds.gym"
        ? selectedZone.id
        : primaryAction.milestone.kind === "gym" && primaryAction.milestone.locationId
          ? primaryAction.milestone.locationId
          : chapter?.gym?.id ?? null;
    const badgeType =
      (locationId ? gymRequirements[locationId]?.badgeType : null) ??
      (barAction.gymOrder != null ? BADGE_TYPE_BY_ORDER[barAction.gymOrder] : null);
    return badgeType ? gymBadgeImageUrl(badgeType) : null;
  })();
  const helpBullets = (tUx.raw("help.campaign") as string[]) ?? [];
  // Título del banner = destino del capítulo que estás mirando (no farming sticky).
  const locationLabelKey =
    chapter?.nameKey ??
    zone?.nameKey ??
    farmingZone?.nameKey ??
    primaryAction.locationNameKey ??
    "regions.kanto";
  const bannerArt = campaignBannerForChapter(chapter?.number ?? 1);
  const chapterBadgeEarned =
    chapter?.gymOrder != null && earnedGymOrders.includes(chapter.gymOrder);

  function openChapter(i: number) {
    setChapterIndex(i);
    const next = chapters[i];
    setZoneId(
      next
        ? defaultChapterZoneId({
            chapter: next,
            farmingLocationId,
            earnedGymOrders,
            milestoneLocationId:
              milestone.kind === "complete" ? null : milestone.locationId,
          })
        : null,
    );
  }

  function pickZone(id: string) {
    setZoneId(id);
  }

  function travelTo(id: string) {
    startTransition(async () => {
      await selectLocation(id, locale);
      const nameKey = chapters.flatMap((c) => c.zones).find((z) => z.id === id)?.nameKey;
      if (nameKey) showToast(t("movedHere", { name: t(nameKey) }), "success");
    });
  }

  /** Barra desktop: viajar a la zona seleccionada y abrir combate. */
  function travelAndExplore(id: string) {
    startTransition(async () => {
      await selectLocation(id, locale);
      router.push("/battle");
    });
  }

  function farmStage(stageId: string) {
    startTransition(async () => {
      await setFarmingStage(stageId, locale);
      const stageName = chapters
        .flatMap((c) => c.zones)
        .flatMap((z) => z.stages)
        .find((s) => s.id === stageId)?.nameKey;
      if (stageName) showToast(t("stageSet", { name: t(stageName) }), "info");
    });
  }

  function claim(
    locationId: string,
    objective: ZoneObjectiveId,
    origin?: { x: number; y: number },
  ) {
    startTransition(async () => {
      const result = await claimZoneObjective(locale, locationId, objective);
      if (!result.ok) {
        showToast(t(campaignClaimErrorKey(result.error)), "error");
        return;
      }
      playLootCollectFx({
        origin,
        coinsDelta: result.coins,
        pieces: [
          // Las monedas también vuelan: antes sólo se pasaba `coinsDelta`, así
          // que el contador subía sin que nada saliera del objetivo cobrado.
          ...(result.coins > 0
            ? [rewardToLootPiece({ kind: "coins", amount: result.coins })]
            : []),
          ...result.items.map((item) =>
            rewardToLootPiece({
              kind: "item",
              itemName: item.itemName,
              quantity: item.quantity,
            }),
          ),
        ],
      });
    });
  }

  function challengeTrainer(trainerId: string) {
    startTransition(async () => {
      const result = await startTrainerBattle(trainerId, locale);
      if (result && !result.success) {
        showToast(t(campaignTrainerErrorKey(result.error)), "error");
      }
    });
  }

  useEffect(() => {
    try {
      const key = "pokerpg:zones-unlocked-count";
      const prev = Number(window.sessionStorage.getItem(key) ?? "0");
      if (summary.zonesUnlocked > prev && prev > 0 && farmingZone) {
        const toast = { id: farmingZone.id, name: t(farmingZone.nameKey) };
        requestAnimationFrame(() => setUnlockToast(toast));
      }
      window.sessionStorage.setItem(key, String(summary.zonesUnlocked));
    } catch {
      /* ignore */
    }
  }, [summary.zonesUnlocked, farmingZone, t]);

  // En mobile el detalle vive debajo de toda la lista: sin esto tocar una zona
  // parece no hacer nada y el jugador sigue tocando cards. Va en un efecto y no
  // en el handler porque la card elegida se expande al seleccionarla y empuja
  // al panel hacia abajo — hay que medir después del commit, no antes.
  //
  // Importante (PWA iOS): no usar `scrollIntoView`. El scroll real está en
  // `.app-main` y scrollIntoView puede trabar ese contenedor hasta recargar.
  useEffect(() => {
    if (!zoneId) return;
    if (!window.matchMedia("(max-width: 1023px)").matches) return;
    const panel = panelRef.current;
    if (!panel) return;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const raf = window.requestAnimationFrame(() => {
      scrollAppMainToElement(panel, {
        behavior: smooth ? "smooth" : "auto",
        offsetPx: 16,
      });
    });
    return () => window.cancelAnimationFrame(raf);
  }, [zoneId]);

  // La fila de capítulos scrollea horizontal: con 8 capítulos el activo puede
  // quedar fuera de pantalla y la pantalla arranca mostrando el capítulo 1.
  useEffect(() => {
    const nav = chapterTabsRef.current;
    const tab = nav?.querySelector<HTMLElement>(
      `[data-chapter-tab="${chapterIndex}"]`,
    );
    if (!nav || !tab) return;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    scrollChildIntoHorizontalCenter(nav, tab, smooth ? "smooth" : "auto");
  }, [chapterIndex]);

  const lastPathScrollChapter = useRef<number | null>(null);
  useEffect(() => {
    if (!focusZoneId) return;
    if (lastPathScrollChapter.current === chapterIndex) return;
    if (window.matchMedia("(max-width: 1023px)").matches) {
      lastPathScrollChapter.current = chapterIndex;
      return;
    }
    const row = document.querySelector<HTMLElement>(
      `[data-zone-row="${CSS.escape(focusZoneId)}"]`,
    );
    if (!row) return;
    lastPathScrollChapter.current = chapterIndex;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const raf = window.requestAnimationFrame(() => {
      scrollAppMainToElement(row, {
        behavior: smooth ? "smooth" : "auto",
        offsetPx: 88,
      });
    });
    return () => window.cancelAnimationFrame(raf);
  }, [chapterIndex, focusZoneId]);

  return (
    <div
      className={`touch-pan-y${pending ? " opacity-90 transition-opacity" : ""}`}
    >
      {unlockToast && (
        <UnlockCelebration locationId={unlockToast.id} locationName={unlockToast.name} />
      )}

      {/* Hero por encima del grid: el menú absolute del viaje no puede pelear
          z-index contra el ZonePanel sticky si el stacking context queda
          atrapado dentro del CoachMark (z-auto). */}
      <div className="relative z-30">
        <CoachMark storageKey="coach-explore" message={tUx("coachExplore")}>
          <div>
            <CampaignUnlockFeedback
              action={primaryAction.action}
              locationName={
                primaryAction.locationNameKey
                  ? t(primaryAction.locationNameKey)
                  : undefined
              }
            />
            <CampaignPrimaryObjective
              action={viewingCurrentChapter ? barAction : primaryAction}
              gymHref={viewingCurrentChapter ? gymChallengeHref : storyGymHref}
              gymBadgeSrc={gymChallengeBadgeSrc}
              onTravel={
                viewingCurrentChapter && selectedZone
                  ? () => travelAndExplore(selectedZone.id)
                  : undefined
              }
              travelPending={pending}
              bannerSrc={bannerArt.src}
              bannerObjectPosition={bannerArt.objectPosition}
              locationName={t(locationLabelKey)}
              regionLabel={t("regions.kanto")}
              chapterLabel={chapter ? `${t("chapter")} ${chapter.number}` : null}
              browsingHint={
                !viewingCurrentChapter && farmingZone
                  ? t("browsingChapterHint", { name: t(farmingZone.nameKey) })
                  : null
              }
              stagesDone={chapter?.stagesDone ?? 0}
              stagesTotal={chapter?.stagesTotal ?? 0}
              party={
                party
                  ? {
                      locale,
                      members: party.members,
                      bagCounts: party.bagCounts,
                      ownedHeldItems: party.ownedHeldItems,
                      heal: party.heal,
                      menuLabels: party.menuLabels,
                      heldLabels: party.heldLabels,
                    }
                  : null
              }
              journeyMenu={
                <details className="group relative">
                  <CampaignJourneyMenuTrigger
                    desktopLabel={t("viewFullJourney")}
                    mobileLabel={t("journeyProgress")}
                  />
                  {/*
                    Sin float-card exterior: JourneyStrip y JourneySummaryCard ya
                    traen la suya. El wrapper solo posiciona.
                  */}
                  <div className="absolute right-0 top-full z-50 mt-2 flex w-[min(100vw-1.5rem,22rem)] flex-col gap-2 sm:w-96">
                    <JourneyStrip
                      chapters={chapters}
                      activeIndex={chapterIndex}
                      currentIndex={currentChapterIdx}
                      onPick={(i) => {
                        openChapter(i);
                      }}
                      percent={summary.journeyPercent}
                      label={t("journeyProgress")}
                      chapterLabel={t("chapter")}
                      currentLabel={t("nodeCurrent")}
                    />
                    <JourneySummaryCard summary={summary} mapSrc={regionMapSrc} />
                    <BadgeMedalRow earnedGymOrders={earnedGymOrders} />
                    <HubHelpPanel
                      storageKey="hub-help-campaign"
                      bullets={helpBullets}
                      handbookChapter="journey"
                    />
                  </div>
                </details>
              }
            />
          </div>
        </CoachMark>
      </div>

      {/*
        Mobile: mapa → detalle (objetivos / premios).
        Desktop lg+: recorrido | panel sticky. xl+: + aside de capítulos.
      */}
      {/*
        Columna única, de arriba a abajo: objetivo → capítulos → recorrido →
        puerta del capítulo → datos del viaje.

        Antes eran tres columnas de peso parejo (capítulos | recorrido | líder) y
        ninguna mandaba: no había orden de lectura, así que la pantalla no
        respondía la única pregunta que importa, qué hacer ahora. En una columna
        el orden es el propio avance del jugador.
      */}
      {/*
        Dos columnas en escritorio: recorrido a la izquierda, rail fijo a la
        derecha.

        La versión de una sola columna ordenó la lectura pero estiró la pantalla:
        todo pedía scroll. El rail devuelve la compacidad sin volver al problema
        original —tres bloques de peso parejo— porque tiene un rol claro y único:
        lo que falta para pasar de capítulo. Al ser `sticky` te acompaña, así que
        la respuesta a "qué me falta" está siempre a la vista.
      */}
      <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(270px,320px)]">

        {/*
          Columna en flex para que el mapa pueda crecer hasta el alto de la
          fila; sin esto el contenedor se estiraba pero el mapa se quedaba en su
          alto de contenido y el sobrante era hueco.

          Sin `order-1`: en mobile esa clase mandaba esta columna al final, así
          que se leía panel de zona → tabs de capítulo → recorrido. Dos
          problemas: la ficha de una zona aparecía antes que el mapa donde se
          elige la zona, y las tabs quedaban partidas del recorrido que
          controlan. La acción principal ya vive arriba, en la barra de
          objetivo, así que el panel no necesita adelantarse.
        */}
        <div className="min-w-0 lg:flex lg:flex-col">
          <nav
            ref={chapterTabsRef}
            className="campaign-chapter-tabs mb-3 flex gap-2 overflow-x-auto pb-0.5"
            aria-label={t("chapter")}
          >
            {chapters.map((c, i) => {
              const selected = i === chapterIndex;
              const isCurrent = i === currentChapterIdx;
              return (
                <button
                  key={c.number}
                  type="button"
                  data-chapter-tab={i}
                  onClick={() => openChapter(i)}
                  disabled={!c.unlocked}
                  aria-current={isCurrent ? "step" : selected ? "true" : undefined}
                  title={
                    !c.unlocked
                      ? t("chapterLockedHint")
                      : `${t("chapter")} ${c.number}${isCurrent ? ` · ${t("nodeCurrent")}` : ""}`
                  }
                  className={`campaign-chapter-tab${
                    isCurrent
                      ? " campaign-chapter-tab--current"
                      : selected
                        ? " campaign-chapter-tab--selected"
                        : c.unlocked
                          ? ""
                          : " campaign-chapter-tab--locked"
                  }`}
                >
                  {/*
                    Portada real del capítulo — “tarjeta de mundo”, no sólo texto.
                    `loading="eager"`: son ~9 miniaturas como máximo, todas parte
                    del selector de capítulo siempre relevante en esta pantalla —
                    no ganan nada difiriéndose, y con lazy (default) las que
                    arrancan scrolleadas fuera de vista tardaban en cargar.
                  */}
                  <span className="campaign-chapter-tab__art" aria-hidden>
                    <Image
                      src={campaignBannerForChapter(c.number).src}
                      alt=""
                      fill
                      sizes="220px"
                      loading="eager"
                      className="object-cover"
                      style={{ objectPosition: campaignBannerForChapter(c.number).objectPosition }}
                    />
                  </span>
                  {!c.unlocked ? (
                    <span className="material-symbols-outlined text-[13px]!" aria-hidden>
                      lock
                    </span>
                  ) : isCurrent ? (
                    <span className="campaign-chapter-tab__dot" aria-hidden />
                  ) : c.completed ? (
                    <span
                      className="material-symbols-outlined text-[13px]! text-electric-yellow"
                      aria-hidden
                    >
                      check_circle
                    </span>
                  ) : null}
                  <span className="campaign-chapter-tab__label">{t(c.nameKey)}</span>
                  <span
                    aria-hidden
                    className="campaign-chapter-tab__progress"
                  >
                    <span
                      className={`campaign-chapter-tab__progress-fill${
                        c.completed ? " campaign-chapter-tab__progress-fill--done" : ""
                      }`}
                      style={{ width: `${c.unlocked ? c.percent : 0}%` }}
                    />
                  </span>
                </button>
              );
            })}
          </nav>

          {chapter && (
            <div
              /*
                `grow`, no un alto mínimo fijo.

                Un capítulo de dos paradas dibuja un mapa de ~150px al lado de
                un panel de 700: lo que queda no es un mapa chico sino un
                agujero. Un `min-height` en rem sólo movía el borde del agujero
                —el panel cambia de alto según la zona—. Creciendo hasta el alto
                de la fila el mapa iguala al rail sea cual sea, y cuando el
                recorrido es el más largo `grow` no lo achica.

                En mobile no aplica: las dos columnas se apilan y no hay hueco.
              */
              className="campaign-scene overflow-hidden rounded-2xl p-2.5 sm:p-3.5 lg:grow"
            >
              {/*
                El arte del capítulo detrás del recorrido: sin esto la pantalla
                más "de aventura" del juego era una lista sobre el gris de la app.
              */}
              <div className="campaign-scene__art" aria-hidden>
                <Image
                  src={bannerArt.src}
                  alt=""
                  fill
                  sizes="(max-width: 1024px) 100vw, 900px"
                  className="object-cover"
                  style={{ objectPosition: bannerArt.objectPosition }}
                />
              </div>
              <div className="campaign-scene__veil" aria-hidden />
              <ExpeditionAmbient kind={sceneKind} />

              <div className="relative z-[1]">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <p className="campaign-scene__title mb-0">{t("chapterPath")}</p>
                {viewingCurrentChapter ? (
                  <span className="rounded-md bg-pokeball-red/90 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-white">
                    {t("nodeCurrent")}
                  </span>
                ) : chapter.completed ? (
                  <span className="rounded-md bg-electric-yellow/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-electric-yellow">
                    {t("chapterDone")}
                  </span>
                ) : null}
                {/* Hojear capítulos es un callejón sin salida sin esto: no había
                    forma de volver a donde el viaje está de verdad. */}
                {!viewingCurrentChapter ? (
                  <button
                    type="button"
                    onClick={() => openChapter(currentChapterIdx)}
                    className="ui-btn-primary ml-auto inline-flex min-h-8 items-center gap-1 px-2.5 text-[10px]"
                  >
                    <span className="material-symbols-outlined text-[14px]!">my_location</span>
                    {t("backToCurrentChapter")}
                  </button>
                ) : null}
              </div>
              {/* `key` por capítulo: al cambiar de capítulo se remonta el
                  sendero y la entrada vuelve a correr. */}
              <CampaignPath
                key={chapter.number}
                chapter={chapter}
                selectedZoneId={focusZoneId}
                leadSpriteUrl={leadSpriteUrl}
                onPick={pickZone}
                nodes={chapter.zones.map((z) => {
                  const nodeStatus = resolveZoneNodeStatus({
                    zone: z,
                    farmingLocationId,
                    selectedZoneId: focusZoneId,
                    chapter,
                    badgeEarned: chapterBadgeEarned,
                  });
                  /*
                    El requisito que se muestra bajo el candado es el primero
                    sin cumplir, no la lista entera: bajo un nodo hay lugar
                    para un renglón, y el resto ya está en el panel de zona.
                  */
                  const pending = getZoneUnlockRequirements(
                    z.id,
                    progress,
                    defeatedTrainerIds,
                  ).find((req) => !req.completed);
                  return {
                    zone: z,
                    status: nodeStatus,
                    isNext: z.id === recommendedZoneId,
                    isFarming: z.id === farmingLocationId,
                    requirement:
                      nodeStatus === "locked" && pending
                        ? translateRequirement(t, pending)
                        : null,
                  };
                })}
              />
              </div>
            </div>
          )}
        </div>

        {/*
          `min-w-0`: sin esto el track del grid no puede encoger por debajo del
          contenido más ancho y empuja la columna hermana.
        */}
        {/*
          Rail de "qué falta": la puerta del capítulo y los datos del viaje.

          En mobile va debajo del recorrido —el orden del DOM es el de lectura—
          y en escritorio se pega arriba. Es el mismo contenido que antes vivía
          en la tercera columna, pero ahora con un rol declarado en vez de ser
          otro bloque más compitiendo por atención.
        */}
        <div
          ref={panelRef}
          className="flex min-w-0 flex-col gap-3 scroll-mt-20 touch-pan-y lg:sticky lg:top-20 lg:self-start"
        >
          {/*
            El equipo, arriba del panel de zona.

            Antes vivía suelto entre la barra de objetivo y los capítulos: un
            bloque con el mismo peso que el panel pero sin nada que lo agrupe,
            así que se leía como un widget huérfano. Acá comparte columna con
            "qué me falta", que es la pregunta que el equipo ayuda a responder.
          */}
          {party && party.members.length > 0 ? (
            <section
              /* Sólo lg+: en mobile el rail cae debajo del recorrido entero, y
                 el equipo tan lejos de la acción no le sirve a nadie. Ahí sigue
                 viviendo bajo el banner (ver `CampaignPrimaryObjective`). */
              className={`campaign-party-card hidden lg:block${
                party.heal.needsHealing ? " campaign-party-card--hurt" : ""
              }`}
            >
              <div className="mb-2.5 flex items-baseline justify-between gap-2">
                <span className={SECTION_LABEL}>{t("partyStripTitle")}</span>
                <span className="font-mono text-[10px] font-bold text-emerald-400/85">
                  {t("partyReady", {
                    count: party.members.filter((m) => m.currentHp > 0).length,
                  })}
                </span>
              </div>
              <CampaignPartyDock
                locale={locale}
                initialMembers={party.members}
                initialBagCounts={party.bagCounts}
                ownedHeldItems={party.ownedHeldItems}
                heal={party.heal}
                menuLabels={party.menuLabels}
                heldLabels={party.heldLabels}
              />
            </section>
          ) : null}

          {zone && (
            <ZonePanel
              zone={zone}
              chapter={chapter}
              isFarming={zone.id === farmingLocationId}
              farmingStageId={farmingStageId}
              pending={pending}
              gymRequirement={gymRequirements[zone.id]}
              gymWon={
                zone.gymOrder != null && earnedGymOrders.includes(zone.gymOrder)
              }
              teamMaxLevel={summary.teamMaxLevel}
              teamLevels={summary.teamLevels}
              unlockRequirements={getZoneUnlockRequirements(
                zone.id,
                progress,
                defeatedTrainerIds,
              )}
              onTravel={() => travelTo(zone.id)}
              onFarmStage={farmStage}
              onChallengeTrainer={challengeTrainer}
              onClaim={(objective, origin) => claim(zone.id, objective, origin)}
            />
          )}

          {/*
            Acá colgaban el medallero y una tira con medallas / Pokédex / zonas
            / variocolor: los mismos cuatro números que ya muestra
            `JourneySummaryCard` dentro de "Viaje completo", y ninguno de ellos
            habla de la zona seleccionada. Estiraban el rail ~200px por debajo
            del recorrido, que es de donde salía el hueco en capítulos cortos.
            Se mudaron al menú del viaje, junto a los mismos datos.
          */}
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────── */


function JourneyStrip({
  chapters,
  activeIndex,
  currentIndex,
  onPick,
  percent,
  label,
  chapterLabel,
  currentLabel,
}: {
  chapters: Chapter[];
  activeIndex: number;
  currentIndex: number;
  onPick: (i: number) => void;
  percent: number;
  label: string;
  chapterLabel: string;
  currentLabel: string;
}) {
  return (
    <section className="game-float-card rounded-2xl p-3">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <span className={SECTION_LABEL}>{label}</span>
        <span className="font-mono text-label-sm text-white/70">{percent}%</span>
      </div>
      <div
        className="grid items-stretch gap-1 sm:gap-1.5"
        style={{ gridTemplateColumns: `repeat(${chapters.length}, minmax(0, 1fr))` }}
      >
        {chapters.map((c, i) => {
          const selected = i === activeIndex;
          const isCurrent = i === currentIndex;
          const badgeType = c.gymOrder != null ? BADGE_TYPE_BY_ORDER[c.gymOrder] : null;
          return (
            <button
              key={c.number}
              type="button"
              onClick={() => onPick(i)}
              disabled={!c.unlocked}
              title={`${chapterLabel} ${c.number}${isCurrent ? ` · ${currentLabel}` : ""}`}
              aria-current={isCurrent ? "step" : undefined}
              className={`relative flex min-h-[3.5rem] min-w-0 flex-col items-center justify-center gap-1 overflow-hidden rounded-xl px-0.5 py-1.5 transition sm:min-h-[3.75rem] sm:gap-1.5 sm:px-1 sm:py-2 ${
                isCurrent
                  ? "bg-pokeball-red/16 ring-1 ring-pokeball-red/55"
                  : selected
                    ? "bg-[#1a1c24] ring-1 ring-white/20"
                    : c.unlocked
                      ? "bg-[#161822] hover:bg-[#1a1c24]"
                      : "bg-[#12141c] opacity-45"
              }`}
            >
              {isCurrent ? (
                <span className="absolute inset-x-1 top-1 rounded-sm bg-pokeball-red px-0.5 text-center text-[7px] font-bold uppercase leading-3 tracking-wide text-white sm:text-[8px]">
                  {currentLabel}
                </span>
              ) : null}
              <span
                className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full sm:h-8 sm:w-8 ${
                  isCurrent
                    ? "bg-[color-mix(in_srgb,var(--color-pokeball-red)_14%,#0a0610)] shadow-[0_0_0_2px_var(--color-pokeball-red)]"
                    : c.completed
                      ? "bg-[#1a1c24] shadow-[0_0_0_1px_color-mix(in_srgb,var(--color-electric-yellow)_45%,transparent)]"
                      : c.unlocked
                        ? "bg-[#12141c] shadow-[0_0_0_1px_rgba(255,255,255,0.12)]"
                        : "bg-[#0c0e14] shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"
                } ${isCurrent ? "mt-2.5 sm:mt-3" : ""}`}
              >
                {!c.unlocked ? (
                  <span className="material-symbols-outlined text-[14px]! text-white/40 sm:text-[16px]!">
                    lock
                  </span>
                ) : badgeType ? (
                  <Image
                    src={gymBadgeImageUrl(badgeType)}
                    alt=""
                    width={28}
                    height={28}
                    className={`h-5 w-5 object-contain sm:h-6 sm:w-6 ${
                      c.completed || isCurrent ? "" : "opacity-55 grayscale"
                    }`}
                    aria-hidden
                  />
                ) : (
                  <span
                    className={`material-symbols-outlined text-[16px]! sm:text-[18px]! ${
                      c.completed || isCurrent ? "text-electric-yellow" : "text-white/50"
                    }`}
                  >
                    {c.completed ? "military_tech" : "flag"}
                  </span>
                )}
              </span>
              <span className="h-1 w-[85%] overflow-hidden rounded-full bg-black/45">
                <span
                  className={`block h-full rounded-full ${PATH_PROGRESS_FILL} transition-all duration-500`}
                  style={{ width: `${c.unlocked ? c.percent : 0}%` }}
                />
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ZonePanel({
  zone,
  chapter,
  isFarming,
  farmingStageId,
  pending,
  gymRequirement,
  gymWon = false,
  teamMaxLevel,
  teamLevels,
  unlockRequirements,
  onTravel,
  onFarmStage,
  onChallengeTrainer,
  onClaim,
}: {
  zone: MapLocation;
  chapter: Chapter;
  isFarming: boolean;
  farmingStageId: string;
  pending: boolean;
  gymRequirement?: GymRequirement;
  gymWon?: boolean;
  teamMaxLevel: number;
  teamLevels: number[];
  unlockRequirements: CampaignRequirement[];
  onTravel: () => void;
  onFarmStage: (stageId: string) => void;
  onChallengeTrainer: (trainerId: string) => void;
  onClaim: (objective: ZoneObjectiveId, origin?: { x: number; y: number }) => void;
}) {
  const t = useTranslations("campaign");
  const tUx = useTranslations("ux");
  const tGyms = useTranslations("gyms");
  const kind = kindOf(zone);
  const isGym = kind === "gym";
  const caught = zone.encounters.filter((e) => e.caught).length;
  const seenCount = zone.encounters.filter((e) => e.seen).length;
  const objectives = evaluateObjectives(zone, new Set(zone.claimedObjectives));
  const gymReady = isGym && chapter.stagesDone >= chapter.stagesTotal;
  const ask = zoneAsk(
    zone,
    objectives,
    isGym
      ? { won: gymWon, chapterCleared: chapter.stagesDone >= chapter.stagesTotal }
      : undefined,
  );

  return (
    <section
      className={`campaign-zone-panel campaign-zone-panel--${kind} p-4 ${
        isFarming ? "ring-1 ring-pokeball-red/45" : ""
      }`}
    >
      {/*
        Cabecera ilustrada.

        El arte de la zona a sangre en vez del ícono de 44px que había antes:
        identificaba la zona pero no la mostraba, y el panel abría igual para
        una ciudad que para una cueva. Los nodos del sendero ya usan este mismo
        arte, así que al clickear uno el panel confirma visualmente cuál es.
      */}
      {campaignMapHasArt(zone.id) ? (
        <div
          className={`campaign-zone-panel__art${!zone.unlocked ? " campaign-zone-panel__art--locked" : ""}`}
        >
          <Image src={campaignMapSrc(zone.id, true)} alt="" width={640} height={280} />
          {/* Sólo texto: `ZoneIcon` pinta un sprite isométrico con su propio
              tamaño y dentro de una chapa de 20px se salía por todos lados.
              El tipo de zona además ya está dicho por el color del panel. */}
          <span className="campaign-zone-panel__kind">{t(zone.kindKey)}</span>
          {isGym && gymRequirement?.leaderSpriteUrl ? (
            <Image
              src={gymRequirement.leaderSpriteUrl}
              alt=""
              width={140}
              height={140}
              className={`campaign-zone-panel__leader${
                gymRequirement.leaderSpriteUrl.includes("/avatars/")
                  ? ""
                  : " campaign-zone-panel__leader--pixel"
              }`}
            />
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className={`page-title ${ZONE_TITLE}`}>{t(zone.nameKey)}</h3>
          {isFarming && (
            <span className={ZONE_CHIP}>
              <span className="material-symbols-outlined text-[12px]!">my_location</span>
              {tUx("youAreHere")}
            </span>
          )}
        </div>
        <p className={`mt-0.5 ${ZONE_META}`}>
          {t("wildLevels", { min: zone.levelMin, max: zone.levelMax })}
          <span className="mx-1.5 text-white/25">·</span>
          {t(`encounterRate.${zone.encounterRate}`)}
        </p>
      </div>

      {/*
        Lo que la zona te pide, en una frase y antes que cualquier dato.

        La ficha listaba cinco secciones —objetivos, salvajes, entrenadores,
        tramos, maestría— y dejaba que el jugador dedujera qué hacer. Deducir es
        trabajo. La frase se arma de los mismos datos (`zoneAsk`), así que se
        actualiza sola con el progreso y no hay texto por zona que mantener.
      */}
      <div className="campaign-zone-ask">
        <span className={ZONE_LABEL}>{t("askTitle")}</span>
        <p>{t(ask.key, resolveAskParams(t, ask.params))}</p>
      </div>

      {zone.unlocked && !isFarming && !isGym ? (
        <GameCtaButton
          icon="explore"
          variant="red"
          disabled={pending}
          onClick={onTravel}
          className="mt-3 min-h-10! text-[12px]!"
        >
          {t("startExploring")}
        </GameCtaButton>
      ) : null}

      {/*
        Acá vivía una fila "Derrotar a los entrenadores 1/1" — exactamente el
        mismo texto y el mismo contador que el objetivo homónimo, cuatro líneas
        más abajo. Decirlo dos veces no lo hacía más claro.
      */}


      {!zone.unlocked ? (
        <div className="game-float-tile mt-3 rounded-xl border-dashed px-3 py-4">
          <p className={`text-center ${ZONE_ROW_TITLE} text-white/45`}>{t("zoneLocked")}</p>
          {unlockRequirements.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1.5">
              {unlockRequirements.map((req) => (
                <li
                  key={req.id}
                  className={`flex items-start gap-2 ${ZONE_ROW_TITLE} text-white/50`}
                >
                  <span className="material-symbols-outlined mt-0.5 text-[16px]!">lock</span>
                  <span>{translateRequirement(t, req)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <>
          <p className={`mt-3 mb-1.5 ${ZONE_LABEL}`}>{t("objectives")}</p>
          <ul className="flex flex-col divide-y divide-white/[0.06]">
            {objectives.map((obj) => {
              return (
                <Objective
                  key={obj.id}
                  state={obj}
                  label={t(`obj_${obj.id}`)}
                  hint={
                    obj.id === "pokedex"
                      ? t("obj_pokedexHint")
                      : obj.id === "trainers"
                        ? t("obj_trainersHint")
                        : undefined
                  }
                  roleLabel={obj.required ? t("objRoleRequirement") : undefined}
                  findHereLabel={obj.id === "pokedex" ? t("obj_pokedexFindHere") : undefined}
                  claimLabel={t("claim")}
                  claimedLabel={t("claimed")}
                  pending={pending}
                  encounters={
                    obj.id === "pokedex"
                      ? zone.encounters.filter((e) => e.forObjective)
                      : undefined
                  }
                  onClaim={(origin) => onClaim(obj.id, origin)}
                />
              );
            })}
            {isGym && gymRequirement && (
              gymWon ? (
                <li className="game-float-tile flex items-center gap-2.5 rounded-xl px-2.5 py-2 ring-1 ring-electric-yellow/35">
                  <span className="relative grid h-11 w-11 shrink-0 place-items-center" aria-hidden>
                    <Image
                      src={gymBadgeImageUrl(gymRequirement.badgeType)}
                      alt=""
                      width={44}
                      height={44}
                      className="h-10 w-10 object-contain drop-shadow-[0_2px_8px_color-mix(in_srgb,var(--color-electric-yellow)_35%,transparent)]"
                    />
                    <span className="absolute -right-0.5 -top-0.5 grid h-4 w-4 place-items-center rounded-full bg-electric-yellow text-[#1a1208]">
                      <span className="material-symbols-outlined text-[11px]! leading-none">
                        check
                      </span>
                    </span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-electric-yellow">
                      {t("nodeWon")}
                    </p>
                    <p className={`truncate ${ZONE_ROW_TITLE} text-white`}>
                      {localizedBadgeName(gymRequirement, tGyms) || t("objBadge")}
                    </p>
                  </div>
                  <span className="material-symbols-outlined text-[20px]! text-electric-yellow">
                    task_alt
                  </span>
                </li>
              ) : (
                <li className="game-float-tile flex items-center gap-2.5 rounded-xl px-2.5 py-2 ring-1 ring-pokeball-red/35">
                  <span className="relative grid h-11 w-11 shrink-0 place-items-center" aria-hidden>
                    <Image
                      src={gymBadgeImageUrl(gymRequirement.badgeType)}
                      alt=""
                      width={44}
                      height={44}
                      className="h-10 w-10 object-contain drop-shadow-[0_2px_8px_color-mix(in_srgb,var(--color-pokeball-red)_35%,transparent)]"
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-pokeball-red">
                      {t("objRoleRequirement")}
                    </p>
                    <p className={`truncate ${ZONE_ROW_TITLE} text-white`}>
                      {localizedBadgeName(gymRequirement, tGyms) || t("objBadge")}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-md bg-[#12141c] px-2 py-1 font-mono text-[11px] text-electric-yellow">
                    {`Lv. ${gymRequirement.recommendedLevel}`}
                  </span>
                </li>
              )
            )}
          </ul>

          {zone.encounters.length > 0 && (
            /*
              Plegado, como maestría. La grilla de salvajes ocupaba un tercio
              del panel con información de consulta —quién vive acá— mientras
              los objetivos, que son la tarea, quedaban arriba comprimidos. El
              contador del resumen sigue visible sin abrir nada.
            */
            <details className="mt-4 hidden border-t border-white/[0.08] pt-3 lg:block">
              <summary className={`flex cursor-pointer list-none items-center justify-between gap-2 marker:content-none [&::-webkit-details-marker]:hidden ${ZONE_LABEL}`}>
                {t("zoneWilds")}
                {/*
                  Con íconos, no con una fracción pelada.

                  Decía "4/4 (4 vistos)" a dos líneas del objetivo "Encontrar
                  las especies de esta zona 1/1": dos fracciones parecidas que
                  cuentan cosas distintas —acá capturados sobre el total de la
                  zona, allá el subconjunto que pide el objetivo—. Una pokébola
                  y un ojo dicen cuál es cuál sin agregar palabras.
                */}
                <span className="flex shrink-0 items-center gap-2.5 font-mono normal-case tracking-normal text-white/70">
                  <span className="inline-flex items-center gap-1" title={t("obj_pokedex")}>
                    <PokeballIcon className="h-3 w-3" />
                    {caught}/{zone.encounters.length}
                  </span>
                  <span
                    className="inline-flex items-center gap-1 text-white/40"
                    title={t("seenShort")}
                  >
                    <span className="material-symbols-outlined text-[13px]!">visibility</span>
                    {seenCount}
                  </span>
                </span>
              </summary>
              <ul className="flex flex-wrap gap-2">
                {zone.encounters.map((mon) => (
                  <li
                    key={mon.speciesId}
                    title={`${mon.name}${mon.seen ? ` · ${t(`rarity.${mon.rarity}`)}` : ""}`}
                    className="flex w-14 flex-col items-center gap-1"
                  >
                    <span
                      className={`relative flex h-12 w-12 items-center justify-center rounded-xl bg-[#1a1c24] border ${
                        mon.caught
                          ? RARITY_STYLE[mon.rarity]
                          : mon.seen
                            ? RARITY_STYLE[mon.rarity]
                            : "border-white/8"
                      }`}
                    >
                      <Image
                        src={mon.spriteUrl}
                        alt={mon.name}
                        width={44}
                        height={44}
                        className={`h-10 w-10 object-contain ${
                          mon.caught
                            ? ""
                            : mon.seen
                              ? "opacity-60 grayscale"
                              : "brightness-0 opacity-40"
                        }`}
                      />
                      {mon.caught && (
                        <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-400 text-surface">
                          <span className="material-symbols-outlined text-[11px]! leading-none">
                            check
                          </span>
                        </span>
                      )}
                    </span>
                    <span
                      className={`max-w-full truncate text-center font-mono text-[9px] leading-tight ${
                        mon.caught
                          ? "text-white"
                          : mon.seen
                            ? "text-white/55"
                            : "text-white/35"
                      }`}
                    >
                      {mon.name}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}

          {/*
            Con todos vencidos, la lista es un registro: los nombres, los
            niveles y una chapa VENCIDO por cada uno, sin nada que hacer. Se
            pliega, como ya hacían los salvajes. Mientras quede alguno vivo
            queda abierta — ahí sí es lo que falta.
          */}
          {zone.trainers.length > 0 && (
            <details open={zone.trainers.some((tr) => !tr.defeated)}>
              <summary
                className={`mt-3 mb-1.5 flex cursor-pointer list-none items-center justify-between gap-2 marker:content-none [&::-webkit-details-marker]:hidden ${ZONE_LABEL}`}
              >
                <span>{t("trainersTitle")}</span>
                <span className="font-mono normal-case tracking-normal text-white/70">
                  {zone.trainers.filter((tr) => tr.defeated).length}/{zone.trainers.length}
                </span>
              </summary>
              <ul className="flex flex-col gap-2">
                {zone.trainers.map((tr) => (
                  <li
                    key={tr.id}
                    className={`game-float-tile flex items-center gap-2.5 rounded-xl px-2.5 py-2 backdrop-blur-md transition ${
                      tr.defeated
                        ? "opacity-60"
                        : "ring-1 ring-[color:color-mix(in_srgb,var(--zone-accent)_24%,transparent)] hover:ring-[color:color-mix(in_srgb,var(--zone-accent)_45%,transparent)]"
                    }`}
                  >
                    <span className="relative shrink-0">
                      <Image
                        src={tr.spriteUrl}
                        alt=""
                        width={36}
                        height={36}
                        className={`h-9 w-9 object-contain ${tr.defeated ? "opacity-55 grayscale" : ""}`}
                        unoptimized
                      />
                      {tr.defeated && (
                        <span className="absolute -right-0.5 -bottom-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 text-white">
                          <span className="material-symbols-outlined text-[10px]! leading-none">
                            check
                          </span>
                        </span>
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={`truncate ${ZONE_ROW_TITLE}`}>{t(tr.nameKey)}</p>
                      <p className={ZONE_ROW_META}>Lv. {tr.level}</p>
                    </div>
                    {tr.defeated ? (
                      <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-400">
                        {t("trainerBeaten")}
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => onChallengeTrainer(tr.id)}
                        className="ui-btn-primary shrink-0 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide"
                        style={{
                          boxShadow: `0 0 14px color-mix(in srgb, var(--zone-accent) 30%, transparent)`,
                        }}
                      >
                        {t("trainerFight")}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          )}

          <div className="mt-3 flex flex-col gap-2">
            {/*
              Sin la frase de arriba ("Usá la acción principal…"): es la misma
              instrucción que ya da el bloque del pedido. Queda la lista de
              requisitos, que sí aporta —dice qué falta— y sólo mientras falte
              algo: con el gimnasio listo no hay nada que enumerar.
            */}
            {isGym && !gymReady ? (
              <div className="game-float-tile hidden rounded-xl px-3 py-2.5 ring-1 ring-tertiary/25 lg:block">
                {!gymReady && (
                  <ul className="mt-2 flex flex-col gap-1">
                    <li
                      className={`flex items-center gap-1.5 text-[11px] ${
                        chapter.stagesDone >= chapter.stagesTotal
                          ? "text-emerald-400"
                          : "text-white/45"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[14px]!">
                        {chapter.stagesDone >= chapter.stagesTotal
                          ? "check_circle"
                          : "radio_button_unchecked"}
                      </span>
                      {t("reqStagesDetail", {
                        done: chapter.stagesDone,
                        total: chapter.stagesTotal,
                      })}
                    </li>
                    {gymRequirement && (
                      <>
                        <li
                          className={`flex items-center gap-1.5 text-[11px] ${
                            teamMaxLevel >= gymRequirement.recommendedLevel
                              ? "text-emerald-400"
                              : "text-white/45"
                          }`}
                        >
                          <span className="material-symbols-outlined text-[14px]!">
                            {teamMaxLevel >= gymRequirement.recommendedLevel
                              ? "check_circle"
                              : "radio_button_unchecked"}
                          </span>
                          {t("reqLevel", { level: gymRequirement.recommendedLevel })}
                        </li>
                        <li
                          className={`flex items-center gap-1.5 text-[11px] ${
                            countTeamReadyAtLevel(
                              teamLevels,
                              gymReadyLevel(gymRequirement.recommendedLevel),
                            ) >= GYM_READY_TEAM_SIZE
                              ? "text-emerald-400"
                              : "text-white/45"
                          }`}
                        >
                          <span className="material-symbols-outlined text-[14px]!">
                            {countTeamReadyAtLevel(
                              teamLevels,
                              gymReadyLevel(gymRequirement.recommendedLevel),
                            ) >= GYM_READY_TEAM_SIZE
                              ? "check_circle"
                              : "radio_button_unchecked"}
                          </span>
                          {t("reqTeamReady", {
                            count: GYM_READY_TEAM_SIZE,
                            level: gymReadyLevel(gymRequirement.recommendedLevel),
                          })}
                        </li>
                      </>
                    )}
                  </ul>
                )}
              </div>
            ) : (
              <>
                {isFarming ? (
                  <div className="lg:hidden">
                    <GameCtaButton href="/battle" icon="explore" variant="red">
                      {t("continueExpedition")}
                    </GameCtaButton>
                  </div>
                ) : null}

                {/* Stages solo desktop: en mobile el objetivo principal ya marca el progreso. */}
                <div className="hidden lg:block">
                  <p className={`mt-1 ${ZONE_LABEL}`}>{t("pickStage")}</p>
                  <ul className="flex flex-col gap-1">
                    {zone.stages.map((stage) => {
                      const current = stage.id === farmingStageId;
                      return (
                        <li key={stage.id}>
                          <button
                            type="button"
                            disabled={pending || !stage.unlocked || stage.isGym}
                            onClick={() => onFarmStage(stage.id)}
                            className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-label-sm transition ${
                              current
                                ? "bg-[#1a1c24] text-white ring-1 ring-electric-yellow/65 shadow-[0_0_16px_color-mix(in_srgb,var(--color-electric-yellow)_28%,transparent)]"
                                : stage.unlocked && !stage.isGym
                                  ? "campaign-stage-row game-float-tile text-white/80 hover:brightness-110"
                                  : "bg-[#12141c] text-white/30"
                            }`}
                          >
                            <span
                              className={`material-symbols-outlined text-[15px]! ${
                                current || stage.done ? "text-electric-yellow" : ""
                              }`}
                            >
                              {stage.isGym
                                ? "military_tech"
                                : !stage.unlocked
                                  ? "lock"
                                  : stage.done
                                    ? "task_alt"
                                    : current
                                      ? "my_location"
                                      : "radio_button_unchecked"}
                            </span>
                            <span className="min-w-0 flex-1 truncate">{stageShortName(t(stage.nameKey))}</span>
                            {!stage.isGym && stage.clearsRequired > 1 && !stage.done ? (
                              <span className="shrink-0 font-mono text-[10px] text-white/55">
                                {t("stageClearsProgress", {
                                  current: stage.clearsCurrent,
                                  required: stage.clearsRequired,
                                })}
                              </span>
                            ) : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </>
            )}
          </div>
        </>
      )}
      {/*
        Maestría, al final del panel y plegada.

        Estaba entre el CTA y los objetivos —o sea entre "qué puedo hacer acá" y
        "qué me falta acá"—, cortando la lectura justo en el medio con un dato
        que no se consulta en cada visita. Los bloques de referencia van abajo;
        lo accionable, arriba.
      */}
      {zone.unlocked && (
        <details className="mt-3 hidden border-t border-white/[0.08] pt-3 open:pb-1 lg:block">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 marker:content-none [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-1.5 text-label-sm text-pokeball-red">
              <MasteryIcon className="h-4 w-4" />
              {t("mastery")} · Lv. {zone.masteryLevel} · {masteryProgressPercent(zone.masteryXp)}%
            </span>
            <span className="material-symbols-outlined text-[16px]! text-white/40">
              expand_more
            </span>
          </summary>
          <div className="mt-2">
            <div className="h-1.5 overflow-hidden rounded-full bg-black/40">
              <div
                className="campaign-warm-bar h-full rounded-full transition-all duration-500"
                style={{ width: `${masteryProgressPercent(zone.masteryXp)}%` }}
              />
            </div>
            <p className="mt-1.5 text-[11px] leading-snug text-white/45">
              {t("masteryBonuses", {
                xp: masteryBonuses(zone.masteryLevel).xp,
                capture: masteryBonuses(zone.masteryLevel).capture,
                coins: masteryBonuses(zone.masteryLevel).coins,
              })}
            </p>
          </div>
        </details>
      )}
    </section>
  );
}

/**
 * Anillo chico de progreso por objetivo — mismo lenguaje que `ObjectiveRing`
 * en el hero, aplicado en miniatura. Reemplaza la barra lineal que había
 * debajo del título: mostrar el mismo dato dos veces (barra + "2/4" a la
 * derecha) era ruido, y el anillo ya lo hace sin ocupar una fila propia.
 */
function ObjectiveMiniRing({ pct }: { pct: number }) {
  const size = 22;
  const stroke = 2.5;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  return (
    <span className="relative grid h-[22px] w-[22px] shrink-0 place-items-center" aria-hidden>
      <svg className="absolute inset-0 -rotate-90" viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--zone-accent, var(--theme-primary))"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - Math.min(100, Math.max(0, pct)) / 100)}
          style={{
            filter:
              "drop-shadow(0 0 3px color-mix(in srgb, var(--zone-accent, var(--theme-primary)) 60%, transparent))",
            transition: "stroke-dashoffset 0.5s cubic-bezier(0.22,1,0.36,1)",
          }}
        />
      </svg>
      {pct >= 100 ? (
        <span className="material-symbols-outlined relative text-[13px]! leading-none text-[color:var(--zone-accent,var(--theme-primary))]">
          check
        </span>
      ) : null}
    </span>
  );
}

function Objective({
  state,
  label,
  hint,
  roleLabel,
  findHereLabel,
  claimLabel,
  claimedLabel,
  pending,
  encounters,
  onClaim,
}: {
  state: ZoneObjectiveState;
  label: string;
  hint?: string;
  roleLabel?: string;
  findHereLabel?: string;
  claimLabel: string;
  claimedLabel: string;
  pending: boolean;
  encounters?: MapEncounter[];
  onClaim: (origin?: { x: number; y: number }) => void;
}) {
  const pct = state.target > 0 ? Math.min(100, (state.current / state.target) * 100) : 0;
  const shell = state.claimable
    ? "rounded-lg bg-pokeball-red/[0.07]"
    : "";

  /*
    Objetivo ya cobrado: una línea.

    Medido en pantalla, el bloque de objetivos ocupaba 272px de los 851 del
    panel, y en una zona terminada los tres estaban cobrados: seguían mostrando
    grilla de especies, barra de progreso y las fichas de premio de algo que ya
    se pagó. Detalle sólo donde queda algo por hacer — lo cobrado se reduce a su
    título y el tilde.
  */
  if (state.claimed) {
    return (
      <li className="flex items-center gap-2 px-0.5 py-1.5">
        <span className="material-symbols-outlined text-[16px]! text-emerald-400/80" aria-hidden>
          check_circle
        </span>
        <p className={`min-w-0 flex-1 truncate ${ZONE_ROW_TITLE} text-white/45`}>{label}</p>
        <span className={`shrink-0 ${ZONE_ROW_META} text-white/35`}>
          {state.current}/{state.target}
        </span>
      </li>
    );
  }

  return (
    /* `data-objective-done` lo consume el CSS del panel para bajarle la voz a
       lo ya cumplido sin esconderlo. Un objetivo cobrable NO cuenta como
       cumplido: todavía pide un clic. */
    <li
      data-objective-done={state.done && !state.claimable ? "true" : undefined}
      className={`px-0.5 py-2.5 transition ${shell}`}
    >
      <div className="flex items-start gap-2.5">
        <ObjectiveMiniRing pct={pct} />
        {/*
          Envuelve en vez de truncar.

          "Explorar todos los stages" + la chapa REQUISITO + el contador no
          entran en el ancho del rail, y cortado ("Explorar todos los sta…") el
          objetivo deja de decir qué hay que hacer, que es su único trabajo. Un
          renglón más cuesta menos que una frase incompleta.
        */}
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1 gap-y-0.5">
          <p
            className={`min-w-0 ${ZONE_ROW_TITLE} ${
              state.claimed ? "text-white/55" : ""
            }`}
          >
            {label}
          </p>
          {roleLabel && !state.done ? (
            <span className="shrink-0 rounded-md bg-pokeball-red/16 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-pokeball-red">
              {roleLabel}
            </span>
          ) : null}
          {hint ? (
            <details className="relative shrink-0">
              <summary
                className="flex h-5 w-5 cursor-pointer list-none items-center justify-center text-white/40 transition hover:text-white/70 marker:content-none [&::-webkit-details-marker]:hidden"
                aria-label={hint}
                title={hint}
              >
                <span className="material-symbols-outlined text-[15px]! leading-none">
                  info
                </span>
              </summary>
              <div className="absolute left-0 top-[calc(100%+0.35rem)] z-20 w-[min(16.5rem,calc(100vw-3rem))] rounded-lg border border-white/12 bg-[#12141c]/96 px-2.5 py-2 text-[11px] leading-snug text-white/70 shadow-[0_12px_28px_rgba(0,0,0,0.5)] backdrop-blur-md">
                {hint}
              </div>
            </details>
          ) : null}
        </div>
        <span className={`shrink-0 ${ZONE_ROW_META} text-white/90`}>
          {state.current}
          <span className="text-white/40">/{state.target}</span>
        </span>
      </div>

      {encounters && encounters.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {encounters.map((mon) => {
            const ownedElsewhere = mon.owned && !mon.caught;
            const title = mon.caught
              ? mon.name
              : ownedElsewhere && findHereLabel
                ? `${mon.name} · ${findHereLabel}`
                : mon.name;
            return (
              <li
                key={mon.speciesId}
                title={title}
                className={`relative flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.04] ring-1 ${
                  ownedElsewhere ? "ring-pokeball-red/45" : "ring-white/[0.06]"
                }`}
              >
                <Image
                  src={mon.spriteUrl}
                  alt={mon.name}
                  width={32}
                  height={32}
                  className={`h-7 w-7 object-contain ${
                    mon.caught
                      ? ""
                      : ownedElsewhere
                        ? "opacity-90"
                        : mon.seen
                          ? "opacity-55 grayscale"
                          : "brightness-0 opacity-40"
                  }`}
                />
                {mon.caught ? (
                  <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-emerald-400 text-surface">
                    <span className="material-symbols-outlined text-[9px]! leading-none">
                      check
                    </span>
                  </span>
                ) : null}
                {ownedElsewhere ? (
                  <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-pokeball-red text-white">
                    <span className="material-symbols-outlined text-[9px]! leading-none">
                      explore
                    </span>
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="rounded-lg bg-white/[0.03] px-2 py-1">
          <ObjectiveRewardBits state={state} />
        </div>
        <ObjectiveClaimControl
          state={state}
          claimLabel={claimLabel}
          claimedLabel={claimedLabel}
          pending={pending}
          onClaim={onClaim}
        />
      </div>
    </li>
  );
}

const OBJECTIVE_COIN_HD = "/items/hd/poke-coin.png";

function localizedBadgeName(
  gym: Pick<GymRequirement, "gymOrder" | "badgeName">,
  tGyms: ReturnType<typeof useTranslations<"gyms">>,
): string {
  const key = `badges.${gym.gymOrder}`;
  if (tGyms.has(key)) return tGyms(key);
  return gym.badgeName;
}

function ObjectiveRewardBits({
  state,
}: {
  state: ZoneObjectiveState;
}) {
  const tShop = useTranslations("shop");
  const coinsTitle = `${state.reward.coins} ${tShop("coinsUnit")}`;

  return (
    <div
      className={`flex items-center gap-2.5 ${state.claimed ? "opacity-45" : ""}`}
    >
      {state.reward.items.map((reward) => {
        const itemLabel = resolveItemDisplayName(reward.itemName, (key) => {
          const path = `names.${key}`;
          return tShop.has(path) ? tShop(path) : null;
        });
        const itemTitle = `${reward.quantity}× ${itemLabel}`;
        return (
          <span
            key={reward.itemName}
            title={itemTitle}
            className="inline-flex items-center gap-1"
          >
            <Image
              src={itemDisplayUrl(reward.itemName, "hd")}
              alt={itemTitle}
              width={28}
              height={28}
              className="h-7 w-7 object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.45)]"
            />
            <span className="font-mono text-[11px] font-bold tabular-nums text-white">
              ×{reward.quantity}
            </span>
          </span>
        );
      })}
      <span
        title={coinsTitle}
        className="inline-flex items-center gap-1 font-mono text-[11px] font-bold tabular-nums text-white"
      >
        <Image
          src={OBJECTIVE_COIN_HD}
          alt={coinsTitle}
          width={28}
          height={28}
          className="h-7 w-7 object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.45)]"
        />
        {state.reward.coins}
      </span>
    </div>
  );
}

function ObjectiveClaimControl({
  state,
  claimLabel,
  claimedLabel,
  pending,
  onClaim,
}: {
  state: ZoneObjectiveState;
  claimLabel: string;
  claimedLabel: string;
  pending: boolean;
  onClaim: (origin?: { x: number; y: number }) => void;
}) {
  if (state.claimable) {
    return (
      <button
        type="button"
        disabled={pending}
        onClick={(event) => {
          const r = event.currentTarget.getBoundingClientRect();
          onClaim({
            x: r.left + r.width / 2,
            y: r.top + r.height / 2,
          });
        }}
        className="shrink-0 rounded-md bg-pokeball-red px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow-[0_4px_14px_color-mix(in_srgb,var(--color-pokeball-red)_28%,transparent)] transition hover:brightness-110 disabled:opacity-40"
      >
        {claimLabel}
      </button>
    );
  }
  if (state.claimed) {
    return (
      <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-400/90">
        {claimedLabel}
      </span>
    );
  }
  return null;
}

/**
 * Datos del viaje en una tira de cuatro, al pie de la pantalla.
 *
 * Los mismos números que `JourneySummaryCard` —que sigue viva dentro del menú
 * de progreso—, pero acá van horizontales y sin arte de fondo: son estadísticas
 * de consulta, no algo que se mire en cada visita. Como card vertical en la
 * columna izquierda competían con el recorrido, que es lo que sí importa.
 */
/**
 * Medallero: una por gimnasio ganado, con el arte real de la insignia.
 *
 * Vive dentro del menú "Viaje completo", junto a `JourneySummaryCard`, que ya
 * lleva el contador "8/8": el medallero dice *cuáles*, que es lo que el número
 * solo no cuenta. En el rail de la derecha estiraba la columna con datos que
 * no hablan de la zona seleccionada.
 */
function BadgeMedalRow({ earnedGymOrders }: { earnedGymOrders: number[] }) {
  const t = useTranslations("campaign");
  const tGyms = useTranslations("gyms");
  const earned = [...earnedGymOrders].sort((a, b) => a - b);
  if (earned.length === 0) return null;

  return (
    <ul className="campaign-badge-row" aria-label={t("badges")}>
      {earned.map((order) => {
        const type = BADGE_TYPE_BY_ORDER[order];
        if (!type) return null;
        const key = `badges.${order}`;
        const label = tGyms.has(key) ? tGyms(key) : type;
        return (
          <li key={order} className="campaign-badge-medal" title={label}>
            <Image src={gymBadgeImageUrl(type)} alt={label} width={24} height={24} />
          </li>
        );
      })}
    </ul>
  );
}

function JourneySummaryCard({
  summary,
  mapSrc,
}: {
  summary: JourneySummary;
  mapSrc: string;
}) {
  const t = useTranslations("campaign");
  // Solo se colorean las medallas y los shinies: lo escaso. El resto es neutro.
  const rows = [
    { iconSrc: "/nav/gym-icon.png?v=4", label: t("badges"), value: `${summary.badges}/${summary.badgesTotal}` },
    { iconSrc: "/nav/collection-icon.png?v=4", label: t("pokedexShort"), value: `${summary.speciesCaught}/${summary.speciesTotal}` },
    { iconSrc: "/nav/map-icon.png?v=4", label: t("zonesUnlocked"), value: `${summary.zonesUnlocked}/${summary.zonesTotal}` },
    { iconSrc: "/ranking/insignia-gold.png", label: t("shinies"), value: `${summary.shinies}` },
  ];

  return (
    <section className="game-float-card relative overflow-hidden rounded-2xl p-3">
      <div className="pointer-events-none absolute inset-0">
        <Image src={mapSrc} alt="" fill className="object-cover opacity-[0.08]" sizes="240px" />
        <div className="absolute inset-0 bg-linear-to-b from-[#12141c]/80 to-[#12141c]" />
      </div>
      <div className="relative">
        <p className={`mb-2 ${SECTION_LABEL}`}>{t("journeySummary")}</p>
        <ul className="flex flex-col gap-1.5">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center gap-2 text-label-sm">
              <Image
                src={r.iconSrc}
                alt=""
                width={18}
                height={18}
                className="h-[18px] w-[18px] shrink-0 object-contain"
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate text-white/50">{r.label}</span>
              <span className="font-mono text-white">{r.value}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
