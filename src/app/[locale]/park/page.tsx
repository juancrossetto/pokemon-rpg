import { auth } from "@/auth";
import { redirect } from "@/i18n/navigation";
import { redirectIfInBattle } from "@/lib/battle-lock";
import { loadParkHub } from "@/lib/park-hub";
import { ParkHub } from "@/components/park/park-hub";

export default async function ParkPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user) {
    redirect({ href: "/login", locale });
    return null;
  }
  await redirectIfInBattle(session.user.id, locale);
  const data = await loadParkHub(session.user.id);
  return <ParkHub locale={locale} data={data} />;
}
