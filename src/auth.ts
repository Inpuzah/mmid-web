// src/auth.ts
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import { prisma } from "@/lib/prisma";

function must(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`[auth] Missing required env: ${name}`);
  return v;
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    DiscordProvider({
      clientId: must("DISCORD_CLIENT_ID"),
      clientSecret: must("DISCORD_CLIENT_SECRET"),
    }),
  ],
  session: { strategy: "database" },
  secret: must("NEXTAUTH_SECRET"),

  // Surface role/id on the session so the header & pages can gate by role
  callbacks: {
    async session({ session, user }) {
      (session.user as any).role = (user as any)?.role ?? "USER";
      (session.user as any).id = user.id;
      return session;
    },
  },

  // Auto-promote OWNER on first successful sign-in, and store Discord ID on link
  events: {
    async signIn({ user }) {
      try {
        const owner = process.env.OWNER_EMAIL;
        if (owner && user?.email === owner) {
          await prisma.user.update({
            where: { id: user.id },
            data: { role: "ADMIN" as any },
          });
        }
      } catch {
        // ignore if user already ADMIN or row not ready yet
      }
    },
    async linkAccount({ user, account }) {
      try {
        if (account?.provider === "discord" && account.providerAccountId) {
          await prisma.user.update({
            where: { id: user.id },
            data: { discordId: account.providerAccountId },
          });
        }
      } catch {
        // ignore if already set
      }
    },
  },
};
