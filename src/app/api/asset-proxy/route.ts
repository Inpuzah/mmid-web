import { NextRequest, NextResponse } from "next/server";

const ALLOWED_HOSTS = new Set([
  "textures.minecraft.net",
  "optifine.net",
  "crafatar.com",
  "mc-heads.net",
  "visage.surgeplay.com",
  "sessionserver.mojang.com",
]);

function isAllowedUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  const host = url.hostname.toLowerCase();
  if (!ALLOWED_HOSTS.has(host)) return null;

  return url;
}

async function fetchFollowingRedirects(
  url: URL,
  init: RequestInit,
  maxRedirects = 5,
): Promise<Response> {
  let current = url;
  for (let i = 0; i <= maxRedirects; i++) {
    const res = await fetch(current.toString(), {
      ...init,
      redirect: "manual",
    });

    // Follow redirects manually so we can enforce the allowlist on the redirect target too.
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const loc = res.headers.get("location");
      if (!loc) return res;
      const next = isAllowedUrl(new URL(loc, current).toString());
      if (!next) return res;
      current = next;
      continue;
    }

    return res;
  }

  // Too many redirects.
  return new Response(null, { status: 508, statusText: "Loop Detected" });
}

function badRequest(status: number, message: string) {
  return new NextResponse(message, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

async function handleProxy(req: NextRequest, method: "GET" | "HEAD") {
  const urlRaw = req.nextUrl.searchParams.get("url") ?? "";
  const url = isAllowedUrl(urlRaw);

  if (!url) return badRequest(400, "Invalid or disallowed url");

  let upstream: Response;
  try {
    upstream = await fetchFollowingRedirects(
      url,
      {
        method,
        // Cache at the Next.js fetch layer.
        next: { revalidate: 60 * 60 },
      },
      5,
    );
  } catch {
    return badRequest(502, "Upstream fetch failed");
  }

  if (!upstream.ok) {
    // Return the upstream status code so the client can show a useful message.
    return badRequest(upstream.status, `Upstream ${upstream.status}`);
  }

  const contentType = upstream.headers.get("content-type") || "application/octet-stream";

  // HEAD: no body.
  if (method === "HEAD") {
    return new NextResponse(null, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  }

  const body = await upstream.arrayBuffer();

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      // Allow the browser to cache; also helps reduce repeated requests from the viewer.
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}

export async function GET(req: NextRequest) {
  return handleProxy(req, "GET");
}

export async function HEAD(req: NextRequest) {
  return handleProxy(req, "HEAD");
}
