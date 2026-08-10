"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { setTeamLayout } from "@/actions/pc";
import { playPcSfx } from "@/lib/pc-sfx";
import { SquadCardSheet } from "@/components/squad-card-sheet";
import { PokemonShowcaseCard } from "@/components/pokemon-showcase-card";
import {
  SquadCardContextMenu,
  type SquadContextLabels,
} from "@/components/squad-card-context-menu";
import type { TeachTmLabels } from "@/components/teach-tm-panel";
import type { HeldItemLabels } from "@/components/held-item-panel";
import type { RenameLabels } from "@/components/rename-pokemon-panel";
import type { EvolutionStage } from "@/lib/evolution-readiness";
import { anyEvolveReady } from "@/lib/evolution-readiness";
import type { SquadBagCounts } from "@/lib/squad-bag";

export interface TeamMoveDetail {
  slot: number;
  moveId: number;
  name: string;
  type: string;
  category: string;
  power: number | null;
  currentPp: number;
  maxPp: number;
}

export interface TeamCompatibleTm {
  itemId: string;
  code: string;
  quantity: number;
  moveId: number;
  moveName: string;
  moveType: string;
  moveCategory: string;
  movePower: number | null;
  alreadyKnown: boolean;
}

export interface TeamMember {
  instanceId: string;
  slot: number;
  isLead: boolean;
  speciesId: number;
  nickname: string | null;
  speciesName: string;
  level: number;
  types: string[];
  spriteUrl: string;
  currentHp: number;
  maxHp: number;
  xp: number;
  xpForCurrentLevel: number;
  xpToNext: number;
  evolutionChain: EvolutionStage[];
  ownedEvolutionItems?: string[];
  atk: number;
  def: number;
  spAtk: number;
  spDef: number;
  speed: number;
  unspentPoints: number;
  points: {
    ptStrength: number;
    ptDexterity: number;
    ptIntelligence: number;
    ptSpeed: number;
    ptConstitution: number;
  };
  bases: {
    baseHp: number;
    baseAttack: number;
    baseDefense: number;
    baseSpAtk: number;
    baseSpDef: number;
    baseSpeed: number;
  };
  moves: (TeamMoveDetail | null)[];
  compatibleTms: TeamCompatibleTm[];
  levelLabel: string;
  slotLabel: string;
  expToNextLabel: string;
  heldItem: {
    itemId: string;
    name: string;
    displayName: string;
    effectText: string | null;
  } | null;
  ownedHeldItems: {
    itemId: string;
    name: string;
    displayName: string;
    effectText: string | null;
    quantity: number;
  }[];
  isFavorite: boolean;
  isTradeLocked: boolean;
  isShiny: boolean;
}

export interface TeamRosterLabels {
  hp: string;
  exp: string;
  atk: string;
  def: string;
  spAtk: string;
  spDef: string;
  speed: string;
  lead: string;
  fainted: string;
  emptySlot: string;
  slotAvailableLabels: string[];
  emptySlotMove: string;
  unknownSpecies: string;
  evolveAtLevel: string;
  evolveByTrade: string;
  evolveTradeItemHint?: string;
  evolveStones: Record<string, string>;
  evolveReadyShort: string;
  evolveNeedItem: string;
  evolveNeedLevel: string;
  evolveNow: string;
  evolveUseStone: string;
  evolving: string;
  canEvolveBadge: string;
  favoriteBadge: string;
  shinyBadge: string;
  showDetails: string;
  hideDetails: string;
  tabAbout: string;
  tabStats: string;
  tabEvolutions: string;
  /** "Nv. {level}" — para repintar el nivel tras un carameloraro. */
  levelTemplate: string;
  menu: SquadContextLabels;
  teach: TeachTmLabels;
  held: HeldItemLabels;
  rename: RenameLabels;
}

type MemberPatch = Partial<
  Pick<
    TeamMember,
    | "level"
    | "levelLabel"
    | "currentHp"
    | "maxHp"
    | "isFavorite"
    | "isTradeLocked"
    | "unspentPoints"
    | "points"
    | "atk"
    | "def"
    | "spAtk"
    | "spDef"
    | "speed"
    | "xp"
    | "xpForCurrentLevel"
    | "xpToNext"
    | "heldItem"
    | "nickname"
  >
>;

function membersFingerprint(members: (TeamMember | null)[]) {
  return members
    .map((m) =>
      m
        ? `${m.instanceId}:${m.level}:${m.currentHp}:${m.maxHp}:${m.isFavorite ? 1 : 0}:${m.isTradeLocked ? 1 : 0}:${m.unspentPoints}:${m.heldItem?.itemId ?? "-"}:${m.nickname ?? ""}`
        : "-",
    )
    .join("|");
}

export function TeamRoster({
  members,
  labels,
  bagCounts,
  coins,
  initialSelectedId = null,
  initialTeachItemId = null,
}: {
  members: (TeamMember | null)[];
  labels: TeamRosterLabels;
  bagCounts: SquadBagCounts;
  coins: number;
  /** Miembro del deep-link inventario (`?member=`). */
  initialSelectedId?: string | null;
  /** MT a desplegar dentro de ese miembro. Ya validada en el servidor. */
  initialTeachItemId?: string | null;
}) {
  const [overrides, setOverrides] = useState<Record<string, MemberPatch>>({});
  const [bag, setBag] = useState(bagCounts);
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [depositingId, setDepositingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const locale = useLocale();
  const serverFp = membersFingerprint(members);
  const [syncedFp, setSyncedFp] = useState(serverFp);
  const bagFp = `${bagCounts.heal}:${bagCounts.leppa}:${bagCounts.rareCandy}:${bagCounts.healItemName}:${bagCounts.ppItemName}`;
  const [syncedBagFp, setSyncedBagFp] = useState(bagFp);

  if (serverFp !== syncedFp) {
    setSyncedFp(serverFp);
    setOverrides({});
    setRemovedIds(new Set());
    setDepositingId(null);
  }
  if (bagFp !== syncedBagFp) {
    setSyncedBagFp(bagFp);
    setBag(bagCounts);
  }

  const displayMembers = members.map((m) => {
    if (!m || removedIds.has(m.instanceId)) return null;
    const patch = overrides[m.instanceId];
    return patch ? { ...m, ...patch } : m;
  });

  const teamCount = displayMembers.filter(Boolean).length;

  function patchMember(instanceId: string, patch: MemberPatch) {
    setOverrides((prev) => {
      const next: Record<string, MemberPatch> = {
        ...prev,
        [instanceId]: { ...prev[instanceId], ...patch },
      };
      // Un solo favorito por entrenador: al marcar uno se limpia el resto.
      if (patch.isFavorite === true) {
        for (const m of members) {
          if (!m || m.instanceId === instanceId) continue;
          if (m.isFavorite || prev[m.instanceId]?.isFavorite) {
            next[m.instanceId] = { ...prev[m.instanceId], isFavorite: false };
          }
        }
      }
      // Exp. Share (y unique held): un solo holder a la vez.
      if (patch.heldItem) {
        const itemId = patch.heldItem.itemId;
        for (const m of members) {
          if (!m || m.instanceId === instanceId) continue;
          const current =
            prev[m.instanceId]?.heldItem !== undefined
              ? prev[m.instanceId].heldItem
              : m.heldItem;
          if (current?.itemId === itemId) {
            next[m.instanceId] = { ...prev[m.instanceId], heldItem: null };
          }
        }
      }
      return next;
    });
  }

  function depositToPc(instanceId: string) {
    if (depositingId || teamCount <= 1) return;
    const target = displayMembers.find((m) => m?.instanceId === instanceId);
    if (!target) return;
    if (target.isTradeLocked) return;
    const nextIds = displayMembers
      .filter((m): m is TeamMember => m !== null && m.instanceId !== instanceId)
      .map((m) => m.instanceId);
    if (nextIds.length === 0) return;

    setDepositingId(instanceId);
    playPcSfx("store");
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const delay = reduced ? 0 : 480;

    window.setTimeout(() => {
      setRemovedIds((prev) => new Set(prev).add(instanceId));
      setDepositingId(null);
      startTransition(async () => {
        const result = await setTeamLayout(locale, nextIds);
        if (!result.ok) {
          setRemovedIds((prev) => {
            const n = new Set(prev);
            n.delete(instanceId);
            return n;
          });
        } else {
          router.refresh();
        }
      });
    }, delay);
  }

  return (
    <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 md:gap-3 lg:grid-cols-3">
      {displayMembers.map((member, i) =>
        member ? (
          <PokemonCard
            key={member.instanceId}
            member={member}
            labels={labels}
            bagCounts={bag}
            coins={coins}
            onBagChange={setBag}
            autoOpenTeach={
              member.instanceId === initialSelectedId && Boolean(initialTeachItemId)
            }
            initialTeachItemId={
              member.instanceId === initialSelectedId ? initialTeachItemId : null
            }
            onMemberPatch={(patch) => patchMember(member.instanceId, patch)}
            onDepositToPc={() => depositToPc(member.instanceId)}
            canDepositToPc={teamCount > 1}
            isDepositing={depositingId === member.instanceId}
          />
        ) : (
          <EmptySlot
            key={`empty-${i}`}
            label={labels.emptySlot}
            hint={labels.slotAvailableLabels[i]}
          />
        ),
      )}
    </div>
  );
}

function PokemonCard({
  member,
  labels,
  bagCounts,
  coins,
  onBagChange,
  autoOpenTeach,
  initialTeachItemId,
  onMemberPatch,
  onDepositToPc,
  canDepositToPc,
  isDepositing,
}: {
  member: TeamMember;
  labels: TeamRosterLabels;
  bagCounts: SquadBagCounts;
  coins: number;
  onBagChange: (next: SquadBagCounts) => void;
  autoOpenTeach: boolean;
  initialTeachItemId: string | null;
  onMemberPatch: (patch: MemberPatch) => void;
  onDepositToPc: () => void;
  canDepositToPc: boolean;
  isDepositing: boolean;
}) {
  const displayName = member.nickname ?? member.speciesName;
  const fainted = member.currentHp <= 0;
  const canEvolve = anyEvolveReady(
    member.evolutionChain,
    member.level,
    new Set(member.ownedEvolutionItems ?? []),
  );
  const xpIntoLevel = member.xp - member.xpForCurrentLevel;
  const levelSpan = xpIntoLevel + member.xpToNext;
  const xpPct = levelSpan > 0 ? Math.max(0, Math.min(100, (xpIntoLevel / levelSpan) * 100)) : 0;

  return (
    <div className={isDepositing ? "team-slot--depositing" : undefined}>
    <SquadCardContextMenu
      instanceId={member.instanceId}
      pokemonName={displayName}
      speciesName={member.speciesName}
      nickname={member.nickname}
      spriteUrl={member.spriteUrl}
      currentHp={member.currentHp}
      maxHp={member.maxHp}
      level={member.level}
      isFavorite={member.isFavorite}
      isTradeLocked={member.isTradeLocked}
      canHeal={member.currentHp > 0 && member.currentHp < member.maxHp}
      canRevive={member.currentHp <= 0}
      canLevelUp={member.level < 100}
      showViewTeam={false}
      labels={labels.menu}
      bagCounts={bagCounts}
      coins={coins}
      moves={member.moves}
      compatibleTms={member.compatibleTms}
      heldItem={member.heldItem}
      ownedHeldItems={member.ownedHeldItems}
      teachLabels={labels.teach}
      heldLabels={labels.held}
      renameLabels={labels.rename}
      autoOpenTeach={autoOpenTeach}
      initialTeachItemId={initialTeachItemId}
      onBagChange={onBagChange}
      onDepositToPc={onDepositToPc}
      canDepositToPc={canDepositToPc}
      onHealed={(next) =>
        onMemberPatch({ currentHp: next.currentHp, maxHp: next.maxHp })
      }
      onLeveledUp={(next) =>
        onMemberPatch({
          level: next.level,
          currentHp: next.currentHp,
          maxHp: next.maxHp,
          levelLabel: labels.levelTemplate.replace("{level}", String(next.level)),
        })
      }
      onFlagsChange={(next) => onMemberPatch(next)}
      onHeldChange={(next) => onMemberPatch({ heldItem: next })}
      onNicknameChange={(next) => onMemberPatch({ nickname: next })}
      allocatePoints={member.points}
      allocateUnspent={member.unspentPoints}
      allocateBases={member.bases}
      onPointsAllocated={(next) => {
        const nextCurrentHp =
          member.currentHp <= 0
            ? 0
            : Math.min(next.maxHp, member.currentHp + next.currentHpDelta);
        onMemberPatch({
          unspentPoints: next.unspentPoints,
          points: next.points,
          maxHp: next.maxHp,
          currentHp: nextCurrentHp,
          atk: next.atk,
          def: next.def,
          spAtk: next.spAtk,
          spDef: next.spDef,
          speed: next.speed,
        });
      }}
    >
      <PokemonShowcaseCard
        speciesId={member.speciesId}
        speciesName={member.speciesName}
        nickname={member.nickname}
        types={member.types}
        spriteUrl={member.spriteUrl}
        fainted={fainted}
        faintedLabel={labels.fainted}
        accentBorder={member.isLead}
        badges={{
          slot: member.slotLabel,
          lead: member.isLead ? labels.lead : null,
          level: member.levelLabel,
          favorite: member.isFavorite ? labels.favoriteBadge : null,
          shiny: member.isShiny ? labels.shinyBadge : null,
          canEvolve: canEvolve ? labels.canEvolveBadge : null,
          heldItem: member.heldItem?.displayName ?? null,
          heldItemName: member.heldItem?.name ?? null,
        }}
      >
          <div className="mt-3">
            <SquadCardSheet
              labels={{
                showDetails: labels.showDetails,
                hideDetails: labels.hideDetails,
                tabAbout: labels.tabAbout,
                tabStats: labels.tabStats,
                tabEvolutions: labels.tabEvolutions,
                hp: labels.hp,
                exp: labels.exp,
                atk: labels.atk,
                def: labels.def,
                spAtk: labels.spAtk,
                spDef: labels.spDef,
                speed: labels.speed,
                emptyMove: labels.emptySlotMove,
                unknownSpecies: labels.unknownSpecies,
                evolveAtLevel: labels.evolveAtLevel,
                evolveByTrade: labels.evolveByTrade,
                evolveTradeItemHint: labels.evolveTradeItemHint,
                evolveStones: labels.evolveStones,
                evolveReadyShort: labels.evolveReadyShort,
                evolveNeedItem: labels.evolveNeedItem,
                evolveNeedLevel: labels.evolveNeedLevel,
                evolveNow: labels.evolveNow,
                evolveUseStone: labels.evolveUseStone,
                evolving: labels.evolving,
              }}
              moves={member.moves}
              currentHp={member.currentHp}
              maxHp={member.maxHp}
              xpPct={xpPct}
              atk={member.atk}
              def={member.def}
              spAtk={member.spAtk}
              spDef={member.spDef}
              speed={member.speed}
              evolutionChain={member.evolutionChain}
              instanceId={member.instanceId}
              currentLevel={member.level}
              ownedEvolutionItems={member.ownedEvolutionItems}
              allocate={{
                level: member.level,
                unspentPoints: member.unspentPoints,
                points: member.points,
                bases: member.bases,
                onAllocated: (next) => {
                  const nextCurrentHp =
                    member.currentHp <= 0
                      ? 0
                      : Math.min(next.maxHp, member.currentHp + next.currentHpDelta);
                  onMemberPatch({
                    unspentPoints: next.unspentPoints,
                    points: next.points,
                    maxHp: next.maxHp,
                    currentHp: nextCurrentHp,
                    atk: next.atk,
                    def: next.def,
                    spAtk: next.spAtk,
                    spDef: next.spDef,
                    speed: next.speed,
                  });
                },
              }}
            />
          </div>
      </PokemonShowcaseCard>
    </SquadCardContextMenu>
    </div>
  );
}

function EmptySlot({ label, hint }: { label: string; hint: string }) {
  const t = useTranslations("team");
  return (
    <Link
      href="/team?tab=pc"
      className="flex min-h-[220px] flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-white/12 bg-white/[0.015] px-4 py-6 text-center transition hover:border-white/25 hover:bg-white/[0.04] md:min-h-[320px]"
    >
      <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-white/15 bg-white/[0.02]">
        <span className="material-symbols-outlined text-[20px]! text-on-surface-variant/50">add</span>
      </div>
      <p className="text-label-sm text-on-surface-variant">{label}</p>
      <p className="mt-0.5 text-[10px] text-on-surface-variant/60">{hint}</p>
      <span className="mt-3 inline-flex items-center gap-1 rounded-md border border-white/12 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-on-surface-variant">
        <span aria-hidden className="material-symbols-outlined text-[14px]!">storage</span>
        {t("emptySlotCta")}
      </span>
    </Link>
  );
}
