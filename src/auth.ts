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

function buildDiscordAvatarUrl(profile: any, account: any): string | null {
  const userId = String(profile?.id ?? account?.providerAccountId ?? "").trim();
  if (!userId) return null;

  const avatarHash = typeof profile?.avatar === "string" ? profile.avatar : null;
  if (avatarHash) {
    const ext = avatarHash.startsWith("a_") ? "gif" : "png";
    return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.${ext}?size=256`;
  }

  const discriminatorRaw = String(profile?.discriminator ?? "").trim();
  if (discriminatorRaw && discriminatorRaw !== "0") {
    const discriminator = Number(discriminatorRaw);
    if (Number.isFinite(discriminator)) {
      return `https://cdn.discordapp.com/embed/avatars/${discriminator % 5}.png`;
    }
  }

  try {
    const snowflake = BigInt(userId);
    const index = Number((snowflake >> BigInt(22)) % BigInt(6));
    return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
  } catch {
    return "https://cdn.discordapp.com/embed/avatars/0.png";
  }
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
    async jwt({ token, user, account, profile }) {
      const discordImage =
        account?.provider === "discord"
          ? buildDiscordAvatarUrl(profile, account)
          : null;

      if (user) {
        (token as any).role = (user as any)?.role ?? "USER";
        (token as any).id = (user as any).id;
        (token as any).picture =
          discordImage ?? (user as any)?.image ?? (token as any).picture;
        if (account?.provider === "discord" && account?.providerAccountId) {
          (token as any).discordId = String(account.providerAccountId);
        }
      }

      if (discordImage && !(token as any).picture) {
        (token as any).picture = discordImage;
      }

      return token;
    },
    async session({ session, token, user }) {
      const roleFromToken = (token as any)?.role as string | undefined;
      const idFromToken = (token as any)?.id as string | undefined;
      const imageFromToken = (token as any)?.picture as string | undefined;
      const discordIdFromToken = (token as any)?.discordId as string | undefined;

      (session.user as any).role = roleFromToken ?? (user as any)?.role ?? "USER";
      (session.user as any).id = idFromToken ?? (user as any)?.id;

      let resolvedImage = imageFromToken ?? session.user.image ?? (user as any)?.image ?? null;
      if (!resolvedImage) {
        const dbUser = idFromToken
          ? await prisma.user.findUnique({ where: { id: idFromToken }, select: { image: true } })
          : session.user?.email
          ? await prisma.user.findUnique({ where: { email: session.user.email }, select: { image: true } })
          : null;
        resolvedImage = dbUser?.image ?? null;
      }

      if (!resolvedImage && discordIdFromToken) {
        try {
          const snowflake = BigInt(discordIdFromToken);
          const index = Number((snowflake >> BigInt(22)) % BigInt(6));
          resolvedImage = `https://cdn.discordapp.com/embed/avatars/${index}.png`;
        } catch {
          resolvedImage = "https://cdn.discordapp.com/embed/avatars/0.png";
        }
      }

      session.user.image = resolvedImage;
      return session;
    },
  },

  // Auto-promote OWNER on first successful sign-in, and store Discord ID on link
  events: {
    async signIn({ user, account, profile }) {
      try {
        const owner = process.env.OWNER_EMAIL;
        const shouldPromote = owner && user?.email === owner;
        const discordImage =
          account?.provider === "discord"
            ? buildDiscordAvatarUrl(profile, account)
            : null;

        if (shouldPromote || user?.image || discordImage) {
          const data: Record<string, unknown> = {};
          if (shouldPromote) data.role = "ADMIN";
          if (discordImage) data.image = discordImage;
          else if (user?.image) data.image = user.image;

          await prisma.user.update({
            where: { id: user.id },
            data,
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
