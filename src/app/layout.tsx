// src/app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SiteHeader from "@/components/site-header";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

// Prefer NEXT_PUBLIC_SITE_URL, fall back to NEXTAUTH_URL, then localhost
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.NEXTAUTH_URL ??
  "http://localhost:3000";

export const metadata: Metadata = {
  title: "MMID · Skyza Murder Mystery Integrity Directory",
  description:
    "Community-run integrity directory for Hypixel Murder Mystery, started in the Skyza guild and maintained by the wider MMID community.",
  metadataBase: new URL(siteUrl),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <div className="relative min-h-screen">
          {/* Background image removed; rely on solid bg-background */}
          <div className="relative mx-auto flex min-h-screen max-w-[1400px] flex-col px-3 pb-8 pt-2 sm:px-5">
            <SiteHeader />
            <main className="mt-2 min-h-[calc(100vh-6rem)] pb-6">{children}</main>
            <footer className="mt-auto border-t border-border/60 pt-4 text-xs text-muted-foreground">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="max-w-xl leading-relaxed">
                  MMID is a community-run project and is not affiliated with or endorsed by Mojang Studios,
                  Microsoft, Hypixel Inc., or any of their partners. Minecraft is a trademark of Mojang AB.
                  Hypixel is a trademark of Hypixel Inc. All game data and player information are provided for
                  community moderation and reference only.
                </p>
                <p className="text-[11px] text-muted-foreground/80">
                  Use of this site is at your own discretion. Do not harass or witch-hunt any listed players.
                </p>
              </div>
            </footer>
          </div>
        </div>
      </body>
    </html>
  );
}
