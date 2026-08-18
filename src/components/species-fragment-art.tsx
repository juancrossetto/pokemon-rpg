"use client";

import { PokemonImage } from "@/components/pokemon-image";
import type { DexRarity } from "@/lib/pokedex";
import type { CSSProperties } from "react";

/**
 * Cristal con el sprite recortado adentro.
 *
 * Un fragmento no es un Pokémon capturado: si se muestra el sprite entero
 * parece que ya lo tenés. La gema deja reconocer la especie y deja claro
 * que todavía es un pedazo.
 *
 * El color del cristal sale de la **rareza de la especie**, la misma escala que
 * usa la Pokédex (`DexRarity`): un fragmento de legendario tiene que verse
 * distinto de uno común antes de leer ningún texto. Sin rareza cae en el azul
 * neutro, que es el que tenía todo.
 */
export function SpeciesFragmentArt({
  speciesId,
  speciesName,
  size,
  rarity,
  alt = "",
  className = "",
}: {
  speciesId: number;
  speciesName: string;
  size: number;
  rarity?: DexRarity;
  alt?: string;
  className?: string;
}) {
  return (
    <span
      className={`frag-art${rarity ? ` is-${rarity}` : ""} ${className}`.trim()}
      style={{ "--frag-size": `${size}px` } as CSSProperties}
      aria-hidden={alt === ""}
    >
      <span className="frag-art__poke">
        <PokemonImage
          speciesId={speciesId}
          speciesName={speciesName}
          alt={alt}
          width={size}
          height={size}
          draggable={false}
          className="frag-art__sprite"
        />
      </span>
      <span className="frag-art__shine" />
      <span className="frag-art__crack" />
    </span>
  );
}
