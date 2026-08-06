/**
 * Catálogo de banners de perfil / home.
 * Sin Prisma: client y server pueden importarlo.
 *
 * Assets en `/public/home/banners/banner-{n}.jpg`.
 * El id es el número como string ("1"…"14").
 *
 * `HOME_BANNER_ASSET_VERSION` se concatena al `src` para invalidar caché del
 * optimizador de Next / del browser cuando se reemplaza un JPG in-place.
 */

export type HomeBannerOption = {
  id: string;
  src: string;
};

/** Bump al reemplazar assets sin cambiar el path. */
export const HOME_BANNER_ASSET_VERSION = "20260806b";

const BANNER_IDS = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
  "13",
  "14",
] as const;

export const HOME_BANNER_OPTIONS: HomeBannerOption[] = BANNER_IDS.map((id) => ({
  id,
  src: `/home/banners/banner-${id}.jpg?v=${HOME_BANNER_ASSET_VERSION}`,
}));

/** Default si el user no eligió (o id inválido). Coincide con el banner actual del home. */
export const DEFAULT_HOME_BANNER_ID = "2";

export function homeBannerById(id: string | null | undefined): HomeBannerOption {
  const found = id ? HOME_BANNER_OPTIONS.find((b) => b.id === id) : undefined;
  return (
    found ??
    HOME_BANNER_OPTIONS.find((b) => b.id === DEFAULT_HOME_BANNER_ID) ??
    HOME_BANNER_OPTIONS[0]!
  );
}
