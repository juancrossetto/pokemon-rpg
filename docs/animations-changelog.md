# Changelog de animaciones de batalla

Registro de qué está hecho y qué falta en el pulido visual de batalla, para no perder de vista el conjunto a medida que se suma de a poco. Vive en `docs/` junto al dossier de diseño — no es un changelog de todo el proyecto, solo de las animaciones/UI de batalla.

## Entradas y salidas

- [x] Aparición inicial de ambos sprites al arrancar la batalla (Pokéball se ve viajar antes de revelar al jugador)
- [x] Recall (absorbido por la ball) + throw (ball nueva) al cambiar de Pokémon, voluntario o forzado por debilitamiento
- [x] Debilitamiento (se hunde y se desvanece)
- [x] Curación con poción (glow verde)
- [x] Transición fluida entre Pokémon del mismo entrenador/líder en gimnasios, sin cortar a la pantalla de resultado

## Golpes

- [x] Físico: embestida + sacudida + flash
- [x] Especial: haz de color viajando entre sprites (color según el tipo del movimiento)
- [x] Estado: brillo pulsante coloreado por tipo sobre quien lo usa
- [x] Popup de daño flotante
- [x] Flash de pantalla en golpes súper/poco efectivos
- [x] **Intensidad de sacudida/flash/haz escalada según cuánto HP representó el golpe** — un golpe de 2 ya no se ve idéntico a uno que casi noquea
- [ ] Multi-golpe real (Double-Slap, Comet Punch, etc.) — hoy el motor resuelve estos movimientos como un solo golpe, mecánica y visualmente; para animarlo bien primero hay que sumar el multi-hit real a la fórmula de daño, no es solo un tema de animación
- [ ] Distinguir buff propio vs. debuff al rival en movimientos de estado — hoy el glow siempre aparece sobre quien usa el movimiento, aunque el efecto real sea sobre el rival (ej. Growl baja el ataque del rival pero hoy brilla quien lo usa). Necesita saber a quién apunta cada movimiento (dato que no está guardado todavía, PokeAPI lo tiene como `target`)
- [ ] Partículas específicas por estado persistente (veneno/parálisis/quemadura) — no tiene sentido animarlo hasta que esos estados existan de verdad en el motor (hoy no aplican ningún efecto, ver ronda 23 de la memoria del proyecto)

## Captura

- [x] Lanzar la ball: viaja del jugador al rival con arco + giro
- [x] Tambaleo (wobble) en el lugar del rival mientras se resuelve la captura server-side
- [x] Destello dorado si atrapa
- [x] La ball se abre y el rival reaparece si falla, siguiendo directo al contraataque si corresponde
- [x] Pantalla de captura con mote (sprite, stats, movimientos reales)

## Gimnasios

- [x] Fondo de arena coloreado por tipo (tipo del gimnasio, o del rival actual en encuentros salvajes)
- [x] Pips del equipo rival cuando el oponente tiene más de un Pokémon (entrenadores/líderes)
- [x] Retrato real del líder + medalla real en la pantalla de victoria

## UI general de batalla

- [x] Registro de batalla en dos columnas (jugador izquierda, rival derecha) con scroll y auto-scroll al fondo
- [x] Menú Luchar/Pokémon/Mochila/Huir, recuerda la última vista usada entre turnos (salvo justo después de cambiar de Pokémon, que siempre vuelve al menú raíz)

## Ideas sin empezar (no comprometidas, para evaluar)

- [ ] Animación específica para algún movimiento icónico puntual (ej. Ember tirando 3 proyectiles en vez del haz genérico) — evaluar caso por caso, no escalable a los ~150 movimientos sembrados
- [ ] Shake de cámara/panel completo en golpes muy fuertes (hoy el shake es solo del sprite que recibe el golpe)
- [ ] Sonido/SFX — el sistema es 100% visual por ahora, sin audio
