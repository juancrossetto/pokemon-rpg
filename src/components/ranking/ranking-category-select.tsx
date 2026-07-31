"use client";

import * as Select from "@radix-ui/react-select";
import { useRouter } from "@/i18n/navigation";
import {
  RANKING_CATEGORIES,
  rankingHref,
  type RankingCategory,
  type RankingScope,
} from "@/lib/ranking";

/**
 * Selector de categoría del ranking. Radix da el comportamiento accesible
 * (teclado, foco, ARIA) y expone `data-state` en el panel, así que la animación
 * de apertura se resuelve con `@keyframes` en globals.css — sin librería de
 * animación extra.
 */
export function RankingCategorySelect({
  category,
  scope,
  countryCode,
  ariaLabel,
  labels,
}: {
  category: RankingCategory;
  scope: RankingScope;
  countryCode?: string;
  ariaLabel: string;
  labels: Record<RankingCategory, { title: string; blurb: string }>;
}) {
  const router = useRouter();

  return (
    <Select.Root
      value={category}
      onValueChange={(next) =>
        router.push(rankingHref(next as RankingCategory, scope, countryCode))
      }
    >
      <Select.Trigger className="rk-select__trigger" aria-label={ariaLabel}>
        <Select.Value />
        <Select.Icon className="rk-select__chevron">
          <svg viewBox="0 0 24 24" aria-hidden focusable="false">
            <path
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m6 9 6 6 6-6"
            />
          </svg>
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Content className="rk-select__content" position="popper" sideOffset={8}>
          <Select.Viewport className="rk-select__viewport">
            {RANKING_CATEGORIES.map((id) => (
              <Select.Item key={id} value={id} className="rk-select__item">
                <Select.ItemText>{labels[id].title}</Select.ItemText>
                <Select.ItemIndicator className="rk-select__tick">
                  <svg viewBox="0 0 24 24" aria-hidden focusable="false">
                    <path
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m5 13 4 4L19 7"
                    />
                  </svg>
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
