"use client";

import { useState, useTransition } from "react";
import { deleteGoal } from "./actions";

export default function DeleteGoalButton({
  goalId,
  goalType,
}: {
  goalId?: string;
  goalType?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  function onConfirmDelete() {
    startTransition(async () => {
      await deleteGoal({ goalId, goalType });
    });
  }

  return (
    <>
      <button type="button" onClick={() => setIsConfirmOpen(true)} disabled={isPending} style={btnStyle}>
        {isPending ? "Deleting..." : "Delete"}
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
  padding: "8px 10px",
  border: "1px solid rgba(255,0,0,0.55)",
  borderRadius: 10,
  textAlign: "center",
  textDecoration: "none",
  color: "inherit",
  background: "rgba(128,128,128,0.12)",
  fontWeight: 700,
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
