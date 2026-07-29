import Image from "next/image";
import { Link } from "@/i18n/navigation";
import {
  RANKING_CATEGORIES,
  rankingHref,
  type RankingCategory,
  type RankingScope,
} from "@/lib/ranking";

const CATEGORY_META: Record<RankingCategory, { iconSrc: string }> = {
  combat_power: { iconSrc: "/nav/ranking-icon.png" },
  pvp: { iconSrc: "/nav/pvp-icon.png" },
  ranked: { iconSrc: "/nav/ranking-icon.png" },
};

export function RankingCategoryTabs({
  category,
  scope,
  countryCode,
  labels,
}: {
  category: RankingCategory;
  scope: RankingScope;
  countryCode?: string;
  labels: Record<RankingCategory, { title: string; blurb: string }>;
}) {
  return (
    <nav className="rk-modes" aria-label="Ranking categories">
      {RANKING_CATEGORIES.map((id) => {
        const active = category === id;
        return (
          <Link
            key={id}
            href={rankingHref(id, scope, countryCode)}
            className={`rk-modes__btn ${active ? "rk-modes__btn--active" : ""}`}
            aria-current={active ? "page" : undefined}
            title={labels[id].blurb}
          >
            <Image
              src={CATEGORY_META[id].iconSrc}
              alt=""
              width={22}
              height={22}
              className="rk-modes__icon"
              aria-hidden
            />
            <span className="rk-modes__text">{labels[id].title}</span>
          </Link>
        );
      })}
    </nav>
  );
}
