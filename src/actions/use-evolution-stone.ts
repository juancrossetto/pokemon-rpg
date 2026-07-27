"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { blockIfInCombat } from "@/lib/battle-lock";
import { evolvePokemonWithItem } from "@/lib/level-up";

export type UseEvolutionStoneResult =
  | {
      ok: true;
      fromName: string;
      fromSpriteUrl: string;
      toName: string;
      toSpriteUrl: string;
      level: number;
      currentHp: number;
      maxHp: number;
      itemName: string;
    }
  | {
      ok: false;
      error:
        | "unauthorized"
        | "not_found"
        | "no_item"
        | "incompatible"
        | "not_ready"
        | "in_combat";
    };

/** Consume una piedra de evolución y transforma el Pokémon compatible. */
export async function useEvolutionStone(
  instanceId: string,
  itemName: string,
  locale: string,
  toSpeciesId?: number,
): Promise<UseEvolutionStoneResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "unauthorized" };
  if (await blockIfInCombat(session.user.id, locale)) {
    return { ok: false, error: "in_combat" };
  }

  const result = await evolvePokemonWithItem({
    userId: session.user.id,
    instanceId,
    itemName,
    toSpeciesId,
  });
  if (!result.ok) return result;

  revalidatePath(`/${locale}`);
  revalidatePath(`/${locale}/team`);
  revalidatePath(`/${locale}/battle`);
  revalidatePath(`/${locale}/pc`);
  revalidatePath(`/${locale}/inventory`);
  revalidatePath(`/${locale}/pokedex`);
  return result;
}
