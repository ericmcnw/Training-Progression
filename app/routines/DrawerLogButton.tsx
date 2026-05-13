"use client";

import { useLogDrawer } from "@/app/contexts/LogDrawerContext";

export default function DrawerLogButton({
  routineId,
  defaultDate,
  label = "Log",
  className = "routineCardPrimaryAction",
  style,
}: {
  routineId: string;
  /** YYYY-MM-DD — passed through openDrawer so back-date entry points keep
   *  the floating-drawer flow when logging retroactively. */
  defaultDate?: string;
  label?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const { openDrawer } = useLogDrawer();
  return (
    <button
      type="button"
      className={className}
      style={style}
      onClick={() => openDrawer(routineId, defaultDate ? { defaultDate } : undefined)}
    >
      {label}
    </button>
  );
}
