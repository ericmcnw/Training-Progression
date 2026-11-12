"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ROUTINE_SORT_OPTIONS, RETIRED_AFTER_DAYS, type RoutineSortKey } from "@/lib/routine-grouping";
import ArchiveRoutineButton from "./ArchiveRoutineButton";

export type RoutineListItem = {
  id: string;
  name: string;
  lastAt: string | null;
  logCount: number;
  retired: boolean;
  /** Name of a live routine sharing this one's day — "Push A" → "Push B". */
  supersededBy: string | null;
  node: ReactNode;
};

function comparator(sort: RoutineSortKey) {
  if (sort === "name") return (a: RoutineListItem, b: RoutineListItem) => a.name.localeCompare(b.name);
  if (sort === "logged") return (a: RoutineListItem, b: RoutineListItem) => b.logCount - a.logCount || a.name.localeCompare(b.name);
  return (a: RoutineListItem, b: RoutineListItem) => {
    if (a.lastAt === b.lastAt) return a.name.localeCompare(b.name);
    if (!a.lastAt) return 1;
    if (!b.lastAt) return -1;
    return a.lastAt < b.lastAt ? 1 : -1;
  };
}

export default function RoutineListControls({
  items,
  accentColor,
}: {
  items: RoutineListItem[];
  accentColor?: string;
}) {
  const [sort, setSort] = useState<RoutineSortKey>("recent");
  const [showRetired, setShowRetired] = useState(false);

  const { live, retired } = useMemo(() => {
    const cmp = comparator(sort);
    return {
      live: items.filter((i) => !i.retired).sort(cmp),
      retired: items.filter((i) => i.retired).sort(cmp),
    };
  }, [items, sort]);

  const accent = accentColor ?? "rgba(255,255,255,0.75)";

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <span style={{ fontSize: 10, fontWeight: 800, opacity: 0.5, letterSpacing: 0.5 }}>SORT</span>
        {ROUTINE_SORT_OPTIONS.map((opt) => {
          const on = sort === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setSort(opt.value)}
              style={{
                minHeight: 30,
                padding: "5px 10px",
                borderRadius: 999,
                border: `1px solid ${on ? accent.replace("0.9", "0.5") : "rgba(255,255,255,0.12)"}`,
                background: on ? accent.replace("0.9", "0.15") : "rgba(255,255,255,0.04)",
                color: on ? accent : "inherit",
                fontSize: 11,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {live.map((item) => <div key={item.id}>{item.node}</div>)}

      {live.length === 0 && retired.length > 0 ? (
        <div style={{ padding: "10px 12px", fontSize: 12, opacity: 0.6, border: "1px dashed rgba(255,255,255,0.13)", borderRadius: 10 }}>
          Nothing logged here in the last {RETIRED_AFTER_DAYS} days.
        </div>
      ) : null}

      {retired.length > 0 ? (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 8, display: "grid", gap: 8 }}>
          <button
            type="button"
            onClick={() => setShowRetired((v) => !v)}
            style={{
              minHeight: 36,
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.03)",
              color: "rgba(255,255,255,0.6)",
              fontSize: 11.5,
              fontWeight: 800,
              textAlign: "left",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span aria-hidden="true" style={{ opacity: 0.7 }}>{showRetired ? "▴" : "▾"}</span>
            Retired · {retired.length} not logged in {RETIRED_AFTER_DAYS}+ days
          </button>

          {showRetired ? (
            <div style={{ display: "grid", gap: 8 }}>
              {retired.map((item) => (
                <div key={item.id} style={{ display: "grid", gap: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, opacity: 0.6 }}>
                      {item.supersededBy ? (
                        <>Superseded by <b style={{ color: "rgba(255,255,255,0.8)" }}>{item.supersededBy}</b></>
                      ) : item.logCount === 0 ? (
                        "Never logged"
                      ) : (
                        `${item.logCount} ${item.logCount === 1 ? "log" : "logs"}, then dropped`
                      )}
                    </span>
                    <ArchiveRoutineButton routineId={item.id} />
                  </div>
                  <div style={{ opacity: 0.66 }}>{item.node}</div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
