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
 * A resilient skin renderer that works in all environments (no Next/Image config needed).
 *
 * Strategy:
 *  - Try mc-heads first (supports username OR UUID and is very reliable).
 *  - Fallback to Crafatar (UUID only) and Visage.
 *  - Uses an <img> tag so no remotePatterns config is required.
 */
export default function MinecraftSkin({ id, name, className }: Props) {
  const chain = useMemo(
    () => [
      // Works with username OR UUID
      `https://mc-heads.net/body/${encodeURIComponent(id)}/512`,
      // UUID only, but fast
      `https://crafatar.com/renders/body/${encodeURIComponent(id)}?overlay&scale=10`,
      // UUID or username, different renderer
      `https://visage.surgeplay.com/full/512/${encodeURIComponent(id)}.png`,
    ],
    [id]
  );

  const [idx, setIdx] = useState(0);

  return (
    <img
      src={chain[idx]}
      alt={`${name ?? id} skin`}
      loading="lazy"
      className={["object-contain", className].filter(Boolean).join(" ")}
      onError={() => setIdx((i) => (i + 1 < chain.length ? i + 1 : i))}
    />
  );
}
