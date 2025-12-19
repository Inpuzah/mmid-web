// src/app/admin/tools/minecraft-crawl/page.tsx

import { requireMaintainer } from "@/lib/authz";

import MinecraftCrawlDashboard from "./MinecraftCrawlDashboard.client";

export const dynamic = "force-dynamic";

export default async function MinecraftCrawlAdminPage() {
  await requireMaintainer();
  return <MinecraftCrawlDashboard />;
}
