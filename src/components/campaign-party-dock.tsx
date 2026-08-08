"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { setTeamLayout } from "@/actions/pc";
import { HealButton } from "@/components/heal-button";
import {
  SquadCardContextMenu,
  type SquadContextLabels,
} from "@/components/squad-card-context-menu";
import type {
  HeldItemInfo,
  HeldItemLabels,
  OwnedHeldItem,
} from "@/components/held-item-panel";
import { hpBarVariant } from "@/components/segmented-stat-bar";
import { announceHomeTeamHealed, HOME_TEAM_HEALED_EVENT } from "@/lib/home-heal-fx";
import { itemHdIconUrl, itemSpriteUrl } from "@/lib/item-sprites";
import type { SquadBagCounts } from "@/lib/squad-bag";

export type CampaignDockMember = {
  id: string;
  speciesName: string;
  nickname: string | null;
  spriteUrl: string;
  level: number;
  currentHp: number;
  maxHp: number;
  isFavorite: boolean;
  isTradeLocked: boolean;
  heldItem?: HeldItemInfo | null;
};

export type CampaignPartyHeal = {
  needsHealing: boolean;
  cooldownMsLeft: number;
  rushCost: number;
  coins: number;
  teamMaxLevel: number;
};

const TEAM_SIZE = 6;

function DockHpBar({ pct, fainted }: { pct: number; fainted: boolean }) {
  if (fainted) {
    return (
      <div className="party-hp mx-[10%] w-[80%]" aria-hidden>
        <div className="party-hp__track party-hp__track--faint" />
      </div>
    );
  }
  const variant = hpBarVariant(pct);
  const toneClass =
    variant === "danger"
      ? "party-hp__fill--red"
      : variant === "xp"
        ? "party-hp__fill--yellow"
        : "party-hp__fill--ok";
  return (
    <div
      className="party-hp mx-[10%] w-[80%]"
      role="meter"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="party-hp__track">
        <div className={`party-hp__fill ${toneClass}`} style={{ width: `${pct}%` }}>
          <span className="party-hp__sheen" aria-hidden />
        </div>
      </div>
    </div>
  );
}

function DockSlot({
  member,
  index,
  bagCounts,
  menuLabels,
  ownedHeldItems,
  heldLabels,
  isDragging,
  isOver,
  pending,
  onBagChange,
  onHealed,
  onFlagsChange,
  onHeldChange,
  onDragStart,
  onDragEnd,
  onDrop,
}: {
  member: CampaignDockMember | null;
  index: number;
  bagCounts: SquadBagCounts;
  menuLabels: SquadContextLabels;
  ownedHeldItems: OwnedHeldItem[];
  heldLabels: HeldItemLabels;
  isDragging: boolean;
  isOver: boolean;
  pending: boolean;
  onBagChange: (next: SquadBagCounts) => void;
  onHealed: (id: string, currentHp: number, maxHp: number) => void;
  onFlagsChange: (
    id: string,
    next: { isFavorite?: boolean; isTradeLocked?: boolean },
  ) => void;
  onHeldChange: (id: string, next: HeldItemInfo | null) => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDrop: (index: number) => void;
}) {
  const t = useTranslations("campaign");
  const skipClickRef = useRef(false);

  if (!member) {
    return (
      <div
        className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-md border border-dashed border-white/12 p-0.5 ${
          isOver ? "ring-1 ring-pokeball-red/50" : ""
        }`}
        onDragOver={(e) => {
          e.preventDefault();
        }}
        onDrop={(e) => {
          e.preventDefault();
          onDrop(index);
        }}
        aria-hidden
      >
        <div className="flex aspect-square min-h-[2.45rem] w-full items-center justify-center">
          <Image
            src="/items/hd/poke-ball.png"
            alt=""
            width={28}
            height={28}
            className="h-5 w-5 object-contain opacity-25 saturate-50"
            unoptimized
          />
        </div>
        <div className="h-[3px] w-[80%]" />
      </div>
    );
  }

  const displayName = member.nickname ?? member.speciesName;
  const fainted = member.currentHp <= 0;
  const hpPct =
    member.maxHp > 0
      ? Math.max(0, Math.min(100, (member.currentHp / member.maxHp) * 100))
      : 0;
  const detail = `${displayName} · Nv. ${member.level}${
    fainted ? ` · ${t("partyDock.fainted")}` : ""
  }`;

  return (
    <div
      className={`relative min-w-0 flex-1 ${isDragging ? "opacity-40" : ""} ${
        isOver ? "scale-[1.02]" : ""
      }`}
      onDragOver={(e) => {
        e.preventDefault();
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop(index);
      }}
    >
      <SquadCardContextMenu
        instanceId={member.id}
        pokemonName={displayName}
        spriteUrl={member.spriteUrl}
        speciesName={member.speciesName}
        nickname={member.nickname}
        currentHp={member.currentHp}
        maxHp={member.maxHp}
        level={member.level}
        isFavorite={member.isFavorite}
        isTradeLocked={member.isTradeLocked}
        canHeal={!fainted && member.currentHp < member.maxHp}
        canRevive={fainted}
        canLevelUp={false}
        showFlags={false}
        showViewTeam
        hideTrigger
        openOnPrimaryClick
        className="min-w-0 w-full!"
        labels={menuLabels}
        bagCounts={bagCounts}
        onBagChange={onBagChange}
        onHealed={(next) => onHealed(member.id, next.currentHp, next.maxHp)}
        onFlagsChange={(next) => onFlagsChange(member.id, next)}
        heldItem={member.heldItem ?? null}
        ownedHeldItems={ownedHeldItems}
        heldLabels={heldLabels}
        onHeldChange={(next) => onHeldChange(member.id, next)}
      >
        <button
          type="button"
          draggable={!pending}
          title={`${detail} · ${t("partyDock.dragHint")}`}
          aria-label={`${detail}. ${t("partyDock.careHint")}`}
          data-dock-dragging={isDragging ? "" : undefined}
          onDragStart={(e) => {
            skipClickRef.current = true;
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", member.id);
            onDragStart(member.id);
          }}
          onDragEnd={() => {
            onDragEnd();
            window.setTimeout(() => {
              skipClickRef.current = false;
            }, 0);
          }}
          onClick={(e) => {
            if (skipClickRef.current) {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
          className={`flex w-full flex-col items-center gap-0.5 rounded-md p-0.5 transition hover:bg-white/[0.04] ${
            fainted ? "opacity-70" : ""
          } ${
            index === 0 && !fainted ? "ring-1 ring-primary/35" : ""
          } ${isOver ? "ring-1 ring-pokeball-red/55" : ""}`}
        >
          <span className="relative flex aspect-square min-h-[2.45rem] w-full items-center justify-center overflow-hidden">
            <Image
              src={member.spriteUrl}
              alt=""
              width={40}
              height={40}
              className={`h-[92%] w-[92%] object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)] ${
                fainted ? "grayscale-[0.55]" : ""
              }`}
              unoptimized
            />
            {fainted ? (
              <span className="material-symbols-outlined absolute right-0 top-0 text-[8px]! text-error drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                skull
              </span>
            ) : null}
            {index === 0 && !fainted ? (
              <span className="absolute left-0 top-0 text-[#21CEA1] drop-shadow-[0_0_4px_rgba(33,206,161,0.55)]">
                <span className="material-symbols-outlined ms-fill text-[8px]! leading-none">
                  military_tech
                </span>
              </span>
            ) : null}
            {member.heldItem ? (
              <span
                title={member.heldItem.displayName}
                className="absolute bottom-0 right-0 inline-flex rounded-full border border-white/15 bg-black/55 p-px"
              >
                <Image
                  src={
                    itemHdIconUrl(member.heldItem.name) ??
                    itemSpriteUrl(member.heldItem.name)
                  }
                  alt=""
                  width={12}
                  height={12}
                  unoptimized
                  className="h-2.5 w-2.5 object-contain"
                />
              </span>
            ) : null}
          </span>
          <DockHpBar pct={hpPct} fainted={fainted} />
        </button>
      </SquadCardContextMenu>
    </div>
  );
}

/**
 * Mini-equipo en la barra de próximo objetivo (derecha, antes del CTA):
 * sprites + HP, drag para reordenar, click para curar/revivir, Chansey.
 */
export function CampaignPartyDock({
  locale,
  initialMembers,
  initialBagCounts,
  ownedHeldItems,
  heal,
  menuLabels,
  heldLabels,
}: {
  locale: string;
  initialMembers: CampaignDockMember[];
  initialBagCounts: SquadBagCounts;
  ownedHeldItems: OwnedHeldItem[];
  heal: CampaignPartyHeal;
  menuLabels: SquadContextLabels;
  heldLabels: HeldItemLabels;
}) {
  const t = useTranslations("campaign");
  const [members, setMembers] = useState(initialMembers);
  const [bagCounts, setBagCounts] = useState(initialBagCounts);
  const [healLive, setHealLive] = useState(heal);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overSlot, setOverSlot] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [lastMembers, setLastMembers] = useState(initialMembers);
  if (lastMembers !== initialMembers) {
    setLastMembers(initialMembers);
    setMembers(initialMembers);
  }
  const [lastBag, setLastBag] = useState(initialBagCounts);
  if (lastBag !== initialBagCounts) {
    setLastBag(initialBagCounts);
    setBagCounts(initialBagCounts);
  }
  const [lastHeal, setLastHeal] = useState(heal);
  if (lastHeal !== heal) {
    setLastHeal(heal);
    setHealLive(heal);
  }

  useEffect(() => {
    function onTeamHealed() {
      setMembers((prev) => prev.map((m) => ({ ...m, currentHp: m.maxHp })));
      setHealLive((prev) => ({ ...prev, needsHealing: false, cooldownMsLeft: 0 }));
    }
    window.addEventListener(HOME_TEAM_HEALED_EVENT, onTeamHealed);
    return () => window.removeEventListener(HOME_TEAM_HEALED_EVENT, onTeamHealed);
  }, []);

  const slots = Array.from({ length: TEAM_SIZE }, (_, i) => members[i] ?? null);

  function commit(next: CampaignDockMember[]) {
    const previous = members;
    setMembers(next);
    setError(null);
    startTransition(async () => {
      const result = await setTeamLayout(
        locale,
        next.map((m) => m.id),
      );
      if (!result.ok) {
        setMembers(previous);
        setError(result.error);
      }
    });
  }

  function dropOnSlot(index: number) {
    if (!dragId) return;
    const mon = members.find((m) => m.id === dragId);
    if (!mon) return;
    const rest = members.filter((m) => m.id !== mon.id);
    const at = Math.min(index, rest.length);
    commit([...rest.slice(0, at), mon, ...rest.slice(at)]);
    setDragId(null);
    setOverSlot(null);
  }

  return (
    <div
      className="flex w-full min-w-0 items-center gap-1.5"
      aria-label={t("partyDock.label")}
    >
      <div className="flex min-w-0 flex-1 items-end gap-1">
        {slots.map((member, index) => (
          <div
            key={member?.id ?? `empty-${index}`}
            className="min-w-0 flex-1"
            onDragEnter={() => setOverSlot(index)}
          >
            <DockSlot
              member={member}
              index={index}
              bagCounts={bagCounts}
              menuLabels={menuLabels}
              ownedHeldItems={ownedHeldItems}
              heldLabels={heldLabels}
              isDragging={Boolean(member && dragId === member.id)}
              isOver={overSlot === index && dragId != null}
              pending={pending}
              onBagChange={setBagCounts}
              onHealed={(id, currentHp, maxHp) => {
                setMembers((prev) => {
                  const next = prev.map((m) =>
                    m.id === id ? { ...m, currentHp, maxHp } : m,
                  );
                  setHealLive((h) => ({
                    ...h,
                    needsHealing: next.some((m) => m.currentHp < m.maxHp),
                  }));
                  return next;
                });
              }}
              onFlagsChange={(id, next) => {
                setMembers((prev) =>
                  prev.map((m) => (m.id === id ? { ...m, ...next } : m)),
                );
              }}
              onHeldChange={(id, next) => {
                setMembers((prev) =>
                  prev.map((m) =>
                    m.id === id
                      ? { ...m, heldItem: next }
                      : // Unique held (Exp. Share): al equipar acá, los otros lo pierden.
                        next && m.heldItem?.itemId === next.itemId
                        ? { ...m, heldItem: null }
                        : m,
                  ),
                );
              }}
              onDragStart={setDragId}
              onDragEnd={() => {
                setDragId(null);
                setOverSlot(null);
              }}
              onDrop={dropOnSlot}
            />
          </div>
        ))}
      </div>

      <div className="shrink-0 border-l border-white/10 pl-1.5">
        <HealButton
          locale={locale}
          needsHealing={healLive.needsHealing}
          cooldownMsLeft={healLive.cooldownMsLeft}
          rushCost={healLive.rushCost}
          coins={healLive.coins}
          teamMaxLevel={healLive.teamMaxLevel}
          iconOnly
          onHealed={() => {
            announceHomeTeamHealed();
            setMembers((prev) => prev.map((m) => ({ ...m, currentHp: m.maxHp })));
            setHealLive((prev) => ({ ...prev, needsHealing: false }));
          }}
          onHealFailed={() => {
            setHealLive(heal);
            setMembers(initialMembers);
          }}
        />
      </div>

      {error ? (
        <span className="sr-only" role="status">
          {["unauthorized", "in_battle", "rate_limited", "last_team_member", "team_full"].includes(
            error,
          )
            ? t(`partyDock.errors.${error}`)
            : t("partyDock.errors.generic")}
        </span>
      ) : null}
    </div>
  );
}
