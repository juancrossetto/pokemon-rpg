"use client";

import { useTranslations } from "next-intl";
import { PokemonImage } from "@/components/pokemon-image";

export type BattleHistoryEntry = {
  id: string;
  status: "WON" | "LOST" | "FLED" | "CAUGHT";
  mode: "wild" | "gym" | "tower" | "pvp";
  createdAt: string;
  player: { name: string; speciesName: string; spriteUrl: string; isShiny: boolean; level: number };
  foe: { name: string; speciesName: string; spriteUrl: string; isShiny: boolean; level: number };
  participants: { id: string; speciesName: string; spriteUrl: string; isShiny: boolean }[];
  damageDealt: number;
  damageTaken: number;
  items: string[];
  log: string[];
};

export function BattleHistoryList({ entries, locale }: { entries: BattleHistoryEntry[]; locale: string }) {
  const t = useTranslations("battleHistory");
  if (entries.length === 0) return <div className="rounded-2xl border border-white/10 bg-[#15171d] px-5 py-14 text-center"><span className="material-symbols-outlined text-[38px]! text-white/20">history</span><h2 className="mt-2 font-bold text-white">{t("emptyTitle")}</h2><p className="mt-1 text-sm text-white/45">{t("emptyBody")}</p></div>;

  return <div className="space-y-3">{entries.map((entry) => {
    const won = entry.status === "WON" || entry.status === "CAUGHT";
    return <article key={entry.id} className="overflow-hidden rounded-2xl border border-white/10 bg-[#15171d]/94 shadow-[0_14px_34px_rgba(0,0,0,.22)]">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 p-3 sm:p-4">
        <Combatant side="player" {...entry.player} />
        <div className="text-center"><span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[.12em] ${won ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-red-400/30 bg-red-400/10 text-red-300"}`}>{t(`status.${entry.status.toLowerCase()}`)}</span><p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-white/30">{t(`mode.${entry.mode}`)}</p></div>
        <Combatant side="foe" {...entry.foe} />
      </div>
      <details className="group border-t border-white/8">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-2.5 text-xs font-semibold text-white/55 hover:bg-white/4"><span>{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(entry.createdAt))}</span><span className="flex items-center gap-1">{t("turns", { count: entry.log.length })}<span className="material-symbols-outlined text-[16px]! transition group-open:rotate-180">expand_more</span></span></summary>
        <div className="border-t border-white/6 bg-black/20 px-4 py-3">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <HistoryMetric label={t("damageDealt")} value={entry.damageDealt.toLocaleString()} />
            <HistoryMetric label={t("damageTaken")} value={entry.damageTaken.toLocaleString()} />
            {entry.items.length ? <HistoryMetric label={t("items")} value={entry.items.join(" · ")} /> : null}
            <span className="ml-auto flex items-center -space-x-1">{entry.participants.map((member) => <PokemonImage key={member.id} src={member.spriteUrl} speciesName={member.speciesName} isShiny={member.isShiny} alt={member.speciesName} width={30} height={30} className="h-7 w-7 rounded-full border border-white/12 bg-black/45 object-contain" />)}</span>
          </div>
          <ol className="space-y-1">{entry.log.map((line, index) => <li key={`${index}:${line}`} className="flex gap-2 text-[11px] leading-relaxed text-white/55"><span className="font-mono text-primary/60">{String(index + 1).padStart(2, "0")}</span><span>{line}</span></li>)}</ol>
        </div>
      </details>
    </article>;
  })}</div>;
}

function HistoryMetric({ label, value }: { label: string; value: string }) {
  return <span className="rounded-lg border border-white/8 bg-white/4 px-2 py-1"><span className="mr-1 text-[9px] font-bold uppercase tracking-wider text-white/30">{label}</span><strong className="text-[10px] text-white/70">{value}</strong></span>;
}

function Combatant({ side, name, speciesName, spriteUrl, isShiny, level }: BattleHistoryEntry["player"] & { side: "player" | "foe" }) {
  return <div className={`flex min-w-0 items-center gap-2 ${side === "foe" ? "flex-row-reverse text-right" : ""}`}><PokemonImage src={spriteUrl} speciesName={speciesName} isShiny={isShiny} alt={speciesName} width={58} height={58} className="h-12 w-12 shrink-0 object-contain sm:h-14 sm:w-14" /><span className="min-w-0"><strong className="block truncate text-sm text-white">{name}</strong><span className="block text-[10px] text-white/40">{speciesName} · Lv. {level}</span></span></div>;
}
