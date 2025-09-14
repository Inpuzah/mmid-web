// src/app/admin/proposals/page.actions.ts
"use server";

import { approveProposal, rejectProposal } from "./actions";

// Wrap to satisfy <form action> requirement: must return void
export async function approveAction(formData: FormData): Promise<void> {
  await approveProposal(formData);
}

export async function rejectAction(formData: FormData): Promise<void> {
  await rejectProposal(formData);
}
