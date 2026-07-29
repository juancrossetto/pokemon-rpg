"use client";

import { useTranslations } from "next-intl";
import { localizePokemonType } from "@/lib/pokemon-type-i18n";

/** Hook de cliente: label localizado de un tipo PokeAPI (`fire` → Fuego). */
export function useTypeLabel() {
  const t = useTranslations("pokedex.pokemonTypes");
  return (type: string) => localizePokemonType(t, type);
}
