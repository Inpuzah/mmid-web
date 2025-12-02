import type { PageProps } from "next";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { deletePost, deleteThread, replyToThread, toggleLockThread, togglePinThread } from "../actions";

export const dynamic = "force-dynamic";

type ForumThreadPageProps = PageProps<{
  id: string;
}>;

function initialsFrom(name?: string | null, fallback?: string | null): string {
  if (name) {
    const parts = name.split(" ").filter(Boolean);
    if (parts.length) return parts.map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  }
  if (fallback && fallback.length) return fallback[0]!.toUpperCase();
  return "?";
}

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export default async function ForumThreadPage({ params }: ForumThreadPageProps) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const user = (session?.user as any) ?? null;
  const role = (user?.role as string | undefined) ?? "USER";
  const userId = (user?.id as string | undefined) ?? null;
  const isManager = role === "ADMIN" || role === "MAINTAINER";

  const thread = await prisma.forumThread.findUnique({
    where: { id },
    include: {
      author: true,
      replies: {
        orderBy: { createdAt: "asc" },
        include: { author: true },
      },
    },
  });

  if (!thread) {
    notFound();
  }

  const canDeleteThread = isManager || (!!userId && thread.authorId === userId);

  return (
    <main className="mx-auto max-w-5xl space-y-5 py-6 text-sm text-foreground">
      <section className="rounded-[3px] border-2 border-black/80 bg-[radial-gradient(circle_at_top,#1f2937_0%,#020617_65%)] px-5 py-4 shadow-[0_0_0_1px_rgba(0,0,0,0.85),0_8px_0_0_rgba(0,0,0,0.9)]">
        <header className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-300">
                {thread.isAnnouncement ? "Staff Announcement" : "Community Thread"}
              </p>
              <h1 className="mt-1 text-xl font-extrabold text-white drop-shadow-[0_0_6px_rgba(0,0,0,0.9)]">
                {thread.title}
              </h1>
            </div>
            <div className="flex flex-wrap justify-end gap-1">
              {thread.isPinned && (
                <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-semibold text-black uppercase tracking-[0.18em]">
                  Pinned
                </span>
              )}
              {thread.isLocked && (
                <span className="rounded-full bg-slate-700 px-2 py-0.5 text-[10px] font-semibold text-slate-100 uppercase tracking-[0.18em]">
                  Locked
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 text-xs text-slate-300/90">
            <div className="flex items-center gap-2">
              <Avatar className="h-7 w-7">
                <AvatarImage src={thread.author.image ?? undefined} alt={thread.author.name ?? "User"} />
                <AvatarFallback>
                  {initialsFrom(thread.author.name, thread.author.email)}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="font-medium text-slate-50">
                  {thread.author.name ?? thread.author.email ?? "Account"}
                </div>
                <div className="text-[11px] text-slate-300">Posted {fmtDate(thread.createdAt)}</div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1 text-[11px] text-slate-300">
              <div>
                Replies: <span className="font-semibold text-slate-50">{thread.replyCount}</span>
              </div>
              <div>
                Last activity: <span className="font-semibold text-slate-50">{fmtDate(thread.lastActivityAt ?? thread.createdAt)}</span>
              </div>
            </div>
          </div>

          <article className="mt-4 rounded-[3px] border border-slate-800/80 bg-black/40 p-4 text-sm text-slate-100 shadow-[0_0_0_1px_rgba(0,0,0,0.85)] whitespace-pre-wrap">
            {thread.body}
          </article>

          {isManager && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
              <span>Maintainer tools</span>
              <div className="flex flex-wrap gap-2">
                <form action={togglePinThread}>
                  <input type="hidden" name="threadId" value={thread.id} />
                  <Button
                    type="submit"
                    size="sm"
                    variant="outline"
                    className="border-amber-400/80 text-amber-200 hover:bg-amber-500/10 h-7 px-2 text-[11px]"
                  >
                    {thread.isPinned ? "Unpin" : "Pin"} thread
                  </Button>
                </form>
                <form action={toggleLockThread}>
                  <input type="hidden" name="threadId" value={thread.id} />
                  <Button
                    type="submit"
                    size="sm"
                    variant="outline"
                    className="border-slate-500/80 text-slate-200 hover:bg-slate-500/10 h-7 px-2 text-[11px]"
                  >
                    {thread.isLocked ? "Unlock" : "Lock"} thread
                  </Button>
                </form>
                {canDeleteThread && (
                  <form action={deleteThread}>
                    <input type="hidden" name="threadId" value={thread.id} />
                    <Button
                      type="submit"
                      size="sm"
                      variant="outline"
                      className="border-rose-500/80 text-rose-300 hover:bg-rose-500/10 h-7 px-2 text-[11px]"
                    >
                      Delete thread
                    </Button>
                  </form>
                )}
              </div>
            </div>
          )}
        </header>
      </section>

      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
          Replies ({thread.replies.length})
        </h2>
        <div className="space-y-3">
          {thread.replies.map((post) => {
            const canDelete =
              !!userId && (isManager || userId === post.authorId);
            return (
              <article
                key={post.id}
                className="rounded-[3px] border border-slate-800/80 bg-slate-950/90 p-3 text-xs text-slate-100 shadow-[0_0_0_1px_rgba(0,0,0,0.85)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={post.author.image ?? undefined} alt={post.author.name ?? "User"} />
                      <AvatarFallback>
                        {initialsFrom(post.author.name, post.author.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="text-[13px] font-medium text-slate-50">
                        {post.author.name ?? post.author.email ?? "Account"}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {fmtDate(post.createdAt)}
                      </div>
                    </div>
                  </div>
                  {canDelete && (
                    <form action={deletePost}>
                      <input type="hidden" name="postId" value={post.id} />
                      <Button
                        type="submit"
                        size="sm"
                        variant="outline"
                        className="border-rose-500/80 text-rose-300 hover:bg-rose-500/10 h-7 px-2 text-[11px]"
                      >
                        Delete
                      </Button>
                    </form>
                  )}
                </div>
                <div className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-slate-100">
                  {post.body}
                </div>
              </article>
            );
          })}
          {thread.replies.length === 0 && (
            <div className="rounded-[3px] border border-dashed border-slate-700 bg-slate-950/80 p-3 text-xs text-slate-400">
              No replies yet. Be the first to respond.
            </div>
          )}
        </div>
      </section>

      <section className="mt-4">
        {thread.isLocked ? (
          <div className="rounded-[3px] border border-slate-700 bg-slate-950/80 px-4 py-3 text-xs text-slate-300">
            This thread is locked. New replies are disabled.
          </div>
        ) : user ? (
          <form
            action={replyToThread}
            className="space-y-3 rounded-[3px] border-2 border-black/80 bg-slate-950/90 px-4 py-3 shadow-[0_0_0_1px_rgba(0,0,0,0.9),0_6px_0_0_rgba(0,0,0,0.9)]"
          >
            <input type="hidden" name="threadId" value={thread.id} />
            <div className="flex items-center gap-2 text-xs text-slate-200/90">
              <Avatar className="h-7 w-7">
                <AvatarImage src={user.image ?? undefined} alt={user.name ?? "User"} />
                <AvatarFallback>
                  {initialsFrom(user.name, user.email)}
                </AvatarFallback>
              </Avatar>
              <span>
                Replying as <span className="font-semibold text-slate-50">{user.name ?? user.email ?? "Account"}</span>
              </span>
            </div>
            <textarea
              name="body"
              required
              rows={4}
              placeholder="Share your thoughts or additional context. Keep things civil and focused on integrity."
              className="w-full resize-y rounded-[3px] border border-slate-700 bg-slate-950/90 px-3 py-2 text-xs text-slate-50 placeholder:text-slate-500 focus:border-amber-400 focus:outline-none"
            />
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Public replies are logged; avoid posting sensitive identifiers.</span>
              <Button
                type="submit"
                size="sm"
                className="bg-amber-400 text-black hover:brightness-110 border border-amber-400/80 shadow-[0_0_0_1px_rgba(0,0,0,0.85),0_3px_0_0_rgba(0,0,0,0.9)]"
              >
                Post Reply
              </Button>
            </div>
          </form>
        ) : (
          <div className="rounded-[3px] border border-slate-800 bg-slate-950/90 px-4 py-3 text-xs text-slate-300">
            Sign in with Discord to reply.
          </div>
        )}
      </section>
    </main>
  );
}
