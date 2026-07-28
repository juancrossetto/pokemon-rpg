"use client";

import Image from "next/image";
import { useState, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { typeColor } from "@/lib/type-colors";
import { AllocatePointsPanel } from "@/components/allocate-points-panel";
import { SquadCardSheet } from "@/components/squad-card-sheet";
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
  heldItem: { itemId: string; name: string; effectText: string | null } | null;
  ownedHeldItems: { itemId: string; name: string; effectText: string | null; quantity: number }[];
  isFavorite: boolean;
  isTradeLocked: boolean;
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
  const serverFp = membersFingerprint(members);
  const [syncedFp, setSyncedFp] = useState(serverFp);
  const bagFp = `${bagCounts.heal}:${bagCounts.leppa}:${bagCounts.rareCandy}:${bagCounts.healItemName}:${bagCounts.ppItemName}`;
  const [syncedBagFp, setSyncedBagFp] = useState(bagFp);

  if (serverFp !== syncedFp) {
    setSyncedFp(serverFp);
    setOverrides({});
  }
  if (bagFp !== syncedBagFp) {
    setSyncedBagFp(bagFp);
    setBag(bagCounts);
  }

  const displayMembers = members.map((m) => {
    if (!m) return null;
    const patch = overrides[m.instanceId];
    return patch ? { ...m, ...patch } : m;
  });

  function patchMember(instanceId: string, patch: MemberPatch) {
    setOverrides((prev) => ({
      ...prev,
      [instanceId]: { ...prev[instanceId], ...patch },
    }));
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
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
}: {
  member: TeamMember;
  labels: TeamRosterLabels;
  bagCounts: SquadBagCounts;
  coins: number;
  onBagChange: (next: SquadBagCounts) => void;
  autoOpenTeach: boolean;
  initialTeachItemId: string | null;
  onMemberPatch: (patch: MemberPatch) => void;
}) {
  const displayName = member.nickname ?? member.speciesName;
  const primaryType = member.types[0] ?? "normal";
  const accent = typeColor(primaryType);
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
      canHeal={member.currentHp < member.maxHp}
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
    >
      <article
        className={`team-card group relative overflow-hidden rounded-[1.5rem] border transition duration-300 hover:-translate-y-1 ${
          member.isLead
            ? "border-pokeball-red/35 shadow-[0_14px_32px_rgba(0,0,0,0.45)]"
            : "border-white/[0.07] hover:border-white/20"
        } ${fainted ? "opacity-75" : ""}`}
        style={{ "--type-accent": accent } as CSSProperties}
      >
        <div className="relative flex min-h-[156px] w-full flex-col items-center justify-end px-3 pb-0 pt-8 text-left">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: `radial-gradient(ellipse 95% 75% at 50% 38%, ${accent}70 0%, transparent 70%)`,
            }}
          />
          <div
            className="pointer-events-none absolute left-1/2 top-[40%] h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.08]"
            style={{
              background:
                "radial-gradient(circle at 50% 50%, transparent 36%, currentColor 37%, currentColor 48%, transparent 49%)",
              color: accent,
            }}
            aria-hidden
          />

          <div className="absolute left-3 top-3 z-[2] flex max-w-[calc(100%-3rem)] flex-wrap items-center gap-1">
            <span className="rounded-full border border-white/12 bg-black/40 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white/60 backdrop-blur-sm">
              {member.slotLabel}
            </span>
            {member.isLead && (
              <span className="rounded-full bg-pokeball-red px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                {labels.lead}
              </span>
            )}
            <span className="rounded-full border border-white/15 bg-black/45 px-2 py-0.5 font-mono text-[10px] font-semibold text-white backdrop-blur-sm">
              {member.levelLabel}
            </span>
            {canEvolve && (
              <span className="inline-flex items-center gap-0.5 rounded-full border border-tertiary/40 bg-tertiary/20 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-tertiary backdrop-blur-sm">
                <span className="material-symbols-outlined text-[11px]! leading-none">
                  auto_awesome
                </span>
                {labels.canEvolveBadge}
              </span>
            )}
            {member.heldItem && (
              <span
                title={member.heldItem.name}
                className="inline-flex items-center gap-0.5 rounded-full border border-white/15 bg-black/45 px-1.5 py-0.5 text-[8px] font-semibold text-white/70 backdrop-blur-sm"
              >
                <span className="material-symbols-outlined text-[11px]! leading-none text-tertiary">
                  auto_awesome
                </span>
                {member.heldItem.name}
              </span>
            )}
          </div>

          <div className="relative z-[1] flex h-[128px] w-full items-end justify-center">
            <div
              className="absolute bottom-1 h-9 w-24 rounded-[100%] opacity-55 blur-xl transition group-hover:opacity-75"
              style={{ background: accent }}
            />
            <div className="absolute bottom-2 h-3 w-[4.5rem] rounded-[100%] bg-black/45 blur-sm" />
            {member.spriteUrl ? (
              <Image
                src={member.spriteUrl}
                alt={member.speciesName}
                width={128}
                height={128}
                className={`relative z-[1] h-32 w-32 object-contain drop-shadow-[0_18px_30px_rgba(0,0,0,0.6)] transition duration-300 group-hover:-translate-y-2 group-hover:scale-105 ${
                  fainted ? "grayscale" : ""
                }`}
              />
            ) : (
              <span className="material-symbols-outlined relative z-[1] text-[52px]! text-white/25">
                sports_baseball
              </span>
            )}
          </div>
        </div>

        <div className="relative z-[1] bg-gradient-to-b from-transparent to-black/25 px-3 pb-3 pt-1">
          <div className="text-center">
            <h2 className="truncate text-[16px] font-bold capitalize tracking-tight text-white leading-tight">
              {displayName}
            </h2>
            {member.nickname && (
              <p className="mt-0.5 text-[10px] capitalize text-white/45">{member.speciesName}</p>
            )}
            <p className="mt-0.5 font-mono text-[10px] text-white/35">
              #{String(member.speciesId).padStart(3, "0")}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1">
              {member.types.map((type) => {
                const color = typeColor(type);
                return (
                  <span
                    key={type}
                    className="rounded-full border border-white/10 bg-black/40 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                    style={{ color }}
                  >
                    {type}
                  </span>
                );
              })}
              {fainted && (
                <span className="rounded-full bg-error/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-error">
                  {labels.fainted}
                </span>
              )}
            </div>
          </div>

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
            />
          </div>

          {member.unspentPoints > 0 ? (
            <div className="relative mt-2" onClick={(e) => e.stopPropagation()}>
              <AllocatePointsPanel
                instanceId={member.instanceId}
                level={member.level}
                unspentPoints={member.unspentPoints}
                points={member.points}
                bases={member.bases}
              />
            </div>
          ) : null}
        </div>
      </article>
    </SquadCardContextMenu>
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
