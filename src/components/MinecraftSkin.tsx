"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  /** UUID or username. */
  id: string;
  /** Display name for alt text. */
  name?: string;
  /** Placeholder for future posed renders (skinview3d, etc.) */
  pose?: string;
  /** Render size passed to remote endpoints. */
  size?: number;
  /** Extra classes for sizing/positioning. */
  className?: string;

  /**
   * When true (default), do not start fetching the image until the element is
   * near the viewport (IntersectionObserver).
   */
  lazy?: boolean;

  /** Optional text shown while loading (helps users understand it's fetching). */
  loadingLabel?: string;
};

const isUuidish = (v: string) => {
  const s = v.replace(/-/g, "");
  return s.length === 32 && /^[0-9a-f]+$/i.test(s);
};

/**
 * A resilient **3D bust** renderer (head + shoulders) that works in all environments.
 *
 * Strategy:
 *  - Prefer Visage bust (nice 3D look, username or UUID).
 *  - Fallback to mc-heads avatar and Crafatar avatars.
 *
 * Adds:
 *  - viewport-based lazy start (so jumping around doesn't fire a ton of fetches)
 *  - skeleton + spinner while the render is loading
 */
export default function MinecraftSkin({
  id,
  name,
  className,
  size = 160,
  lazy = true,
  loadingLabel,
}: Props) {
  const s = Math.max(16, Math.min(512, Math.floor(Number(size) || 160)));

  // Some providers behave better with undashed UUIDs.
  const idNoDash = useMemo(() => id.replace(/-/g, ""), [id]);
  const preferNoDash = isUuidish(id);
  const primaryId = preferNoDash ? idNoDash : id;

  const chain = useMemo(
    () => [
      // 3D bust (head + shoulders)
      `https://visage.surgeplay.com/bust/${s}/${encodeURIComponent(primaryId)}.png`,
      // Classic square head render – works with username OR UUID
      `https://mc-heads.net/avatar/${encodeURIComponent(id)}/${s}`,
      // UUID-based avatar; harmless no-op if id happens to be a username
      `https://crafatar.com/avatars/${encodeURIComponent(primaryId)}?overlay&size=${s}`,
    ],
    [id, primaryId, s],
  );

  const hostRef = useRef<HTMLDivElement | null>(null);
  const [shouldLoad, setShouldLoad] = useState(!lazy);

  const [idx, setIdx] = useState(0);
  const [loaded, setLoaded] = useState(false);

  // Reset when target changes.
  useEffect(() => {
    setIdx(0);
    setLoaded(false);
  }, [id, s]);

  // Mark as not loaded when switching fallbacks.
  useEffect(() => {
    setLoaded(false);
  }, [idx]);

  // Start loading only when near viewport.
  useEffect(() => {
    if (!lazy) {
      setShouldLoad(true);
      return;
    }

    if (shouldLoad) return;

    const el = hostRef.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setShouldLoad(true);
            obs.disconnect();
            break;
          }
        }
      },
      // Preload slightly before the user sees it.
      { root: null, rootMargin: "200px" },
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [lazy, shouldLoad]);

  const showSpinner = shouldLoad && !loaded;
  const label = loadingLabel ?? "Loading render…";

  return (
    <div ref={hostRef} className={["relative", className].filter(Boolean).join(" ")}>
      {/* Skeleton background */}
      <div
        className={
          "pointer-events-none absolute inset-0 rounded-[inherit] bg-slate-900/40 " +
          (showSpinner ? "animate-pulse" : "")
        }
        aria-hidden="true"
      />

      {shouldLoad && (
        <img
          src={chain[idx]}
          alt={`${name ?? id} head`}
          loading="lazy"
          decoding="async"
          className={["block object-contain", className].filter(Boolean).join(" ")}
          style={loaded ? undefined : { opacity: 0 }}
          onLoad={() => setLoaded(true)}
          onError={() => {
            setLoaded(false);
            setIdx((i) => (i + 1 < chain.length ? i + 1 : i));
          }}
        />
      )}

      {showSpinner && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 text-[10px] text-slate-200">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200/60 border-t-transparent" />
          <div className="px-2 text-center leading-tight text-slate-300">{label}</div>
        </div>
      )}
    </div>
  );
}
