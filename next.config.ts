import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  images: {
    // Next 16: sin esto, `src` locales con query (`/nav/foo.png?v=4`) tiran
    // runtime error. Omitir `search` = cualquier query (o ninguna) está OK.
    localPatterns: [{ pathname: "/**" }],
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
};

export default withNextIntl(nextConfig);
