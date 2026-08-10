"use client";

import Image from "next/image";
import {
  evolutionRecipesForItem,
  type ItemEvolutionRecipe,
} from "@/lib/evolution-items";
import { itemDisplayUrl } from "@/lib/item-sprites";
import { homeSpriteById } from "@/lib/sprites";

/**
 * Diagrama estilo Wikidex: `from → ítem → to` en el detalle del objeto.
 * Los sprites salen del CDN HOME por id (no requieren especie en nuestra DB).
 */
export function ItemEvolutionRecipes({
  itemName,
  title,
}: {
  itemName: string;
  title: string;
}) {
  const recipes = evolutionRecipesForItem(itemName);
  if (recipes.length === 0) return null;

  return (
    <div>
      <p className="mb-1.5 text-[10px] uppercase tracking-[0.18em] text-on-surface-variant">
        {title}
      </p>
      <ul className="flex flex-col gap-2">
        {recipes.map((recipe) => (
          <li key={`${recipe.fromId}-${recipe.toId}-${recipe.itemName}`}>
            <RecipeRow recipe={recipe} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function RecipeRow({ recipe }: { recipe: ItemEvolutionRecipe }) {
  return (
    <div className="flex items-center justify-between gap-1 rounded-lg border border-white/10 bg-black/30 px-2 py-2">
      <SpeciesCell id={recipe.fromId} name={recipe.fromName} />
      <div className="relative flex min-w-[2.75rem] flex-1 items-center justify-center px-0.5">
        <span
          aria-hidden
          className="absolute inset-x-1 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-white/20"
        />
        <span
          aria-hidden
          className="absolute right-0.5 top-1/2 h-2 w-2 -translate-y-1/2 rotate-45 border-r-2 border-t-2 border-white/35"
        />
        <Image
          src={itemDisplayUrl(recipe.itemName)}
          alt=""
          width={28}
          height={28}
          unoptimized
          draggable={false}
          className="relative z-[1] h-7 w-7 object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.55)]"
        />
      </div>
      <SpeciesCell id={recipe.toId} name={recipe.toName} />
    </div>
  );
}

function SpeciesCell({ id, name }: { id: number; name: string }) {
  return (
    <div className="flex w-[4.5rem] shrink-0 flex-col items-center gap-0.5 text-center sm:w-[5.25rem]">
      <Image
        src={homeSpriteById(id)}
        alt=""
        width={56}
        height={56}
        unoptimized
        draggable={false}
        className="h-12 w-12 object-contain sm:h-14 sm:w-14"
      />
      <span className="line-clamp-2 text-[9px] font-medium leading-tight text-sky-300/90 sm:text-[10px]">
        {name}
      </span>
    </div>
  );
}
