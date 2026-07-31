"use client";

import * as Select from "@radix-ui/react-select";
import { Link, useRouter } from "@/i18n/navigation";
import { FlagIcon } from "@/components/flag-icon";
import {
  rankingHref,
  type RankingCategory,
  type RankingScope,
} from "@/lib/ranking";

/**
 * Scope del ranking: Global · País (select de países con perfiles) · Amigos.
 * El filtro de país es el slot que ya existía — no un control aparte.
 * Por defecto muestra el país de la cuenta (bandera + nombre), no "Mi país".
 */
export function RankingScopeFilter({
  category,
  scope,
  selectedCountry,
  accountCountry,
  countries,
  labels,
}: {
  category: RankingCategory;
  scope: RankingScope;
  selectedCountry?: string;
  /** País del perfil logueado; se usa como valor por defecto del select. */
  accountCountry?: string;
  countries: { code: string; name: string }[];
  labels: {
    global: string;
    country: string;
    friends: string;
    friendsSoon: string;
  };
}) {
  const router = useRouter();
  const countryActive = scope === "country" && Boolean(selectedCountry);

  const displayCode =
    (countryActive ? selectedCountry : undefined) ||
    accountCountry ||
    countries[0]?.code;
  const displayCountry = countries.find((c) => c.code === displayCode);

  return (
    <div className="rk-scopes" role="group" aria-label="Ranking scope">
      <Link
        href={rankingHref(category, "global")}
        className={`rk-scopes__btn ${scope === "global" ? "rk-scopes__btn--active" : ""}`}
        aria-current={scope === "global" ? "page" : undefined}
      >
        {labels.global}
      </Link>

      {countries.length > 0 && displayCountry ? (
        <Select.Root
          value={countryActive && selectedCountry ? selectedCountry : undefined}
          onValueChange={(next) => {
            router.push(rankingHref(category, "country", next));
          }}
        >
          <Select.Trigger
            className={`rk-scopes__btn rk-scopes__country ${countryActive ? "rk-scopes__btn--active" : ""}`}
            aria-label={labels.country}
          >
            <span className="rk-scopes__country-option">
              <FlagIcon
                code={displayCountry.code}
                className="h-2.5 w-auto shrink-0 rounded-[1px]"
              />
              {displayCountry.name}
            </span>
            <Select.Icon className="rk-scopes__country-chevron" aria-hidden>
              <svg viewBox="0 0 24 24" focusable="false">
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
            <Select.Content
              className="rk-select__content rk-scopes__country-content"
              position="popper"
              sideOffset={8}
              align="center"
            >
              <Select.Viewport className="rk-select__viewport">
                {countries.map((c) => (
                  <Select.Item
                    key={c.code}
                    value={c.code}
                    className="rk-select__item"
                  >
                    <Select.ItemText>
                      <span className="rk-scopes__country-option">
                        <FlagIcon
                          code={c.code}
                          className="h-2.5 w-auto shrink-0 rounded-[1px]"
                        />
                        {c.name}
                      </span>
                    </Select.ItemText>
                    <Select.ItemIndicator className="rk-select__tick">
                      <CheckIcon />
                    </Select.ItemIndicator>
                  </Select.Item>
                ))}
              </Select.Viewport>
            </Select.Content>
          </Select.Portal>
        </Select.Root>
      ) : null}

      <span
        className="rk-scopes__btn rk-scopes__btn--disabled"
        title={labels.friendsSoon}
        aria-disabled
      >
        {labels.friends}
      </span>
    </div>
  );
}

function CheckIcon() {
  return (
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
  );
}
