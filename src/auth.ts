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
      // Without this, NextAuth throws OAuthAccountNotLinked ("Sign in with a different account")
      // when a user signs in with a different Discord account that has the same email.
      // Discord emails are verified, so linking by email is acceptable for this app.
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  // Use JWT-based sessions so middleware getToken() can see the logged-in user.
  session: { strategy: "jwt" },
  secret: must("NEXTAUTH_SECRET"),

  // Surface role/id on the JWT + session so middleware & pages can gate by role
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        (token as any).role = (user as any)?.role ?? "USER";
        (token as any).id = (user as any).id;
      }
      return token;
    },
    async session({ session, token, user }) {
      const roleFromToken = (token as any)?.role as string | undefined;
      const idFromToken = (token as any)?.id as string | undefined;

      (session.user as any).role = roleFromToken ?? (user as any)?.role ?? "USER";
      (session.user as any).id = idFromToken ?? (user as any)?.id;
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
          // Only set discordId once; with email-based linking enabled, a user may
          // end up linking multiple Discord accounts over time.
          await prisma.user.updateMany({
            where: { id: user.id, discordId: null },
            data: { discordId: account.providerAccountId },
          });
        }
      } catch {
        // ignore if already set
      }
    },
  },
};
