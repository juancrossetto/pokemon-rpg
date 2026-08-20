# Pokémon RPG

Juego web de captura y batalla estilo Pokémon PRO/CemZoo, hecho con Next.js + Prisma + PostgreSQL. Los datos de especies, movimientos y tipos se siembran desde [PokeAPI](https://pokeapi.co/) (Generación 1 por defecto).

## Requisitos

- Node.js 20+
- Nada de Docker ni Postgres instalado aparte — Prisma 7 trae su propio servidor local de desarrollo.

## Setup

1. Instalar dependencias:

   ```bash
   npm install
   ```

2. Levantar la base de datos local de desarrollo (dejarla corriendo en una terminal aparte):

   ```bash
   npx prisma dev
   ```

   Al arrancar imprime una `DATABASE_URL` de conexión local.

3. Crear un archivo `.env` (basado en `.env.example`) con:

   ```bash
   DATABASE_URL="<la que imprimió npx prisma dev>"
   AUTH_SECRET="<generar con: openssl rand -base64 32>"
   AUTH_TRUST_HOST=true
   ```

4. En otra terminal, con el `.env` ya armado:

   ```bash
   npm run db:migrate -- --name initial_local_setup
   npm run db:seed      # siembra especies/movimientos/tipos desde PokeAPI (tarda unos minutos la primera vez)
   npm run dev
   ```

5. Abrir [http://localhost:3000](http://localhost:3000), registrar una cuenta y elegir Pokémon inicial.

## Scripts

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo (Turbopack) |
| `npm run build` | Build de producción |
| `npm run lint` | ESLint |
| `npm run db:generate` | Regenera el Prisma Client tras cambiar el schema |
| `npm run db:migrate -- --name <cambio>` | Crea y aplica una migración versionada |
| `npm run db:seed` | Vuelve a sembrar especies/movimientos/objetos desde PokeAPI |

## Web Push (opcional)

Generá un par VAPID con `npx web-push generate-vapid-keys` y copiá las claves a
`NEXT_PUBLIC_VAPID_PUBLIC_KEY` y `VAPID_PRIVATE_KEY`. `VAPID_SUBJECT` debe ser
un `mailto:` o una URL administrada por el proyecto. Sin esas variables, la
app y las notificaciones internas siguen funcionando, pero el control push se
muestra como no disponible.

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind CSS v4 · Prisma 7 + PostgreSQL · NextAuth.js v5 · next-intl (ES/EN/PT)
