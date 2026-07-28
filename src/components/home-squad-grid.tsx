"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { setTeamLayout } from "@/actions/pc";
import {
  HomeEmptySquadSlot,
  HomeSquadCard,
  type HomeSquadCardLabels,
  type HomeSquadMove,
} from "@/components/home-squad-card";
import type { SquadContextLabels } from "@/components/squad-card-context-menu";
import type { SquadBagCounts } from "@/lib/squad-bag";
import type { EvolutionStage } from "@/lib/evolution-readiness";

export type HomeSquadMember = {
  id: string;
  level: number;
  isFavorite: boolean;
  isTradeLocked: boolean;
  nickname: string | null;
  speciesName: string;
  types: string[];
  spriteUrl: string;
  currentHp: number;
  maxHp: number;
  xpPct: number;
  xpToNextLabel: string;
  levelLabel: string;
  atk: number;
  def: number;
  spAtk: number;
  spDef: number;
  speed: number;
  evolutionChain: EvolutionStage[];
  ownedEvolutionItems?: string[];
  moves: (HomeSquadMove | null)[];
  labels: Omit<HomeSquadCardLabels, "lead" | "slot" | "level">;
  menuLabels: SquadContextLabels;
};

const TEAM_SIZE = 6;

/**
 * Grilla del equipo en Home con drag & drop para reordenar.
 * Click izquierdo → /team. Click derecho / ⋮ → menú. Arrastrar → setTeamLayout.
 */
export function HomeSquadGrid({
  locale,
  initialMembers,
  emptySlotLabel,
  leadLabel,
  slotLabels,
  initialBagCounts,
}: {
  locale: string;
  initialMembers: HomeSquadMember[];
  emptySlotLabel: string;
  leadLabel: string;
  /** Labels ya resueltos en el server (no se pueden pasar funciones a client). */
  slotLabels: string[];
  initialBagCounts: SquadBagCounts;
}) {
  const t = useTranslations("pc");
  const [members, setMembers] = useState(initialMembers);
  const [bagCounts, setBagCounts] = useState(initialBagCounts);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overSlot, setOverSlot] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const didDragRef = useRef(false);

  // Tras curar / refresh del server, sincronizar HP sin perder el orden local.
  useEffect(() => {
    setMembers((prev) => {
      const byId = new Map(initialMembers.map((m) => [m.id, m]));
      const merged = prev
        .map((m) => {
          const fresh = byId.get(m.id);
          return fresh ? { ...m, ...fresh, id: m.id } : null;
        })
        .filter((m): m is HomeSquadMember => m !== null);
      for (const m of initialMembers) {
        if (!merged.some((x) => x.id === m.id)) merged.push(m);
      }
      return merged;
    });
  }, [initialMembers]);

  useEffect(() => {
    setBagCounts(initialBagCounts);
  }, [initialBagCounts]);

  const slots = Array.from({ length: TEAM_SIZE }, (_, i) => members[i] ?? null);

  function commit(next: HomeSquadMember[]) {
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
  }

  function applyHeal(instanceId: string, currentHp: number, maxHp: number) {
    setMembers((prev) =>
      prev.map((m) => (m.id === instanceId ? { ...m, currentHp, maxHp } : m)),
    );
  }

  function applyLevelUp(
    instanceId: string,
    next: { level: number; currentHp: number; maxHp: number; levelLabel: string },
  ) {
    setMembers((prev) =>
      prev.map((m) =>
        m.id === instanceId
          ? {
              ...m,
              level: next.level,
              currentHp: next.currentHp,
              maxHp: next.maxHp,
              levelLabel: next.levelLabel,
              xpPct: 0,
            }
          : m,
      ),
    );
  }

  function applyPpRestore(
    instanceId: string,
    next: { moveName: string; restoredBy: number; allMoves: boolean },
  ) {
    setMembers((prev) =>
      prev.map((m) => {
        if (m.id !== instanceId) return m;
        return {
          ...m,
          moves: m.moves.map((slot) => {
            if (!slot) return slot;
            if (!next.allMoves && slot.name !== next.moveName) return slot;
            return {
              ...slot,
              currentPp: Math.min(slot.maxPp, slot.currentPp + next.restoredBy),
            };
          }),
        };
      }),
    );
  }

  return (
    <div className={pending ? "opacity-90 transition-opacity" : undefined}>
      {error ? (
        <div className="mb-2 rounded-lg border border-error/40 bg-error-container/30 px-3 py-1.5 text-label-sm text-error">
          {t(`errors.${error}`)}
        </div>
      ) : null}

      {/* Una card por fila en mobile: estas cards traen HP, EXP, pestañas y
          movimientos, y a 3 columnas en 375px quedaban ilegibles y encimadas.
          Recién desde sm entran dos, y las 6 en una fila desde xl. */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {slots.map((instance, i) => {
          const isOver = overSlot === i && dragId !== null;
          const isDragging = instance !== null && dragId === instance.id;

          return (
            <div
              key={instance?.id ?? `empty-${i}`}
              onDragOver={(e) => {
                e.preventDefault();
                setOverSlot(i);
              }}
              onDragLeave={() => setOverSlot((s) => (s === i ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                dropOnSlot(i);
                setDragId(null);
                setOverSlot(null);
              }}
              className={[
                "h-full min-h-[300px] rounded-2xl transition-all sm:min-h-[340px]",
                isOver ? "ring-2 ring-pokeball-red/55 ring-offset-2 ring-offset-background" : "",
                isDragging ? "opacity-45" : "",
              ].join(" ")}
            >
              {instance ? (
                <div
                  draggable={!pending}
                  onDragStart={(e) => {
                    const target = e.target as HTMLElement;
                    if (target.closest("button,[role='menu'],a[role='menuitem']")) {
                      e.preventDefault();
                      return;
                    }
                    didDragRef.current = true;
                    setDragId(instance.id);
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", instance.id);
                  }}
                  onDragEnd={() => {
                    setDragId(null);
                    setOverSlot(null);
                    requestAnimationFrame(() => {
                      requestAnimationFrame(() => {
                        didDragRef.current = false;
                      });
                    });
                  }}
                  className="h-full cursor-grab active:cursor-grabbing"
                >
                  <HomeSquadCard
                    instanceId={instance.id}
                    isLead={i === 0}
                    isFavorite={instance.isFavorite}
                    isTradeLocked={instance.isTradeLocked}
                    nickname={instance.nickname}
                    speciesName={instance.speciesName}
                    types={instance.types}
                    spriteUrl={instance.spriteUrl}
                    currentHp={instance.currentHp}
                    maxHp={instance.maxHp}
                    level={instance.level}
                    xpPct={instance.xpPct}
                    atk={instance.atk}
                    def={instance.def}
                    spAtk={instance.spAtk}
                    spDef={instance.spDef}
                    speed={instance.speed}
                    evolutionChain={instance.evolutionChain}
                    ownedEvolutionItems={instance.ownedEvolutionItems}
                    moves={instance.moves}
                    labels={{
                      ...instance.labels,
                      level: instance.levelLabel,
                      lead: leadLabel,
                      slot: slotLabels[i] ?? String(i + 1),
                    }}
                    menuLabels={instance.menuLabels}
                    bagCounts={bagCounts}
                    onBagChange={setBagCounts}
                    onHealed={({ currentHp, maxHp }) =>
                      applyHeal(instance.id, currentHp, maxHp)
                    }
                    onLeveledUp={({ level, currentHp, maxHp, levelLabel }) =>
                      applyLevelUp(instance.id, { level, currentHp, maxHp, levelLabel })
                    }
                    onPpRestored={(next) => applyPpRestore(instance.id, next)}
                    onCardClick={(e) => {
                      if (didDragRef.current) {
                        e.preventDefault();
                        e.stopPropagation();
                      }
                    }}
                  />
                </div>
              ) : (
                <div className="h-full">
                  <HomeEmptySquadSlot label={emptySlotLabel} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
