import { describe, expect, it } from "vitest";
import {
  isNpcTrainerPixelPortraitUrl,
  npcTrainerCardPortraitUrl,
  npcTrainerPortraitUrl,
} from "@/lib/avatars";
import { ROUTE_TRAINERS } from "@/lib/campaign/trainers";
import { trainerSpriteSlugFromName } from "@/lib/gym-corridor-theme";
import kantoGyms from "../../../prisma/seed/data/gyms/kanto.json";
import johtoGyms from "../../../prisma/seed/data/gyms/johto.json";

describe("trainer portraits", () => {
  it("resolves every route trainer to the local 80x80 family", () => {
    for (const trainer of ROUTE_TRAINERS) {
      const url = npcTrainerPortraitUrl(trainer.spriteSlug, "thumb");
      expect(url).toMatch(/^\/trainers\/portraits\/thumbs\/[a-z]+\.png$/);
      expect(isNpcTrainerPixelPortraitUrl(url)).toBe(false);
      expect(npcTrainerCardPortraitUrl(trainer.spriteSlug)).toMatch(
        /^\/trainers\/portraits\/[a-z]+\.png$/,
      );
    }
  });

  it.each([
    ["Recluta Rocket", "rocketgrunt"],
    ["Supernerd Pyro", "supernerd"],
    ["Ornitóloga Lara", "birdkeeperf"],
    ["Observador de Aves Nico", "birdkeeper"],
    ["Señorita Rosa", "lady"],
    ["Gentilhombre Aldo", "gentleman"],
    ["Esquiador Max", "skier"],
    ["Esquiadora Inés", "skierf"],
    ["Domadragones Lia", "dragontamer"],
  ])("maps %s to its own trainer class", (name, expected) => {
    expect(trainerSpriteSlugFromName(name)).toBe(expected);
    expect(npcTrainerPortraitUrl(expected)).toBe(`/trainers/portraits/${expected}.png`);
  });

  it("resolves every seeded gym subordinate without a generic fallback", () => {
    for (const gym of [...kantoGyms, ...johtoGyms]) {
      for (const trainer of gym.trainers) {
        const slug = trainerSpriteSlugFromName(trainer.name);
        expect(npcTrainerPortraitUrl(slug), trainer.name).toBe(
          `/trainers/portraits/${slug}.png`,
        );
      }
    }
  });
});
