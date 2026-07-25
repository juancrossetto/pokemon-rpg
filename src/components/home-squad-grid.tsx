"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { setTeamLayout } from "@/actions/pc";
import {
  HomeEmptySquadSlot,
  HomeSquadCard,
  type HomeSquadCardLabels,
} from "@/components/home-squad-card";
import type { SquadContextLabels } from "@/components/squad-card-context-menu";

export type HomeSquadMember = {
  id: string;
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
}: {
  locale: string;
  initialMembers: HomeSquadMember[];
  emptySlotLabel: string;
  leadLabel: string;
  /** Labels ya resueltos en el server (no se pueden pasar funciones a client). */
  slotLabels: string[];
}) {
  const t = useTranslations("pc");
  const [members, setMembers] = useState(initialMembers);
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

  return (
    <div className={pending ? "opacity-90 transition-opacity" : undefined}>
      {error ? (
        <div className="mb-2 rounded-lg border border-error/40 bg-error-container/30 px-3 py-1.5 text-label-sm text-error">
          {t(`errors.${error}`)}
        </div>
      ) : null}

      <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
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
                "rounded-2xl transition-all",
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
                    xpPct={instance.xpPct}
                    xpToNextLabel={instance.xpToNextLabel}
                    labels={{
                      ...instance.labels,
                      level: instance.levelLabel,
                      lead: leadLabel,
                      slot: slotLabels[i] ?? String(i + 1),
                    }}
                    menuLabels={instance.menuLabels}
                    onHealed={({ currentHp, maxHp }) =>
                      applyHeal(instance.id, currentHp, maxHp)
                    }
                    onCardClick={(e) => {
                      if (didDragRef.current) {
                        e.preventDefault();
                        e.stopPropagation();
                      }
                    }}
                  />
                </div>
              ) : (
                <HomeEmptySquadSlot label={emptySlotLabel} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
