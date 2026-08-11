import path from "path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // El home tiene un package-lock.json suelto; sin esto Turbopack toma ~ como
  // root y rompe imports relativos del CSS (`../styles/...`) + el HMR.
  turbopack: {
    root: path.join(__dirname),
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "raw.githubusercontent.com" },
      { protocol: "https", hostname: "play.pokemonshowdown.com" },
    ],
    // Next 16 bloquea por default cualquier imagen local con query string
    // (default interno: pathname "**" + search ""). Apenas se define
    // `localPatterns`, deja de aplicar el permitir-todo implícito para
    // TODAS las imágenes locales, no solo las que tienen query string — por
    // eso el patrón cubre cualquier ruta bajo /public en vez de solo /nav/**
    // (que rompía /logo.png y cualquier otra imagen local sin versión).
    localPatterns: [{ pathname: "/**" }],
  },
  experimental: {
    /*
      Sin esto, el client cache de rutas dinámicas dura 0s: cada click a
      team↔inventory↔clans vuelve a esperar el RSC completo y se siente lag.
      30s alcanza para moverse entre tabs sin datos obsoletos de más.
    */
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
};

export default withNextIntl(nextConfig);
