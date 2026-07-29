import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { FlagIcon } from "@/components/flag-icon";
import { rankingHref, type RankingCategory, type RankingScope } from "@/lib/ranking";

export function RankingScopeFilter({
  category,
  scope,
  countryCode,
  countryName,
  labels,
}: {
  category: RankingCategory;
  scope: RankingScope;
  countryCode?: string;
  countryName?: string;
  labels: {
    global: string;
    myCountry: string;
    friends: string;
    friendsSoon: string;
  };
}) {
  const item = (
    href: string,
    active: boolean,
    content: ReactNode,
    opts?: { disabled?: boolean; title?: string },
  ) => {
    if (opts?.disabled) {
      return (
        <span className="rk-scopes__btn rk-scopes__btn--disabled" title={opts.title} aria-disabled>
          {content}
        </span>
      );
    }
    return (
      <Link
        href={href}
        className={`rk-scopes__btn ${active ? "rk-scopes__btn--active" : ""}`}
        aria-current={active ? "page" : undefined}
      >
        {content}
      </Link>
    );
  };

  return (
    <div className="rk-scopes" role="group" aria-label="Ranking scope">
      {item(rankingHref(category, "global"), scope === "global", labels.global)}
      {countryCode
        ? item(
            rankingHref(category, "country", countryCode),
            scope === "country",
            <>
              <FlagIcon code={countryCode} className="h-2.5 w-auto rounded-[1px]" />
              <span className="truncate">{countryName ?? labels.myCountry}</span>
            </>,
          )
        : null}
      {item("#", false, labels.friends, {
        disabled: true,
        title: labels.friendsSoon,
      })}
    </div>
  );
}
