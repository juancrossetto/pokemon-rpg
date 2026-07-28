import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Inter, JetBrains_Mono } from "next/font/google";
import { routing } from "@/i18n/routing";
import { BootSplashController } from "@/components/boot-splash";
import { BootSplashMarkup } from "@/components/boot-splash-markup";
import { bootSplashEarlyScript } from "@/lib/boot-splash";
import { AppShell } from "@/components/app-shell";
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
  return {
    title: t("title"),
    description: t("description"),
    appleWebApp: {
      capable: true,
      title: "PokeRPG",
      statusBarStyle: "black-translucent",
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#0a0806",
};

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

  return (
    <html
      lang={locale}
      className={`dark ${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <head>
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
        <link rel="preload" href="/splash/boot.webp" as="image" />
        <script dangerouslySetInnerHTML={{ __html: bootSplashEarlyScript() }} />
      </head>
      <body className="relative flex min-h-full flex-col overflow-x-hidden">
        <BootSplashMarkup />
        <BootSplashController />

        <div className="fixed top-0 left-1/4 h-96 w-96 rounded-full bg-pokeball-red/5 blur-[120px] pointer-events-none" />
        <div className="fixed bottom-0 right-1/4 h-[500px] w-[500px] rounded-full bg-electric-yellow/[0.02] blur-[150px] pointer-events-none" />

        <Suspense fallback={null}>
          <AppShell locale={locale}>{children}</AppShell>
        </Suspense>
      </body>
    </html>
  );
}
