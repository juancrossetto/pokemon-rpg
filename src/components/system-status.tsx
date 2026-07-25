"use client";

import { useEffect, useState } from "react";

export function SystemStatus({
  timeLabel,
  climateLabel,
  climateValue,
  climateIcon,
}: {
  timeLabel: string;
  climateLabel: string;
  climateValue: string;
  climateIcon: string;
}) {
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    const tick = () =>
      setTime(
        new Date().toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }),
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex items-stretch divide-x divide-white/10 rounded-lg border border-white/10 bg-surface-container-low/60">
      <div className="px-4 py-1.5 text-right">
        <p className="text-[10px] uppercase tracking-wider text-on-surface-variant/70">
          {timeLabel}
        </p>
        <p className="font-mono text-[13px] tabular-nums text-white">{time ?? "--:--:--"}</p>
      </div>
      <div className="px-4 py-1.5 text-right">
        <p className="text-[10px] uppercase tracking-wider text-on-surface-variant/70">
          {climateLabel}
        </p>
        <p className="flex items-center justify-end gap-1 text-[13px] font-medium text-white">
          <span className="material-symbols-outlined text-[14px] text-sky-300">{climateIcon}</span>
          {climateValue}
        </p>
      </div>
    </div>
  );
}
