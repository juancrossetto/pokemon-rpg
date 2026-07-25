import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const DAY = 24 * 60 * 60;
/** Sin “recordarme”: 1 día. */
const SESSION_SHORT = DAY;
/** Con “recordarme”: 30 días. */
const SESSION_LONG = 30 * DAY;

function isRemembered(value: unknown): boolean {
  return value === true || value === "true" || value === "on" || value === "1";
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt", maxAge: SESSION_LONG },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email" },
        password: { label: "Password" },
        remember: { label: "Remember" },
      },
      async authorize(credentials) {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") {
          return null;
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.username,
          remember: isRemembered(credentials?.remember),
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        const remember = Boolean(user.remember);
        token.remember = remember;
        const maxAge = remember ? SESSION_LONG : SESSION_SHORT;
        token.sessionExpires = Math.floor(Date.now() / 1000) + maxAge;
      }

      if (
        typeof token.sessionExpires === "number" &&
        Math.floor(Date.now() / 1000) > token.sessionExpires
      ) {
        return null;
      }

      return token;
    },
    session({ session, token }) {
      if (session.user && typeof token.id === "string") {
        session.user.id = token.id;
      }
      return session;
    },
  },
});
