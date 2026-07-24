"use server";

import { runShowdownDemoBattle, type ShowdownDemoResult } from "@/lib/showdown-demo";

export async function runShowdownDemo(): Promise<ShowdownDemoResult> {
  return runShowdownDemoBattle();
}
