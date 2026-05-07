"use client";

import { useEffect, useState } from "react";

/**
 * Animates a string at a readable pace. Returns the slice of `target`
 * that should be on screen right now.
 *
 * Why this exists: DeepSeek streams the agent's reasoning in 3-4s,
 * which is faster than the eye can read. Without throttling the
 * display, the text flashes by and the "watch the agent think"
 * effect is lost. This hook grows the rendered slice toward the
 * full streamed target at ~100 chars/sec, so the reader can follow
 * along while DeepSeek is still pushing tokens — and after the
 * stream completes, the typewriter keeps catching up to the final
 * reasoning so the transition to the static view feels smooth.
 *
 * If the target gets shorter or completely diverges (rare), the
 * animation snaps to the new value. The common case (each new
 * target is a prefix-extension of the previous) animates smoothly.
 */
export function useTypewriter(
  target: string,
  charsPerTick = 5,
  tickMs = 50,
): string {
  const [shown, setShown] = useState("");

  useEffect(() => {
    // Already caught up? Nothing to do.
    if (shown === target) return;

    // Common case: target is an extension of what we've shown so far.
    // Grow the displayed slice over time.
    if (target.startsWith(shown)) {
      const id = setInterval(() => {
        setShown((prev) => {
          if (prev.length >= target.length) return target;
          return target.slice(0, prev.length + charsPerTick);
        });
      }, tickMs);
      return () => clearInterval(id);
    }

    // Target diverged (string got reset / truncated). Snap to it.
    setShown(target);
  }, [target, shown, charsPerTick, tickMs]);

  return shown;
}
