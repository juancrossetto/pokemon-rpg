import Image from "next/image";
import { FlagIcon } from "@/components/flag-icon";
import { Ambience, ProgressRail, RankFrame } from "@/components/trainer-profile-parts";
import { AvatarPicker, type AvatarPickerLabels } from "@/components/avatar-picker";
import type { RankProgress } from "@/lib/trainer-profile";

export type TrainerHeroLabels = {
  rank: Record<string, string>;
  title: Record<string, string>;
  power: string;
  badges: string;
  memberSince: string;
  toNextRank: string;
  maxRank: string;
};

/**
 * Hero del perfil.
 *
 * Decisiones que lo separan del "banner + avatar" genérico:
 *
 * 1. El fondo no es una imagen fija: es el sprite del Pokémon favorito a gran
 *    escala, sangrando por el borde derecho y desaturado hasta ser una marca de
 *    agua. Cambia solo cuando el jugador cambia de favorito, así que dos
 *    perfiles nunca se ven iguales sin necesitar un solo asset extra.
 * 2. La luz ambiental y las partículas toman el color del tipo de ese Pokémon.
 *    Charizard tiñe el hero de naranja; Gyarados, de azul.
 * 3. La composición es asimétrica: el retrato invade el borde inferior de la
 *    losa en vez de quedar centrado, y el bloque de identidad ocupa la banda
 *    izquierda. Es lo que evita la lectura de "card de dashboard".
 */
export function TrainerHero({
  username,
  avatarSrc,
  country,
  rank,
  title,
  power,
  badges,
  totalGyms,
  memberSince,
  favoriteSprite,
  favoriteAccent,
  labels,
  avatarLabels,
  currentAvatarId,
}: {
  username: string;
  avatarSrc: string | null;
  country: string;
  rank: RankProgress;
  title: string;
  power: number;
  badges: number;
  totalGyms: number;
  memberSince: string;
  favoriteSprite: string | null;
  favoriteAccent: string;
  labels: TrainerHeroLabels;
  avatarLabels: AvatarPickerLabels;
  currentAvatarId: string | null;
}) {
  return (
    <section className="relative overflow-hidden rounded-[1.75rem] border border-white/[0.08] bg-[#0d0f14]">
      {/* Luz ambiental del tipo favorito */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: `radial-gradient(120% 90% at 78% 15%, ${favoriteAccent}33 0%, transparent 60%), radial-gradient(80% 70% at 0% 100%, ${favoriteAccent}1a 0%, transparent 55%)`,
        }}
      />
      {/* Marca de agua: el favorito sangrando por la derecha */}
      {favoriteSprite && (
        <div
          aria-hidden
          className="pointer-events-none absolute -right-8 top-1/2 hidden -translate-y-1/2 sm:block"
          style={{
            filter: `drop-shadow(0 0 40px ${favoriteAccent}55)`,
            maskImage: "linear-gradient(to left, #000 40%, transparent 95%)",
            WebkitMaskImage: "linear-gradient(to left, #000 40%, transparent 95%)",
          }}
        >
          <Image
            src={favoriteSprite}
            alt=""
            width={340}
            height={340}
            unoptimized
            className="h-[240px] w-[240px] object-contain opacity-[0.17] [image-rendering:pixelated] lg:h-[300px] lg:w-[300px]"
          />
        </div>
      )}
      <Ambience color={favoriteAccent} />

      <div className="relative flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:gap-6 sm:p-7">
        {/*
          El retrato es el disparador del selector: es donde el jugador va a
          buscar cómo cambiarlo. Antes el avatar sólo se podía elegir al
          registrarse y después no había ninguna forma de tocarlo.
        */}
        <AvatarPicker
          currentAvatarId={currentAvatarId}
          unlockedIds={[]}
          labels={avatarLabels}
        >
          <RankFrame src={avatarSrc} alt={username} rank={rank.tier} size={148} />
        </AvatarPicker>

        <div className="min-w-0 flex-1">
          {/* Rango + título: la jerarquía arranca acá, no en el nombre */}
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <span
              className="tp-sheen relative overflow-hidden rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-black/80"
              style={{ background: rank.tier.metal }}
            >
              {labels.rank[rank.tier.id] ?? rank.tier.id}
            </span>
            <span
              className="rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em]"
              style={{
                borderColor: `${favoriteAccent}55`,
                color: favoriteAccent,
                background: `${favoriteAccent}14`,
              }}
            >
              {labels.title[title] ?? title}
            </span>
          </div>

          <h1 className="page-title truncate text-display-sm leading-none tracking-tight text-white">
            {username}
          </h1>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-on-surface-variant">
            <span className="inline-flex items-center gap-1.5">
              <FlagIcon code={country} className="h-3 w-4 rounded-[2px]" />
              {country}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="material-symbols-outlined text-[13px]! text-electric-yellow">
                bolt
              </span>
              <span className="font-mono font-semibold tabular-nums text-white">
                {power.toLocaleString()}
              </span>
              {labels.power}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="material-symbols-outlined text-[13px]! text-pokeball-red">
                military_tech
              </span>
              <span className="font-mono font-semibold tabular-nums text-white">
                {badges}/{totalGyms}
              </span>
              {labels.badges}
            </span>
            <span className="hidden opacity-60 sm:inline">
              {labels.memberSince} {memberSince}
            </span>
          </div>

          {/* Riel de rango: el único progreso "de cuenta" que existe */}
          <div className="mt-3 max-w-md">
            <div className="mb-1 flex items-baseline justify-between text-[9px] uppercase tracking-[0.14em]">
              <span className="text-on-surface-variant/60">
                {rank.next ? labels.toNextRank : labels.maxRank}
              </span>
              <span className="font-mono tabular-nums text-white/60">
                {Math.round(rank.pct * 100)}%
              </span>
            </div>
            <ProgressRail pct={rank.pct} color={rank.tier.accent} height={7} delayMs={220} />
          </div>
        </div>
      </div>
    </section>
  );
}
