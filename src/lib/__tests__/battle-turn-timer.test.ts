import { describe, expect, it } from "vitest";
import {
  BATTLE_TURN_IDLE_MS,
  isTurnExpired,
  nextTurnDeadline,
} from "@/lib/battle-turn-timer";

describe("battle-turn-timer", () => {
  it("creates a deadline one minute ahead", () => {
    const from = new Date("2026-08-05T12:00:00.000Z");
    const deadline = nextTurnDeadline(from);
    expect(deadline.getTime() - from.getTime()).toBe(BATTLE_TURN_IDLE_MS);
  });

  it("treats null deadline as not expired (legacy sessions)", () => {
    expect(isTurnExpired(null)).toBe(false);
    expect(isTurnExpired(undefined)).toBe(false);
  });

  it("expires at or after the deadline", () => {
    const deadline = new Date("2026-08-05T12:01:00.000Z");
    expect(isTurnExpired(deadline, new Date("2026-08-05T12:00:59.999Z"))).toBe(false);
    expect(isTurnExpired(deadline, new Date("2026-08-05T12:01:00.000Z"))).toBe(true);
    expect(isTurnExpired(deadline, new Date("2026-08-05T12:02:00.000Z"))).toBe(true);
  });
});
