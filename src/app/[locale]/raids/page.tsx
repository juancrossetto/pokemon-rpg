import { auth } from "@/auth";
import { redirect } from "@/i18n/navigation";
import { redirectIfInBattle } from "@/lib/battle-lock";
import { loadWeeklyRaid } from "@/lib/raids/state";
import { WeeklyRaidBoard } from "@/components/raids/weekly-raid-board";

export default async function RaidsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user) { redirect({ href: "/login", locale }); return null; }
  await redirectIfInBattle(session.user.id, locale);
  const data = await loadWeeklyRaid(session.user.id);
  return <main className="flex-1 px-margin-mobile py-5 md:px-margin-desktop md:py-8"><div className="mx-auto max-w-5xl"><WeeklyRaidBoard data={data} locale={locale} userId={session.user.id} /></div></main>;
}
