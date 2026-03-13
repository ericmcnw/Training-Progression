"use client";

import { addDaysYmd, formatUtcDateLabel, todayAppYmd } from "@/lib/dates";
import { routineKindColor } from "@/lib/routines";
import { useMemo, useState } from "react";
import { saveManualEntries } from "./actions";

type Routine = {
  id: string;
  name: string;
  kind: string;
  category: string;
  suggestedTimesPerWeek: number;
  plannedDaysPerWeek: number;
};

type ManualEntry = {
  clientId: string;
  routineId: string;
  scheduledDate: string;
  sortOrder: number;
};

function addDays(base: string, plus: number) {
  return addDaysYmd(base, plus);
}

function normalizeManual(items: ManualEntry[]) {
  const groups = new Map<string, ManualEntry[]>();
  for (const item of items) {
    if (!groups.has(item.scheduledDate)) groups.set(item.scheduledDate, []);
    groups.get(item.scheduledDate)!.push(item);
  }
  const normalized: ManualEntry[] = [];
  for (const [date, list] of groups) {
    list
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .forEach((entry, index) => normalized.push({ ...entry, scheduledDate: date, sortOrder: index }));
  }
  return normalized;
}

function formatDayLabel(ymd: string) {
  const weekday = formatUtcDateLabel(ymd, { weekday: "short" });
  const md = formatUtcDateLabel(ymd, { month: "numeric", day: "numeric" });
  return `${weekday} ${md}`;
}

export default function ScheduleBoard({
  routines,
  manualEntries,
}: {
  routines: Routine[];
  manualEntries: Array<{ id: string; routineId: string; scheduledDate: string; sortOrder: number }>;
}) {
  const [manual, setManual] = useState<ManualEntry[]>(
    normalizeManual(
      manualEntries.map((entry) => ({
        clientId: entry.id,
        routineId: entry.routineId,
        scheduledDate: entry.scheduledDate,
        sortOrder: entry.sortOrder,
      }))
    )
  );

  const routineMap = useMemo(() => new Map(routines.map((routine) => [routine.id, routine])), [routines]);
  const routinesByCategory = useMemo(() => {
    const groups = new Map<string, Routine[]>();
    for (const routine of routines) {
      const category = routine.category?.trim() || "General";
      if (!groups.has(category)) groups.set(category, []);
      groups.get(category)!.push(routine);
    }
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [routines]);
  const start = todayAppYmd();
  const horizonDays = 21;
  const days = Array.from({ length: horizonDays }, (_, i) => addDays(start, i));

  const manualEntriesJson = useMemo(
    () =>
      JSON.stringify(
        manual.map((entry) => ({
          routineId: entry.routineId,
          scheduledDate: entry.scheduledDate,
          sortOrder: entry.sortOrder,
        }))
      ),
    [manual]
  );

  function onDrop(event: React.DragEvent<HTMLDivElement>, targetDate: string) {
    event.preventDefault();
    const payload = event.dataTransfer.getData("text/plain");
    if (!payload) return;
    try {
      const parsed = JSON.parse(payload) as { source: "library"; routineId: string } | { source: "manual"; clientId: string };

      if (parsed.source === "library" && parsed.routineId) {
        setManual((prev) =>
          normalizeManual([
            ...prev,
            {
              clientId: `manual-${Date.now()}-${Math.random().toString(16).slice(2)}`,
              routineId: parsed.routineId,
              scheduledDate: targetDate,
              sortOrder: prev.filter((x) => x.scheduledDate === targetDate).length,
            },
          ])
        );
      }

      if (parsed.source === "manual" && parsed.clientId) {
        setManual((prev) =>
          normalizeManual(
            prev.map((entry) =>
              entry.clientId === parsed.clientId
                ? {
                    ...entry,
                    scheduledDate: targetDate,
                    sortOrder: prev.filter((x) => x.scheduledDate === targetDate).length,
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
    <div style={{ display: "grid", gap: 12 }}>
      <section style={panel}>
        <div style={panelHeader}>ROUTINES TO DROP</div>
        <div style={{ padding: 10, display: "grid", gap: 10 }}>
          {routinesByCategory.map(([category, list]) => (
            <div key={category} style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 0.3 }}>{category.toUpperCase()}</div>
              <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
                {list.map((routine) => (
                  <div
                    key={routine.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", JSON.stringify({ source: "library", routineId: routine.id }))}
                    style={{ border: "1px solid rgba(128,128,128,0.45)", borderRadius: 10, padding: 9, background: "rgba(128,128,128,0.08)", cursor: "grab", minWidth: 210 }}
                  >
                    <div style={{ fontWeight: 800, fontSize: 13 }}>{routine.name}</div>
                    <div style={{ marginTop: 3, fontSize: 11, opacity: 0.8 }}>{routine.kind}</div>
                    <div style={{ marginTop: 3, fontSize: 11, opacity: 0.85 }}>
                      Suggested: <b>{routine.suggestedTimesPerWeek}</b>/week | Planned: <b>{routine.plannedDaysPerWeek}</b>/week
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={panel}>
          <div style={panelHeader}>SCHEDULE</div>
          <div style={{ overflowX: "auto", padding: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(150px, 1fr))", gap: 8, minWidth: 1080 }}>
              {days.map((date) => {
                const manualForDate = manual.filter((entry) => entry.scheduledDate === date).sort((a, b) => a.sortOrder - b.sortOrder);

                return (
                  <div key={date} onDragOver={(e) => e.preventDefault()} onDrop={(e) => onDrop(e, date)} style={dayCard}>
                    <div style={{ fontWeight: 900, fontSize: 12 }}>{formatDayLabel(date)}</div>
                    <div style={{ fontSize: 11, opacity: 0.75 }}>{date}</div>

                    <div style={{ marginTop: 6, display: "grid", gap: 6 }}>
                      {manualForDate.map((entry) => {
                        const routine = routineMap.get(entry.routineId);
                        if (!routine) return null;
                        return (
                          <div
                            key={entry.clientId}
                            draggable
                            onDragStart={(e) => e.dataTransfer.setData("text/plain", JSON.stringify({ source: "manual", clientId: entry.clientId }))}
                            style={{ border: `1px solid ${routineKindColor(routine.kind)}`, borderRadius: 8, padding: 6, background: "rgba(128,128,128,0.12)", cursor: "grab" }}
                          >
                            <div style={{ fontSize: 12, fontWeight: 800 }}>{routine.name}</div>
                            <button
                              type="button"
                              style={removeBtn}
                              onClick={() => setManual((prev) => normalizeManual(prev.filter((x) => x.clientId !== entry.clientId)))}
                            >
                              Remove
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ padding: 10, borderTop: "1px solid rgba(128,128,128,0.25)" }}>
            <form action={saveManualEntries}>
              <input type="hidden" name="manualEntriesJson" value={manualEntriesJson} />
              <button type="submit" style={saveBtn}>
                Save Schedule
              </button>
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
  minHeight: 175,
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
