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
  title: "MMID",
  description: "Murder Mystery Integrity Directory",
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
          <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-3 pb-8 pt-2 sm:px-5">
            <SiteHeader />
            <main className="mt-2 min-h-[calc(100vh-4rem)] pb-4">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
