"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SkinViewer } from "skinview3d";

type Props = {
  skinUrl: string;
  capeUrl?: string | null;
  className?: string;
};

function proxyIfCrossOrigin(raw: string) {
  // NOTE: WebGL textures require CORS-enabled images. Many Minecraft skin/cape
  // endpoints (e.g. textures.minecraft.net, optifine.net) do not send permissive
  // CORS headers, so we proxy them through same-origin.
  try {
    const u = new URL(raw, window.location.href);
    if (u.origin === window.location.origin) return u.toString();
    return `/api/asset-proxy?url=${encodeURIComponent(u.toString())}`;
  } catch {
    return raw;
  }
}

export default function MinecraftSkinViewer3D({ skinUrl, capeUrl, className }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedCapeUrl = useMemo(() => (capeUrl ? String(capeUrl) : null), [capeUrl]);

  const skinUrlForViewer = useMemo(() => proxyIfCrossOrigin(String(skinUrl)), [skinUrl]);
  const capeUrlForViewer = useMemo(
    () => (normalizedCapeUrl ? proxyIfCrossOrigin(normalizedCapeUrl) : null),
    [normalizedCapeUrl],
  );

  useEffect(() => {
    setLoaded(false);
    setError(null);
  }, [skinUrlForViewer, capeUrlForViewer]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;

    const viewer = new SkinViewer({
      canvas,
      width: Math.max(1, host.clientWidth),
      height: Math.max(1, host.clientHeight),
    });

    viewer.background = null;
    viewer.fov = 65;

    // skinview3d creates OrbitControls internally; expose basic configuration.
    viewer.controls.enablePan = false;
    viewer.controls.enableZoom = true;
    viewer.controls.rotateSpeed = 0.9;

    let disposed = false;

    const load = async () => {
      try {
        // Preflight with HEAD so we can surface actionable errors (status/content-type)
        // without downloading the image twice.
        const head = await fetch(skinUrlForViewer, { method: "HEAD" });
        if (!head.ok) {
          throw new Error(`Skin HTTP ${head.status}`);
        }
        const ct = head.headers.get("content-type") || "";
        if (ct && !ct.toLowerCase().startsWith("image/")) {
          throw new Error(`Skin unexpected content-type: ${ct}`);
        }

        await viewer.loadSkin(skinUrlForViewer);
        if (disposed) return;

        if (capeUrlForViewer) {
          try {
            const capeHead = await fetch(capeUrlForViewer, { method: "HEAD" });
            if (capeHead.ok) {
              await viewer.loadCape(capeUrlForViewer);
            }
          } catch {
            // ignore cape failures
          }
        }

        if (!disposed) {
          setLoaded(true);
          setError(null);
        }
      } catch (e) {
        if (!disposed) {
          setLoaded(false);
          setError(e instanceof Error ? e.message : "Failed to load skin texture");
        }
      }
    };

    void load();

    const ro = new ResizeObserver(() => {
      viewer.width = Math.max(1, host.clientWidth);
      viewer.height = Math.max(1, host.clientHeight);
    });
    ro.observe(host);

    return () => {
      disposed = true;
      ro.disconnect();
      viewer.dispose();
    };
  }, [skinUrlForViewer, capeUrlForViewer]);

  return (
    <div ref={hostRef} className={["relative", className].filter(Boolean).join(" ")}>
      <canvas ref={canvasRef} className="h-full w-full rounded-lg" />

      {!loaded && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-lg border border-white/10 bg-slate-900/40 px-3 text-center text-[11px] text-slate-200">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200/60 border-t-transparent" />
          <div className="text-slate-300">Loading 3D render…</div>
          {error && <div className="text-[10px] text-rose-200/80">{error}</div>}
        </div>
      )}
    </div>
  );
}
