# Migraciones

Hasta ahora el schema se aplicaba con `prisma db push`, que no deja historial:
no hay forma de saber qué cambió, ni de revertir, ni de que dos personas
apliquen lo mismo. Con la base ya en Supabase y compartida, eso se vuelve
incómodo.

`0_init` es el **baseline**: el SQL completo del schema actual (25 tablas, 11
enums, 34 índices), generado sin conectarse a ninguna base:

```bash
npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script -o prisma/migrations/0_init/migration.sql
```

## Adoptarlo (lo hace quien administra la base)

La base de Supabase **ya tiene estas tablas**, así que el baseline no hay que
ejecutarlo: hay que marcarlo como aplicado para que Prisma sepa que ese punto
de partida ya existe.

```bash
npx prisma migrate resolve --applied 0_init
```

Ese comando sólo escribe una fila en `_prisma_migrations`; no crea ni modifica
tablas. Está sin correr a propósito: toca una base compartida y esa decisión es
de quien la administra.

## Después del baseline

Cambios de schema con `prisma migrate dev --name lo_que_cambia` en vez de
`db push`. Eso genera un archivo por cambio, versionado en git.

> Ojo: mientras alguien siga usando `db push` contra la misma base, el
> historial vuelve a desincronizarse — el cambio queda aplicado sin migración
> que lo represente.
