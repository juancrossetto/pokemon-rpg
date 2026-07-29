# Manual del entrenador

Guía de sistemas del juego. La misma prosa vive en la app (ícono del libro en el chrome) y acá para el equipo.

> Fuente de verdad de copy: `messages/{es,en,pt}.json` → `handbook`.  
> Constantes de reglas: `src/lib/pvp-*`, `src/lib/market-rules.ts`, `src/lib/energy.ts`.

---

## Viaje

La historia no es un menú aparte: es el mapa. Elegís una zona, explorás ahí, y cuando estés listo plantás cara al gimnasio.

- En **Viaje** marcás la zona activa (farmeo + objetivos).
- **Explorar** gasta energía: 1 punto cada 30 minutos.
- **Gimnasios** abren el camino; perder impone cooldown (saltable con gemas).

## Combate

Salvajes, entrenadores y gimnasios comparten la misma arena.

- Turnos: Luchar, cambiar, mochila o huir (solo salvajes).
- Captura: bajá HP y tirale una ball; equipo lleno → PC.
- Estados y tipos condicionan el combate; el XP se reparte entre quienes pelearon.

## PvP

Opcional. No bloquea la historia.

- Elo clásico, arranque **1000**, **K = 32**.
- **Ranked** y **Rápido** mueven Elo; Rápido paga ×0,6 monedas.
- Ligas: Bronce 0 · Plata 1100 · Oro 1250 · Platino 1400 · Diamante 1600 · Maestro 1800 (multiplican monedas al ganar).
- Win base 40 × liga × modo; derrota base 12 × modo.
- Temporadas mensuales UTC + soft reset `0.7 × rating + 0.3 × 1000` + premio por liga.

## Economía

- **Monedas**: día a día (tienda, mercado, cures, motes pagos…).
- **Gemas**: premium (cooldown de gimnasio, y más usos a futuro).
- Mercado entre jugadores con comisión; medallas bajan la tarifa.
