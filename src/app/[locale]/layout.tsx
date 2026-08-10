import type { Metadata, Viewport } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Inter, JetBrains_Mono } from "next/font/google";
import { routing } from "@/i18n/routing";
import { BootSplashMarkup } from "@/components/boot-splash-markup";
import { InlineScript } from "@/components/inline-script";
import {
  APPLE_STARTUP_IMAGES,
  isBootSplashAuthGatePath,
} from "@/lib/apple-startup-images";
import { bootSplashCriticalCss, bootSplashEarlyScript } from "@/lib/boot-splash";
import { iconsReadyEarlyScript } from "@/lib/icons-ready";
import { standaloneEarlyScript, standaloneNavCriticalCss } from "@/lib/standalone-early";
import { AppShell } from "@/components/app-shell";
import { AppToastViewport } from "@/components/app-toast-viewport";
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
      /*
       * `black` y no `black-translucent`.
       *
       * Con `black-translucent` iOS dibuja el contenido desde y=0 (debajo de la
       * barra de estado) pero le asigna al webview la altura como si la barra
       * fuera opaca. Medido en el iPhone: `screen.height` 852 contra
       * `innerHeight` / `clientHeight` / `visualViewport.height` 793 — 59pt,
       * justo el alto de la barra de estado. Como el webview arranca arriba de
       * todo y mide 59pt de menos, sobra esa banda negra abajo, y el dock
       * (correctamente pegado al fondo del viewport: `HUECO` daba 0) queda
       * despegado del borde físico.
       *
       * Con la barra opaca el viewport arranca debajo de ella y ocupa el resto
       * completo. `env(safe-area-inset-top)` pasa a 0, que es lo correcto: el
       * contenido ya no se dibuja bajo la barra, así que los paddings que la
       * compensaban dejan de sumar de más.
       */
      statusBarStyle: "black",
      startupImage: APPLE_STARTUP_IMAGES,
    },
    /*
     * Next 15 emite `mobile-web-app-capable` en vez de
     * `apple-mobile-web-app-capable`. iOS sigue necesitando el tag viejo para
     * mostrar las startup images al abrir la PWA desde el home.
     */
    other: {
      "apple-mobile-web-app-capable": "yes",
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
  /* Necesario para que `env(safe-area-inset-bottom)` sea > 0: es lo que hace
     que el dock cubra el home indicator en vez de quedar debajo. Con la barra
     de estado opaca el inset de arriba pasa a 0, pero el de abajo sigue
     haciendo falta (medido en el iPhone: 34pt). */
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

  const [tLoading, authGate] = await Promise.all([
    getTranslations({ locale, namespace: "loading" }),
    isBootSplashAuthGatePath(),
  ]);

  // Cold start: splash en el HTML (sin esperar JS) → no hay frame blanco.
  const htmlClass = [
    "dark",
    inter.variable,
    jetbrainsMono.variable,
    "h-full",
    "antialiased",
    authGate ? "" : "boot-splash-pending",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <html
      lang={locale}
      className={htmlClass}
      // boot-splash early script puede quitar `boot-splash-pending` antes
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
        <InlineScript
          id="boot-splash-early"
          html={`${bootSplashEarlyScript()}(${iconsReadyEarlyScript()})();`}
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
      </head>
      <body
        className="relative flex min-h-full flex-col overflow-x-clip"
        // standalone-early puede agregar `is-standalone` antes de hidratar.
        suppressHydrationWarning
      >
        <BootSplashMarkup label={tLoading("boot")} pending={!authGate} />

        <div className="fixed top-0 left-1/4 h-96 w-96 rounded-full bg-pokeball-red/5 blur-[120px] pointer-events-none" />
        <div className="fixed bottom-0 right-1/4 h-[500px] w-[500px] rounded-full bg-electric-yellow/[0.02] blur-[150px] pointer-events-none" />

        <AppShell locale={locale}>{children}</AppShell>
        <AppToastViewport />
      </body>
    </html>
  );
}
