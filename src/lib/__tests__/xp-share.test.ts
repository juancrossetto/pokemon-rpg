import { describe, expect, it } from "vitest";
import { distributeVictoryXpShares } from "@/lib/battle";

describe("distributeVictoryXpShares (FireRed / Gen III)", () => {
  it("splits the full pool evenly among living participants", () => {
    const shares = distributeVictoryXpShares({
      totalXp: 300,
      participantIds: ["a", "b", "c"],
      expShareHolderIds: [],
    });
    expect(shares.get("a")).toBe(100);
    expect(shares.get("b")).toBe(100);
    expect(shares.get("c")).toBe(100);
  });

  it("drops integer remainder", () => {
    const shares = distributeVictoryXpShares({
      totalXp: 100,
      participantIds: ["a", "b", "c"],
      expShareHolderIds: [],
    });
    expect(shares.get("a")).toBe(33);
    expect(shares.get("b")).toBe(33);
    expect(shares.get("c")).toBe(33);
  });

  it("with Exp. Share: half to holders, half to participants", () => {
    const shares = distributeVictoryXpShares({
      totalXp: 1000,
      participantIds: ["fighter"],
      expShareHolderIds: ["bench"],
    });
    expect(shares.get("fighter")).toBe(500);
    expect(shares.get("bench")).toBe(500);
  });

  it("holder who also fought gets both halves", () => {
    const shares = distributeVictoryXpShares({
      totalXp: 1000,
      participantIds: ["carry"],
      expShareHolderIds: ["carry"],
    });
    expect(shares.get("carry")).toBe(1000);
  });

  it("splits participant half among several fighters", () => {
    const shares = distributeVictoryXpShares({
      totalXp: 1000,
      participantIds: ["a", "b"],
      expShareHolderIds: ["bench"],
    });
    expect(shares.get("a")).toBe(250);
    expect(shares.get("b")).toBe(250);
    expect(shares.get("bench")).toBe(500);
  });

  it("gives the full pool to Exp. Share if no living participants", () => {
    const shares = distributeVictoryXpShares({
      totalXp: 800,
      participantIds: [],
      expShareHolderIds: ["bench"],
    });
    expect(shares.get("bench")).toBe(800);
  });

  it("dedupes ids", () => {
    const shares = distributeVictoryXpShares({
      totalXp: 100,
      participantIds: ["a", "a", "b"],
      expShareHolderIds: [],
    });
    expect(shares.get("a")).toBe(50);
    expect(shares.get("b")).toBe(50);
  });
});
