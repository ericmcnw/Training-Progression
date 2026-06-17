"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { InjuryStatus } from "@/generated/prisma";
import { deleteInjury, updateInjuryStatus } from "../actions";

export default function InjuryStatusButtons({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function setStatus(status: InjuryStatus) {
    startTransition(async () => {
      await updateInjuryStatus(id, status);
      router.refresh();
    });
  }

  function remove() {
    if (!window.confirm("Delete this injury?")) return;
    startTransition(async () => {
      await deleteInjury(id);
      router.push("/body");
    });
  }

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <button type="button" disabled={pending} onClick={() => setStatus("RECOVERING")} style={buttonStyle}>
        Mark recovering
      </button>
      <button type="button" disabled={pending} onClick={() => setStatus("RESOLVED")} style={buttonStyle}>
        Mark resolved
      </button>
      <button type="button" disabled={pending} onClick={() => setStatus("FLARED")} style={buttonStyle}>
        Mark flared
      </button>
      <button type="button" disabled={pending} onClick={remove} style={{ ...buttonStyle, ...dangerStyle, marginLeft: "auto" }}>
        Delete injury
      </button>
    </div>
  );
}

const buttonStyle: React.CSSProperties = {
  appearance: "none",
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.05)",
  color: "inherit",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
  minHeight: 36,
};

const dangerStyle: React.CSSProperties = {
  border: "1px solid rgba(248,113,113,0.4)",
  background: "rgba(248,113,113,0.10)",
  color: "#FCA5A5",
};
