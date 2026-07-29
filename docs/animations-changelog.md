# Changelog de animaciones de batalla

Registro de qué está hecho y qué falta en el pulido visual de batalla, para no perder de vista el conjunto a medida que se suma de a poco (entre dos personas tocando el mismo sistema, así que doblemente útil). Vive en `docs/` junto al dossier de diseño — no es un changelog de todo el proyecto, solo de las animaciones/UI de batalla.

## Entradas y salidas

- [x] Aparición inicial de ambos sprites al arrancar la batalla (Pokéball se ve viajar antes de revelar al jugador)
- [x] Recall (absorbido por la ball) + throw (ball nueva) al cambiar de Pokémon, voluntario o forzado por debilitamiento
- [x] Debilitamiento (se hunde y se desvanece)
- [x] Curación con poción (glow verde)
- [x] Transición fluida entre Pokémon del mismo entrenador/líder en gimnasios, sin cortar a la pantalla de resultado
- [x] Sprites animados reales (GIF de Showdown, con fallback al official-artwork estático si falla) en vez de imagen fija

## Golpes

- [x] Físico/especial: embestida + sacudida + flash + haz/orbe de color viajando (color según el tipo del movimiento) + banner con nombre del movimiento
- [x] Estado: flash de color en toda la arena + log con quién recibe el efecto real (buff propio vs. debuff al rival correctamente targeteado)
- [x] Popup de daño flotante + popup de "¡Súper efectivo!"/"Golpe crítico!"/etc.
- [x] Flash de pantalla en golpes súper/poco efectivos, con un tier extra de flash ("heavy") en críticos y súper efectivos
- [x] **Intensidad de sacudida escalada según cuánto HP representó el golpe** — un golpe de 2 ya no sacude igual que uno que casi noquea (compone con el tier de flash por efectividad, son dos señales distintas)
- [x] Estados persistentes reales: dormido/paralizado/veneno/quemadura con su propio log y daño residual por turno — ya NO es "pendiente hasta que exista de verdad", ya existe
- [x] Sonido (SFX real por tipo de golpe: normal/crítico/súper efectivo/estado/fallo/ball)
- [x] Multi-golpe real (Double-Slap, Comet Punch, etc.) — motor (`multi-hit.ts` + `resolve-action`) + animación por golpe en arena + log “Hit N times!”

## Captura

- [x] Lanzar la ball: viaja del jugador al rival con arco + giro
- [x] Tambaleo (wobble) en el lugar del rival mientras se resuelve la captura server-side
- [x] Destello dorado si atrapa
- [x] La ball se abre y el rival reaparece si falla, siguiendo directo al contraataque si corresponde
- [x] Pantalla de captura con mote (sprite, stats, movimientos reales)

## Gimnasios y equipo

- [x] Fondo de arena coloreado por tipo (tipo del gimnasio, o del rival actual en encuentros salvajes)
- [x] Retrato real del líder + medalla real en la pantalla de victoria
- [x] Sidebar de equipo propio y del rival visible durante toda la batalla (sprite, HP, fainted) — reemplaza los pips sueltos por una vista completa del roster de ambos lados
- [x] Bloqueo real para no poder salir de una batalla a mitad de combate (antes solo aplicaba a la corrida de gimnasio completa, ahora hay un gate por batalla individual)
- [x] IA del salvaje/entrenador más inteligente al elegir movimiento (antes era aleatorio puro)

## UI general de batalla

- [x] Registro de batalla en dos columnas (jugador izquierda, rival derecha) con scroll y auto-scroll al fondo
- [x] Menú Luchar/Pokémon/Mochila/Huir, recuerda la última vista usada entre turnos (salvo justo después de cambiar de Pokémon, que siempre vuelve al menú raíz)
- [x] Tarjeta de movimiento completa: ícono de categoría (físico/especial/estado), precisión, poder, PP y efectividad — antes solo poder y PP
- [x] **Daño estimado por movimiento** (`damage-forecast.ts`): rango `~min-max%` del HP del rival, o "¡KO seguro!" cuando el roll bajo ya alcanza. Reusa la parte determinista de la fórmula del servidor; deja afuera crítico y objetos, por eso el `~`
- [x] Aviso de orden de turno (quién pega primero por velocidad) en el menú raíz y en el de poderes, con stages y parálisis aplicados
- [x] Badges de stat stages (ATK/DEF/VEL ▲▼N) en las placas de HP — antes un Growl repetido solo dejaba una línea vieja en el log
- [x] Velocidad de animación 1x/2x/3x persistida (`battle-speed.ts`): escala las esperas del timeline y acorta las FX de un disparo; las animaciones en bucle quedan a 1x
- [x] Al cambiar de Pokémon se ve contra quién se está eligiendo (nombre + tipos del rival) y los debilitados llevan chip de KO en vez de solo estar atenuados
- [x] En submenús mobile el log completo se oculta pero sobrevive la última línea; el panel del log es `aria-live` para lectores de pantalla
- [x] Struggle traducido (antes texto inglés hardcodeado en el botón)
- [x] **Movimientos de 2 turnos** (Fly, Dig, Dive, Bounce, Solar Beam, Skull Bash, Razor Wind, Sky Attack): turno 1 carga/desaparece, turno 2 pega automático; semi-invulnerabilidad con excepciones (Gust/Earthquake/Surf…) y ×2 donde corresponde; se cancela si un status impide actuar

## Bug conocido (encontrado en verificación, sin arreglar todavía)

- [ ] La pantalla de "elegí a quién enviar" tras debilitarse a veces muestra el HP de un Pokémon por encima de su máximo (ej. "50/47") en la lista de opciones — la DB tiene el valor real correcto (confirmado, no es pérdida de datos), es un display client-side. Necesita más investigación en el componente de selección de reemplazo forzado.

## Ideas sin empezar (no comprometidas, para evaluar)

- [ ] Animación específica para algún movimiento icónico puntual (ej. Ember tirando 3 proyectiles en vez del haz genérico) — evaluar caso por caso, no escalable a los ~150 movimientos sembrados
- [ ] Shake de cámara/panel completo en golpes muy fuertes (hoy el shake es solo del sprite que recibe el golpe)
