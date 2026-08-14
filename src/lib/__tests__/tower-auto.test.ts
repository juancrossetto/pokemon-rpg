import { describe, expect, it } from "vitest";
import {
  pickTowerAutoBlessing,
  pickTowerAutoRest,
  TOWER_AUTO_REST_RECOVERY_THRESHOLD,
} from "@/lib/tower-auto";

describe("tower auto", () => {
  it("cura en descansos cuando el equipo está comprometido", () => {
    expect(pickTowerAutoRest(TOWER_AUTO_REST_RECOVERY_THRESHOLD - 0.01, true)).toBe(
      "recover",
    );
  });

  it("sintoniza una bendición cuando el equipo está sano", () => {
    expect(pickTowerAutoRest(0.9, true)).toBe("attune");
    expect(pickTowerAutoRest(0.9, false)).toBe("recover");
  });

  it("prioriza supervivencia con poca vida", () => {
    const picked = pickTowerAutoBlessing(
      [
        {
          id: "damage",
          rarity: "epic" as const,
          effects: [{ kind: "type_damage_pct" as const, value: 15 }],
        },
        {
          id: "heal",
          rarity: "common" as const,
          effects: [{ kind: "heal_team_pct" as const, value: 20 }],
        },
      ],
      0.3,
    );

    expect(picked?.id).toBe("heal");
  });

  it("usa rareza y valor ofensivo cuando no necesita curarse", () => {
    const picked = pickTowerAutoBlessing(
      [
        {
          id: "coins",
          rarity: "common" as const,
          effects: [{ kind: "coins_pct" as const, value: 10 }],
        },
        {
          id: "shield",
          rarity: "rare" as const,
          effects: [{ kind: "shield_first_hit" as const, value: 1 }],
        },
      ],
      0.95,
    );

    expect(picked?.id).toBe("shield");
  });
});
