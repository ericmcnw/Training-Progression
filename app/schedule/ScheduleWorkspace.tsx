"use client";

import { addDaysYmd, diffYmdDays, todayAppYmd } from "@/lib/dates";
import { routineKindColor } from "@/lib/routines";
import { useMemo, useState } from "react";
import { saveCycleEntries, saveManualEntries } from "./actions";

type Routine = {
  id: string;
  name: string;
  kind: string;
  category: string;
};

type CycleEntry = {
  clientId: string;
  routineId: string;
  dayOffset: number;
  sortOrder: number;
};

type ManualEntry = {
  clientId: string;
  routineId: string;
  scheduledDate: string;
  sortOrder: number;
};

type ActiveCycle = {
  id: string;
  name: string;
  cycleLengthDays: number;
  startDate: string;
  isEnabled: boolean;
  entries: Array<{ routineId: string; dayOffset: number; sortOrder: number }>;
};

function dayKey(date: string) {
  return date;
}

function normalizeCycle(items: CycleEntry[]) {
  const groups = new Map<number, CycleEntry[]>();
  for (const item of items) {
    if (!groups.has(item.dayOffset)) groups.set(item.dayOffset, []);
    groups.get(item.dayOffset)!.push(item);
  }
  const normalized: CycleEntry[] = [];
  for (const [offset, list] of groups) {
    list
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .forEach((item, index) => normalized.push({ ...item, dayOffset: offset, sortOrder: index }));
  }
  return normalized;
}

function normalizeManual(items: ManualEntry[]) {
  const groups = new Map<string, ManualEntry[]>();
  for (const item of items) {
    const key = dayKey(item.scheduledDate);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }
  const normalized: ManualEntry[] = [];
  for (const [date, list] of groups) {
    list
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .forEach((item, index) => normalized.push({ ...item, scheduledDate: date, sortOrder: index }));
  }
  return normalized;
}

function todayYmd() {
  return todayAppYmd();
}

function addDays(base: string, plus: number) {
  return addDaysYmd(base, plus);
}

function dayDiff(from: string, to: string) {
  return diffYmdDays(from, to);
}

export default function ScheduleWorkspace({
  selectedPlanId,
  selectedPlanCycleLengthDays,
  selectedPlanEntries,
  routines,
  activeCycles,
  manualEntries,
}: {
  selectedPlanId: string;
  selectedPlanCycleLengthDays: number;
  selectedPlanEntries: Array<{ id: string; routineId: string; dayOffset: number; sortOrder: number }>;
  routines: Routine[];
  activeCycles: ActiveCycle[];
  manualEntries: Array<{ id: string; routineId: string; scheduledDate: string; sortOrder: number }>;
}) {
  const [cycleEntries, setCycleEntries] = useState<CycleEntry[]>(
    normalizeCycle(
      selectedPlanEntries.map((entry) => ({
        clientId: entry.id,
        routineId: entry.routineId,
        dayOffset: entry.dayOffset,
        sortOrder: entry.sortOrder,
      }))
    )
  );
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
  const viewStart = todayYmd();
  const horizonDays = 21;
  const visibleDays = Array.from({ length: horizonDays }, (_, i) => addDays(viewStart, i));

  const cycleEntriesJson = useMemo(
    () =>
      JSON.stringify(
        cycleEntries.map((entry) => ({
          routineId: entry.routineId,
          dayOffset: entry.dayOffset,
          sortOrder: entry.sortOrder,
        }))
      ),
    [cycleEntries]
  );
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

  function onDropCycle(event: React.DragEvent<HTMLDivElement>, dayOffset: number) {
    event.preventDefault();
    const payload = event.dataTransfer.getData("text/plain");
    if (!payload) return;
    try {
      const parsed = JSON.parse(payload) as { source: "library" | "cycle"; routineId?: string; clientId?: string };
      if (parsed.source === "library" && parsed.routineId) {
        setCycleEntries((prev) =>
          normalizeCycle([
            ...prev,
            {
              clientId: `cycle-${Date.now()}-${Math.random().toString(16).slice(2)}`,
              routineId: parsed.routineId!,
              dayOffset,
              sortOrder: prev.filter((entry) => entry.dayOffset === dayOffset).length,
            },
          ])
        );
      }
      if (parsed.source === "cycle" && parsed.clientId) {
        setCycleEntries((prev) =>
          normalizeCycle(
            prev.map((entry) =>
              entry.clientId === parsed.clientId
                ? {
                    ...entry,
                    dayOffset,
                    sortOrder: prev.filter((x) => x.dayOffset === dayOffset).length,
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

  function onDropManual(event: React.DragEvent<HTMLDivElement>, date: string) {
    event.preventDefault();
    const payload = event.dataTransfer.getData("text/plain");
    if (!payload) return;
    try {
      const parsed = JSON.parse(payload) as { source: "library" | "manual"; routineId?: string; clientId?: string };
      if (parsed.source === "library" && parsed.routineId) {
        setManual((prev) =>
          normalizeManual([
            ...prev,
            {
              clientId: `manual-${Date.now()}-${Math.random().toString(16).slice(2)}`,
              routineId: parsed.routineId!,
              scheduledDate: date,
              sortOrder: prev.filter((entry) => entry.scheduledDate === date).length,
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
                    scheduledDate: date,
                    sortOrder: prev.filter((x) => x.scheduledDate === date).length,
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
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(220px,280px) 1fr", gap: 12 }}>
        <section style={panel}>
          <div style={panelHeader}>ROUTINE LIBRARY</div>
          <div style={{ padding: 10, display: "grid", gap: 8, maxHeight: 640, overflowY: "auto" }}>
            {routines.map((routine) => (
              <div
                key={routine.id}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData("text/plain", JSON.stringify({ source: "library", routineId: routine.id }));
                }}
                style={{ border: "1px solid rgba(128,128,128,0.45)", borderRadius: 10, padding: 9, background: "rgba(128,128,128,0.07)", cursor: "grab" }}
              >
                <div style={{ fontWeight: 800, fontSize: 13 }}>{routine.name}</div>
                <div style={{ marginTop: 4, fontSize: 11, opacity: 0.8 }}>{routine.category} | {routine.kind}</div>
              </div>
            ))}
          </div>
        </section>

        <section style={panel}>
          <div style={panelHeader}>CYCLE TEMPLATE EDITOR (DAYS)</div>
          <div style={{ padding: 10, overflowX: "auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${selectedPlanCycleLengthDays}, minmax(150px, 1fr))`, gap: 8, minWidth: Math.max(800, selectedPlanCycleLengthDays * 150) }}>
              {Array.from({ length: selectedPlanCycleLengthDays }, (_, dayOffset) => {
                const entries = cycleEntries.filter((entry) => entry.dayOffset === dayOffset).sort((a, b) => a.sortOrder - b.sortOrder);
                return (
                  <div key={dayOffset} onDragOver={(e) => e.preventDefault()} onDrop={(e) => onDropCycle(e, dayOffset)} style={dayCard}>
                    <div style={{ fontWeight: 900, fontSize: 12 }}>Day {dayOffset + 1}</div>
                    <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                      {entries.map((entry) => {
                        const routine = routineMap.get(entry.routineId);
                        if (!routine) return null;
                        return (
                          <div
                            key={entry.clientId}
                            draggable
                            onDragStart={(event) => event.dataTransfer.setData("text/plain", JSON.stringify({ source: "cycle", clientId: entry.clientId }))}
                            style={{ border: `1px solid ${routineKindColor(routine.kind)}`, borderRadius: 8, padding: 7, background: "rgba(128,128,128,0.08)", cursor: "grab" }}
                          >
                            <div style={{ fontSize: 12, fontWeight: 800 }}>{routine.name}</div>
                            <button
                              type="button"
                              style={removeBtn}
                              onClick={() => setCycleEntries((prev) => normalizeCycle(prev.filter((x) => x.clientId !== entry.clientId)))}
                            >
                              Remove
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    {entries.length === 0 && <div style={{ marginTop: 8, fontSize: 12, opacity: 0.6 }}>Drop routine</div>}
                  </div>
                );
              })}
            </div>
          </div>
          <div style={{ padding: 10, borderTop: "1px solid rgba(128,128,128,0.25)" }}>
            <form action={saveCycleEntries}>
              <input type="hidden" name="planId" value={selectedPlanId} />
              <input type="hidden" name="entriesJson" value={cycleEntriesJson} />
              <button type="submit" style={saveBtn}>Save Cycle Template</button>
            </form>
          </div>
        </section>
      </div>

      <section style={panel}>
        <div style={panelHeader}>OVERARCHING SCHEDULE (NEXT 21 DAYS)</div>
        <div style={{ overflowX: "auto", padding: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(150px, 1fr))", gap: 8, minWidth: 1080 }}>
            {visibleDays.map((date) => {
              const manualForDate = manual.filter((entry) => entry.scheduledDate === date).sort((a, b) => a.sortOrder - b.sortOrder);
              const cycleProjected = activeCycles.flatMap((plan) => {
                if (!plan.isEnabled) return [];
                const diff = dayDiff(date, plan.startDate);
                if (diff < 0 || plan.cycleLengthDays <= 0) return [];
                const dayOffset = diff % plan.cycleLengthDays;
                return plan.entries
                  .filter((entry) => entry.dayOffset === dayOffset)
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map((entry, i) => ({ ...entry, planName: plan.name, key: `${plan.id}-${dayOffset}-${i}` }));
              });

              return (
                <div key={date} onDragOver={(e) => e.preventDefault()} onDrop={(e) => onDropManual(e, date)} style={dayCard}>
                  <div style={{ fontWeight: 900, fontSize: 12 }}>{date}</div>

                  <div style={{ marginTop: 6, display: "grid", gap: 6 }}>
                    {cycleProjected.map((entry) => {
                      const routine = routineMap.get(entry.routineId);
                      if (!routine) return null;
                      return (
                        <div key={entry.key} style={{ border: `1px dashed ${routineKindColor(routine.kind)}`, borderRadius: 8, padding: 6, background: "rgba(128,128,128,0.05)" }}>
                          <div style={{ fontSize: 11, fontWeight: 800 }}>{routine.name}</div>
                          <div style={{ fontSize: 10, opacity: 0.75 }}>From cycle: {entry.planName}</div>
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
                          onDragStart={(event) => event.dataTransfer.setData("text/plain", JSON.stringify({ source: "manual", clientId: entry.clientId }))}
                          style={{ border: `1px solid ${routineKindColor(routine.kind)}`, borderRadius: 8, padding: 7, background: "rgba(128,128,128,0.12)", cursor: "grab" }}
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
            <button type="submit" style={saveBtn}>Save Overarching Schedule</button>
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
  minHeight: 150,
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
