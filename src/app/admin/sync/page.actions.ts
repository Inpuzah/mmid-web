// src/app/admin/sync/page.actions.ts
"use server";

import { syncMmidFromSheet } from "./actions";

// Wrapper so <form action> sees a () => Promise<void>
export async function syncAction(_formData: FormData): Promise<void> {
  await syncMmidFromSheet();
}
