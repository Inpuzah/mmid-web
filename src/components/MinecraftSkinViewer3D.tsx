"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SkinViewer } from "skinview3d";
import { NearestFilter } from "three";

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

function applyNameMcIdlePose(viewer: SkinViewer) {
  // Mild dynamic stance similar to NameMC card previews.
  viewer.playerObject.resetJoints();

  // Subtle head turn.
  viewer.playerObject.skin.head.rotation.y = -0.08;

  const arm = 0.18;
  const leg = 0.14;

  viewer.playerObject.skin.rightArm.rotation.x = arm;
  viewer.playerObject.skin.leftArm.rotation.x = -arm;
  viewer.playerObject.skin.rightLeg.rotation.x = -leg;
  viewer.playerObject.skin.leftLeg.rotation.x = leg;

  viewer.playerObject.skin.rightArm.rotation.z = -0.06;
  viewer.playerObject.skin.leftArm.rotation.z = 0.06;
}

function applyNameMcPortraitCamera(viewer: SkinViewer) {
  // NameMC-ish portrait framing for tall cards.
  viewer.fov = 52;
  viewer.playerObject.rotation.y = 1.3;

  // Aim at mid-torso so head and feet stay in frame.
  const targetX = 0;
  const targetY = 0;
  const distance = 44;
  const polar = 1.22;
  const azimuth = 0.85;

  const sinPhi = Math.sin(polar);
  const x = distance * sinPhi * Math.sin(azimuth);
  const y = targetY + distance * Math.cos(polar);
  const z = distance * sinPhi * Math.cos(azimuth);

  viewer.controls.target.set(targetX, targetY, 0);
  viewer.camera.position.set(x, y, z);
  viewer.camera.lookAt(targetX, targetY, 0);
  viewer.controls.update();
}

function applyCrispTextureFiltering(viewer: SkinViewer) {
  const maps = [
    viewer.playerObject.skin.map,
    viewer.playerObject.cape.map,
    viewer.playerObject.elytra.map,
    viewer.playerObject.ears.map,
  ];

  for (const texture of maps) {
    if (!texture) continue;
    texture.magFilter = NearestFilter;
    texture.minFilter = NearestFilter;
    texture.generateMipmaps = false;
    texture.anisotropy = 1;
    texture.needsUpdate = true;
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
    viewer.fov = 42;
    viewer.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

    // Allow drag interactions, but keep scroll-wheel zoom disabled.
    viewer.controls.enableRotate = true;
    viewer.controls.enableZoom = false;
    viewer.controls.enablePan = true;
    viewer.controls.enableDamping = true;
    viewer.controls.dampingFactor = 0.08;
    viewer.controls.minDistance = 22;
    viewer.controls.maxDistance = 90;
    viewer.controls.minPolarAngle = 0.78;
    viewer.controls.maxPolarAngle = Math.PI / 2 - 0.08;
    viewer.autoRotate = false;
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

        applyCrispTextureFiltering(viewer);
        applyNameMcPortraitCamera(viewer);
        applyNameMcIdlePose(viewer);

        if (capeUrlForViewer) {
          try {
            const capeHead = await fetch(capeUrlForViewer, { method: "HEAD" });
            if (capeHead.ok) {
              await viewer.loadCape(capeUrlForViewer);
              applyCrispTextureFiltering(viewer);
              applyNameMcPortraitCamera(viewer);
              applyNameMcIdlePose(viewer);
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
      viewer.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    });
    ro.observe(host);

    return () => {
      disposed = true;
      ro.disconnect();
      viewer.dispose();
    };
  }, [skinUrlForViewer, capeUrlForViewer]);

  return (
    <div
      ref={hostRef}
      className={[
        "relative overflow-hidden rounded-lg",
        "bg-[linear-gradient(45deg,rgba(255,255,255,.06)_25%,transparent_25%),linear-gradient(-45deg,rgba(255,255,255,.06)_25%,transparent_25%),linear-gradient(45deg,transparent_75%,rgba(255,255,255,.06)_75%),linear-gradient(-45deg,transparent_75%,rgba(255,255,255,.06)_75%)]",
        "bg-[length:28px_28px] bg-[position:0_0,0_14px,14px_-14px,-14px_0px]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <canvas
        ref={canvasRef}
        className="h-full w-full [filter:drop-shadow(0_16px_18px_rgba(0,0,0,0.55))]"
      />

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
