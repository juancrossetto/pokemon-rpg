"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { chapterForPath, type HandbookChapterId } from "@/lib/handbook/chapters";
import { openHandbook } from "@/lib/handbook/open";

/** Ícono del manual en el chrome. Abre en el capítulo de la ruta actual si hay uno. */
export function HandbookTrigger({
  chapter,
  className,
}: {
  /** Fuerza un capítulo; si no, se infiere de la ruta. */
  chapter?: HandbookChapterId;
  className?: string;
}) {
  const t = useTranslations("handbook");
  const pathname = usePathname();

  return (
    <button
      type="button"
      onClick={() => openHandbook(chapter ?? chapterForPath(pathname) ?? undefined)}
      className={
        className ??
        "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-on-surface-variant transition hover:border-electric-yellow/40 hover:bg-electric-yellow/10 hover:text-electric-yellow"
      }
      aria-label={t("open")}
      title={t("open")}
    >
      <span className="material-symbols-outlined text-[18px]!">menu_book</span>
    </button>
  );
}

/** Link de texto para paneles de ayuda / CTAs. */
export function HandbookLink({
  chapter,
  className,
  children,
}: {
  chapter?: HandbookChapterId;
  className?: string;
  children?: ReactNode;
}) {
  const t = useTranslations("handbook");
  return (
    <button
      type="button"
      onClick={() => openHandbook(chapter)}
      className={
        className ??
        "inline-flex items-center gap-1.5 text-label-sm font-semibold text-electric-yellow transition hover:underline"
      }
    >
      <span className="material-symbols-outlined text-[16px]!">menu_book</span>
      {children ?? t("readMore")}
    </button>
  );
}
