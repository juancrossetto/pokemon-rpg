import { Link } from "@/i18n/navigation";

export function RankingEmptyState({
  icon,
  title,
  body,
  ctaHref,
  ctaLabel,
}: {
  icon: string;
  title: string;
  body?: string;
  ctaHref?: string;
  ctaLabel?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/12 px-5 py-12 text-center text-on-surface-variant">
      <span className="material-symbols-outlined text-[32px]! opacity-50">{icon}</span>
      <h2 className="text-label-lg font-semibold text-white">{title}</h2>
      {body ? <p className="max-w-md text-label-sm text-on-surface-variant">{body}</p> : null}
      {ctaHref && ctaLabel ? (
        <Link
          href={ctaHref}
          className="mt-2 rounded-md border border-white/20 bg-white/[0.07] px-4 py-2 text-label-sm font-semibold text-white transition hover:border-white/35 hover:bg-white/[0.12]"
        >
          {ctaLabel}
        </Link>
      ) : null}
    </div>
  );
}

export function RankedComingSoon({
  title,
  eyebrow,
  body,
  detail,
}: {
  title: string;
  eyebrow: string;
  body: string;
  detail: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-violet-400/20 bg-gradient-to-b from-violet-500/10 to-black/40 px-5 py-14 text-center">
      <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-violet-200/70">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-headline-sm text-white">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-label-md text-on-surface-variant">{body}</p>
      <p className="mx-auto mt-3 max-w-sm text-[12px] leading-relaxed text-on-surface-variant/70">
        {detail}
      </p>
    </div>
  );
}
