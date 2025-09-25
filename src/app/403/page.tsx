// src/app/403/page.tsx
export const dynamic = "force-dynamic";

export default function ForbiddenPage() {
  return (
    <main className="mx-auto max-w-xl p-8 text-center">
      <h1 className="text-3xl font-bold mb-3 text-red-400">403 – Forbidden</h1>
      <p className="text-slate-300 mb-6">
        You don’t have permission to view this page.
      </p>
      <a
        href="/"
        className="rounded-md bg-[#ff7a1a] px-4 py-2 font-medium text-black hover:brightness-110"
      >
        Return Home
      </a>
    </main>
  );
}
