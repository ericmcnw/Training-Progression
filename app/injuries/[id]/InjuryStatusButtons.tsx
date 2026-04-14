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
      router.push("/injuries");
    });
  }

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <button type="button" disabled={pending} onClick={() => setStatus("RECOVERING")} style={buttonStyle}>
        Mark recovering
      </button>
      <button type="button" disabled={pending} onClick={() => setStatus("RESOLVED")} style={buttonStyle}>
        Mark resolved
      </button>
      <button type="button" disabled={pending} onClick={() => setStatus("FLARED")} style={buttonStyle}>
        Mark flared
      </button>
      <button type="button" disabled={pending} onClick={remove} style={buttonStyle}>
        Delete
      </button>
    </div>
  );
}

const buttonStyle: React.CSSProperties = {
  borderRadius: 8,
  fontSize: 12,
};
