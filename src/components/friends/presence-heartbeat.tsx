"use client";

import { useEffect } from "react";
import { heartbeatPresence } from "@/actions/friends";
import { PRESENCE_HEARTBEAT_MS } from "@/lib/friend-rules";

/**
 * Marca al jugador como presente mientras tiene la app abierta.
 *
 * Antes el ping vivía sólo en `/friends`: jugar en Home o Aventura no
 * actualizaba `lastSeenAt`, y a los 15 minutos figurabas ausente aunque
 * siguieras en sesión. El layout no se desmonta al navegar, así que un
 * intervalo acá cubre toda la app con un write por minuto, no por pantalla.
 */
export function PresenceHeartbeat() {
  useEffect(() => {
    void heartbeatPresence();
    const id = setInterval(() => {
      void heartbeatPresence();
    }, PRESENCE_HEARTBEAT_MS);
    return () => clearInterval(id);
  }, []);
  return null;
}
