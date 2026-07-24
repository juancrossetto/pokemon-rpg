import type { Metadata } from "next";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Inter, JetBrains_Mono } from "next/font/google";
import { routing } from "@/i18n/routing";
import { Providers } from "@/components/providers";
import { SiteHeader } from "@/components/site-header";
import { CombatLockGate } from "@/components/combat-lock-gate";
import { auth } from "@/auth";
import { getCombatLock, enforceCombatLockInLayout } from "@/lib/battle-lock";
import "../globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return { title: t("title"), description: t("description") };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const session = await auth();
  if (session?.user) {
    await enforceCombatLockInLayout(session.user.id, locale);
  }
  const combatLock = session?.user ? await getCombatLock(session.user.id) : null;

  return (
    <html
      lang={locale}
      className={`dark ${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <head>
        {/* next/font/google no soporta las variable-font axes de este ícono (wght/FILL) */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col relative overflow-x-hidden">
        <div className="fixed top-0 left-1/4 w-96 h-96 bg-pokeball-red/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="fixed bottom-0 right-1/4 w-[500px] h-[500px] bg-electric-yellow/[0.02] rounded-full blur-[150px] pointer-events-none" />
        <NextIntlClientProvider>
          <Providers>
            <CombatLockGate lock={combatLock} />
            <SiteHeader combatLock={combatLock} />
            <div className="relative z-10 flex flex-1 flex-col pb-14 pt-12 md:pb-0 md:pt-16">
              {children}
            </div>
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
