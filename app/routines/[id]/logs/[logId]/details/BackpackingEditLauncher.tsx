"use client";

// Edit entry for a backpacking day-log. A trip's day-log can't be edited as a
// standalone session (the generic editor knows nothing about miles, elevation,
// gear, or the other days), so the detail-page "Edit Log" routes here and we
// open the dedicated trip editor instead, returning to `returnTo` on save/close.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BackpackingLogSheet from "@/app/routines/BackpackingLogSheet";
import { getBackpackingTripForEdit, type BackpackingEditData } from "@/app/log/backpacking-log-actions";

export default function BackpackingEditLauncher({ tripId, returnTo }: { tripId: string; returnTo: string }) {
  const router = useRouter();
  const [data, setData] = useState<BackpackingEditData | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getBackpackingTripForEdit(tripId).then((d) => {
      if (cancelled) return;
      if (d) setData(d);
      else setMissing(true);
    });
    return () => {
      cancelled = true;
    };
  }, [tripId]);

  if (missing) return <div style={{ padding: 20 }}>Trip not found.</div>;
  if (!data) return <div style={{ padding: 20, opacity: 0.7 }}>Loading trip…</div>;

  return (
    <BackpackingLogSheet
      editTripId={tripId}
      initialEdit={data}
      onClose={() => router.push(returnTo)}
      onSaved={() => router.push(returnTo)}
    />
  );
}
