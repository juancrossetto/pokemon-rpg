import Image from "next/image";
import type { CSSProperties } from "react";
import type { TimelineEvent, TimelineKind } from "@/lib/trainer-profile";

export type TimelineLabels = {
  empty: string;
  kind: Record<TimelineKind, string>;
  agoMinutes: string;
  agoHours: string;
  agoDays: string;
  justNow: string;
};

const KIND_ICON: Record<TimelineKind, string> = {
  catch: "sports_baseball",
  badge: "military_tech",
  trainer: "swords",
  shiny: "auto_awesome",
};

const KIND_COLOR: Record<TimelineKind, string> = {
  catch: "#4ade80",
  badge: "#ee1515",
  trainer: "#60a5fa",
  shiny: "#f2c000",
};

export function relativeTime(at: Date, now: Date, labels: TimelineLabels): string {
  const diffMs = Math.max(0, now.getTime() - at.getTime());
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return labels.justNow;
  if (minutes < 60) return labels.agoMinutes.replace("{n}", String(minutes));
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return labels.agoHours.replace("{n}", String(hours));
  return labels.agoDays.replace("{n}", String(Math.floor(hours / 24)));
}

/**
 * Timeline de actividad: riel vertical + nodos iluminados.
 */
export function TrainerTimeline({
  events,
  now,
  labels,
}: {
  events: TimelineEvent[];
  now: Date;
  labels: TimelineLabels;
}) {
  if (events.length === 0) {
    return (
      <p className="py-6 text-center text-[11px] text-on-surface-variant/60">
        {labels.empty}
      </p>
    );
  }

  return (
    <ol className="relative flex flex-col gap-0.5 pl-1">
      <span
        aria-hidden
        className="absolute bottom-4 left-[18px] top-4 w-px bg-gradient-to-b from-transparent via-white/20 to-transparent"
      />

      {events.map((event, i) => {
        const color = event.accent ?? KIND_COLOR[event.kind];
        return (
          <li
            key={event.id}
            className="tp-rise relative flex items-start gap-3 py-2"
            style={{ animationDelay: `${i * 45}ms` } as CSSProperties}
          >
            <span
              className="relative z-[1] mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-[#0b0d12]"
              style={{
                borderColor: `${color}77`,
                boxShadow: `0 0 14px ${color}44, inset 0 0 8px ${color}22`,
              }}
            >
              {event.spriteUrl ? (
                <Image
                  src={event.spriteUrl}
                  alt=""
                  width={28}
                  height={28}
                  unoptimized
                  className="h-7 w-7 object-contain"
                />
              ) : (
                <span
                  className="material-symbols-outlined text-[16px]!"
                  style={{ color }}
                >
                  {KIND_ICON[event.kind]}
                </span>
              )}
            </span>

            <div className="min-w-0 flex-1 rounded-lg border border-white/[0.05] bg-white/[0.02] px-2.5 py-1.5">
              <p className="truncate text-[12px] leading-tight">
                <span
                  className="text-[9px] font-bold uppercase tracking-[0.12em]"
                  style={{ color }}
                >
                  {labels.kind[event.kind]}
                </span>
                <span className="mx-1 text-white/20">·</span>
                <span className="font-semibold capitalize text-white">{event.label}</span>
              </p>
              <p className="mt-0.5 text-[9px] text-on-surface-variant/50">
                {relativeTime(event.at, now, labels)}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
