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
          <h1 className="text-2xl font-semibold">User Management</h1>
          <p className="text-sm text-slate-400">
            Signed in as {session.user?.email} ({role})
          </p>
        </div>

        {/* Quick promote by Discord ID */}
        <form action={promoteByDiscordId} className="flex items-center gap-2">
          <input
            name="discordId"
            placeholder="Discord ID (e.g. 1234567890)"
            className="px-3 py-2 rounded-md bg-slate-800 text-slate-100 border border-white/10"
          />
          <select
            name="role"
            className="px-3 py-2 rounded-md bg-slate-800 text-slate-100 border border-white/10"
          >
            <option value="MAINTAINER">MAINTAINER</option>
            <option value="ADMIN">ADMIN</option>
            <option value="USER">USER</option>
          </select>
          <button className="px-3 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white">
            Promote
          </button>
        </form>
      </header>

      <section className="rounded-xl border border-white/10 overflow-hidden">
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
                      className="px-2 py-1 rounded-md bg-slate-800 text-slate-100 border border-white/10"
                    >
                      <option value="USER">USER</option>
                      <option value="MAINTAINER">MAINTAINER</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                    <button className="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white">
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
