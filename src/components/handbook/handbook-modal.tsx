"use client";

import Image from "next/image";
import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { HANDBOOK_CHAPTER_META } from "@/lib/handbook/chapters";
import {
  closeHandbook,
  setHandbookChapter,
  useHandbookState,
} from "@/lib/handbook/open";
import { PVP_TIERS, tierBadgeSrc, type PvpTier } from "@/lib/pvp/tiers";
import { lockBodyScroll } from "@/lib/scroll-lock";

type Section =
  | { kind?: "prose"; heading: string; body: string }
  | { kind?: "prose"; heading: string; body: string; bullets: string[] }
  | {
      kind: "table";
      heading: string;
      caption?: string;
      columns: string[];
      rows: string[][];
    }
  | { kind: "rankBadges"; heading: string; body?: string; caption?: string };

type ChapterContent = {
  title: string;
  lead: string;
  sections: Section[];
};

/**
 * Manual del entrenador — sheet de lectura, no una ruta más del menú.
 * Un solo host en el chrome; se abre con el ícono o desde ayudas de hub.
 */
export function HandbookModal() {
  const t = useTranslations("handbook");
  const { open, chapter } = useHandbookState();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    openerRef.current = document.activeElement as HTMLElement | null;
    const releaseScroll = lockBodyScroll();

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeHandbook();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    requestAnimationFrame(() => {
      panelRef.current?.querySelector<HTMLElement>("button, [tabindex]")?.focus();
    });

    return () => {
      document.removeEventListener("keydown", onKey);
      releaseScroll();
      openerRef.current?.focus?.();
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  const content = t.raw(`chapters.${chapter}`) as ChapterContent;
  const sections = Array.isArray(content?.sections) ? content.sections : [];

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
        aria-label={t("close")}
        onClick={closeHandbook}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="handbook-sheet relative z-10 flex h-[min(92dvh,52rem)] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-white/12 bg-[#12100e] shadow-[0_-12px_48px_rgba(0,0,0,0.55)] sm:rounded-2xl"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(242,192,0,0.12),_transparent_55%),radial-gradient(ellipse_at_bottom_right,_rgba(238,21,21,0.1),_transparent_50%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />

        <header className="relative shrink-0 border-b border-white/10 px-4 pb-3 pt-4 sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-electric-yellow/90">
                {t("eyebrow")}
              </p>
              <h2
                id={titleId}
                className="page-title mt-1 text-[1.75rem] leading-none tracking-wide text-on-surface sm:text-[2rem]"
              >
                {t("title")}
              </h2>
              <p className="mt-2 max-w-prose text-label-sm text-on-surface-variant">
                {t("subtitle")}
              </p>
            </div>
            <button
              type="button"
              onClick={closeHandbook}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-on-surface-variant transition hover:bg-white/10 hover:text-on-surface"
              aria-label={t("close")}
            >
              <span className="material-symbols-outlined text-[20px]!">close</span>
            </button>
          </div>

          <nav
            aria-label={t("toc")}
            className="mt-4 -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {HANDBOOK_CHAPTER_META.map((meta) => {
              const active = meta.id === chapter;
              return (
                <button
                  key={meta.id}
                  type="button"
                  onClick={() => setHandbookChapter(meta.id)}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-label-sm font-semibold transition ${
                    active
                      ? "border-electric-yellow/50 bg-electric-yellow/15 text-electric-yellow"
                      : "border-white/10 bg-white/[0.03] text-on-surface-variant hover:border-white/20 hover:text-on-surface"
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]!">{meta.icon}</span>
                  {t(`nav.${meta.id}`)}
                </button>
              );
            })}
          </nav>
        </header>

        <div className="relative min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          <article className="mx-auto max-w-prose">
            <h3 className="page-title text-[1.45rem] leading-tight text-on-surface">
              {content?.title}
            </h3>
            <p className="mt-2 text-[0.95rem] leading-relaxed text-on-surface-variant">
              {content?.lead}
            </p>

            <div className="mt-6 space-y-7">
              {sections.map((section, index) => (
                <HandbookSection key={`${chapter}-${index}`} section={section} />
              ))}
            </div>
          </article>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function HandbookSection({ section }: { section: Section }) {
  const tPvp = useTranslations("pvp");
  const isTable = section.kind === "table" && Array.isArray(section.columns);
  const isRankBadges = section.kind === "rankBadges";

  return (
    <section>
      <h4 className="text-label-md font-bold tracking-wide text-on-surface">
        {section.heading}
      </h4>
      {"body" in section && section.body ? (
        <p className="mt-1.5 text-[0.92rem] leading-relaxed text-on-surface-variant">
          {section.body}
        </p>
      ) : null}
      {"bullets" in section && Array.isArray(section.bullets) && section.bullets.length > 0 ? (
        <ul className="mt-2 space-y-1.5 text-[0.92rem] leading-relaxed text-on-surface-variant">
          {section.bullets.map((item) => (
            <li key={item} className="flex gap-2">
              <span className="mt-[0.55em] h-1.5 w-1.5 shrink-0 rounded-full bg-pokeball-red" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {isRankBadges ? (
        <div className="mt-3">
          {"caption" in section && section.caption ? (
            <p className="mb-3 text-[11px] text-on-surface-variant">{section.caption}</p>
          ) : null}
          <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {PVP_TIERS.map((tier) => {
              const label = tPvp(`tiers.${tier.id}` as `tiers.${PvpTier}`);
              const mult = Number.isInteger(tier.coinMult)
                ? `×${tier.coinMult}`
                : `×${String(tier.coinMult).replace(".", ",")}`;
              return (
                <li
                  key={tier.id}
                  className="flex flex-col items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-2 py-3 text-center"
                >
                  <Image
                    src={tierBadgeSrc(tier.id)}
                    alt={label}
                    width={72}
                    height={72}
                    className="h-16 w-16 object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.4)]"
                    unoptimized
                  />
                  <span className="text-[11px] font-bold leading-tight text-on-surface">
                    {label}
                  </span>
                  <span className="font-mono text-[10px] text-on-surface-variant">
                    {tier.minRating}+ · {mult}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
      {isTable ? (
        <div className="mt-3 overflow-x-auto rounded-xl border border-white/10">
          {"caption" in section && section.caption ? (
            <p className="border-b border-white/10 px-3 py-2 text-[11px] text-on-surface-variant">
              {section.caption}
            </p>
          ) : null}
          <table className="w-full min-w-[18rem] border-collapse text-left text-label-sm">
            <thead>
              <tr className="bg-white/[0.04] text-on-surface">
                {section.columns.map((col) => (
                  <th key={col} className="px-3 py-2 font-semibold">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section.rows.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className="border-t border-white/8 text-on-surface-variant"
                >
                  {row.map((cell, cellIndex) => (
                    <td
                      key={`${rowIndex}-${cellIndex}`}
                      className={`px-3 py-2 ${cellIndex === 0 ? "font-medium text-on-surface" : ""}`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

/** Host invisible: monta el portal una sola vez en el chrome. */
export function HandbookHost() {
  return <HandbookModal />;
}
