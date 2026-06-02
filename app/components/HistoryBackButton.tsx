"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type CSSProperties, type MouseEvent } from "react";

// Back button that respects browser history — calls router.back()
// when there's a referrer/history entry in the SPA stack, otherwise
// falls back to a `fallbackHref`. Used on the exercise + routine
// detail pages so users land back where they came from (strength
// dashboard, library, search, etc.) instead of being forced to a
// hardcoded destination.
//
// Renders as a Link to the fallback for non-JS / right-click "open
// in new tab" — the onClick handler intercepts the normal click and
// uses router.back() when possible.
export default function HistoryBackButton({
  fallbackHref,
  label,
  style,
}: {
  fallbackHref: string;
  label: string;
  style?: CSSProperties;
}) {
  const router = useRouter();

  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    // Respect modifier-key clicks (cmd-click, middle-click, etc.) —
    // let the browser handle them as normal Link navigations.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    // Only intercept when we actually have history to go back to.
    // history.length > 1 means there's at least one prior entry; the
    // initial entry (the current page) counts as 1.
    if (typeof window !== "undefined" && window.history.length > 1) {
      e.preventDefault();
      router.back();
    }
  }

  return (
    <Link href={fallbackHref} onClick={handleClick} style={style}>
      {label}
    </Link>
  );
}
