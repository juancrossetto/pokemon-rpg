"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { attackWeeklyRaid, claimWeeklyRaidReward, type RaidActionResult } from "@/actions/weekly-raid";
import { PokemonImage } from "@/components/pokemon-image";
import { TrainerAvatar } from "@/components/trainer-avatar";
import { avatarById } from "@/lib/avatars";
import { seedPendingCoinDelta } from "@/lib/coin-fx";
import { showToast } from "@/lib/app-toast";

type RaidData = {
  resetsAt: string;
  boss: { speciesId: number; name: string; spriteUrl: string; types: string[]; level: number; accent: string };
  score: { attemptsUsed: number; totalDamage: number; bestDamage: number; rewardClaimedAt: Date | null };
  attemptsLeft: number;
  communityDamage: number;
  communityHp: number;
  communityDefeated: boolean;
  leaders: { position: number; userId: string; username: string; avatarId: string | null; country: string; damage: number }[];
  clans: { id: string; name: string; damage: number }[];
  userClanId: string | null;
};

export function WeeklyRaidBoard({ data, locale, userId }: { data: RaidData; locale: string; userId: string }) {
  const t = useTranslations("raids");
  const [pending, startTransition] = useTransition();
  const [lastDamage, setLastDamage] = useState<number | null>(null);
  const communityPct = Math.min(100, Math.round((data.communityDamage / data.communityHp) * 100));
  const readyToClaim = data.score.attemptsUsed >= 3 && !data.score.rewardClaimedAt;

  function handle(result: RaidActionResult) {
    if (!result.ok) { showToast(t(`errors.${result.error}`), result.error === "busy" ? "info" : "error"); return; }
    if (result.damage > 0) setLastDamage(result.damage);
    if (result.coins) seedPendingCoinDelta(result.coins);
  }

  return <div className="space-y-4">
    <section className="relative overflow-hidden rounded-[26px] border border-white/12 bg-[radial-gradient(circle_at_70%_30%,color-mix(in_srgb,var(--raid-accent)_22%,transparent),transparent_38%),linear-gradient(145deg,#171923,#0b0c11)] p-5 shadow-[0_24px_70px_rgba(0,0,0,.45)] sm:p-7" style={{ "--raid-accent": data.boss.accent } as React.CSSProperties}>
      <div className="relative z-10 grid items-center gap-4 sm:grid-cols-[1fr_240px]">
        <div><p className="text-[10px] font-black uppercase tracking-[.2em] text-primary">{t("eyebrow")}</p><h1 className="page-title mt-1 text-3xl text-white sm:text-5xl">{t("title")}</h1><p className="mt-2 max-w-xl text-sm leading-relaxed text-white/55">{t("subtitle")}</p><div className="mt-4 flex flex-wrap gap-2"><StatChip label={t("attempts")} value={`${data.attemptsLeft}/3`} /><StatChip label={t("yourDamage")} value={data.score.totalDamage.toLocaleString()} /><StatChip label={t("resets")} value={new Intl.DateTimeFormat(locale, { weekday: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(data.resetsAt))} /></div></div>
        <div className="relative flex justify-center"><span className="absolute inset-8 rounded-full blur-3xl" style={{ background: `${data.boss.accent}35` }} /><PokemonImage src={data.boss.spriteUrl} speciesId={data.boss.speciesId} speciesName={data.boss.name} alt={data.boss.name} width={240} height={240} className="relative h-44 w-44 object-contain drop-shadow-[0_18px_20px_rgba(0,0,0,.7)] sm:h-56 sm:w-56" /></div>
      </div>
      <div className="relative z-10 mt-4 border-t border-white/8 pt-4"><div className="flex items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-white/40">{t("weeklyBoss")}</p><h2 className="text-xl font-black text-white">{data.boss.name} <span className="text-sm text-white/35">Lv. {data.boss.level}</span></h2></div>{lastDamage ? <span className="raid-damage-pop text-xl font-black text-secondary">-{lastDamage.toLocaleString()}</span> : null}</div><div className="mt-3 h-2.5 overflow-hidden rounded-full bg-black/45"><span className="block h-full rounded-full bg-linear-to-r from-primary to-secondary transition-[width] duration-700" style={{ width: `${communityPct}%` }} /></div><div className="mt-1 flex justify-between text-[10px] font-bold text-white/35"><span>{t("communityProgress", { percent: communityPct })}</span><span>{data.communityDamage.toLocaleString()} / {data.communityHp.toLocaleString()}</span></div>
      <button type="button" disabled={pending || data.attemptsLeft <= 0} onClick={() => startTransition(async () => handle(await attackWeeklyRaid(locale)))} className="game-cta game-cta--red mt-5 w-full disabled:cursor-not-allowed disabled:grayscale disabled:opacity-45">{pending ? t("attacking") : data.attemptsLeft > 0 ? t("attack") : t("noAttempts")}</button>
      </div>
    </section>

    <section className="grid gap-4 lg:grid-cols-[1.35fr_.65fr]">
      <div className="rounded-2xl border border-white/10 bg-[#15171d] p-4"><div className="mb-3 flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.15em] text-secondary">{t("rankingEyebrow")}</p><h2 className="text-lg font-bold text-white">{t("ranking")}</h2></div><span className="material-symbols-outlined text-secondary">leaderboard</span></div><div className="divide-y divide-white/7">{data.leaders.length ? data.leaders.map((row) => { const avatar = avatarById(row.avatarId); return <div key={row.userId} className={`grid grid-cols-[28px_1fr_auto] items-center gap-2 py-2 ${row.userId === userId ? "text-primary" : "text-white"}`}><span className="text-xs font-black">#{row.position}</span><span className="flex min-w-0 items-center gap-2"><TrainerAvatar name={row.username} src={avatar?.src ?? null} size="xs" /><strong className="truncate text-sm">{row.username}</strong></span><span className="font-mono text-sm font-black">{row.damage.toLocaleString()}</span></div>; }) : <p className="py-8 text-center text-sm text-white/35">{t("emptyRanking")}</p>}</div></div>
      <div className="space-y-4"><div className="rounded-2xl border border-white/10 bg-[#15171d] p-4"><p className="text-[10px] font-black uppercase tracking-[.15em] text-primary">{t("clansEyebrow")}</p><h2 className="mt-0.5 text-base font-bold text-white">{t("clans")}</h2><div className="mt-3 space-y-2">{data.clans.length ? data.clans.map((clan, index) => <div key={clan.id} className={`flex items-center justify-between rounded-lg px-2 py-1.5 text-xs ${clan.id === data.userClanId ? "bg-primary/10 text-primary" : "bg-black/20 text-white/60"}`}><span>#{index + 1} {clan.name}</span><strong>{clan.damage.toLocaleString()}</strong></div>) : <p className="py-4 text-center text-xs text-white/35">{t("emptyClans")}</p>}</div></div>
      <div className="rounded-2xl border border-secondary/20 bg-secondary/7 p-4"><p className="text-[10px] font-black uppercase tracking-[.15em] text-secondary">{t("rewardEyebrow")}</p><h2 className="mt-0.5 font-bold text-white">{t("reward")}</h2><p className="mt-1 text-xs leading-relaxed text-white/45">{t("rewardBody")}</p><button type="button" disabled={pending || !readyToClaim} onClick={() => startTransition(async () => handle(await claimWeeklyRaidReward(locale)))} className="mt-3 w-full rounded-xl bg-secondary px-3 py-2 text-sm font-black text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:grayscale disabled:opacity-40">{data.score.rewardClaimedAt ? t("claimed") : readyToClaim ? t("claim") : t("lockedReward", { current: data.score.attemptsUsed })}</button></div></div>
    </section>
  </div>;
}

function StatChip({ label, value }: { label: string; value: string }) { return <span className="rounded-xl border border-white/10 bg-black/25 px-3 py-2"><span className="block text-[9px] font-black uppercase tracking-wider text-white/35">{label}</span><strong className="text-sm text-white">{value}</strong></span>; }
