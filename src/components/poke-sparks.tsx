/**
 * Lunares que orbitan detrás del sprite de un Pokémon, teñidos con el color de
 * su tipo. Mismo lenguaje visual que los destellos del login (reutiliza el
 * keyframe `auth-spark-twinkle`), pero en escala de card.
 *
 * Dos decisiones importantes:
 *
 * 1. Todo determinista a partir de `seed`. Con `Math.random()` el servidor y el
 *    cliente generarían posiciones distintas y React tiraría un error de
 *    hidratación; además cada re-render movería los puntos.
 * 2. La distribución es radial (ángulo + radio) y no una grilla como en el
 *    login, porque acá el objetivo es rodear al Pokémon, no llenar un fondo.
 */

const SPARK_COUNTS = {
  default: 9,
  dense: 15,
} as const;

type SparkDensity = keyof typeof SPARK_COUNTS;

/** Hash entero estable a partir del id de la instancia. */
function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function buildSparks(seed: string, count: number) {
  const base = hashSeed(seed);
  return Array.from({ length: count }, (_, i) => {
    const n = base + i * 2654435761;
    // Ángulos repartidos con una rotación propia por card, para que dos cards
    // vecinas no muestren la misma constelación.
    const angle = ((i / count) * 360 + (base % 360)) * (Math.PI / 180);
    // Radio entre 30% y 47%: fuera del cuerpo del sprite, dentro de la card.
    const radius = 30 + ((n >>> 3) % 18);
    // toFixed: sin esto SSR y cliente serializan distinto el float (hidratación).
    const left = (50 + Math.cos(angle) * radius).toFixed(2);
    const top = (48 + Math.sin(angle) * radius * 0.78).toFixed(2);
    const size = [2, 2.5, 3, 2, 3.5][i % 5];
    const duration = (3 + ((n >>> 7) % 25) / 10).toFixed(1);
    const delay = (-(((n >>> 11) % 40) / 10)).toFixed(1);
    return { left, top, size, duration, delay };
  });
}

export function PokeSparks({
  seed,
  accent,
  density = "default",
}: {
  seed: string;
  accent: string;
  density?: SparkDensity;
}) {
  const sparks = buildSparks(seed, SPARK_COUNTS[density]);

  return (
    <div
      aria-hidden
      className={`poke-sparks poke-sparks--${density} pointer-events-none absolute inset-0 z-0 overflow-hidden`}
      style={
        {
          "--spark-color": `${accent}e6`,
          "--spark-glow": `${accent}66`,
        } as React.CSSProperties
      }
    >
      {sparks.map((s, i) => (
        <span
          key={i}
          className="poke-spark"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            animationDuration: `${s.duration}s`,
            animationDelay: `${s.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
