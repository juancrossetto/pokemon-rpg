import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ACTION_RATE_LIMITS, allowAction, allowUserAction } from "@/lib/rate-limit";

/**
 * El módulo guarda la ventana en un `Map` de módulo, así que los tests usan
 * claves distintas entre sí en vez de resetear estado global: el orden de
 * ejecución no debería poder hacer fallar a otro test.
 */
let seq = 0;
const key = (label: string) => `test:${label}:${(seq += 1)}`;

describe("allowAction", () => {
  it("deja pasar hasta el límite y frena en el siguiente", () => {
    const k = key("basic");
    expect(allowAction(k, 3, 60_000)).toBe(true);
    expect(allowAction(k, 3, 60_000)).toBe(true);
    expect(allowAction(k, 3, 60_000)).toBe(true);
    expect(allowAction(k, 3, 60_000)).toBe(false);
  });

  it("cada clave lleva su propio presupuesto", () => {
    const a = key("iso-a");
    const b = key("iso-b");
    expect(allowAction(a, 1, 60_000)).toBe(true);
    expect(allowAction(a, 1, 60_000)).toBe(false);
    // Gastar la de `a` no puede afectar a `b`: si no, dos jugadores (o dos
    // acciones distintas) compartirían cupo.
    expect(allowAction(b, 1, 60_000)).toBe(true);
  });

  it("un límite de cero frena todo", () => {
    expect(allowAction(key("zero"), 0, 60_000)).toBe(false);
  });
});

describe("allowAction · ventana deslizante", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("libera cupo al salir los intentos de la ventana", () => {
    const k = key("slide");
    expect(allowAction(k, 2, 1_000)).toBe(true);
    expect(allowAction(k, 2, 1_000)).toBe(true);
    expect(allowAction(k, 2, 1_000)).toBe(false);

    // Justo antes de que expire el primero sigue frenado.
    vi.advanceTimersByTime(999);
    expect(allowAction(k, 2, 1_000)).toBe(false);

    // Pasada la ventana entera, el presupuesto vuelve completo.
    vi.advanceTimersByTime(1_001);
    expect(allowAction(k, 2, 1_000)).toBe(true);
    expect(allowAction(k, 2, 1_000)).toBe(true);
    expect(allowAction(k, 2, 1_000)).toBe(false);
  });

  it("es deslizante, no de bloques fijos", () => {
    const k = key("rolling");
    expect(allowAction(k, 2, 1_000)).toBe(true);
    vi.advanceTimersByTime(600);
    expect(allowAction(k, 2, 1_000)).toBe(true);
    expect(allowAction(k, 2, 1_000)).toBe(false);

    // A los 1.050ms venció el primero (t=0) pero no el segundo (t=600):
    // queda exactamente un lugar, no dos.
    vi.advanceTimersByTime(450);
    expect(allowAction(k, 2, 1_000)).toBe(true);
    expect(allowAction(k, 2, 1_000)).toBe(false);
  });

  it("estar frenado no extiende el castigo", () => {
    // Un rechazo no debe contar como intento: si contara, insistir dejaría al
    // jugador bloqueado para siempre.
    const k = key("no-penalty");
    expect(allowAction(k, 1, 1_000)).toBe(true);
    for (let i = 0; i < 20; i += 1) allowAction(k, 1, 1_000);
    vi.advanceTimersByTime(1_001);
    expect(allowAction(k, 1, 1_000)).toBe(true);
  });
});

describe("allowUserAction", () => {
  it("separa el cupo por jugador", () => {
    const action = key("per-user");
    const budget = ACTION_RATE_LIMITS.claim.limit;
    for (let i = 0; i < budget; i += 1) {
      expect(allowUserAction("claim", action, "user-a")).toBe(true);
    }
    expect(allowUserAction("claim", action, "user-a")).toBe(false);
    // El jugador B no paga por lo que hizo A.
    expect(allowUserAction("claim", action, "user-b")).toBe(true);
  });

  it("separa el cupo por acción dentro de la misma familia", () => {
    const one = key("fam-1");
    const two = key("fam-2");
    const budget = ACTION_RATE_LIMITS.purchase.limit;
    for (let i = 0; i < budget; i += 1) allowUserAction("purchase", one, "u");
    expect(allowUserAction("purchase", one, "u")).toBe(false);
    // Comprar en la tienda no debe gastar el cupo de comprar energía.
    expect(allowUserAction("purchase", two, "u")).toBe(true);
  });

  it("los presupuestos son holgados para el juego a mano", () => {
    // Si alguno bajara a un número que un jugador real alcanza jugando normal,
    // el límite dejaría de ser invisible y se volvería un bug de UX.
    for (const [name, budget] of Object.entries(ACTION_RATE_LIMITS)) {
      expect(budget.limit, name).toBeGreaterThanOrEqual(20);
      expect(budget.windowMs, name).toBeGreaterThan(0);
    }
  });
});
