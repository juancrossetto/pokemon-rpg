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
  },
};

export default withNextIntl(nextConfig);
