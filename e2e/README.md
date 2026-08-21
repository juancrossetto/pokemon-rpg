# Tests end-to-end

```bash
npm run test:e2e
```

La primera vez, además: `npx playwright install chromium`.

## Qué cubren

| Spec | Qué prueba |
| --- | --- |
| `onboarding.spec.ts` | Alta → inicial → home. El único camino que nadie puede saltear. |
| `navigation.spec.ts` | Las 20 pantallas principales abren sin 5xx ni errores de consola. |
| `battle.spec.ts` | Entrar en combate, atacar, y que el turno quede escrito en la base. |
| `shop.spec.ts` | Comprar descuenta monedas y suma al inventario. |

## Lo que hay que saber antes de tocarlos

En local corren contra la base indicada por `DATABASE_URL`; si apunta a la base
compartida, la suite está diseñada para no ensuciarla:

- Cada corrida **crea su propia cuenta** (`e2e-<id>@pokerpg.test`) y nunca toca
  la de nadie más.
- El `globalTeardown` borra todo lo que matchee ese prefijo **y** ese dominio.
  El filtro es doble a propósito.
- `workers: 1`. No es por lentitud del runner: paralelizar satura el pooler y
  además hace que los specs se pisen en estado global (rankings, barra
  comunitaria de incursión).

En CI se levanta PostgreSQL 16 como servicio, se aplican las migraciones y se
siembra el catálogo hasta Johto. Ninguna credencial ni dato de Supabase entra
en el workflow.

**Los asserts miran la base con SQL directo, no con Prisma.** Si el test
consultara con el mismo ORM y el mismo esquema que usa la app, un error de mapeo
se cancelaría solo —escribo mal y leo mal igual, el assert pasa—. En SQL el test
es un observador independiente. (Y, secundario: el cliente generado es ESM y
Playwright transpila a CJS.)

**Un combate abierto bloquea toda la app.** `redirectIfInBattle` manda cualquier
ruta a `/battle`; es intencional. Por eso los specs que no son de combate llaman
a `closeActiveBattles()` antes de empezar: los vuelve independientes del orden.

## Selectores

Van por atributo (`autocomplete`, `type`, `data-autofocus`) o por clase
semántica (`.battle-cmd-fight`, `.shop-tile`), nunca por texto: la app tiene tres
idiomas y un test no debería romperse porque alguien retocó una traducción.
