import type { MetadataRoute } from "next";

/**
 * Manifest PWA — es lo que Chrome Android lee al "Añadir a pantalla de inicio".
 *
 * Sin este archivo el navegador improvisa: toma el favicon, lo encoge, le pone
 * un fondo blanco y abre la app con la barra del navegador en vez de pantalla
 * completa. De ahí que el ícono se viera mal.
 *
 * Los iconos van en dos variantes a propósito:
 * - `any`: se muestra tal cual (logo al 80% del lienzo).
 * - `maskable`: Android le aplica una máscara circular o squircle y recorta lo
 *   que sobresalga, así que el logo va al 60% y todo queda dentro del círculo
 *   central seguro. Si se usara la variante `any` como maskable, la máscara se
 *   comería los bordes del logo.
 *
 * Ambos tienen fondo sólido: con fondo transparente Android rellena en blanco,
 * que sobre un logo oscuro queda pésimo.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pokémon RPG",
    short_name: "PokeRPG",
    description:
      "Captura, entrena y competí con otros entrenadores. Gimnasios, mercado, ranking y PvP.",
    // La app redirige por locale; la raíz resuelve al idioma que corresponda.
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    // Tonos del splash de arranque (`boot-splash` en globals.css): el flash
    // nativo de la PWA empalma con la imagen de Mewtwo.
    background_color: "#0a0806",
    theme_color: "#0a0806",
    categories: ["games", "entertainment"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-192-maskable.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
