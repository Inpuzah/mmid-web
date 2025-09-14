// src/components/actions/auth-actions.ts
"use client";

import { signIn, signOut } from "next-auth/react";

export async function signInAction() {
  await signIn("discord");
}

export async function signOutAction() {
  await signOut();
}
