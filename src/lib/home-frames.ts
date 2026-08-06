/**
 * Catálogo de marcos del banner de identidad.
 * Sin Prisma: client y server pueden importarlo.
 *
 * Assets en `/public/home/frames/marco-{n}.png`, misma convención que
 * `home-banners.ts`.
 *
 * El marco se pinta con `border-image` en nueve piezas (ver
 * `.home-identity__marco`), así que cada entrada necesita dos datos que
 * dependen del arte:
 *
 * - `slice`: cuántos píxeles del PNG ocupa cada esquina. Es el número que
 *   separa "esquina" de "borde estirable"; si está mal, las esquinas salen
 *   cortadas o deformadas.
 * - `rails`: en qué fracción de esa esquina cae el riel, por lado. De ahí
 *   salen tanto la retracción del arte como el padding del copy, para que el
 *   contenido nunca quede debajo del trazo.
 *
 * Medido con `node scripts/measure-frame.mjs public/home/frames/marco-N.png`.
 */

export type HomeFrameOption = {
  id: string;
  src: string;
  /** Tamaño de la esquina en px del PNG original. */
  slice: number;
  /** Posición del riel dentro de la esquina, 0–1, por lado. */
  rails: { top: number; bottom: number; left: number; right: number };
};

export const HOME_FRAME_OPTIONS: HomeFrameOption[] = [
  {
    id: "1",
    src: "/home/frames/marco-1.png",
    slice: 160,
    rails: { top: 0.56, bottom: 0.35, left: 0.45, right: 0.46 },
  },
  {
    id: "2",
    src: "/home/frames/marco-2.png",
    slice: 160,
    rails: { top: 0.63, bottom: 0.53, left: 0.41, right: 0.42 },
  },
  {
    id: "3",
    src: "/home/frames/marco-3.png",
    slice: 160,
    rails: { top: 1, bottom: 0.5, left: 0.72, right: 0.56 },
  },
  {
    id: "4",
    src: "/home/frames/marco-4.png",
    slice: 160,
    rails: { top: 0.75, bottom: 0.37, left: 0.63, right: 0.61 },
  },
  {
    id: "5",
    src: "/home/frames/marco-5.png",
    slice: 160,
    rails: { top: 0.76, bottom: 0.47, left: 0.56, right: 0.51 },
  },
  {
    id: "6",
    src: "/home/frames/marco-6.png",
    slice: 160,
    rails: { top: 0.84, bottom: 0.51, left: 0.8, right: 0.78 },
  },
  {
    id: "7",
    src: "/home/frames/marco-7.png",
    slice: 160,
    rails: { top: 0.61, bottom: 0.39, left: 0.44, right: 0.54 },
  },
  {
    id: "8",
    src: "/home/frames/marco-8.png",
    slice: 160,
    rails: { top: 0.61, bottom: 0.28, left: 0.41, right: 0.47 },
  },
  {
    id: "9",
    src: "/home/frames/marco-9.png",
    slice: 160,
    rails: { top: 0.72, bottom: 0.4, left: 0.61, right: 0.65 },
  },
];

export const DEFAULT_HOME_FRAME_ID = "1";

export function homeFrameById(id: string | null | undefined): HomeFrameOption {
  const found = id ? HOME_FRAME_OPTIONS.find((f) => f.id === id) : undefined;
  return (
    found ??
    HOME_FRAME_OPTIONS.find((f) => f.id === DEFAULT_HOME_FRAME_ID) ??
    HOME_FRAME_OPTIONS[0]!
  );
}
