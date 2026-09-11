"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { archiveProgressionFromList } from "./actions";
import { dangerAction } from "./ui";

export default function DeleteProgressionButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      style={dangerAction}
      disabled={pending}
      onClick={() => {
        if (!confirm(`Delete "${name}"? This removes it from your list.`)) return;
        startTransition(async () => {
          const data = new FormData();
          data.set("progressionId", id);
          await archiveProgressionFromList(data);
          router.refresh();
        });
      }}
    >
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}
