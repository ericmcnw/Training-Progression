"use client";

import { routineKindColor } from "@/lib/routines";
import { useMemo, useState } from "react";
import { saveCycleEntries } from "./actions";

type Routine = {
  id: string;
  name: string;
  kind: string;
  category: string;
  timesPerWeek: number | null;
};

type Entry = {
  clientId: string;
  routineId: string;
  dayOffset: number;
  sortOrder: number;
};

function normalizeEntries(items: Entry[]) {
  const groups = new Map<number, Entry[]>();
  for (const item of items) {
    if (!groups.has(item.dayOffset)) groups.set(item.dayOffset, []);
    groups.get(item.dayOffset)!.push(item);
  }
  const out: Entry[] = [];
  for (const [offset, list] of groups) {
    list
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .forEach((item, index) => out.push({ ...item, dayOffset: offset, sortOrder: index }));
  }
  return out;
}

export default function CycleBuilder({
  planId,
  cycleLengthDays,
  routines,
  initialEntries,
}: {
  planId: string;
  cycleLengthDays: number;
  routines: Routine[];
  initialEntries: Array<{ id: string; routineId: string; dayOffset: number; sortOrder: number }>;
}) {
  const [entries, setEntries] = useState<Entry[]>(
    normalizeEntries(
      initialEntries.map((entry) => ({
        clientId: entry.id,
        routineId: entry.routineId,
        dayOffset: entry.dayOffset,
        sortOrder: entry.sortOrder,
      }))
    )
  );
  const routineMap = useMemo(() => new Map(routines.map((routine) => [routine.id, routine])), [routines]);

  const entriesJson = useMemo(
    () =>
      JSON.stringify(
        entries.map((entry) => ({
          routineId: entry.routineId,
          dayOffset: entry.dayOffset,
          sortOrder: entry.sortOrder,
        }))
      ),
    [entries]
  );

  function onDrop(event: React.DragEvent<HTMLDivElement>, targetOffset: number) {
    event.preventDefault();
    const raw = event.dataTransfer.getData("text/plain");
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as
        | { source: "library"; routineId: string }
        | { source: "cycle"; clientId: string };

      if (parsed.source === "library" && parsed.routineId) {
        setEntries((prev) =>
          normalizeEntries([
            ...prev,
            {
              clientId: `cycle-${Date.now()}-${Math.random().toString(16).slice(2)}`,
              routineId: parsed.routineId,
              dayOffset: targetOffset,
              sortOrder: prev.filter((entry) => entry.dayOffset === targetOffset).length,
            },
          ])
        );
      }

      if (parsed.source === "cycle" && parsed.clientId) {
        setEntries((prev) =>
          normalizeEntries(
            prev.map((entry) =>
              entry.clientId === parsed.clientId
                ? {
                    ...entry,
                    dayOffset: targetOffset,
                    sortOrder: prev.filter((x) => x.dayOffset === targetOffset).length,
                  }
                : entry
            )
          )
        );
      }
    } catch {
      return;
    }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(240px,300px) 1fr", gap: 12 }}>
      <section style={panel}>
        <div style={panelHeader}>ROUTINES</div>
        <div style={{ padding: 10, display: "grid", gap: 8, maxHeight: 640, overflowY: "auto" }}>
          {routines.map((routine) => (
            <div
              key={routine.id}
              draggable
              onDragStart={(e) => e.dataTransfer.setData("text/plain", JSON.stringify({ source: "library", routineId: routine.id }))}
              style={{ border: "1px solid rgba(128,128,128,0.45)", borderRadius: 10, padding: 9, background: "rgba(128,128,128,0.08)", cursor: "grab" }}
            >
              <div style={{ fontWeight: 800, fontSize: 13 }}>{routine.name}</div>
              <div style={{ marginTop: 3, fontSize: 11, opacity: 0.8 }}>{routine.category} | {routine.kind}</div>
              <div style={{ marginTop: 3, fontSize: 11, opacity: 0.85 }}>
                Suggested: <b>{routine.timesPerWeek ?? 0}</b>/week
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={panel}>
        <div style={panelHeader}>CYCLE DAYS</div>
        <div style={{ overflowX: "auto", padding: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${cycleLengthDays}, minmax(150px, 1fr))`, gap: 8, minWidth: Math.max(800, cycleLengthDays * 150) }}>
            {Array.from({ length: cycleLengthDays }, (_, dayOffset) => {
              const list = entries.filter((entry) => entry.dayOffset === dayOffset).sort((a, b) => a.sortOrder - b.sortOrder);
              return (
                <div key={dayOffset} onDragOver={(e) => e.preventDefault()} onDrop={(e) => onDrop(e, dayOffset)} style={dayCard}>
                  <div style={{ fontWeight: 900, fontSize: 12 }}>Day {dayOffset + 1}</div>
                  <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                    {list.map((entry) => {
                      const routine = routineMap.get(entry.routineId);
                      if (!routine) return null;
                      return (
                        <div
                          key={entry.clientId}
                          draggable
                          onDragStart={(e) => e.dataTransfer.setData("text/plain", JSON.stringify({ source: "cycle", clientId: entry.clientId }))}
                          style={{ border: `1px solid ${routineKindColor(routine.kind)}`, borderRadius: 8, padding: 6, background: "rgba(128,128,128,0.1)", cursor: "grab" }}
                        >
                          <div style={{ fontSize: 12, fontWeight: 800 }}>{routine.name}</div>
                          <button
                            type="button"
                            style={removeBtn}
                            onClick={() => setEntries((prev) => normalizeEntries(prev.filter((x) => x.clientId !== entry.clientId)))}
                          >
                            Remove
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  {list.length === 0 && <div style={{ marginTop: 8, fontSize: 12, opacity: 0.6 }}>Drop routine</div>}
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ padding: 10, borderTop: "1px solid rgba(128,128,128,0.25)" }}>
          <form action={saveCycleEntries}>
            <input type="hidden" name="planId" value={planId} />
            <input type="hidden" name="returnMode" value="cycle" />
            <input type="hidden" name="entriesJson" value={entriesJson} />
            <button type="submit" style={saveBtn}>Save Cycle</button>
          </form>
        </div>
      </section>
    </div>
  );
}

const panel: React.CSSProperties = {
  border: "1px solid rgba(128,128,128,0.35)",
  borderRadius: 12,
  overflow: "hidden",
};

const panelHeader: React.CSSProperties = {
  padding: "10px 14px",
  background: "rgba(128,128,128,0.14)",
  borderBottom: "1px solid rgba(128,128,128,0.25)",
  fontWeight: 900,
  fontSize: 12,
  letterSpacing: 0.3,
};

const dayCard: React.CSSProperties = {
  border: "1px solid rgba(128,128,128,0.35)",
  borderRadius: 10,
  padding: 8,
  minHeight: 160,
  background: "rgba(128,128,128,0.05)",
};

const saveBtn: React.CSSProperties = {
  padding: "8px 12px",
  border: "1px solid rgba(84,203,130,0.8)",
  borderRadius: 10,
  background: "rgba(84,203,130,0.16)",
  color: "inherit",
  fontWeight: 800,
};

const removeBtn: React.CSSProperties = {
  marginTop: 6,
  padding: "2px 6px",
  border: "1px solid rgba(255,80,80,0.75)",
  borderRadius: 7,
  background: "rgba(255,80,80,0.12)",
  color: "inherit",
  fontSize: 11,
};
