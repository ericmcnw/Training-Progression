"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addManualZoneActivity } from "@/app/body/actions";
import { todayAppYmd } from "@/lib/dates";

export default function ManualZoneActivityForm({ zoneSlug }: { zoneSlug: string }) {
  const router = useRouter();
  const [performedAt, setPerformedAt] = useState(todayAppYmd());
  const [label, setLabel] = useState("");
  const [intensity, setIntensity] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      try {
        await addManualZoneActivity({
          zoneSlug,
          performedAt: `${performedAt}T12:00:00.000`,
          label,
          intensity: intensity || null,
          notes,
        });
        router.push(`/body/${zoneSlug}`);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to add activity.");
      }
    });
  }

  return (
    <div style={card}>
      <div style={{ fontWeight: 900 }}>Manual zone activity</div>
      <div style={grid}>
        <label style={field}>
          Date
          <input type="date" value={performedAt} onChange={(event) => setPerformedAt(event.target.value)} />
        </label>
        <label style={field}>
          Label
          <input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Surf session, long hike..." />
        </label>
        <label style={field}>
          Intensity
          <select value={intensity} onChange={(event) => setIntensity(event.target.value)}>
            <option value="">Optional</option>
            <option value="easy">Easy</option>
            <option value="moderate">Moderate</option>
            <option value="hard">Hard</option>
          </select>
        </label>
      </div>
      <label style={field}>
        Notes
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} />
      </label>
      {message ? <div style={{ fontSize: 12, color: "#FCA5A5" }}>{message}</div> : null}
      <button type="button" disabled={pending} onClick={submit}>
        {pending ? "Saving…" : "Add activity"}
      </button>
    </div>
  );
}

const card: React.CSSProperties = {
  border: "1px solid rgba(96,165,250,0.28)",
  borderRadius: 16,
  background: "rgba(96,165,250,0.08)",
  padding: 14,
  display: "grid",
  gap: 12,
};
const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 };
const field: React.CSSProperties = { display: "grid", gap: 6, fontSize: 13, fontWeight: 800 };
