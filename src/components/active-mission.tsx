import { Link } from "@/i18n/navigation";

export type ActiveMissionProps = {
  heading: string;
  title: string;
  description: string;
  progressLabel: string;
  progressPercent: number;
  stagesLabel: string;
  stagesDone: number;
  stagesTotal: number;
  ctaHref: string;
  ctaLabel: string;
};

export function ActiveMission({
  heading,
  title,
  description,
  progressLabel,
  progressPercent,
  stagesLabel,
  stagesDone,
  stagesTotal,
  ctaHref,
  ctaLabel,
}: ActiveMissionProps) {
  const segmentCount = Math.max(1, Math.min(stagesTotal || 1, 12));

  return (
    <section className="glass-panel flex h-full min-h-[168px] flex-col rounded-2xl border border-white/10 p-3.5 shadow-lg sm:p-4 lg:min-h-[220px]">
      <div className="flex items-center gap-2 border-b border-white/10 pb-2">
        <span className="material-symbols-outlined text-[18px]! text-pokeball-red">assignment</span>
        <h2 className="text-[13px] font-bold uppercase tracking-[0.14em] text-on-surface-variant lg:text-label-sm">
          {heading}
        </h2>
      </div>

      <h3 className="mt-2.5 text-[15px] font-semibold leading-snug text-white lg:text-body-md">
        {title}
      </h3>
      <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-on-surface-variant lg:text-label-md">
        {description}
      </p>

      <div className="mt-auto space-y-2 pt-3">
        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-[11px] text-on-surface-variant lg:text-label-sm">{progressLabel}</span>
            <span className="font-mono text-[11px] text-electric-yellow lg:text-label-sm">
              {progressPercent}%
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-electric-yellow/70 to-electric-yellow"
              style={{ width: `${Math.max(0, Math.min(100, progressPercent))}%` }}
            />
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-[11px] text-on-surface-variant lg:text-label-sm">{stagesLabel}</span>
            <span className="font-mono text-[11px] text-on-surface lg:text-label-sm">
              {stagesDone} / {stagesTotal}
            </span>
          </div>
          <div className="flex gap-1">
            {Array.from({ length: segmentCount }, (_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-sm ${
                  i < stagesDone ? "bg-pokeball-red shadow-[0_0_8px_rgba(238,21,21,0.45)]" : "bg-white/10"
                }`}
              />
            ))}
          </div>
        </div>

        <Link
          href={ctaHref}
          className="flex w-full items-center justify-center gap-1 rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-[12px] text-on-surface transition-colors hover:bg-white/10 lg:text-label-sm"
        >
          {ctaLabel}
          <span className="material-symbols-outlined text-[16px]!">chevron_right</span>
        </Link>
      </div>
    </section>
  );
}
