"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SkinViewer } from "skinview3d";

type Props = {
  skinUrl: string;
  capeUrl?: string | null;
  className?: string;
};

export default function MinecraftSkinViewer3D({ skinUrl, capeUrl, className }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [loaded, setLoaded] = useState(false);

  const normalizedCapeUrl = useMemo(() => (capeUrl ? String(capeUrl) : null), [capeUrl]);

  useEffect(() => {
    setLoaded(false);
  }, [skinUrl, normalizedCapeUrl]);

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
        await viewer.loadSkin(skinUrl);
        if (disposed) return;

        if (normalizedCapeUrl) {
          try {
            await viewer.loadCape(normalizedCapeUrl);
          } catch {
            // ignore cape failures
          }
        }

        if (!disposed) setLoaded(true);
      } catch {
        if (!disposed) setLoaded(false);
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
  }, [skinUrl, normalizedCapeUrl]);

  return (
    <div ref={hostRef} className={["relative", className].filter(Boolean).join(" ")}>
      <canvas ref={canvasRef} className="h-full w-full rounded-lg" />

      {!loaded && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-lg border border-white/10 bg-slate-900/40 text-[11px] text-slate-200">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200/60 border-t-transparent" />
          <div className="text-slate-300">Loading 3D render…</div>
        </div>
      )}
    </div>
  );
}
