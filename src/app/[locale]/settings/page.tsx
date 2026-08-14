import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { redirect } from "@/i18n/navigation";
import { redirectIfInBattle } from "@/lib/battle-lock";
import { GameSettingsPanel } from "@/components/settings/game-settings-panel";

export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const [session, t] = await Promise.all([auth(), getTranslations("settings")]);
  if (!session?.user) {
    redirect({ href: "/login", locale });
    return null;
  }
  await redirectIfInBattle(session.user.id, locale);
  return <main className="flex-1 px-margin-mobile py-5 md:px-margin-desktop md:py-8"><div className="mx-auto max-w-5xl"><header className="mb-5"><p className="text-[11px] font-black uppercase tracking-[0.18em] text-primary">{t("eyebrow")}</p><h1 className="page-title mt-1 text-headline-lg text-white md:text-display-sm">{t("title")}</h1><p className="mt-1 max-w-2xl text-sm text-on-surface-variant">{t("subtitle")}</p></header><GameSettingsPanel /></div></main>;
}
