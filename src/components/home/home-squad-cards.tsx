"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ShinyMark } from "@/components/shiny-mark";
import { PokeSparks } from "@/components/poke-sparks";
import { SegmentedStatBar, hpBarVariant } from "@/components/segmented-stat-bar";
import { showdownTypeSymbolUrl } from "@/lib/type-icons";
import { typeColor } from "@/lib/type-colors";
import { calculateMaxHp, calculateStat } from "@/lib/stats";
import type { HomeSquadMember } from "@/components/home/squad-types";
import type { CSSProperties } from "react";

/**
 * Poder del Pokémon. Misma fórmula que `pokemonPower` de `@/lib/ranking`,
 * recalculada acá porque el miembro ya viaja con bases, puntos y nivel: pedir
 * el número al server sería un campo más en un payload que ya lo contiene.
 */
function memberPower(m: HomeSquadMember): number {
  const b = m.bases;
  const p = m.points;
  return (
    calculateMaxHp(b.baseHp, m.level, p.ptConstitution) +
    calculateStat(b.baseAttack, p.ptStrength, m.level) +
    calculateStat(b.baseDefense, p.ptDexterity, m.level) +
    calculateStat(b.baseSpAtk, p.ptIntelligence, m.level) +
    calculateStat(b.baseSpDef, p.ptIntelligence, m.level) +
    calculateStat(b.baseSpeed, p.ptSpeed, m.level)
  );
}

/** Familia visual para partículas del fondo (agua flota, planta cae, etc.). */
function typeFamily(type: string): string {
  const t = type.toLowerCase();
  if (t === "water" || t === "ice") return "water";
  if (t === "grass" || t === "bug") return "grass";
  if (t === "fire") return "fire";
  if (t === "fighting") return "fighting";
  if (t === "dragon") return "dragon";
  if (t === "electric" || t === "psychic" || t === "fairy") return t;
  if (t === "poison" || t === "ghost" || t === "dark") return t;
  return "normal";
}

/**
 * Equipo activo en mobile: carrusel de cards con el color del tipo y el PC
 * de cada Pokémon. **Sólo mobile** (`lg:hidden`); en desktop sigue
 * `ActiveTeamStrip`, que tiene el detalle expandible y las acciones.
 *
 * Acá el criterio es de vitrina: se ve el equipo de un vistazo y se toca para
 * ir a la ficha. Nada de menús contextuales — eso vive en `/team`.
 */
export function HomeSquadCards({
  members,
  title,
  manageHref,
  manageLabel,
  leadLabel,
}: {
  members: HomeSquadMember[];
  title: string;
  manageHref: string;
  manageLabel: string;
  leadLabel: string;
}) {
  const t = useTranslations("home.hub.identity");
  if (members.length === 0) return null;

  const totalPower = members.reduce((sum, m) => sum + memberPower(m), 0);

  return (
    <section className="squad-cards lg:hidden">
      <header className="squad-cards__head">
        <h2 className="squad-cards__title">{title}</h2>
        <span className="squad-cards__power">
          <span className="squad-cards__power-key">{t("combatPower")}</span>
          <span className="squad-cards__power-val">{totalPower.toLocaleString()}</span>
        </span>
        <Link href={manageHref} className="squad-cards__manage">
          {manageLabel}
        </Link>
      </header>

      <ul className="squad-cards__rail">
        {members.map((m, index) => {
          const primaryType = m.types[0] ?? "normal";
          const accent = typeColor(primaryType);
          const power = memberPower(m);
          const hpPct =
            m.maxHp > 0 ? Math.max(0, Math.min(100, (m.currentHp / m.maxHp) * 100)) : 0;
          const fainted = m.currentHp <= 0;

          return (
            <li key={m.id} className="squad-cards__item">
              <Link
                href={`/team?focus=${m.id}`}
                className={`squad-card${fainted ? " squad-card--fainted" : ""}`}
                data-type-family={typeFamily(primaryType)}
                style={{ "--card-accent": accent } as CSSProperties}
              >
                <span className="squad-card__fx" aria-hidden>
                  <span className="squad-card__fx-dot" />
                  <span className="squad-card__fx-dot" />
                  <span className="squad-card__fx-dot" />
                  <span className="squad-card__fx-dot" />
                  <span className="squad-card__fx-dot" />
                  <span className="squad-card__fx-dot" />
                </span>

                <span className="squad-card__badges">
                  <span className="squad-card__badge squad-card__badge--level">
                    {m.levelLabel}
                  </span>
                  {index === 0 ? (
                    <span className="squad-card__badge squad-card__badge--lead">
                      {leadLabel}
                    </span>
                  ) : null}
                </span>

                <span className="squad-card__art">
                  <span className="squad-card__pool" aria-hidden />
                  <PokeSparks seed={m.id} accent={accent} />
                  <span className="squad-card__shadow" aria-hidden />
                  <Image
                    src={m.spriteUrl}
                    alt=""
                    width={140}
                    height={140}
                    className="squad-card__sprite"
                    unoptimized
                  />
                </span>

                <span className="squad-card__hp">
                  <SegmentedStatBar
                    pct={hpPct}
                    variant={hpBarVariant(hpPct)}
                    segments={8}
                    heightClass="h-1.5"
                  />
                </span>

                <span className="squad-card__foot">
                  <span className="squad-card__name">{m.nickname ?? m.speciesName}</span>
                  <span className="squad-card__meta">
                    <Image
                      src={showdownTypeSymbolUrl(primaryType)}
                      alt=""
                      width={14}
                      height={14}
                      className="squad-card__type"
                      unoptimized
                    />
                    <span className="squad-card__cp">{power.toLocaleString()}</span>
                    {m.isShiny ? (
                      <ShinyMark className="squad-card__flag" title="" />
                    ) : null}
                    {m.isFavorite ? (
                      <span className="material-symbols-outlined ms-fill squad-card__flag squad-card__flag--fav">
                        star
                      </span>
                    ) : null}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
