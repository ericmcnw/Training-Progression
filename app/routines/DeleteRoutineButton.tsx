"use client";

import { useState, useTransition } from "react";
import { deleteRoutine } from "./actions";

function TrashIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <path
        d="M6 1h4l.5 1H13a1 1 0 1 1 0 2h-.6l-.6 8.1A2 2 0 0 1 9.8 14H6.2a2 2 0 0 1-1.99-1.9L3.6 4H3A1 1 0 1 1 3 2h2.5zM5.6 4l.58 7.84a.4.4 0 0 0 .4.36h3.24a.4.4 0 0 0 .4-.36L10.4 4z"
        fill="currentColor"
      />
      <path
        d="M8 6.1v4"
        fill="none"
        stroke="#f87171"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function DeleteRoutineButton({
  routineId,
  compact = false,
}: {
  routineId: string;
  compact?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  function onConfirmDelete() {
    startTransition(async () => {
      await deleteRoutine(routineId);
    });
  }

  return (
    <>
      <button
        type="button"
        suppressHydrationWarning
        onClick={() => setIsConfirmOpen(true)}
        disabled={isPending}
        style={compact ? compactBtnStyle : btnStyle}
        aria-label="Delete routine"
        title="Delete routine"
      >
        {compact ? (isPending ? "..." : <TrashIcon />) : isPending ? "Deleting..." : "Delete"}
      </button>

      {isConfirmOpen && (
        <div style={overlayStyle} role="dialog" aria-modal="true" aria-label="Delete routine confirmation">
          <div style={modalStyle}>
            <div style={{ fontSize: 16, fontWeight: 900 }}>
              Are you sure you want to delete this routine?
            </div>
            <div style={{ marginTop: 8, fontSize: 13, opacity: 0.8 }}>
              All logged routine data will stay saved.
            </div>

            <div style={{ marginTop: 14, display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                type="button"
                suppressHydrationWarning
                onClick={() => setIsConfirmOpen(false)}
                disabled={isPending}
                style={secondaryBtnStyle}
              >
                No
              </button>
              <button type="button" suppressHydrationWarning onClick={onConfirmDelete} disabled={isPending} style={dangerBtnStyle}>
                {isPending ? "Deleting..." : "Yes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const btnStyle: React.CSSProperties = {
  padding: "8px 10px",
  border: "1px solid rgba(255,0,0,0.55)",
  borderRadius: 10,
  textAlign: "center",
  textDecoration: "none",
  color: "inherit",
  background: "rgba(128,128,128,0.12)",
  fontWeight: 700,
};

const compactBtnStyle: React.CSSProperties = {
  ...btnStyle,
  minHeight: 30,
  minWidth: 30,
  padding: "5px 8px",
  borderRadius: 9,
  fontSize: 12,
  lineHeight: 1.2,
  color: "#f87171",
  border: "1px solid rgba(248,113,113,0.6)",
};

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
  background: "rgba(0,0,0,0.5)",
  zIndex: 999,
};

const modalStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 460,
  border: "1px solid rgba(128,128,128,0.35)",
  borderRadius: 12,
  background: "rgb(17,24,39)",
  color: "inherit",
  padding: 14,
};

const secondaryBtnStyle: React.CSSProperties = {
  padding: "8px 12px",
  border: "1px solid rgba(128,128,128,0.8)",
  borderRadius: 10,
  background: "rgba(128,128,128,0.12)",
  color: "inherit",
  fontWeight: 700,
};

const dangerBtnStyle: React.CSSProperties = {
  padding: "8px 12px",
  border: "1px solid rgba(255,0,0,0.55)",
  borderRadius: 10,
  background: "rgba(128,128,128,0.12)",
  color: "inherit",
  fontWeight: 700,
};
