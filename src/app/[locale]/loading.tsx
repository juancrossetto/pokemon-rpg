import { RouteLoadingSkeleton } from "@/components/route-loading-skeleton";

/** Reserva el layout principal mientras las rutas autenticadas resuelven datos. */
export default function RouteLoading() {
  return <RouteLoadingSkeleton />;
}
