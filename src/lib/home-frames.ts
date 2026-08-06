/**
 * Catálogo de marcos del banner de identidad.
 * Sin Prisma: client y server pueden importarlo.
 *
 * Assets en `/public/home/frames/marco-{n}.png` (base) y
 * `/public/home/frames/marco-gym-{n}.png` (recompensa de gimnasio).
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
 *
 * Los `gym-*` serán unlock por medalla; por ahora están en el picker para QA.
 */

export type HomeFrameOption = {
  id: string;
  src: string;
  /** Tamaño de la esquina en px del PNG original. */
  slice: number;
  /** Posición del riel dentro de la esquina, 0–1, por lado. */
  rails: { top: number; bottom: number; left: number; right: number };
  /**
   * Multiplicador del ancho del borde (`--hi-frame`). Default 1.
   *
   * `border-image` comprime el trozo del borde hasta el ancho del borde, así
   * que la compresión es `slice / --hi-frame`. Con un ancho global, un marco de
   * slice 320 se aplasta el doble que uno de 160 y pierde todo el detalle.
   * Este peso lo compensa: los `gym-*` (slice 320) piden un borde más grueso.
   */
  weight?: number;
};

/**
 * Marcos de gimnasio: arte de 1536×1024.
 *
 * Sus `slice` NO son un número redondo elegido a ojo — están medidos sobre el
 * alfa de cada PNG, buscando dónde el ornamento de la esquina deja paso al riel
 * liso. Estaban todos en 320, que cortaba el racimo por la mitad: el pedazo
 * sobrante caía del lado del borde y se estiraba a lo largo, que es lo que se
 * veía como un patrón repetido.
 */
const GYM_WEIGHT = 1.5;

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
  {
    id: "gym-1",
    src: "/home/frames/marco-gym-1.png",
    slice: 512,
    rails: { top: 0.57, bottom: 0.54, left: 0.31, right: 0.34 },
    weight: GYM_WEIGHT,
  },
  {
    id: "gym-2",
    src: "/home/frames/marco-gym-2.png",
    slice: 452,
    rails: { top: 0.58, bottom: 0.62, left: 0.31, right: 0.25 },
    weight: GYM_WEIGHT,
  },
  {
    id: "gym-3",
    src: "/home/frames/marco-gym-3.png",
    slice: 475,
    rails: { top: 0.61, bottom: 0.58, left: 0.35, right: 0.34 },
    weight: GYM_WEIGHT,
  },
  {
    id: "gym-4",
    src: "/home/frames/marco-gym-4.png",
    slice: 473,
    rails: { top: 0.53, bottom: 0.58, left: 0.33, right: 0.34 },
    weight: GYM_WEIGHT,
  },
  {
    id: "gym-5",
    src: "/home/frames/marco-gym-5.png",
    slice: 405,
    rails: { top: 0.61, bottom: 0.6, left: 0.36, right: 0.33 },
    weight: GYM_WEIGHT,
  },
  {
    id: "gym-6",
    src: "/home/frames/marco-gym-6.png",
    slice: 416,
    rails: { top: 0.62, bottom: 0.67, left: 0.33, right: 0.33 },
    weight: GYM_WEIGHT,
  },
  {
    id: "gym-7",
    src: "/home/frames/marco-gym-7.png",
    slice: 450,
    rails: { top: 0.62, bottom: 0.64, left: 0.37, right: 0.37 },
    weight: GYM_WEIGHT,
  },
  {
    id: "gym-8",
    src: "/home/frames/marco-gym-8.png",
    slice: 441,
    rails: { top: 0.65, bottom: 0.64, left: 0.37, right: 0.37 },
    weight: GYM_WEIGHT,
  },
  {
    id: "gym-9",
    src: "/home/frames/marco-gym-9.png",
    slice: 330,
    rails: { top: 0.84, bottom: 0.83, left: 0.5, right: 0.45 },
    weight: GYM_WEIGHT,
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
