"use client";

import { addDaysYmd, diffYmdDays, formatUtcDateLabel, todayAppYmd } from "@/lib/dates";
import { routineKindColor } from "@/lib/routines";
import { useMemo, useState } from "react";
import { saveManualEntries, setCycleActivation } from "./actions";

type Routine = {
  id: string;
  name: string;
  kind: string;
  category: string;
  suggestedTimesPerWeek: number;
  plannedDaysPerWeek: number;
};

type CycleDef = {
  id: string;
  name: string;
  cycleLengthDays: number;
  startDate: string;
  isEnabled: boolean;
  entries: Array<{ routineId: string; dayOffset: number; sortOrder: number }>;
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

function dayDiff(a: string, b: string) {
  return diffYmdDays(a, b);
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
  cycles,
  manualEntries,
}: {
  routines: Routine[];
  cycles: CycleDef[];
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
      const parsed = JSON.parse(payload) as
        | { source: "library"; routineId: string }
        | { source: "manual"; clientId: string }
        | { source: "cycle_once"; cycleId: string };

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

      if (parsed.source === "cycle_once" && parsed.cycleId) {
        const cycle = cycles.find((c) => c.id === parsed.cycleId);
        if (!cycle) return;
        setManual((prev) => {
          const next = prev.slice();
          for (const entry of cycle.entries) {
            const date = addDays(targetDate, entry.dayOffset);
            next.push({
              clientId: `manual-${Date.now()}-${Math.random().toString(16).slice(2)}`,
              routineId: entry.routineId,
              scheduledDate: date,
              sortOrder: next.filter((x) => x.scheduledDate === date).length,
            });
          }
          return normalizeManual(next);
        });
      }
    } catch {
      return;
    }
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <section style={panel}>
        <div style={panelHeader}>SAVED CYCLES</div>
        <div style={{ padding: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {cycles.length === 0 && <div style={{ fontSize: 12, opacity: 0.7 }}>No cycles yet. Create one in Cycle Builder.</div>}
          {cycles.map((cycle) => (
            <div key={cycle.id} style={{ border: "1px solid rgba(128,128,128,0.45)", borderRadius: 12, padding: 8, display: "grid", gap: 8, minWidth: 220 }}>
              <div
                draggable
                onDragStart={(e) => e.dataTransfer.setData("text/plain", JSON.stringify({ source: "cycle_once", cycleId: cycle.id }))}
                style={{ border: "1px dashed rgba(255,255,255,0.6)", borderRadius: 999, padding: "5px 10px", fontSize: 12, cursor: "grab", opacity: 0.95, textAlign: "center" }}
                title="Drag to schedule one full cycle repetition starting on the drop day"
              >
                1x {cycle.name} ({cycle.cycleLengthDays}d)
              </div>
              <form action={setCycleActivation} style={{ display: "grid", gap: 6 }}>
                <input type="hidden" name="planId" value={cycle.id} />
                <input type="hidden" name="returnMode" value="schedule" />
                <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, fontWeight: 700 }}>
                  <input name="isEnabled" type="checkbox" defaultChecked={cycle.isEnabled} />
                  Enabled
                </label>
                <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, fontWeight: 700 }}>
                  Start
                  <input name="startDate" type="date" defaultValue={cycle.startDate} style={{ ...miniInput, flex: 1 }} />
                </label>
                <button type="submit" style={miniBtn}>Save</button>
              </form>
            </div>
          ))}
        </div>
      </section>

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
                const projected = cycles.flatMap((cycle) => {
                  if (!cycle.isEnabled || cycle.cycleLengthDays <= 0) return [];
                  const diff = dayDiff(date, cycle.startDate);
                  if (diff < 0) return [];
                  const offset = diff % cycle.cycleLengthDays;
                  return cycle.entries
                    .filter((entry) => entry.dayOffset === offset)
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map((entry, index) => ({ ...entry, key: `${cycle.id}-${offset}-${index}`, planName: cycle.name }));
                });

                return (
                  <div key={date} onDragOver={(e) => e.preventDefault()} onDrop={(e) => onDrop(e, date)} style={dayCard}>
                    <div style={{ fontWeight: 900, fontSize: 12 }}>{formatDayLabel(date)}</div>
                    <div style={{ fontSize: 11, opacity: 0.75 }}>{date}</div>

                    <div style={{ marginTop: 6, display: "grid", gap: 6 }}>
                      {projected.map((entry) => {
                        const routine = routineMap.get(entry.routineId);
                        if (!routine) return null;
                        return (
                        <div key={entry.key} style={{ border: `1px dashed ${routineKindColor(routine.kind)}`, borderRadius: 8, padding: 6, background: "rgba(128,128,128,0.06)" }}>
                            <div style={{ fontSize: 11, fontWeight: 800 }}>{routine.name}</div>
                            <div style={{ fontSize: 10, opacity: 0.75 }}>Cycle: {entry.planName}</div>
                          </div>
                        );
                      })}
                    </div>

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

const miniInput: React.CSSProperties = {
  padding: 6,
  border: "1px solid rgba(128,128,128,0.6)",
  borderRadius: 8,
  background: "rgba(128,128,128,0.08)",
  color: "inherit",
};

const miniBtn: React.CSSProperties = {
  padding: "6px 8px",
  border: "1px solid rgba(128,128,128,0.8)",
  borderRadius: 8,
  background: "rgba(128,128,128,0.12)",
  color: "inherit",
  fontWeight: 700,
  fontSize: 12,
};
