"use client";

function buildSparks(count: number) {
  // Determinista (sin Math.random en render) — posiciones repartidas tipo estrellas.
  const cols = 10;
  const sparks = [];
  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const jitterX = ((i * 37) % 9) - 4;
    const jitterY = ((i * 53) % 11) - 5;
    const left = Math.min(97, Math.max(2, 3 + col * 9.5 + jitterX));
    const top = Math.min(94, Math.max(4, 4 + row * 11.5 + jitterY));
    const size = [1.5, 1.5, 2, 2, 2.5][i % 5];
    const duration = 3.2 + (i % 8) * 0.4;
    const delay = -((i * 0.31) % 5);
    sparks.push({ left: `${left}%`, top: `${top}%`, size, duration, delay });
  }
  return sparks;
}

const SPARKS = buildSparks(80);

/**
 * Destellos / estrellas suaves para login/register.
 */
export function AuthAtmosphere() {
  return (
    <div
      aria-hidden
      className="auth-atmosphere pointer-events-none absolute inset-0 overflow-hidden"
    >
      {SPARKS.map((spark, i) => (
        <span
          key={i}
          className="auth-spark"
          style={{
            left: spark.left,
            top: spark.top,
            width: spark.size,
            height: spark.size,
            animationDuration: `${spark.duration}s`,
            animationDelay: `${spark.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
