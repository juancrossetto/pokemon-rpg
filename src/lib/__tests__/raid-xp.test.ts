import { describe, expect, it } from "vitest";
import { RAID_XP_MULTIPLIER, raidAttemptXp } from "@/lib/raids/xp";
import { xpForVictory } from "@/lib/battle";

describe("raidAttemptXp", () => {
  it("paga proporcional al daño, no por victoria", () => {
    // La incursión casi nunca termina en KO: si sólo pagara al matarlo, el
    // modo no daría progresión a nadie salvo al equipo más fuerte del server.
    const full = raidAttemptXp({ bossLevel: 25, damageDealt: 1200, bossMaxHp: 1200 });
    const half = raidAttemptXp({ bossLevel: 25, damageDealt: 600, bossMaxHp: 1200 });
    expect(full).toBe(xpForVictory(25) * RAID_XP_MULTIPLIER);
    expect(half).toBe(Math.round(full / 2));
  });

  it("sin daño no hay XP", () => {
    expect(raidAttemptXp({ bossLevel: 25, damageDealt: 0, bossMaxHp: 1200 })).toBe(0);
    expect(raidAttemptXp({ bossLevel: 25, damageDealt: -50, bossMaxHp: 1200 })).toBe(0);
  });

  it("un rasguño paga al menos 1, para que el intento nunca sea estéril", () => {
    expect(raidAttemptXp({ bossLevel: 25, damageDealt: 1, bossMaxHp: 999999 })).toBe(1);
  });

  it("no se puede cobrar más que el jefe entero", () => {
    const full = raidAttemptXp({ bossLevel: 50, damageDealt: 5000, bossMaxHp: 5000 });
    const overflow = raidAttemptXp({ bossLevel: 50, damageDealt: 99999, bossMaxHp: 5000 });
    expect(overflow).toBe(full);
  });

  it("rinde más que farmear un salvaje del mismo nivel", () => {
    // Si no, gastar los tres intentos semanales sería un mal negocio frente
    // a seguir farmeando la ruta.
    expect(raidAttemptXp({ bossLevel: 40, damageDealt: 3900, bossMaxHp: 3900 })).toBeGreaterThan(
      xpForVictory(40),
    );
  });

  it("un jefe más alto paga más por el mismo porcentaje", () => {
    const bajo = raidAttemptXp({ bossLevel: 25, damageDealt: 50, bossMaxHp: 100 });
    const alto = raidAttemptXp({ bossLevel: 100, damageDealt: 50, bossMaxHp: 100 });
    expect(alto).toBeGreaterThan(bajo);
  });
});
