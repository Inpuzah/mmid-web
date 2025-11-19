"use client";

import { useMemo, useState } from "react";

type Props = {
  /** UUID or username. */
  id: string;
  /** Display name for alt text. */
  name?: string;
  /** Placeholder for future posed renders (skinview3d, etc.) */
  pose?: string;
  /** Extra classes for sizing/positioning. */
  className?: string;
};

/**
 * A resilient **3D bust** renderer (head + shoulders) that works in all environments.
 *
 * Strategy:
 *  - Prefer Visage bust (nice 3D look, username or UUID).
 *  - Fallback to mc-heads avatar and Crafatar avatars.
 *  - Uses an <img> tag so no Next/Image remotePatterns config is required.
 */
export default function MinecraftSkin({ id, name, className }: Props) {
  const chain = useMemo(
    () => [
      // 3D bust (head + shoulders) – works with username OR UUID
      `https://visage.surgeplay.com/bust/160/${encodeURIComponent(id)}.png`,
      // Classic square head render – works with username OR UUID
      `https://mc-heads.net/avatar/${encodeURIComponent(id)}/160`,
      // UUID-based avatar; harmless no-op if id happens to be a username
      `https://crafatar.com/avatars/${encodeURIComponent(id)}?overlay&size=160`,
    ],
    [id]
  );

  const [idx, setIdx] = useState(0);

  return (
    <img
      src={chain[idx]}
      alt={`${name ?? id} head`}
      loading="lazy"
      decoding="async"
      className={["object-contain", className].filter(Boolean).join(" ")}
      onError={() => setIdx((i) => (i + 1 < chain.length ? i + 1 : i))}
    />
  );
}
