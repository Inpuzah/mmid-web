// src/app/login/page.tsx
"use client";

import { signIn } from "next-auth/react";

export default function LoginPage() {
  return (
    <main className="mx-auto max-w-xl p-8 text-center">
      <h1 className="text-3xl font-bold mb-3">Sign in</h1>
      <p className="text-slate-300 mb-6">
        Access to this directory requires signing in with Discord.
      </p>
      <button
        onClick={() => signIn("discord")}
        className="rounded-md bg-[#5865F2] px-5 py-2 text-white font-medium hover:bg-[#4752C4] transition"
      >
        Sign in with Discord
      </button>
    </main>
  );
}
