"use client";

// Collapsible section card for the unified Plan page. Matches the visual
// language of progress/ui.tsx SectionCard, but the header is a toggle: tap
// the title to collapse/expand. The action button (New Goal / New Routine)
// sits beside the toggle and doesn't fire it. Collapse state persists per
// section in localStorage so it survives reloads.
//
// `children` is a server component (GoalsTab / MonthTab / RotationTab) passed
// through — Next renders it on the server and hands it here as ready nodes.

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

export default function PlanSection({
  id,
  title,
  subtitle,
  action,
  children,
  defaultOpen = true,
}: {
  id: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const storageKey = `plan.section.${id}.collapsed`;
  const [open, setOpen] = useState(defaultOpen);

  // Read persisted collapse state after mount. Must be an effect (not a lazy
  // initializer) so SSR and the first client render agree on defaultOpen —
  // localStorage isn't available on the server. setState-in-effect is the
  // intended pattern for syncing from an external store on mount.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved === "1" || saved === "0") setOpen(saved === "0");
    } catch {
      // localStorage blocked (private mode) — fall back to defaultOpen.
    }
  }, [storageKey]);

  function toggle() {
    setOpen((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(storageKey, next ? "0" : "1");
      } catch {
        // ignore persistence failures
      }
      return next;
    });
  }

  const bodyId = `${id}-body`;

  return (
    <section id={id} style={{ ...sectionStyle, scrollMarginTop: 14 }}>
      <div style={headerRowStyle}>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={bodyId}
          style={toggleStyle}
        >
          <span style={{ ...chevronStyle, transform: open ? "rotate(90deg)" : "rotate(0deg)" }} aria-hidden>
            ▸
          </span>
          <span style={{ display: "grid", gap: 4, minWidth: 0, textAlign: "left" }}>
            <span style={titleStyle}>{title}</span>
            {subtitle ? <span style={subtitleStyle}>{subtitle}</span> : null}
          </span>
        </button>
        {action ? (
          <div className="planSectionActions" style={actionsStyle}>
            {action}
          </div>
        ) : null}
      </div>
      {open ? (
        <div id={bodyId} style={bodyStyle}>
          {children}
        </div>
      ) : null}
      {/* On phones the action pills (up to two per section) can't share a
          row with the title without crushing the subtitle into a sliver —
          drop them to their own full-width row instead. Plain <style> tag
          matches the repo pattern (HabitGrid) — no styled-jsx registry in
          the app-router setup. */}
      <style>{`
        @media (max-width: 560px) {
          .planSectionActions {
            flex-basis: 100%;
            justify-content: flex-start;
          }
        }
      `}</style>
    </section>
  );
}

const sectionStyle: CSSProperties = {
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 18,
  overflow: "hidden",
  background: "rgba(255,255,255,0.028)",
  boxShadow: "0 10px 24px rgba(0,0,0,0.08)",
};

const headerRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  flexWrap: "wrap",
  padding: "11px 13px",
  background: "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
};

const toggleStyle: CSSProperties = {
  all: "unset",
  display: "flex",
  alignItems: "center",
  gap: 10,
  cursor: "pointer",
  flex: 1,
  minWidth: 0,
  minHeight: 44,
};

const chevronStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
  opacity: 0.6,
  transition: "transform 160ms ease",
  flexShrink: 0,
  width: 14,
  textAlign: "center",
};

const titleStyle: CSSProperties = {
  fontWeight: 900,
  letterSpacing: 0.2,
  fontSize: 16,
};

const subtitleStyle: CSSProperties = {
  fontSize: 13,
  lineHeight: 1.45,
  opacity: 0.72,
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const actionsStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  flexShrink: 0,
};

const bodyStyle: CSSProperties = {
  padding: 14,
  display: "grid",
  gap: 12,
};
