<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Pokémon RPG — guía para agentes

Juego web de captura y batalla estilo Pokémon PRO/CemZoo. Next.js 16 (App
Router, Turbopack) · React 19 · TypeScript · Tailwind CSS v4 · Prisma 7 +
PostgreSQL (Supabase) · NextAuth.js v5 · next-intl (es/en/pt). Setup completo
en `README.md` — no lo repito acá.

## Comandos

```bash
npm run dev            # servidor de desarrollo (Turbopack)
npm run build           # build de producción — es el gate más confiable: corre
                         # typecheck, valida las rutas y next-intl en conjunto
npm run typecheck       # tsc --noEmit
npm run lint             # eslint directo (config eslint-config-next), no `next lint`
npm test                 # vitest run — toda la suite (lógica pura, sin Prisma)
npx vitest run <patrón>  # un archivo o subconjunto, ej: npx vitest run tower
npm run test:watch      # vitest en watch

npm run db:generate     # regenerar Prisma Client tras tocar schema.prisma
npm run db:migrate      # prisma migrate dev --name <algo> — ver abajo
npm run db:seed          # sembrar especies/movimientos/objetos desde PokeAPI
```

No hay suite E2E ni de componentes. Para cambios de UI la verificación es
`tsc --noEmit` + `eslint <archivos tocados> --max-warnings=0` + `npm run
build`, más inspección manual en el navegador — la mayoría de las rutas exige
sesión (`auth()` redirige a `/login`), así que un navegador de preview sin
login sólo sirve para medir CSS/estructura, no para ver pantallas reales.

## Arquitectura

### Rutas y locale

Todo el árbol de páginas vive bajo `src/app/[locale]/...`.

**En este Next el middleware se llama `proxy.ts`, no `middleware.ts`** —
vive en `src/proxy.ts` y el build lo reporta como `ƒ Proxy (Middleware)`.
Buscar `middleware.ts` no encuentra nada y lleva a concluir, erróneamente, que
no hay middleware. Ahí se monta `createMiddleware(routing)` de next-intl (que
resuelve el locale y redirige `/` → `/es`) y además se inyecta el pathname a
los Server Components vía headers `x-middleware-request-*` + la lista de
override — patrón interno de Next, ver `node_modules/next/dist/docs/` antes de
tocarlo. Los mensajes se cargan en `src/i18n/request.ts` (`getRequestConfig`).

### i18n: paridad de claves + placeholders ICU

`messages/{es,en,pt}.json` tienen que tener **exactamente las mismas claves**
(hoy 2482 por idioma). Verificar paridad tras cualquier edición:

```bash
python -c "
import json
def keys(o,p=''):
    s=set()
    for k,v in o.items():
        s.add(p+'.'+k)
        if isinstance(v,dict): s|=keys(v,p+'.'+k)
    return s
ks={l:keys(json.load(open('messages/%s.json'%l,encoding='utf8'))) for l in ['es','en','pt']}
print(ks['es']==ks['en']==ks['pt'])
"
```

Cuando una clave con variable ICU (`{count}`, `{n}`...) se resuelve en un
Server Component pero el `.replace()` real ocurre después en un Client
Component (por ejemplo, un contador que se termina de armar client-side), hay
que pasarle el propio marcador como valor — `t("clave", { count: "{count}" })`
— para que el string quede intacto. Llamar `t("clave")` sin argumentos cuando
la clave tiene variables tira `FORMATTING_ERROR` en runtime, no en build.

### Prisma

- Client generado a `src/generated/prisma` (gitignorado, `postinstall: prisma
  generate`). Si TypeScript no encuentra un campo que sabés que existe en el
  schema, corré `npm run db:generate` antes de asumir que está mal escrito.
- **Las migraciones ya tienen historial real** (`prisma/migrations/`, baseline
  `0_init` adoptado). Cambios de schema van con `npm run db:migrate` — **no**
  con `prisma db push`: la base es compartida (Supabase) y `db push` no deja
  rastro, así que mezclar los dos métodos desincroniza el historial. Detalle
  completo en `prisma/migrations/README.md`.
- Operaciones read-then-write sobre un jugador (mercado, logros, torre, PvP)
  van dentro de una transacción con `lockUsers(tx, ...)` de `src/lib/db-locks.ts`
  para serializar por fila y evitar carreras en `READ COMMITTED`. Con dos
  jugadores (comprador/vendedor) se bloquea siempre en orden de id para no
  generar deadlocks cruzados.

### Módulos de lógica pura sin Prisma

Varios módulos en `src/lib/` exponen lógica de dominio que tanto Server
Components como Client Components necesitan, pero **no importan Prisma**
aunque exista una versión "completa" del mismo dominio que sí lo hace
(`rarity.ts`, `evolution-readiness.ts`, `trainer-profile.ts`, `market-hub.ts`
tiene contraparte en `evolution-chain.ts`, `friends.ts`). La razón: si un
Client Component importa —aunque sea sólo un tipo— desde un archivo que en
algún punto hace `import { prisma }`, Next empaqueta `pg` en el bundle del
browser y el build muere con `Can't resolve 'dns'`/`'fs'`. Al agregar lógica
nueva que sirva a los dos lados, separarla en un módulo puro (sin
`@/lib/prisma` ni tipos reexportados desde uno que sí lo use) desde el
principio, en vez de reexportar y toparse con el error más tarde.

### Dominios (por carpeta de ruta)

`campaign` progresión de historia por zonas · `tower` ascenso roguelite con
pisos, bendiciones y botín acumulado (`TowerRun.pendingLoot`, se reclama al
cerrar el intento) · `gyms` desafíos de gimnasio con corridas (`GymRun`) ·
`pvp` ladder asíncrono · `market` compraventa entre jugadores · `clans`
guilds · `friends` amistades/bloqueos · `events` misiones temporales ·
`pokedex` registro de especies vistas/capturadas · `profile` estadísticas,
rango y logros **derivados** de contadores reales (medallas, capturas,
victorias) — no hay stats inventadas, ver `src/lib/trainer-profile.ts` ·
`inventory` / `pc` / `team` gestión del equipo y la mochila · `ranking`
tablas segmentadas (global/país/especie).

### Motor de combate

El resolutor determinístico vive en `src/lib/battle.ts` +
`src/lib/resolve-action.ts`, apoyado por `capture.ts`, `flee.ts`,
`multi-hit.ts` y `type-effectiveness.ts`. Es lo único con cobertura de tests
real (`src/lib/__tests__/combat-core.test.ts`,
`combat-engine.test.ts`, `damage-forecast.test.ts`, `two-turn.test.ts`) —
correr `npx vitest run combat` antes y después de tocar cualquiera de esos
archivos.

### Navegación

`src/lib/navigation.ts` (`NAV_GROUPS`) es la única fuente de verdad para el
navbar desktop, la bottom bar mobile y el drawer "Más". Antes estaba escrita
cuatro veces a mano y terminaba desincronizada entre superficies — un destino
nuevo se agrega en `NAV_GROUPS`, nunca directamente en `site-header.tsx` o
`mobile-chrome.tsx`.

### Server actions

`src/actions/*.ts` con `"use server"`, un dominio por archivo. Devuelven una
unión discriminada (`{ ok: true, ... } | { ok: false, error: "..." }`) en vez
de tirar excepciones para errores esperables (no autorizado, ya reclamado,
estado inválido), y llaman `revalidatePath` después de mutar. Si la vista
afectada vive en un layout compartido (header, chrome mobile) y no sólo en la
página que llamó la acción, revalidar con `{ ... }, "layout"` — revalidar sólo
la ruta hoja deja el resto de la UI con datos viejos hasta la próxima
navegación.

### Estilos

Tailwind v4. Usar `@utility` (no `@layer utilities`) para cualquier clase que
necesite variantes responsive (`sm:`, `lg:`) — sólo las declaradas con
`@utility` generan esas variantes; `@layer utilities` no. `globals.css` ya
tiene una librería grande de `@keyframes` con nombres descriptivos (efectos de
batalla, evolución, torre, perfil...) — revisar ahí antes de escribir una
animación nueva, y si se agrega una, sumarla también al bloque
`@media (prefers-reduced-motion: reduce)` correspondiente.

### Hidratación e islas de cliente

Nada de `Math.random()` ni `Date.now()` durante el render — server y cliente
producen valores distintos y React tira error de hidratación. Para
aleatoriedad decorativa (posiciones de partículas, offsets), usar un hash
determinístico sembrado por un id estable (ver `src/components/poke-sparks.tsx`).
Para el primer tick de un contador/temporizador que depende del reloj del
cliente, usar `requestAnimationFrame` en vez de `setState` síncrono dentro del
`useEffect` de montaje.

### Regla de lint estricta a tener en cuenta

`eslint-config-next` (vía `react-hooks`) marca como **error**, no warning:

- `setState` llamado sincrónicamente en el cuerpo de un `useEffect` sin
  gatear por un evento externo (`react-hooks/set-state-in-effect`). Si el
  efecto sólo necesita sincronizar estado derivado de props, calcularlo en el
  render o en un handler; si de verdad necesita el primer tick post-montaje,
  envolver el `setState` en `requestAnimationFrame`.
- Cualquier función importada cuyo nombre empiece con `use` se trata como
  hook por `rules-of-hooks`, aunque sea una server action (`useEvolutionStone`,
  `useRareCandy`). Si el nombre es correcto y no se puede renombrar, alisar el
  import (`import { useX as applyX }`) en vez de deshabilitar la regla.

### PWA / iOS standalone

La app se puede anclar a pantalla de inicio (`src/app/[locale]/manifest.ts`,
`display: standalone`). Con la app anclada, iOS deja rebotar el scroll del
documento y eso despega los `position: fixed` (bottom nav, barras de acción) —
mitigado con `overscroll-behavior-y: none` acotado a
`@media (display-mode: standalone)` en `globals.css`. `visualViewport` dispara
`scroll` en cada frame del rebote elástico en iOS: no atar handlers de
medición/reposicionamiento a ese evento, sólo a `resize`.
