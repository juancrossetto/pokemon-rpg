// Envuelve Date.now() en una función de módulo aparte: el lint del React
// Compiler marca llamadas a funciones impuras (Date.now, Math.random, etc.)
// directo adentro del cuerpo de un componente, aunque sea un Server
// Component que solo corre una vez por request (no hay re-render posible).
export function nowMs(): number {
  return Date.now();
}
