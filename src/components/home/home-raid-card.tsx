"use client";

import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { PokemonImage } from "@/components/pokemon-image";

/**
 * Card de incursión del home.
 *
 * En desktop ocupa la columna del rail; en mobile no se monta visualmente para
 * evitar sumar otra card al home. Sólo lleva lo que decide si vale la pena
 * entrar: jefe, intentos y progreso global. El resto vive en /raids.
 */
export function HomeRaidCard({
  boss,
}: {
  boss: {
    speciesId: number;
    name: string;
    spriteUrl: string;
    level: number;
    accent: string;
    attemptsLeft: number;
    attemptsTotal: number;
    communityPercent: number;
    communityDefeated: boolean;
  };
}) {
  const t = useTranslations("raids");
  const available = boss.attemptsLeft > 0;

  return (
    <Link
      href="/raids"
      className={`home-raid${available ? " is-available" : ""}${
        boss.communityDefeated ? " is-defeated" : ""
      }`}
      style={{ "--raid-accent": boss.accent } as CSSProperties}
    >
      <span className="home-raid__beam" aria-hidden />
      <span className="home-raid__head">
        <span className="home-raid__eyebrow">{t("eyebrow")}</span>
        <span className="home-raid__badge">
          <span className="material-symbols-outlined" aria-hidden>
            swords
          </span>
          {boss.attemptsLeft}/{boss.attemptsTotal}
        </span>
      </span>

      <span className="home-raid__body">
        <span className="home-raid__art">
          <span className="home-raid__aura" aria-hidden />
          <PokemonImage
            src={boss.spriteUrl}
            speciesId={boss.speciesId}
            speciesName={boss.name}
            alt={boss.name}
            width={160}
            height={160}
            className="home-raid__sprite"
          />
        </span>

        <span className="home-raid__info">
          <span className="home-raid__name">
            {boss.name}
            <span className="home-raid__level">Lv. {boss.level}</span>
          </span>

          <span className="home-raid__progress-copy">
            {boss.communityDefeated
              ? t("homeCardDefeated")
              : t("communityProgress", { percent: boss.communityPercent })}
          </span>
          <span
            className="home-raid__bar"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={boss.communityPercent}
          >
            <span className="home-raid__fill" style={{ width: `${boss.communityPercent}%` }} />
          </span>

          <span className="home-raid__cta">
            {available ? t("homeCardEnter") : t("homeCardNoAttempts")}
            <span className="material-symbols-outlined" aria-hidden>
              arrow_forward
            </span>
          </span>
        </span>
      </span>
    </Link>
  );
}
