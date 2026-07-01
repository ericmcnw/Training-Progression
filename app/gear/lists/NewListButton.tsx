"use client";

import { useState, useTransition, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { ACTIVITY_REGISTRY } from "@/lib/activity-families";
import { inputStyle } from "@/app/routines/[id]/log/form-ui";
import { createGearList } from "./actions";

const ACTIVITY_OPTIONS = ACTIVITY_REGISTRY.filter((a) => !a.pinnedCatchAll).sort((a, b) => a.label.localeCompare(b.label));

export default function NewListButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [activitySlug, setActivitySlug] = useState("");
  const [pending, startTransition] = useTransition();

  function create() {
    startTransition(async () => {
      const { id } = await createGearList({ name, activitySlug: activitySlug || null });
      router.push(`/gear/lists/${id}`);
    });
  }

  if (!open) {
    return (
      <button type="button" style={openBtn} onClick={() => setOpen(true)}>
        ＋ New list
      </button>
    );
  }

  return (
    <div style={card}>
      <input
        autoFocus
        style={{ ...inputStyle, fontWeight: 800 }}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && create()}
        placeholder="List name — e.g. Backpacking kit"
        aria-label="List name"
      />
      <select style={inputStyle} value={activitySlug} onChange={(e) => setActivitySlug(e.target.value)} aria-label="Activity">
        <option value="">Any activity</option>
        {ACTIVITY_OPTIONS.map((a) => (
          <option key={a.slug} value={a.slug}>
            {a.icon} {a.label}
          </option>
        ))}
      </select>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" style={cancelBtn} onClick={() => setOpen(false)}>
          Cancel
        </button>
        <button type="button" style={createBtn} onClick={create} disabled={pending}>
          {pending ? "Creating…" : "Create list"}
        </button>
      </div>
    </div>
  );
}

const openBtn: CSSProperties = {
  padding: "10px 16px",
  borderRadius: 999,
  border: "1px solid rgba(132,204,120,0.4)",
  background: "rgba(132,204,120,0.14)",
  color: "rgba(190,240,170,0.98)",
  fontWeight: 800,
  fontSize: 13,
  cursor: "pointer",
};
const card: CSSProperties = {
  display: "grid",
  gap: 10,
  padding: 14,
  borderRadius: 14,
  border: "1px solid rgba(128,128,128,0.3)",
  background: "rgba(128,128,128,0.05)",
};
const cancelBtn: CSSProperties = {
  padding: "8px 14px",
  borderRadius: 10,
  border: "1px solid rgba(128,128,128,0.4)",
  background: "transparent",
  color: "inherit",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
};
const createBtn: CSSProperties = {
  padding: "8px 16px",
  borderRadius: 10,
  border: "1px solid rgba(132,204,120,0.5)",
  background: "rgba(132,204,120,0.18)",
  color: "rgba(190,240,170,0.98)",
  fontWeight: 800,
  fontSize: 13,
  cursor: "pointer",
};
