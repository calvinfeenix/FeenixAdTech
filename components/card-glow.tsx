"use client";

import { useEffect } from "react";

/**
 * Feeds the cursor position into any `.card-glow` element as --mx/--my so the
 * CSS radial-gradient can follow the mouse. One document-level, rAF-throttled,
 * passive listener for the whole app — cheap and never blocks scrolling.
 */
export default function CardGlow() {
  useEffect(() => {
    let raf = 0;
    let last: { x: number; y: number } | null = null;

    function apply() {
      raf = 0;
      if (!last) return;
      const el = document.elementFromPoint(last.x, last.y)?.closest(".card-glow") as HTMLElement | null;
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${last.x - r.left}px`);
      el.style.setProperty("--my", `${last.y - r.top}px`);
    }

    function onMove(e: MouseEvent) {
      last = { x: e.clientX, y: e.clientY };
      if (!raf) raf = requestAnimationFrame(apply);
    }

    document.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      document.removeEventListener("mousemove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return null;
}
