import type { MineBag, MineCell } from "@/lib/park/mine";
import type { FrontierFacility } from "@/lib/park/frontier";
import type { DexRarity } from "@/lib/pokedex";

export type ParkMonOption = {
  id: string;
  name: string;
  speciesName: string;
  level: number;
  spriteUrl: string;
};

export type ParkDaycareSlot = {
  slot: number;
  depositId: string | null;
  name: string | null;
  speciesName: string | null;
  level: number | null;
  spriteUrl: string | null;
  pendingLevels: number;
  fee: number;
};

export type ParkPlot = {
  slot: number;
  berryName: string | null;
  ready: boolean;
  msLeft: number;
};

export type ParkFrontierView = {
  facility: FrontierFacility;
  streak: number;
  wins: number;
  lastWon: boolean;
};

export type ParkFragment = {
  speciesId: number;
  speciesName: string;
  spriteUrl: string;
  quantity: number;
  dexRarity: DexRarity;
};

export type ParkHubData = {
  coins: number;
  energy: number;
  energyMax: number;
  daycare: ParkDaycareSlot[];
  box: ParkMonOption[];
  wonderPending: ParkMonOption | null;
  wonder: { freeLeft: number; resetAt: string; resetMs: number };
  farm: ParkPlot[];
  berries: Array<{ itemId: string; name: string; quantity: number }>;
  mine: { grid: MineCell[]; bag: MineBag; digsLeft: number; resetAt: string; resetMs: number };
  fragments: ParkFragment[];
  frontier: ParkFrontierView[];
  corner: { freeLeft: number; resetAt: string; resetMs: number };
  fishing: { freeLeft: number; resetAt: string; resetMs: number };
};
