"use client";

import Link from "next/link";
import { useState, useTransition, type CSSProperties } from "react";
import { removeSportSupportAction } from "./support-actions";

// One row inside the "Supporting training" section on /activities/
// sports. Links to the routine's detail page on the main click area,
// with an inline "✕" to demote (strip the sport from supportsSports)
// without opening the editor. Demotion confirms inline to avoid
// accidental taps.

export default function SupportRow({
  routineId,
  routineName,
  sportSlug,
  sportLabel,
}: {
  routineId: string;
  routineName: string;
  sportSlug: string;
  sportLabel: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function remove() {
    startTransition(async () => {
      await removeSportSupportAction(routineId, sportSlug);
      setConfirming(false);
    });
  }

  return (
    <div style={row}>
      <Link href={`/routines/${routineId}`} style={linkStyle}>
        <span style={name}>{routineName}</span>
      </Link>
      {confirming ? (
        <div style={confirmRow}>
          <span style={confirmText}>Remove from {sportLabel}?</span>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            style={cancelBtn}
            disabled={pending}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={remove}
            style={confirmBtn}
            disabled={pending}
          >
            {pending ? "…" : "Remove"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          style={removeBtn}
          aria-label={`Remove ${routineName} from ${sportLabel}`}
        >
          ✕
        </button>
      )}
    </div>
  );
}

const row: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 6px 6px 10px",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.06)",
  background: "rgba(255,255,255,0.025)",
};
const linkStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  textDecoration: "none",
  color: "inherit",
};
const name: CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 800,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
const removeBtn: CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.03)",
  color: "rgba(255,255,255,0.55)",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
  flexShrink: 0,
};
const confirmRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
};
const confirmText: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  opacity: 0.75,
  whiteSpace: "nowrap",
};
const cancelBtn: CSSProperties = {
  padding: "5px 9px",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.04)",
  color: "inherit",
  fontSize: 11,
  fontWeight: 700,
  cursor: "pointer",
};
const confirmBtn: CSSProperties = {
  padding: "5px 9px",
  borderRadius: 8,
  border: "1px solid rgba(248,113,113,0.45)",
  background: "rgba(248,113,113,0.12)",
  color: "rgba(254,202,202,0.95)",
  fontSize: 11,
  fontWeight: 800,
  cursor: "pointer",
};
