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
   npx prisma db push   # crea las tablas
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
| `npm run db:push` | Sincroniza el schema con la base sin migraciones |
| `npm run db:seed` | Vuelve a sembrar especies/movimientos/objetos desde PokeAPI |

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind CSS v4 · Prisma 7 + PostgreSQL · NextAuth.js v5 · next-intl (ES/EN/PT)
