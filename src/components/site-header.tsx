// src/components/site-header.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import HeaderClient from "./site-header.client";

export const dynamic = "force-dynamic";

export default async function SiteHeader() {
  const session = await getServerSession(authOptions);

  const user =
    (session?.user as {
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role?: string | null;
    }) ?? null;

  return <HeaderClient user={user} />;
}
