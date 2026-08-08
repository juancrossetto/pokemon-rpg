import Image from "next/image";

// Proporción real del arte (800×381 tras recortar el masterball wordmark).
const LOGO_WIDTH = 800;
const LOGO_HEIGHT = 381;

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
      src="/logo.png?v=masterball"
      alt={alt}
      width={LOGO_WIDTH}
      height={LOGO_HEIGHT}
      priority={priority}
      sizes={sizes}
      className={className}
    />
  );
}
