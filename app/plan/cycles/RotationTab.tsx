// RotationTab — the Plan page's Rotation section. Shows the recommended next
// slot, each slot's satisfied state + coverage, recent history, and a
// collapsible builder. Replaces the old "Cycles coming" placeholder.

import type { CSSProperties } from "react";
import { prisma } from "@/lib/prisma";
import { effectiveRoutineDomain } from "@/lib/routines";
import { activitiesByFamily } from "@/lib/activity-families";
import { formatAppDate } from "@/lib/dates";
import { getRotationOverview, type RotationOverview } from "@/lib/rotation";
import RotationBuilder, { type BuilderSlot, type BuilderTag } from "./RotationBuilder";

export default async function RotationTab() {
  const [overview, raw, routineRows] = await Promise.all([
    getRotationOverview(),
    prisma.rotation.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
      include: { slots: { orderBy: { position: "asc" }, include: { coverage: true } } },
    }),
    prisma.routine.findMany({
      where: { isActive: true, isDeleted: false, isPlaceholder: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true, domain: true, kind: true, subtype: true },
    }),
  ]);

  const routines = routineRows.map((r) => ({
    id: r.id,
    name: r.name,
    domain: effectiveRoutineDomain(r.domain, r.kind, r.subtype),
  }));

  const tags: BuilderTag[] = [
    ...activitiesByFamily("sports"),
    ...activitiesByFamily("endurance"),
  ].map((e) => ({ tag: e.slug, label: e.label, icon: e.icon }));

  if (!raw) {
    return <RotationBuilder rotation={null} slots={[]} routines={routines} tags={tags} />;
  }

  const builderSlots: BuilderSlot[] = raw.slots.map((s) => ({
    id: s.id,
    name: s.name,
    primaryRoutineId: s.primaryRoutineId,
    coverage: s.coverage.map((c) => ({ id: c.id, routineId: c.routineId, tag: c.tag })),
  }));

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {overview ? <RotationDisplay overview={overview} /> : null}
      <RotationBuilder
        rotation={{ id: raw.id, name: raw.name }}
        slots={builderSlots}
        routines={routines}
        tags={tags}
      />
    </div>
  );
}

function RotationDisplay({ overview }: { overview: RotationOverview }) {
  const next = overview.slots.find((s) => s.isNext) ?? null;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {/* Next up */}
      {next ? (
        <div style={nextCard}>
          <div style={nextEyebrow}>
            {overview.roundComplete ? "Round complete · start again" : "Recommended next"}
          </div>
          <div style={nextName}>{next.name}</div>
          {next.primaryRoutineName ? (
            <div style={nextSub}>{next.primaryRoutineName}</div>
          ) : (
            <div style={{ ...nextSub, opacity: 0.55 }}>Covered by activities</div>
          )}
        </div>
      ) : null}

      {/* Slot ring */}
      <div style={{ display: "grid", gap: 8 }}>
        {overview.slots.map((slot, idx) => (
          <div key={slot.id} style={{ ...slotRow, ...(slot.isNext ? slotRowNext : {}) }}>
            <span style={{ ...statusDot, ...(slot.satisfied ? statusDotDone : {}) }} aria-hidden>
              {slot.satisfied ? "✓" : idx + 1}
            </span>
            <div style={{ display: "grid", gap: 2, minWidth: 0, flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={slotName}>{slot.name}</span>
                {slot.isNext ? <span style={nextBadge}>NEXT</span> : null}
              </div>
              <div style={slotMeta}>
                {slot.primaryRoutineName ?? "Covered by activities"}
                {slot.lastDoneDate
                  ? ` · last ${formatAppDate(slot.lastDoneDate, { month: "short", day: "numeric" })}`
                  : ""}
              </div>
              {slot.coverageTags.length > 0 || slot.coverageRoutines.length > 0 ? (
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 2 }}>
                  {slot.coverageTags.map((t) => (
                    <span key={`t-${t.tag}`} style={covPill}>{t.icon ? `${t.icon} ` : ""}{t.label}</span>
                  ))}
                  {slot.coverageRoutines.map((r) => (
                    <span key={`r-${r.id}`} style={covPill}>{r.name}</span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {/* Recent */}
      {overview.recent.length > 0 ? (
        <div style={{ display: "grid", gap: 6 }}>
          <div style={recentLabel}>Recent</div>
          {overview.recent.map((r, i) => (
            <div key={i} style={recentRow}>
              <span style={{ fontWeight: 800, fontSize: 12.5 }}>{r.slotName || r.label}</span>
              <span style={{ fontSize: 11, opacity: 0.6 }}>
                {r.label} · {formatAppDate(r.date, { month: "short", day: "numeric" })}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ── styles ────────────────────────────────────────────────────────────────

const nextCard: CSSProperties = {
  display: "grid",
  gap: 3,
  padding: "14px 16px",
  borderRadius: 14,
  border: "1px solid rgba(51,255,122,0.35)",
  background: "linear-gradient(180deg, rgba(51,255,122,0.10), rgba(51,255,122,0.02))",
};

const nextEyebrow: CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  color: "rgba(120,230,160,0.9)",
};

const nextName: CSSProperties = {
  fontSize: 22,
  fontWeight: 900,
  letterSpacing: -0.3,
};

const nextSub: CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  opacity: 0.78,
};

const slotRow: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 10,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.025)",
};

const slotRowNext: CSSProperties = {
  border: "1px solid rgba(51,255,122,0.4)",
  background: "rgba(51,255,122,0.05)",
};

const statusDot: CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: 999,
  border: "1.5px solid rgba(255,255,255,0.22)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 11,
  fontWeight: 900,
  flexShrink: 0,
  color: "rgba(255,255,255,0.7)",
};

const statusDotDone: CSSProperties = {
  border: "1.5px solid rgba(51,255,122,0.6)",
  background: "rgba(51,255,122,0.18)",
  color: "rgba(120,230,160,0.98)",
};

const slotName: CSSProperties = {
  fontSize: 14,
  fontWeight: 900,
};

const nextBadge: CSSProperties = {
  fontSize: 9,
  fontWeight: 900,
  letterSpacing: 0.5,
  padding: "2px 7px",
  borderRadius: 999,
  background: "rgba(51,255,122,0.16)",
  border: "1px solid rgba(51,255,122,0.4)",
  color: "rgba(120,230,160,0.98)",
};

const slotMeta: CSSProperties = {
  fontSize: 11.5,
  opacity: 0.62,
  fontWeight: 700,
};

const covPill: CSSProperties = {
  fontSize: 10.5,
  fontWeight: 700,
  padding: "2px 7px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.10)",
  opacity: 0.85,
};

const recentLabel: CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  opacity: 0.55,
};

const recentRow: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
  padding: "8px 10px",
  borderRadius: 10,
  background: "rgba(255,255,255,0.02)",
  border: "1px solid rgba(255,255,255,0.06)",
  flexWrap: "wrap",
};
