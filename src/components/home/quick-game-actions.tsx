"use client";

import { Link } from "@/i18n/navigation";

export type QuickAction = {
  id: string;
  href: string;
  icon: string;
  label: string;
  badge?: number;
  attention?: boolean;
};

export function QuickGameActions({
  title,
  actions,
}: {
  title: string;
  actions: QuickAction[];
}) {
  const visible = actions.slice(0, 4);

  return (
    <section aria-label={title}>
      <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-on-surface-variant">
        {title}
      </h2>
      <div className="grid grid-cols-4 gap-2">
        {visible.map((action) => (
          <Link
            key={action.id}
            href={action.href}
            className={`relative flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2 transition active:scale-[0.97] ${
              action.attention
                ? "quick-action--attention border-tertiary/40 bg-tertiary/10"
                : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
            }`}
          >
            <span
              className={`material-symbols-outlined text-[24px]! ${
                action.attention ? "text-tertiary" : "text-on-surface"
              }`}
            >
              {action.icon}
            </span>
            <span className="truncate text-center text-[11px] font-medium leading-tight text-on-surface">
              {action.label}
            </span>
            {action.badge != null && action.badge > 0 && (
              <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-pokeball-red px-1 text-[10px] font-bold text-white">
                {action.badge > 9 ? "9+" : action.badge}
              </span>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
