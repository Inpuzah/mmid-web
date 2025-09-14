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

const NAV = [
  { href: "/", label: "Home" },
  { href: "/directory", label: "Directory" },
  { href: "/about", label: "About" },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="hidden md:flex items-center gap-2">
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
              "rounded-lg px-3 py-2 text-sm transition",
              active
                ? "bg-[#ff7a1a]/20 text-white"
                : "text-white/80 hover:bg-white/10 hover:text-white",
            ].join(" ")}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function UserMenu({ user }: { user: User | null }) {
  const role = user?.role ?? null;
  const isManager = role === "ADMIN" || role === "MAINTAINER";

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

        <Link href="/entries/new" className="contents">
          <DropdownMenuItem>New / Edit Entry</DropdownMenuItem>
        </Link>

        {isManager && (
          <>
            <DropdownMenuSeparator />
            <Link href="/admin/proposals" className="contents">
              <DropdownMenuItem>Review Proposals</DropdownMenuItem>
            </Link>
            <Link href="/admin" className="contents">
              <DropdownMenuItem>Admin</DropdownMenuItem>
            </Link>
            <Link href="/admin/users" className="contents">
              <DropdownMenuItem>Users</DropdownMenuItem>
            </Link>
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

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 backdrop-blur-md">
      {/* Gradient layer that matches Skyza home (deep purple → black with slight orange tint) */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="h-full w-full bg-gradient-to-b from-[#130718]/95 via-[#0b0710]/90 to-[#0b0710]/80" />
      </div>

      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-3 md:px-6">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <Link href="/" className="group inline-flex items-center gap-2">
            <Image
              src="/skyza-logo.png"
              alt="Skyza"
              width={28}
              height={28}
              priority
              sizes="32px"
              className="rounded-md ring-2 ring-white/10"
            />
            <span className="text-white font-semibold tracking-tight group-hover:opacity-90">
              Skyza · MMID
            </span>
          </Link>
        </div>

        {/* Center nav (desktop) */}
        <NavLinks />

        {/* Right side */}
        <div className="flex items-center gap-2">
          {user && (
            <Link href="/entries/new" className="hidden md:block">
              <Button
                size="sm"
                className="bg-[#ff7a1a] text-black border border-[#ff7a1a]/50 shadow-[0_6px_20px_rgba(255,122,26,.25)] hover:brightness-110"
              >
                New Entry
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
                <NavLinks onNavigate={() => setOpen(false)} />
                <div className="md:hidden">
                  <div className="h-px my-2 bg-border" />
                  {user && (
                    <Link href="/entries/new" onClick={() => setOpen(false)} className="mb-1">
                      <Button size="sm" className="w-full bg-[#ff7a1a] text-black hover:brightness-110">
                        New / Edit Entry
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
