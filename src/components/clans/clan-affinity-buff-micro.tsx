"use client";

import { getAffinityBuff, type AffinityBuff } from "@/lib/clan-affinity-buff";
import type { ClanAffinity } from "@/lib/clan-types";

export function ClanAffinityBuffMicro({
  affinity,
  label,
  hint,
}: {
  affinity: ClanAffinity;
  label: string;
  hint: string;
}) {
  const buff = getAffinityBuff(affinity);
  return <AffinityBuffMicro buff={buff} label={label} hint={hint} />;
}

function AffinityBuffMicro({
  buff,
  label,
  hint,
}: {
  buff: AffinityBuff;
  label: string;
  hint: string;
}) {
  return (
    <span
      className="group/metric relative inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-black/25 px-1.5 py-1"
      title={hint}
    >
      <span className="material-symbols-outlined text-[12px]! text-on-surface-variant">
        show_chart
      </span>
      <span className="hidden text-[9px] font-bold uppercase tracking-wide text-on-surface-variant md:inline">
        {label}
      </span>
      <span className="text-[10px] font-semibold text-on-surface">
        {buff.leftLabel}+{buff.leftValue}%
      </span>
      <span className="h-4 w-6">
        <svg viewBox="0 0 24 16" className="h-4 w-6" aria-hidden>
          <rect
            x="2"
            y={14 - buff.leftValue * 3}
            width="6"
            height={buff.leftValue * 3}
            rx="1"
            fill="currentColor"
            className="text-tertiary"
          />
          <rect
            x="10"
            y={14 - buff.rightValue * 3}
            width="6"
            height={buff.rightValue * 3}
            rx="1"
            fill="currentColor"
            className="text-tertiary/70"
          />
        </svg>
      </span>
      <span className="text-[10px] font-semibold text-on-surface">
        {buff.rightLabel}+{buff.rightValue}%
      </span>
      <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-white/10 bg-[#11151f] px-2 py-1 text-[10px] font-medium text-on-surface shadow-lg group-hover/metric:block group-focus-within/metric:block">
        {hint}
      </span>
    </span>
  );
}
