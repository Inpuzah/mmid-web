// src/app/login/page.tsx
"use client";

import { signIn } from "next-auth/react";

export default function LoginPage() {
  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-[4px] border-2 border-black/80 bg-slate-950/90 px-6 py-6 shadow-[0_0_0_1px_rgba(0,0,0,0.9),0_10px_0_0_rgba(0,0,0,0.9)]">
        <h1 className="text-xl font-extrabold tracking-[0.18em] uppercase text-yellow-200 text-center drop-shadow-[0_0_6px_rgba(0,0,0,0.9)]">
          Sign In
        </h1>
        <p className="mt-3 text-sm text-slate-300 text-center">
          Access to MMID requires signing in with Discord.
        </p>
        <div className="mt-6 flex justify-center">
          <button
            onClick={() => signIn("discord")}
            className="inline-flex items-center gap-2 rounded-[3px] border-2 border-black/80 bg-[#5865F2] px-5 py-2 text-sm font-semibold text-white shadow-[0_0_0_1px_rgba(0,0,0,0.9),0_4px_0_0_rgba(0,0,0,0.9)] hover:brightness-110 active:translate-y-[2px] active:shadow-[0_0_0_1px_rgba(0,0,0,0.9),0_2px_0_0_rgba(0,0,0,0.9)]"
            type="button"
          >
            <span>Sign in with Discord</span>
          </button>
        </div>
      </div>
    </main>
  );
}
