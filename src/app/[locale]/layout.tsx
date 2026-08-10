import type { Metadata, Viewport } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Inter, JetBrains_Mono } from "next/font/google";
import { routing } from "@/i18n/routing";
import { BootSplashMarkup } from "@/components/boot-splash-markup";
import { InlineScript } from "@/components/inline-script";
import { bootSplashCriticalCss, bootSplashEarlyScript } from "@/lib/boot-splash";
import { iconsReadyEarlyScript } from "@/lib/icons-ready";
import { standaloneEarlyScript, standaloneNavCriticalCss } from "@/lib/standalone-early";
import { AppShell } from "@/components/app-shell";
import { AppToastViewport } from "@/components/app-toast-viewport";
import { StandaloneViewportDebug } from "@/components/standalone-viewport-debug";
import "../globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

/** Tipografía de la app: Inter (UI) + JetBrains Mono (labels) + Grobold local (títulos). */

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
  width: "device-width",
  initialScale: 1,
  /* Evita que iOS deje la app “zoomed” tras foco en inputs de login (<16px)
     o gestos accidentales; en PWA/juego el pinch-zoom no aporta. */
  maximumScale: 1,
  userScalable: false,
  /* Necesario para que env(safe-area-inset-*) sea > 0 con status bar
     translucida; sin esto la bottom nav queda bajo el home indicator. */
  viewportFit: "cover",
  /* Evita que el chrome del teclado/URL deje fixed bottom fuera del
     visual viewport en mobile Chromium. */
  interactiveWidget: "resizes-content",
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

  const tLoading = await getTranslations({ locale, namespace: "loading" });

  return (
    <html
      lang={locale}
      className={`dark ${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
      // boot-splash early script puede agregar `boot-splash-pending` antes
      // de hidratar; React no debe pelear por className en ese caso.
      suppressHydrationWarning
    >
      <head>
        {/*
          Primero de todo y sin depender de la red: el UA tiene que saber que
          pinta en oscuro antes de aplicar cualquier hoja de estilos, y el
          splash tiene que tener fondo propio. Si esto llega con `globals.css`
          (hoja externa) el primer paint es el lienzo blanco del navegador.
        */}
        <meta name="color-scheme" content="dark" />
        <style
          id="boot-splash-critical"
          dangerouslySetInnerHTML={{ __html: bootSplashCriticalCss() }}
        />
        {/* PWA iOS: marca is-standalone antes del paint (sólo scroll, no mueve el nav). */}
        <InlineScript id="standalone-early" html={standaloneEarlyScript()} />
        <style
          id="standalone-nav-critical"
          dangerouslySetInnerHTML={{ __html: standaloneNavCriticalCss() }}
        />
        {/*
          Icon font autoalojada (`@font-face` en globals.css). Antes era una
          hoja de fonts.googleapis.com acá mismo: render-blocking contra un
          tercero, o sea que ni el splash pintaba hasta resolverla. Ahora sale
          del mismo origen y se precarga en paralelo. `display=block` sigue
          vigente, declarado en el propio @font-face.
        */}
        <link
          rel="preload"
          href="/fonts/material-symbols-outlined.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link rel="preload" href="/splash/boot.webp" as="image" />
        <link rel="preload" href="/loaders/pokeball-loader-transparent.webp" as="image" />
        <InlineScript
          id="boot-splash-early"
          html={`${bootSplashEarlyScript()}(${iconsReadyEarlyScript()})();`}
        />
      </head>
      <body
        className="relative flex min-h-full flex-col overflow-x-clip"
        // standalone-early puede agregar `is-standalone` antes de hidratar.
        suppressHydrationWarning
      >
        <BootSplashMarkup label={tLoading("boot")} />

        <div className="fixed top-0 left-1/4 h-96 w-96 rounded-full bg-pokeball-red/5 blur-[120px] pointer-events-none" />
        <div className="fixed bottom-0 right-1/4 h-[500px] w-[500px] rounded-full bg-electric-yellow/[0.02] blur-[150px] pointer-events-none" />

        <AppShell locale={locale}>{children}</AppShell>
        <AppToastViewport />
        {/* TEMPORAL: diagnóstico del dock en PWA anclada. Sólo se monta en
            standalone. Borrar junto con el componente al terminar. */}
        <StandaloneViewportDebug />
      </body>
    </html>
  );
}
