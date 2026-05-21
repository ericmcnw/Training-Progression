"use client";

// Shared popover primitive used by HabitDetailPopover, SparklineWeekPopover,
// and the FAB QuickAdd menu. Design choices:
//
// • Desktop (≥720px): centered modal floating above a dimmed backdrop.
//   Keeps logic simple (no anchor-tracking) and works regardless of where
//   the trigger sits on the page.
// • Mobile (<720px): bottom sheet that slides up. Native-feeling, fits the
//   one-handed mental model.
// • Backdrop click → close.
// • Escape → close.
// • Body scroll lock while open.

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { COLOR, RADIUS, SHADOW } from "./tokens";

export type PopoverProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Optional "Open full →" link in the header. */
  openHref?: string;
  openLabel?: string;
  children: ReactNode;
  /** Hint for the desktop width — defaults to 380. */
  desktopWidth?: number;
};

export default function Popover({
  open,
  onClose,
  title,
  subtitle,
  openHref,
  openLabel = "Open →",
  children,
  desktopWidth = 380,
}: PopoverProps) {
  const sheetRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  // Mobile keyboard tracking — when the soft keyboard opens, iOS shrinks
  // the visualViewport but the layout viewport (vh / inset: bottom 0) stays
  // the same, so the bottom-sheet ends up hidden behind the keyboard. We
  // observe visualViewport.resize and lift the sheet by the occluded
  // amount, capping its max-height to the visible area so the list scrolls
  // inside instead of disappearing.
  //
  // Desktop popovers (centered modal, transform-positioned) aren't affected
  // and the matchMedia check skips the adjust path on wider screens.
  useEffect(() => {
    if (!open) return;
    const sheet = sheetRef.current;
    if (!sheet) return;
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(max-width: 720px)");
    if (!mql.matches) return;
    const vv = window.visualViewport;
    if (!vv) return;

    function adjust() {
      const node = sheetRef.current;
      const viewport = window.visualViewport;
      if (!node || !viewport) return;
      const occluded = Math.max(0, window.innerHeight - (viewport.height + viewport.offsetTop));
      // setProperty with !important so we beat the !important CSS rule on
      // .homeV2Popover's `inset` shorthand and `max-height`.
      node.style.setProperty("bottom", `${occluded}px`, "important");
      node.style.setProperty("max-height", `${Math.max(160, viewport.height - 16)}px`, "important");
    }

    adjust();
    vv.addEventListener("resize", adjust);
    vv.addEventListener("scroll", adjust);
    return () => {
      vv.removeEventListener("resize", adjust);
      vv.removeEventListener("scroll", adjust);
      const node = sheetRef.current;
      if (node) {
        node.style.removeProperty("bottom");
        node.style.removeProperty("max-height");
      }
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      style={backdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        ref={sheetRef}
        className="homeV2Popover"
        style={{ ...sheet, ["--popoverWidth" as never]: `${desktopWidth}px` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={header}>
          <div style={titleColumn}>
            <div style={titleText}>{title}</div>
            {subtitle ? <div style={subtitleText}>{subtitle}</div> : null}
          </div>
          <div style={headerActions}>
            {openHref ? (
              <Link href={openHref} style={openLink} onClick={onClose}>
                {openLabel}
              </Link>
            ) : null}
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              style={closeButton}
            >
              ✕
            </button>
          </div>
        </div>
        <div style={body}>{children}</div>
      </div>

      <style>{`
        @media (max-width: 720px) {
          .homeV2Popover {
            position: fixed !important;
            inset: auto 0 0 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            border-radius: 18px 18px 0 0 !important;
            transform: none !important;
            max-height: 80vh !important;
            animation: homeV2SheetUp 220ms ease-out;
            /* Smooth the keyboard-driven bottom/max-height tweaks the JS
               effect makes when visualViewport changes. Without this the
               sheet jumps when the keyboard opens. */
            transition: bottom 180ms ease, max-height 180ms ease;
          }
        }
        @keyframes homeV2SheetUp {
          from { transform: translateY(100%); opacity: 0.6; }
          to   { transform: translateY(0); opacity: 1; }
        }
        @media (min-width: 721px) {
          .homeV2Popover {
            animation: homeV2PopFade 160ms ease-out;
          }
        }
        @keyframes homeV2PopFade {
          from { transform: translate(-50%, calc(-50% + 8px)); opacity: 0; }
          to   { transform: translate(-50%, -50%); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

const backdrop: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 60,
  background: "rgba(2,6,14,0.62)",
  backdropFilter: "blur(6px)",
  WebkitBackdropFilter: "blur(6px)",
  display: "block",
};

const sheet: CSSProperties = {
  position: "fixed",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: "var(--popoverWidth, 380px)",
  maxWidth: "calc(100vw - 32px)",
  maxHeight: "min(86vh, 720px)",
  background: COLOR.panel,
  border: `1px solid ${COLOR.borderStrong}`,
  borderRadius: RADIUS.card,
  boxShadow: SHADOW.popover,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

const header: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 10,
  padding: "14px 14px 10px",
  borderBottom: `1px solid ${COLOR.border}`,
};

const titleColumn: CSSProperties = {
  display: "grid",
  gap: 2,
  minWidth: 0,
};

const titleText: CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  color: COLOR.text,
};

const subtitleText: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: COLOR.textDim,
};

const headerActions: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const openLink: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 0.3,
  textTransform: "uppercase",
  color: COLOR.success,
  textDecoration: "none",
  padding: "4px 8px",
  borderRadius: RADIUS.pill,
  border: `1px solid rgba(51,255,122,0.28)`,
  background: COLOR.successSoft,
  whiteSpace: "nowrap",
};

const closeButton: CSSProperties = {
  width: 28,
  height: 28,
  minHeight: 28,
  padding: 0,
  borderRadius: RADIUS.pill,
  border: `1px solid ${COLOR.border}`,
  background: "rgba(255,255,255,0.04)",
  color: COLOR.textDim,
  fontSize: 12,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 800,
};

const body: CSSProperties = {
  padding: 14,
  overflowY: "auto",
  display: "grid",
  gap: 12,
};
