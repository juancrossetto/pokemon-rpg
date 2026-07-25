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
    <section className="glass-panel flex min-h-[230px] flex-col rounded-xl border border-white/10 p-4 shadow-lg md:min-h-[260px]">
      <div className="flex items-center gap-2 border-b border-white/10 pb-2">
        <span className="material-symbols-outlined text-[20px]! text-pokeball-red">assignment</span>
        <h2 className="text-headline-md text-white">{heading}</h2>
      </div>

      <h3 className="mt-2.5 text-body-md font-semibold leading-snug text-white">{title}</h3>
      <p className="mt-1 line-clamp-3 text-label-md leading-relaxed text-on-surface-variant">
        {description}
      </p>

      <div className="mt-auto space-y-2.5 pt-3">
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-label-sm text-on-surface-variant">{progressLabel}</span>
            <span className="font-mono text-label-sm text-electric-yellow">{progressPercent}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-electric-yellow/70 to-electric-yellow"
              style={{ width: `${Math.max(0, Math.min(100, progressPercent))}%` }}
            />
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-label-sm text-on-surface-variant">{stagesLabel}</span>
            <span className="font-mono text-label-sm text-on-surface">
              {stagesDone} / {stagesTotal}
            </span>
          </div>
          <div className="flex gap-1">
            {Array.from({ length: segmentCount }, (_, i) => (
              <div
                key={i}
                className={`h-2 flex-1 rounded-sm ${
                  i < stagesDone ? "bg-pokeball-red shadow-[0_0_8px_rgba(238,21,21,0.45)]" : "bg-white/10"
                }`}
              />
            ))}
          </div>
        </div>

        <Link
          href={ctaHref}
          className="flex items-center justify-center gap-1 rounded-lg border border-white/15 bg-white/[0.04] px-4 py-1.5 text-label-sm text-on-surface transition-colors hover:bg-white/10"
        >
          {ctaLabel}
          <span className="material-symbols-outlined text-[16px]!">chevron_right</span>
        </Link>
      </div>
    </section>
  );
}
