// src/components/site-header.client.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu } from "lucide-react";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";

import { signInAction, signOutAction } from "@/components/actions/auth-actions";

type User = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role?: string | null;
};

export const NAV = [
  { href: "/", label: "Home" },
  { href: "/directory", label: "Directory" },
  { href: "/leaderboards", label: "Leaderboards" },
  { href: "/forum", label: "Forum" },
  { href: "/about", label: "About" },
];

function NavLinks({ user, onNavigate }: { user: User | null; onNavigate?: () => void }) {
  const pathname = usePathname();
  const role = user?.role ?? null;
  const isAdmin = role === "ADMIN";
  const isReplayOfficer = role === "REPLAY_OFFICER" || role === "ADMIN";
  const isMaintainer = role === "MAINTAINER" || role === "ADMIN";
  const isManager = isReplayOfficer || isMaintainer;
  return (
    <nav className="hidden md:flex items-center gap-1.5">
      {NAV.map((item) => {
        const active =
          pathname === item.href ||
          (pathname?.startsWith(item.href) && item.href !== "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={[
              "relative rounded px-3 py-2 text-sm font-semibold tracking-wide transition uppercase",
              active
                ? "text-amber-100 after:absolute after:bottom-0 after:left-3 after:right-3 after:h-0.5 after:bg-amber-400"
                : "text-slate-300 hover:text-white hover:bg-white/5",
            ].join(" ")}
          >
            {item.label}
          </Link>
        );
      })}

      {isManager && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="relative rounded px-3 py-2 text-sm font-semibold tracking-wide text-slate-300 hover:text-white hover:bg-white/5 uppercase">
              Directory Ops
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <Link href="/maintainer?tab=overview" className="contents" onClick={onNavigate}>
              <DropdownMenuItem>Overview</DropdownMenuItem>
            </Link>
            {isReplayOfficer && (
              <>
                <Link href="/maintainer/reports?view=queue" className="contents" onClick={onNavigate}>
                  <DropdownMenuItem>New Reports</DropdownMenuItem>
                </Link>
                <Link href="/maintainer/reports?view=approved" className="contents" onClick={onNavigate}>
                  <DropdownMenuItem>Approved Reports</DropdownMenuItem>
                </Link>
                <Link href="/maintainer/reports?view=rejected" className="contents" onClick={onNavigate}>
                  <DropdownMenuItem>Rejected Reports</DropdownMenuItem>
                </Link>
              </>
            )}
            {isMaintainer && (
              <>
                <DropdownMenuSeparator />
                <Link href="/maintainer?tab=intake" className="contents" onClick={onNavigate}>
                  <DropdownMenuItem>Report Intake</DropdownMenuItem>
                </Link>
                <Link href="/maintainer?tab=directory" className="contents" onClick={onNavigate}>
                  <DropdownMenuItem>Directory Actions</DropdownMenuItem>
                </Link>
                <Link href="/maintainer?tab=stale" className="contents" onClick={onNavigate}>
                  <DropdownMenuItem>Stale Entries</DropdownMenuItem>
                </Link>
                <Link href="/maintainer?tab=analytics" className="contents" onClick={onNavigate}>
                  <DropdownMenuItem>Analytics</DropdownMenuItem>
                </Link>
              </>
            )}
            {isAdmin && (
              <>
                <DropdownMenuSeparator />
                <Link href="/admin" className="contents" onClick={onNavigate}>
                  <DropdownMenuItem>Admin</DropdownMenuItem>
                </Link>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Community submenu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="relative rounded px-3 py-2 text-sm font-semibold tracking-wide text-slate-300 hover:text-white hover:bg-white/5 uppercase">
            Community
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <Link href="/#team" className="contents" onClick={onNavigate}>
            <DropdownMenuItem>Staff / Maintainers</DropdownMenuItem>
          </Link>
          <Link href="https://discord.gg/Qf6k296bQ9" target="_blank" className="contents" onClick={onNavigate}>
            <DropdownMenuItem>Discord &amp; Resources</DropdownMenuItem>
          </Link>
          <Link href="/#faq" className="contents" onClick={onNavigate}>
            <DropdownMenuItem>FAQ &amp; Policy</DropdownMenuItem>
          </Link>
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  );
}

function UserMenu({ user }: { user: User | null }) {
  const role = user?.role ?? null;
  const isAdmin = role === "ADMIN";
  const isManager = role === "ADMIN" || role === "MAINTAINER" || role === "REPLAY_OFFICER";

  if (!user) {
    return (
      <form action={signInAction}>
        <Button
          size="sm"
          className="bg-white text-slate-900 hover:brightness-95"
        >
          Sign in
        </Button>
      </form>
    );
  }

  const initials = (
    user.name?.split(" ").map((w) => w[0]).join("").slice(0, 2) ||
    user.email?.[0] ||
    "?"
  ).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 rounded-xl px-2 py-1 hover:bg-white/10">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.image ?? undefined} alt={user.name ?? "User"} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <span className="hidden sm:block text-sm text-white/90">
            {user.name ?? user.email ?? "Account"}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="truncate">
          {user.name ?? user.email ?? "Signed in"}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <Link href="/reports/new" className="contents">
          <DropdownMenuItem>Submit Report</DropdownMenuItem>
        </Link>

        {isManager && (
          <>
            <DropdownMenuSeparator />
            <Link href="/maintainer" className="contents">
              <DropdownMenuItem>Maintainer Dashboard</DropdownMenuItem>
            </Link>
            <Link href="/maintainer/reports" className="contents">
              <DropdownMenuItem>New Reports</DropdownMenuItem>
            </Link>
            <Link href="/maintainer/queue" className="contents">
              <DropdownMenuItem>Report Intake</DropdownMenuItem>
            </Link>
            {isAdmin && (
              <>
                <Link href="/admin" className="contents">
                  <DropdownMenuItem>Admin</DropdownMenuItem>
                </Link>
                <Link href="/admin/users" className="contents">
                  <DropdownMenuItem>Users</DropdownMenuItem>
                </Link>
              </>
            )}
          </>
        )}

        <DropdownMenuSeparator />
        <Link href="/profile" className="contents">
          <DropdownMenuItem>Profile</DropdownMenuItem>
        </Link>
        <DropdownMenuSeparator />
        <form action={signOutAction}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full text-left">
              Sign out
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function HeaderClient({ user }: { user: User | null }) {
  const [open, setOpen] = useState(false);

  if (typeof window !== "undefined") {
    console.log("Header user", user);
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-[rgba(8,10,14,0.75)] backdrop-blur-xl">
      <div className="flex h-14 w-full items-center gap-4 px-3 md:px-6">
        {/* Brand */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <Link href="/" className="group inline-flex items-center gap-3">
            <Image
              src="/skyza-logo.png"
              alt="Skyza"
              width={40}
              height={40}
              priority
              sizes="40px"
              className="rounded-md ring-1 ring-amber-300/40"
            />
            <span className="hidden sm:inline bg-gradient-to-r from-amber-200 via-yellow-300 to-emerald-300 bg-clip-text text-transparent text-xl font-extrabold tracking-[0.18em] uppercase">
              Skyza · MMID
            </span>
          </Link>
        </div>

        {/* Center nav */}
        <div className="hidden md:flex flex-1 items-center justify-center">
          <NavLinks user={user} />
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2 ml-auto">
          {user && (
            <Link href="/reports/new" className="hidden md:block">
              <Button
                size="sm"
                className="bg-[#ff7a1a] text-black border border-[#ff7a1a]/50 shadow-[0_6px_20px_rgba(255,122,26,.25)] hover:brightness-110"
              >
                Submit Report
              </Button>
            </Link>
          )}

          <div className="hidden md:block">
            <UserMenu user={user} />
          </div>

          {/* Mobile nav */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button size="icon" variant="ghost" className="md:hidden text-white hover:bg-white/10">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[80vw] sm:w-80">
              <SheetHeader>
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <div className="mt-4 flex flex-col gap-2">
                <NavLinks user={user} onNavigate={() => setOpen(false)} />
                <div className="md:hidden">
                  <div className="h-px my-2 bg-border" />
                  {user && (
                    <Link href="/reports/new" onClick={() => setOpen(false)} className="mb-1">
                      <Button size="sm" className="w-full bg-[#ff7a1a] text-black hover:brightness-110">
                        Submit Report
                      </Button>
                    </Link>
                  )}
                  <UserMenu user={user} />
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
