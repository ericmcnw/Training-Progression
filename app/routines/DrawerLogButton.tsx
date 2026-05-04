"use client";

import { useLogDrawer } from "@/app/contexts/LogDrawerContext";

export default function DrawerLogButton({ routineId }: { routineId: string }) {
  const { openDrawer } = useLogDrawer();
  return (
    <button
      type="button"
      className="routineCardPrimaryAction"
      onClick={() => openDrawer(routineId)}
    >
      Log
    </button>
  );
}
