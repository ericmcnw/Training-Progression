"use client";

// Shared collapsible card chrome for home dashboard sections (Goals,
// Rotation, and — eventually — a retrofit of Injuries). Header mirrors the
// pattern HomeInjuriesSection established: title + optional count pill +
// a toggle with a rotating chevron. Open/closed state persists in
// localStorage per `storageKey` so the user's choice sticks across visits.
//
// SSR-safe: first paint uses `defaultOpen` (so server and client markup
// match); the stored preference is applied in an effect after mount.

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

type CountTone = "neutral" | "danger" | "accent";

export default function CollapsibleSection({
  title,
  count,
  countTone = "neutral",
  hint,
  headerExtra,
  storageKey,
  defaultOpen = true,
  children,
}: {
  title: string;
  count?: number;
  countTone?: CountTone;
  /** Small right-aligned hint shown only when expanded (e.g. "tap a row"). */
  hint?: string;
  /** Extra element rendered next to the title/count (e.g. a nudge badge). */
  headerExtra?: ReactNode;
  /** localStorage key — omit to make the section non-persistent (always
   *  starts at defaultOpen). */
  storageKey?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    if (!storageKey) return;
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored === "1") setOpen(true);
      else if (stored === "0") setOpen(false);
    } catch {
      // localStorage can throw in private mode / sandboxed frames — the
      // section just stays at defaultOpen, which is fine.
    }
  }, [storageKey]);

  function toggle() {
    setOpen((prev) => {
      const next = !prev;
      if (storageKey) {
        try {
          window.localStorage.setItem(storageKey, next ? "1" : "0");
        } catch {
          // ignore — non-persistent fallback
        }
      }
      return next;
    });
  }

  return (
    <section style={card}>
      <button type="button" onClick={toggle} style={headerBtn} aria-expanded={open}>
        <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span style={titleStyle}>{title}</span>
          {typeof count === "number" && count > 0 ? (
            <span style={countPill(countTone)}>{count}</span>
          ) : null}
          {headerExtra}
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          {open && hint ? <span style={hintStyle}>{hint}</span> : null}
          <span style={{ ...chevron, transform: open ? "rotate(180deg)" : "none" }} aria-hidden>▾</span>
        </span>
      </button>

      {open ? <div style={body}>{children}</div> : null}
    </section>
  );
}

// ── styles (kept in sync with HomeInjuriesSection's card/header tokens) ───────
const card: CSSProperties = {
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 16,
  background: "rgba(255,255,255,0.028)",
  padding: 14,
  display: "grid",
  gap: 12,
};

const headerBtn: CSSProperties = {
  appearance: "none",
  WebkitAppearance: "none",
  background: "transparent",
  border: "none",
  margin: 0,
  padding: 0,
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  cursor: "pointer",
  color: "inherit",
  minHeight: 32,
};

const titleStyle: CSSProperties = {
  fontSize: 15,
  fontWeight: 900,
  letterSpacing: 0.2,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

function countPill(tone: CountTone): CSSProperties {
  const palette =
    tone === "danger"
      ? { bg: "rgba(248,113,113,0.14)", border: "rgba(248,113,113,0.4)", color: "#FCA5A5" }
      : tone === "accent"
        ? { bg: "rgba(51,255,122,0.13)", border: "rgba(51,255,122,0.4)", color: "rgba(120,235,170,0.95)" }
        : { bg: "rgba(255,255,255,0.08)", border: "rgba(255,255,255,0.18)", color: "rgba(255,255,255,0.7)" };
  return {
    fontSize: 11,
    fontWeight: 900,
    padding: "2px 8px",
    borderRadius: 999,
    background: palette.bg,
    border: `1px solid ${palette.border}`,
    color: palette.color,
  };
}

const hintStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "rgba(255,255,255,0.4)",
};

const chevron: CSSProperties = {
  fontSize: 11,
  color: "rgba(255,255,255,0.6)",
  transition: "transform 160ms ease",
};

const body: CSSProperties = {
  display: "grid",
  gap: 12,
};
