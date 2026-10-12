"use client";

import { useSyncExternalStore } from "react";
import { ArrowUpIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

// The button appears once the page is scrolled this far down.
const SHOW_AFTER_PX = 300;

function subscribeToScroll(onChange: () => void) {
  window.addEventListener("scroll", onChange, { passive: true });
  return () => window.removeEventListener("scroll", onChange);
}

/** Arrow in the bottom right corner that brings the page back to its top. */
export function ScrollToTopButton() {
  const isScrolledDown = useSyncExternalStore(
    subscribeToScroll,
    () => window.scrollY > SHOW_AFTER_PX,
    () => false,
  );
  if (!isScrolledDown) return null;

  return (
    <Button
      variant="outline"
      size="icon-lg"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="В начало списка"
      className="fixed right-4 bottom-4 z-20 size-11 rounded-full text-black shadow-md"
    >
      <ArrowUpIcon aria-hidden className="size-5" />
    </Button>
  );
}
