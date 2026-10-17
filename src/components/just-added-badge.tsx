"use client";

import { useEffect, useRef } from "react";

/** Marks the just-added contact in the list and brings its row into view. */
export function JustAddedBadge() {
  const badgeRef = useRef<HTMLSpanElement>(null);
  const handledRef = useRef(false);

  useEffect(() => {
    // Effects run again when a preserved page is shown again; scroll only the first time.
    if (handledRef.current) return;
    handledRef.current = true;

    badgeRef.current?.scrollIntoView({ block: "center" });
    // Drop `?added=...` so that reloading the page does not jump to the contact again.
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  return (
    <span
      ref={badgeRef}
      className="shrink-0 rounded-full bg-accent px-2.5 py-0.5 text-11 font-medium text-ink"
    >
      Только что добавлен
    </span>
  );
}
