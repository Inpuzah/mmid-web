"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import {
  Home,
  ListOrdered,
  Trophy,
  MessageSquare,
  Info,
  FilePlus2,
  ClipboardList,
  Flag,
  Shield,
  Users,
  User,
  LogIn,
  LogOut,
  MessageCircle,
} from "lucide-react";

import { NAV } from "./site-header.client";
import { signInAction, signOutAction } from "@/components/actions/auth-actions";

type User = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role?: string | null;
};

export default function SidebarNav({ user }: { user: User | null }) {
  const pathname = usePathname();

  const role = user?.role ?? null;
  const isAdmin = role === "ADMIN";
  const isManager = role === "ADMIN" || role === "MAINTAINER";

  const navIconByHref: Record<string, React.ComponentType<{ className?: string }>> = {
    "/": Home,
    "/directory": ListOrdered,
    "/leaderboards": Trophy,
    "/forum": MessageSquare,
    "/about": Info,
  };

  return (
    <aside className="mmid-sidebar">
      {/* Brand + Skyza logo that always links home */}
      <div className="mmid-sidebar-brand">
        <Link href="/" className="flex items-center gap-2" aria-label="Skyza home">
          <div className="mmid-brand-logo overflow-hidden">
            <Image
              src="/skyza-logo.png"
              alt="Skyza logo"
              width={40}
              height={40}
              sizes="40px"
              className={user ? "h-full w-full object-cover" : "h-full w-full object-cover opacity-80 grayscale"}
              priority
            />
          </div>
          <div className="mmid-brand-text">
            <div className="mmid-brand-title">Skyza</div>
            <div className="mmid-brand-subtitle">Murder Mystery Integrity</div>
          </div>
        </Link>
      </div>

      {/* Account section – sign in & staff tools */}
      <div className="mmid-sidebar-section">
        <div className="mmid-nav-label">Account</div>
        <nav className="mmid-nav-list" aria-label="Account navigation">
          {user ? (
            <>
              <div className="px-3 pb-1 pt-0.5 text-[11px] text-muted-foreground">
                Signed in as
                <span className="ml-1 font-semibold text-foreground">
                  {user.name ?? user.email ?? "Account"}
                </span>
              </div>

              <Link
                href="/entries/new"
                className={`mmid-nav-item${
                  pathname === "/entries/new" ? " mmid-nav-item--active" : ""
                }`}
              >
                <span className="mmid-nav-dot" />
                <FilePlus2 className="mmid-nav-icon" />
                <span>New / Edit Entry</span>
              </Link>

              {isManager && (
                <>
                  <Link
                    href="/admin/proposals"
                    className={`mmid-nav-item${
                      pathname?.startsWith("/admin/proposals") ? " mmid-nav-item--active" : ""
                    }`}
                  >
                    <span className="mmid-nav-dot" />
                    <ClipboardList className="mmid-nav-icon" />
                    <span>Review Proposals</span>
                  </Link>
                  <Link
                    href="/admin/flags"
                    className={`mmid-nav-item${
                      pathname?.startsWith("/admin/flags") ? " mmid-nav-item--active" : ""
                    }`}
                  >
                    <span className="mmid-nav-dot" />
                    <Flag className="mmid-nav-icon" />
                    <span>Community Flags</span>
                  </Link>
                  {isAdmin && (
                    <>
                      <Link
                        href="/admin"
                        className={`mmid-nav-item${
                          pathname === "/admin" ? " mmid-nav-item--active" : ""
                        }`}
                      >
                        <span className="mmid-nav-dot" />
                        <Shield className="mmid-nav-icon" />
                        <span>Admin</span>
                      </Link>
                      <Link
                        href="/admin/users"
                        className={`mmid-nav-item${
                          pathname?.startsWith("/admin/users") ? " mmid-nav-item--active" : ""
                        }`}
                      >
                        <span className="mmid-nav-dot" />
                        <Users className="mmid-nav-icon" />
                        <span>Users</span>
                      </Link>
                    </>
                  )}
                </>
              )}

              <Link
                href="/profile"
                className={`mmid-nav-item${
                  pathname?.startsWith("/profile") ? " mmid-nav-item--active" : ""
                }`}
              >
                <span className="mmid-nav-dot" />
                <User className="mmid-nav-icon" />
                <span>Profile</span>
              </Link>

              <form action={signOutAction} className="mt-1">
                <button
                  type="submit"
                  className="mmid-nav-item text-red-200 hover:text-red-50"
                >
                  <span className="mmid-nav-dot" />
                  <LogOut className="mmid-nav-icon" />
                  <span>Sign out</span>
                </button>
              </form>
            </>
          ) : (
            <form action={signInAction}>
              <button type="submit" className="mmid-nav-item">
                <span className="mmid-nav-dot" />
                <LogIn className="mmid-nav-icon" />
                <span>Sign in with Discord</span>
              </button>
            </form>
          )}
        </nav>
      </div>

      {/* Primary nav – main site sections */}
      <div className="mmid-sidebar-section">
        <div className="mmid-nav-label">Menu</div>
        <nav className="mmid-nav-list" aria-label="Primary navigation">
          {NAV.map((item) => {
            const active =
              pathname === item.href ||
              (pathname?.startsWith(item.href) && item.href !== "/");

            const Icon = navIconByHref[item.href] ?? Home;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`mmid-nav-item${active ? " mmid-nav-item--active" : ""}`}
              >
                <span className="mmid-nav-dot" />
                <Icon className="mmid-nav-icon" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Community / utility links – always point at home sections */}
      <div className="mmid-sidebar-section">
        <div className="mmid-nav-label">Community</div>
        <nav className="mmid-nav-list" aria-label="Community navigation">
          <Link href="/#team" className="mmid-nav-item">
            <span className="mmid-nav-dot" />
            <Users className="mmid-nav-icon" />
            <span>Staff / Maintainers</span>
          </Link>
          <Link href="https://discord.gg/Qf6k296bQ9" target="_blank" className="mmid-nav-item">
            <span className="mmid-nav-dot" />
            <MessageCircle className="mmid-nav-icon" />
            <span>Discord &amp; Resources</span>
          </Link>
          <Link href="/#faq" className="mmid-nav-item">
            <span className="mmid-nav-dot" />
            <Info className="mmid-nav-icon" />
            <span>FAQ &amp; Policy</span>
          </Link>
        </nav>
      </div>

      {/* Status footer */}
      <div className="mmid-sidebar-footer">
        <div className="mmid-status-pill">
          <span className="mmid-status-dot" />
          <span>MMID services online</span>
        </div>
      </div>
    </aside>
  );
}
