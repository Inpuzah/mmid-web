// src/app/admin/users/page.tsx
import { prisma } from "@/lib/prisma";
import { updateUserRole, promoteByDiscordId } from "./actions";
import { requireAdmin } from "@/lib/authz";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  // Throws if not ADMIN (edge middleware should also block already)
  const { session } = await requireAdmin();
  const role = (session.user as any)?.role ?? "USER";

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      discordId: true,
      createdAt: true,
    },
  });

  return (
    <main className="p-6 space-y-8">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold tracking-[0.18em] uppercase text-yellow-200 drop-shadow-[0_0_6px_rgba(0,0,0,0.9)]">
            User Management
          </h1>
          <p className="text-sm text-slate-400">
            Signed in as {session.user?.email} ({role})
          </p>
        </div>

        {/* Quick promote by Discord ID */}
        <form action={promoteByDiscordId} className="flex items-center gap-2">
          <input
            name="discordId"
            placeholder="Discord ID (e.g. 1234567890)"
            className="px-3 py-2 rounded-[3px] border-2 border-black/80 bg-slate-950/80 text-slate-100 text-sm shadow-[0_0_0_1px_rgba(0,0,0,0.85)]"
          />
          <select
            name="role"
            className="px-3 py-2 rounded-[3px] border-2 border-black/80 bg-slate-950/80 text-slate-100 text-sm shadow-[0_0_0_1px_rgba(0,0,0,0.85)]"
          >
            <option value="MAINTAINER">MAINTAINER</option>
            <option value="ADMIN">ADMIN</option>
            <option value="USER">USER</option>
          </select>
          <button className="px-3 py-2 rounded-[3px] border-2 border-black/80 bg-emerald-500 hover:brightness-110 text-black text-sm shadow-[0_0_0_1px_rgba(0,0,0,0.9),0_4px_0_0_rgba(0,0,0,0.9)]">
            Promote
          </button>
        </form>
      </header>

      <section className="rounded-[4px] border-2 border-black/80 overflow-hidden bg-slate-950/85 shadow-[0_0_0_1px_rgba(0,0,0,0.9),0_8px_0_0_rgba(0,0,0,0.9)]">
        <table className="w-full text-sm">
          <thead className="bg-slate-800/60 text-slate-300">
            <tr>
              <th className="text-left px-4 py-3">User</th>
              <th className="text-left px-4 py-3">Email</th>
              <th className="text-left px-4 py-3">Discord ID</th>
              <th className="text-left px-4 py-3">Role</th>
              <th className="text-left px-4 py-3">Created</th>
              <th className="text-left px-4 py-3 w-40">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-white/5">
                <td className="px-4 py-3">{u.name ?? "—"}</td>
                <td className="px-4 py-3">{u.email ?? "—"}</td>
                <td className="px-4 py-3">{u.discordId ?? "—"}</td>
                <td className="px-4 py-3">{u.role ?? "USER"}</td>
                <td className="px-4 py-3">
                  {u.createdAt ? new Date(u.createdAt).toLocaleString() : "—"}
                </td>
                <td className="px-4 py-3">
                  <form action={updateUserRole} className="flex items-center gap-2">
                    <input type="hidden" name="userId" value={u.id} />
                    <select
                      name="role"
                      defaultValue={u.role ?? "USER"}
                      className="px-2 py-1 rounded-[3px] border-2 border-black/80 bg-slate-950/80 text-slate-100 text-sm shadow-[0_0_0_1px_rgba(0,0,0,0.85)]"
                    >
                      <option value="USER">USER</option>
                      <option value="MAINTAINER">MAINTAINER</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                    <button className="px-3 py-1.5 rounded-[3px] border-2 border-black/80 bg-emerald-500 hover:brightness-110 text-black text-sm shadow-[0_0_0_1px_rgba(0,0,0,0.9),0_4px_0_0_rgba(0,0,0,0.9)]">
                      Save
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  No users yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
