"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireSession, requireMaintainer } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import type { AuditAction } from "@prisma/client";

function getUserIdFromSession(session: any): string {
  const id = (session.user as any)?.id as string | undefined;
  if (!id) {
    throw new Error("User id missing on session");
  }
  return id;
}

export async function createThread(formData: FormData) {
  const session = await requireSession();
  const userId = getUserIdFromSession(session);
  const role = ((session.user as any)?.role as string) ?? "USER";

  const rawTitle = String(formData.get("title") ?? "").trim();
  const rawBody = String(formData.get("body") ?? "").trim();
  const isAnnouncementRequested = String(formData.get("isAnnouncement") ?? "")
    .toLowerCase()
    .startsWith("on");

  if (!rawTitle || !rawBody) {
    throw new Error("Title and body are required");
  }

  const isAnnouncement =
    isAnnouncementRequested && (role === "ADMIN" || role === "MAINTAINER");

  const thread = await prisma.forumThread.create({
    data: {
      title: rawTitle,
      body: rawBody,
      authorId: userId,
      isAnnouncement,
    },
  });

  await logAudit({
    action: "FORUM_THREAD_CREATED" as AuditAction,
    actorId: userId,
    targetType: "forum_thread",
    targetId: thread.id,
    meta: { title: rawTitle, isAnnouncement },
  });

  revalidatePath("/forum");
  revalidatePath(`/forum/${thread.id}`);

  redirect(`/forum/${thread.id}`);
}

export async function replyToThread(formData: FormData) {
  const session = await requireSession();
  const userId = getUserIdFromSession(session);

  const threadId = String(formData.get("threadId") ?? "");
  const rawBody = String(formData.get("body") ?? "").trim();

  if (!threadId || !rawBody) {
    throw new Error("Thread and body are required");
  }

  const thread = await prisma.forumThread.findUnique({ where: { id: threadId } });
  if (!thread) {
    throw new Error("Thread not found");
  }
  if (thread.isLocked) {
    throw new Error("Thread is locked");
  }

  const post = await prisma.$transaction(async (tx) => {
    const created = await tx.forumPost.create({
      data: {
        threadId,
        authorId: userId,
        body: rawBody,
      },
    });

    await tx.forumThread.update({
      where: { id: threadId },
      data: {
        replyCount: { increment: 1 },
        lastActivityAt: new Date(),
      },
    });

    return created;
  });

  await logAudit({
    action: "FORUM_POST_CREATED" as AuditAction,
    actorId: userId,
    targetType: "forum_post",
    targetId: post.id,
    meta: { threadId },
  });

  revalidatePath(`/forum/${threadId}`);
}

export async function deleteThread(formData: FormData) {
  const session = await requireSession();
  const userId = getUserIdFromSession(session);
  const role = ((session.user as any)?.role as string) ?? "USER";

  const threadId = String(formData.get("threadId") ?? "");
  if (!threadId) throw new Error("Thread id is required");

  const thread = await prisma.forumThread.findUnique({ where: { id: threadId } });
  if (!thread) return;

  const isOwner = thread.authorId === userId;
  const isManager = role === "ADMIN" || role === "MAINTAINER";

  if (!isOwner && !isManager) {
    throw new Error("Not allowed");
  }

  await prisma.forumThread.delete({ where: { id: threadId } });

  await logAudit({
    action: "FORUM_THREAD_DELETED" as AuditAction,
    actorId: userId,
    targetType: "forum_thread",
    targetId: threadId,
  });

  revalidatePath("/forum");
  revalidatePath(`/forum/${threadId}`);

  redirect("/forum");
}

export async function deletePost(formData: FormData) {
  const session = await requireSession();
  const userId = getUserIdFromSession(session);
  const role = ((session.user as any)?.role as string) ?? "USER";

  const postId = String(formData.get("postId") ?? "");
  if (!postId) throw new Error("Post id is required");

  const post = await prisma.forumPost.findUnique({ where: { id: postId } });
  if (!post) return;

  const thread = await prisma.forumThread.findUnique({ where: { id: post.threadId } });
  if (!thread) return;

  const isOwner = post.authorId === userId;
  const isManager = role === "ADMIN" || role === "MAINTAINER";

  if (!isOwner && !isManager) {
    throw new Error("Not allowed");
  }

  await prisma.$transaction(async (tx) => {
    await tx.forumPost.delete({ where: { id: postId } });
    await tx.forumThread.update({
      where: { id: post.threadId },
      data: {
        replyCount: { decrement: 1 },
      },
    });
  });

  await logAudit({
    action: "FORUM_POST_DELETED" as AuditAction,
    actorId: userId,
    targetType: "forum_post",
    targetId: postId,
    meta: { threadId: post.threadId },
  });

  revalidatePath(`/forum/${post.threadId}`);
}

export async function toggleLockThread(formData: FormData) {
  const { session } = await requireMaintainer();
  const userId = getUserIdFromSession(session);

  const threadId = String(formData.get("threadId") ?? "");
  if (!threadId) throw new Error("Thread id is required");

  const thread = await prisma.forumThread.findUnique({ where: { id: threadId } });
  if (!thread) return;

  const updated = await prisma.forumThread.update({
    where: { id: threadId },
    data: { isLocked: !thread.isLocked },
  });

  await logAudit({
    action: (updated.isLocked
      ? "FORUM_THREAD_LOCKED"
      : "FORUM_THREAD_UNLOCKED") as AuditAction,
    actorId: userId,
    targetType: "forum_thread",
    targetId: threadId,
  });

  revalidatePath(`/forum/${threadId}`);
  revalidatePath("/forum");
}

export async function togglePinThread(formData: FormData) {
  const { session } = await requireMaintainer();
  const userId = getUserIdFromSession(session);

  const threadId = String(formData.get("threadId") ?? "");
  if (!threadId) throw new Error("Thread id is required");

  const thread = await prisma.forumThread.findUnique({ where: { id: threadId } });
  if (!thread) return;

  const updated = await prisma.forumThread.update({
    where: { id: threadId },
    data: { isPinned: !thread.isPinned },
  });

  await logAudit({
    action: (updated.isPinned
      ? "FORUM_THREAD_PINNED"
      : "FORUM_THREAD_UNPINNED") as AuditAction,
    actorId: userId,
    targetType: "forum_thread",
    targetId: threadId,
  });

  revalidatePath(`/forum/${threadId}`);
  revalidatePath("/forum");
}
