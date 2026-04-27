"use client";

import { useState, useTransition } from "react";
import { deleteGoalEntry } from "./actions";

export default function DeleteGoalButton({
  goalId,
}: {
  goalId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  function onConfirmDelete() {
    startTransition(async () => {
      await deleteGoalEntry({ goalId });
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsConfirmOpen(true)}
        disabled={isPending}
        style={btnStyle}
        aria-label="Delete goal"
      >
        {isPending ? (
          <svg width={13} height={13} viewBox="0 0 13 13" fill="none" style={{ opacity: 0.5 }}>
            <circle cx={6.5} cy={6.5} r={5} stroke="currentColor" strokeWidth={1.5} strokeDasharray="8 8" />
          </svg>
        ) : (
          <svg width={13} height={13} viewBox="0 0 13 13" fill="none">
            <path d="M2 3.5h9M5 3.5V2.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v1M5 5.5v4M8 5.5v4M2.8 3.5l.6 7a.5.5 0 0 0 .5.5h5.2a.5.5 0 0 0 .5-.5l.6-7" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {isConfirmOpen && (
        <div style={overlayStyle} role="dialog" aria-modal="true" aria-label="Delete goal confirmation">
          <div style={modalStyle}>
            <div style={{ fontSize: 16, fontWeight: 900 }}>
              Are you sure you want to delete this goal?
            </div>
            <div style={{ marginTop: 8, fontSize: 13, opacity: 0.8 }}>
              All logged routine data will stay saved.
            </div>

            <div style={{ marginTop: 14, display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setIsConfirmOpen(false)}
                disabled={isPending}
                style={secondaryBtnStyle}
              >
                No
              </button>
              <button type="button" onClick={onConfirmDelete} disabled={isPending} style={dangerBtnStyle}>
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
  position: "relative",
  zIndex: 2,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 28,
  height: 28,
  padding: 0,
  border: "1px solid rgba(248,113,113,0.38)",
  borderRadius: 8,
  background: "rgba(248,113,113,0.08)",
  color: "rgba(248,113,113,0.85)",
  cursor: "pointer",
  flexShrink: 0,
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
