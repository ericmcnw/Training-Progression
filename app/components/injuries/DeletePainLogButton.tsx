"use client";

import { useRouter } from "next/navigation";
import { useTransition, type CSSProperties } from "react";
import { deletePainLog } from "@/app/body/actions";

export default function DeletePainLogButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function remove() {
    if (!window.confirm("Delete this pain log? This can't be undone.")) return;
    startTransition(async () => {
      await deletePainLog(id);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={remove}
      disabled={pending}
      style={style}
      aria-label="Delete pain log"
    >
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}

const style: CSSProperties = {
  appearance: "none",
  border: "1px solid rgba(248,113,113,0.28)",
  background: "transparent",
  color: "rgba(248,113,113,0.8)",
  borderRadius: 8,
  padding: "4px 9px",
  fontSize: 11,
  fontWeight: 800,
  cursor: "pointer",
  minHeight: 30,
};
