/** Errores esperables cuando el pool o una transacción están momentáneamente ocupados. */
export function isDatabaseBusyError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as { code?: string; message?: string };
  const message = (value.message ?? "").toLowerCase();
  return (
    value.code === "P2028" ||
    value.code === "P1001" ||
    value.code === "P1017" ||
    message.includes("transaction") && message.includes("timeout") ||
    message.includes("connection timeout") ||
    message.includes("max clients") ||
    message.includes("connectionclosed")
  );
}
