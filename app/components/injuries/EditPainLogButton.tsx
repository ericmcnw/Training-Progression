"use client";

import { useState, type CSSProperties } from "react";
import EditPainLogSheet from "./EditPainLogSheet";
import type { PainContext } from "@/generated/prisma";

type ZoneOption = { slug: string; label: string };

export default function EditPainLogButton({
  log,
  zones,
  factorSuggestions = [],
}: {
  log: { id: string; zoneSlug: string; level: number; context: PainContext; notes: string; aggravatingFactors: string[] };
  zones: ZoneOption[];
  factorSuggestions?: string[];
}) {
  const [editing, setEditing] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setEditing(true)} style={style} aria-label="Edit pain log">
        Edit
      </button>
      {editing ? (
        <EditPainLogSheet log={log} zones={zones} factorSuggestions={factorSuggestions} onClose={() => setEditing(false)} />
      ) : null}
    </>
  );
}

const style: CSSProperties = {
  appearance: "none",
  border: "1px solid rgba(255,255,255,0.16)",
  background: "rgba(255,255,255,0.05)",
  color: "rgba(255,255,255,0.8)",
  borderRadius: 8,
  padding: "4px 9px",
  fontSize: 11,
  fontWeight: 800,
  cursor: "pointer",
  minHeight: 30,
};
