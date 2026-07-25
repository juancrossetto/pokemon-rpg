import Image from "next/image";

// Proporción real del arte (947x447 tras recortarlo). El asset original venía
// con ~300px de margen transparente por lado, lo que hacía que en el navbar el
// logo se viera diminuto aunque la caja midiera lo correcto.
const LOGO_WIDTH = 947;
const LOGO_HEIGHT = 447;

/**
 * Logo de marca. Fuente única para el navbar (desktop y mobile) y las
 * pantallas de auth; antes cada lugar repetía el texto "Pokémon RPG" con su
 * propio estilo.
 *
 * El tamaño se controla desde `className` con alto (`h-9 w-auto`) o ancho
 * (`w-[240px] h-auto`), nunca con ambos, para no deformar el arte.
 */
export function BrandLogo({
  alt,
  className,
  priority = false,
  sizes = "300px",
}: {
  alt: string;
  className?: string;
  priority?: boolean;
  /**
   * Ancho real de render. Sin esto Next sirve una variante de 1080px para un
   * logo de 76px en el navbar, porque toma como referencia el `width` del
   * archivo (947) y no el tamaño al que se muestra.
   */
  sizes?: string;
}) {
  return (
    <Image
      src="/logo.png"
      alt={alt}
      width={LOGO_WIDTH}
      height={LOGO_HEIGHT}
      priority={priority}
      sizes={sizes}
      className={className}
    />
  );
}
