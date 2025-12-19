import { NextRequest, NextResponse } from "next/server";

import { recordApiRequestMetric } from "@/lib/api-metrics";

type MojangProfileProperty = { name: string; value: string };
type MojangProfile = {
  id: string;
  name: string;
  properties?: MojangProfileProperty[];
};

type MojangTexturesPayload = {
  textures?: {
    SKIN?: { url?: string };
  };
};

function stripDashes(v: string) {
  return v.replace(/-/g, "");
}

function bad(status: number, msg: string) {
  return new NextResponse(msg, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function decodeBase64Json<T = unknown>(value: string): T | null {
  try {
    // Node runtime
    return JSON.parse(Buffer.from(value, "base64").toString("utf8")) as T;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const uuidRaw = (req.nextUrl.searchParams.get("uuid") ?? "").trim();
  const uuid = stripDashes(uuidRaw).toLowerCase();

  if (!uuid || !/^[0-9a-f]{32}$/.test(uuid)) {
    return bad(400, "Invalid uuid");
  }

  // 1) Get textures payload from Mojang sessionserver
  let profile: MojangProfile;
  try {
    const started = Date.now();
    const res = await fetch(
      `https://sessionserver.mojang.com/session/minecraft/profile/${uuid}?unsigned=false`,
      { next: { revalidate: 60 * 60 } },
    );
    await recordApiRequestMetric({
      api: "mojang_sessionserver",
      ok: res.ok,
      status: res.status,
      latencyMs: Date.now() - started,
    });

    if (!res.ok) return bad(res.status, `Profile HTTP ${res.status}`);
    profile = (await res.json()) as MojangProfile;
  } catch {
    // metrics is best-effort; ignore errors
    return bad(502, "Profile fetch failed");
  }

  const texProp = (profile.properties ?? []).find((p) => p.name === "textures");
  if (!texProp?.value) return bad(404, "No textures property");

  const payload = decodeBase64Json<MojangTexturesPayload>(texProp.value);
  const skinUrl = payload?.textures?.SKIN?.url;
  if (!skinUrl) return bad(404, "No skin url");

  // 2) Fetch the actual skin PNG/JPEG from textures.minecraft.net
  let upstream: Response;
  try {
    const started = Date.now();
    upstream = await fetch(skinUrl, { next: { revalidate: 60 * 60 } });
    await recordApiRequestMetric({
      api: "mojang_textures",
      ok: upstream.ok,
      status: upstream.status,
      latencyMs: Date.now() - started,
    });
  } catch {
    return bad(502, "Skin fetch failed");
  }

  if (!upstream.ok) return bad(upstream.status, `Skin HTTP ${upstream.status}`);

  const contentType = upstream.headers.get("content-type") || "image/png";
  const body = await upstream.arrayBuffer();

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
