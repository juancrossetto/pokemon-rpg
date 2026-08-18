import { auth } from "@/auth";
import { redirect } from "@/i18n/navigation";
import { redirectIfInBattle } from "@/lib/battle-lock";
import { loadParkHub } from "@/lib/park-hub";
import { parseParkTab } from "@/lib/park/tabs";
import { ParkHub } from "@/components/park/park-hub";

export default async function ParkPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const session = await auth();
  if (!session?.user) {
    redirect({ href: "/login", locale });
    return null;
  }
  await redirectIfInBattle(session.user.id, locale);
  const data = await loadParkHub(session.user.id);
  return <ParkHub locale={locale} data={data} initialTab={parseParkTab(query.tab)} />;
}
