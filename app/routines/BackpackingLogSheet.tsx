"use client";

import { useEffect, useMemo, useState, useTransition, type CSSProperties } from "react";
import { logBackpackingTrip, updateBackpackingTrip, type BackpackingLogInput, type BackpackingEditData } from "@/app/log/backpacking-log-actions";
import { loadSportLogContext, type SportLogContext } from "@/app/log/sport-actions";
import { useSportLogDraft } from "./useSportLogDraft";
import SportLogModal from "./SportLogModal";
import SpotPicker from "@/app/components/log/SpotPicker";
import type { SpotPickerValue } from "@/lib/spot-picker-types";
import { inputStyle, textareaStyle, Field, FormSection } from "@/app/routines/[id]/log/form-ui";
import { EffortSlider } from "@/app/components/strain/EffortSlider";
import { useLearnedEffortPrefill } from "@/app/components/strain/useLearnedEffort";

// Dedicated multi-day backpacking trip sheet. A trip is logged as a parent
// BackpackingTrip + one day-log per day, so it spans the calendar natively.
// Per-day rows carry miles (+ optional elevation / campsite / notes); a gear
// list with per-item weights drives a live pack-weight readout.

const GRAMS_PER_OZ = 28.349523125;
const GRAMS_PER_LB = 453.59237;

type DayRow = {
  localId: string;
  ymd: string;
  miles: string;
  elevGainFt: string;
  campsite: string;
  notes: string;
};

type GearRow = {
  localId: string;
  name: string;
  weightOz: string;
  quantity: string;
  consumable: boolean;
};

type Draft = {
  trail: string;
  days: DayRow[];
  gear: GearRow[];
  effort: number | null;
  notes: string;
};

function rid(): string {
  return Math.random().toString(36).slice(2);
}

function todayYmd(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function nextYmd(ymd: string): string {
  const base = /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : todayYmd();
  const d = new Date(`${base}T00:00:00`);
  d.setDate(d.getDate() + 1);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function newDay(ymd: string): DayRow {
  return { localId: rid(), ymd, miles: "", elevGainFt: "", campsite: "", notes: "" };
}

function newGear(): GearRow {
  return { localId: rid(), name: "", weightOz: "", quantity: "1", consumable: false };
}

function initialDraft(): Draft {
  return {
    trail: "",
    days: [newDay(todayYmd())],
    gear: [],
    effort: null,
    notes: "",
  };
}

function draftFromEdit(e: BackpackingEditData): Draft {
  return {
    trail: e.trail,
    days:
      e.days.length > 0
        ? e.days.map((d) => ({
            localId: rid(),
            ymd: d.ymd,
            miles: d.miles != null ? String(d.miles) : "",
            elevGainFt: d.elevGainFt != null ? String(d.elevGainFt) : "",
            campsite: d.campsite ?? "",
            notes: d.notes ?? "",
          }))
        : [newDay(todayYmd())],
    gear: e.gear.map((g) => ({
      localId: rid(),
      name: g.name,
      weightOz: g.weightGrams != null ? String(Math.round((g.weightGrams / GRAMS_PER_OZ) * 10) / 10) : "",
      quantity: String(g.quantity),
      consumable: g.consumable,
    })),
    effort: e.effort,
    notes: e.notes,
  };
}

export default function BackpackingLogSheet({
  onClose,
  editTripId,
  initialEdit,
  onSaved,
}: {
  onClose: () => void;
  /** Present in edit mode — saves via updateBackpackingTrip instead of create. */
  editTripId?: string;
  initialEdit?: BackpackingEditData;
  /** Called after a successful save (the caller typically navigates away,
   *  since editing regenerates the day-logs with new ids). */
  onSaved?: () => void;
}) {
  const isEdit = Boolean(editTripId);
  // Edit gets a trip-scoped draft key so it never clobbers the new-trip draft.
  const draftKey = isEdit ? `sport-log-draft-backpacking-edit-${editTripId}` : "sport-log-draft-backpacking";
  const [draft, setDraft, clearDraft] = useSportLogDraft<Draft>(
    draftKey,
    isEdit && initialEdit ? draftFromEdit(initialEdit) : initialDraft()
  );
  const { trail, days, gear, effort, notes } = draft;

  const [spotValue, setSpotValue] = useState<SpotPickerValue>(initialEdit?.spotValue ?? null);
  const [spotCtx, setSpotCtx] = useState<SportLogContext | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadSportLogContext("backpacking")
      .then((ctx) => {
        if (!cancelled) setSpotCtx(ctx);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const predictedEffort = useLearnedEffortPrefill({ routineId: "sports-backpacking-synthetic", durationMin: null });

  const totals = useMemo(() => {
    const totalMiles = days.reduce((s, d) => s + (Number(d.miles) || 0), 0);
    let packG = 0;
    let baseG = 0;
    let anyWeight = false;
    for (const g of gear) {
      const oz = Number(g.weightOz);
      if (!g.name.trim() || !Number.isFinite(oz) || oz <= 0) continue;
      anyWeight = true;
      const qty = Math.max(1, Number(g.quantity) || 1);
      const grams = oz * GRAMS_PER_OZ * qty;
      packG += grams;
      if (!g.consumable) baseG += grams;
    }
    const hasConsumables = gear.some((g) => g.consumable && Number(g.weightOz) > 0);
    return {
      totalMiles,
      nights: Math.max(0, days.length - 1),
      packLb: anyWeight ? packG / GRAMS_PER_LB : null,
      baseLb: anyWeight && hasConsumables ? baseG / GRAMS_PER_LB : null,
    };
  }, [days, gear]);

  function patch(p: Partial<Draft>) {
    setDraft((d) => ({ ...d, ...p }));
  }
  function setDay(localId: string, p: Partial<DayRow>) {
    setDraft((d) => ({ ...d, days: d.days.map((x) => (x.localId === localId ? { ...x, ...p } : x)) }));
  }
  function addDay() {
    setDraft((d) => {
      const last = d.days[d.days.length - 1];
      return { ...d, days: [...d.days, newDay(nextYmd(last?.ymd ?? todayYmd()))] };
    });
  }
  function removeDay(localId: string) {
    setDraft((d) => (d.days.length === 1 ? d : { ...d, days: d.days.filter((x) => x.localId !== localId) }));
  }
  function setGear(localId: string, p: Partial<GearRow>) {
    setDraft((d) => ({ ...d, gear: d.gear.map((x) => (x.localId === localId ? { ...x, ...p } : x)) }));
  }
  function addGear() {
    setDraft((d) => ({ ...d, gear: [...d.gear, newGear()] }));
  }
  function removeGear(localId: string) {
    setDraft((d) => ({ ...d, gear: d.gear.filter((x) => x.localId !== localId) }));
  }

  function submit() {
    setError(null);
    const validDays = days.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.ymd));
    if (validDays.length === 0) {
      setError("Add at least one day with a date.");
      return;
    }
    const payload: BackpackingLogInput = {
      trail: trail.trim() || undefined,
      spotValue: spotValue ?? undefined,
      notes: notes.trim() || undefined,
      effort,
      days: validDays.map((d) => ({
        ymd: d.ymd,
        miles: d.miles.trim() === "" ? undefined : Number(d.miles),
        elevGainFt: d.elevGainFt.trim() === "" ? undefined : Number(d.elevGainFt),
        campsite: d.campsite.trim() || undefined,
        notes: d.notes.trim() || undefined,
      })),
      gear: gear
        .filter((g) => g.name.trim().length > 0)
        .map((g) => ({
          name: g.name.trim(),
          weightGrams: g.weightOz.trim() === "" ? undefined : Math.round(Number(g.weightOz) * GRAMS_PER_OZ),
          quantity: g.quantity.trim() === "" ? 1 : Number(g.quantity),
          consumable: g.consumable,
        })),
    };

    startTransition(async () => {
      try {
        if (isEdit && editTripId) {
          await updateBackpackingTrip({ tripId: editTripId, ...payload });
        } else {
          await logBackpackingTrip(payload);
        }
        clearDraft();
        onSaved?.();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save trip.");
      }
    });
  }

  return (
    <SportLogModal
      title={isEdit ? "Edit Backpacking Trip" : "Log Backpacking Trip"}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} style={btnSecondary} disabled={pending}>
            Cancel
          </button>
          <button type="button" onClick={submit} style={btnPrimary} disabled={pending}>
            {pending ? "Saving…" : isEdit ? "Save changes" : "Save trip"}
          </button>
        </>
      }
    >
      <>
        <FormSection title="Trip">
          <Field label="Trail / route" hint="The overall route, e.g. “John Muir Trail”.">
            <input
              style={inputStyle}
              value={trail}
              onChange={(e) => patch({ trail: e.target.value })}
              placeholder="Trail or area name"
            />
          </Field>
          {spotCtx?.config ? (
            <Field label="Trailhead / area">
              <SpotPicker
                config={spotCtx.config}
                spotNoun="trailhead"
                savedSpots={spotCtx.savedSpots}
                recentSpots={spotCtx.recentSpots}
                value={spotValue}
                onChange={setSpotValue}
              />
            </Field>
          ) : null}
        </FormSection>

        <FormSection title="Days on trail" description="One row per day. Only miles is needed — the rest is optional.">
          <div style={{ display: "grid", gap: 12 }}>
            {days.map((d, i) => (
              <div key={d.localId} style={dayCard}>
                <div style={dayHeader}>
                  <span style={dayBadge}>Day {i + 1}</span>
                  {days.length > 1 ? (
                    <button type="button" style={removeBtn} onClick={() => removeDay(d.localId)} aria-label={`Remove day ${i + 1}`}>
                      ✕
                    </button>
                  ) : null}
                </div>
                <div style={dayGrid}>
                  <label style={miniField}>
                    <span style={miniLabel}>Date</span>
                    <input type="date" style={inputStyle} value={d.ymd} onChange={(e) => setDay(d.localId, { ymd: e.target.value })} />
                  </label>
                  <label style={miniField}>
                    <span style={miniLabel}>Miles</span>
                    <input
                      inputMode="decimal"
                      style={inputStyle}
                      value={d.miles}
                      onChange={(e) => setDay(d.localId, { miles: e.target.value })}
                      placeholder="0"
                    />
                  </label>
                  <label style={miniField}>
                    <span style={miniLabel}>Elev gain (ft)</span>
                    <input
                      inputMode="numeric"
                      style={inputStyle}
                      value={d.elevGainFt}
                      onChange={(e) => setDay(d.localId, { elevGainFt: e.target.value })}
                      placeholder="optional"
                    />
                  </label>
                  <label style={miniField}>
                    <span style={miniLabel}>Campsite</span>
                    <input
                      style={inputStyle}
                      value={d.campsite}
                      onChange={(e) => setDay(d.localId, { campsite: e.target.value })}
                      placeholder="optional"
                    />
                  </label>
                </div>
                <label style={{ ...miniField, marginTop: 8 }}>
                  <span style={miniLabel}>Day notes</span>
                  <input
                    style={inputStyle}
                    value={d.notes}
                    onChange={(e) => setDay(d.localId, { notes: e.target.value })}
                    placeholder="optional"
                  />
                </label>
              </div>
            ))}
          </div>
          <button type="button" style={addBtn} onClick={addDay}>
            + Add day
          </button>
          <div style={tripTotals}>
            <strong>{totals.totalMiles ? totals.totalMiles.toFixed(1) : "0"} mi</strong> over {days.length} day{days.length === 1 ? "" : "s"}
            {totals.nights > 0 ? ` · ${totals.nights} night${totals.nights === 1 ? "" : "s"}` : ""}
          </div>
        </FormSection>

        <FormSection title="Gear" description="What you carried + per-item weight (oz). Powers your pack weight.">
          <div style={{ display: "grid", gap: 10 }}>
            {gear.map((g) => (
              <div key={g.localId} style={gearRow}>
                <input
                  style={{ ...inputStyle, flex: 2, minWidth: 0 }}
                  value={g.name}
                  onChange={(e) => setGear(g.localId, { name: e.target.value })}
                  placeholder="Item"
                />
                <input
                  inputMode="decimal"
                  style={{ ...inputStyle, width: 64, flexShrink: 0 }}
                  value={g.weightOz}
                  onChange={(e) => setGear(g.localId, { weightOz: e.target.value })}
                  placeholder="oz"
                />
                <input
                  inputMode="numeric"
                  style={{ ...inputStyle, width: 48, flexShrink: 0 }}
                  value={g.quantity}
                  onChange={(e) => setGear(g.localId, { quantity: e.target.value })}
                  placeholder="×"
                  aria-label="Quantity"
                />
                <button
                  type="button"
                  onClick={() => setGear(g.localId, { consumable: !g.consumable })}
                  style={g.consumable ? consumableOn : consumableOff}
                  title="Consumable (food/fuel/water) — excluded from base weight"
                >
                  🍫
                </button>
                <button type="button" style={removeBtn} onClick={() => removeGear(g.localId)} aria-label="Remove gear">
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button type="button" style={addBtn} onClick={addGear}>
            + Add gear
          </button>
          {totals.packLb != null ? (
            <div style={tripTotals}>
              Pack: <strong>{totals.packLb.toFixed(1)} lb</strong>
              {totals.baseLb != null ? (
                <span style={{ opacity: 0.7 }}>
                  {" "}
                  · base {totals.baseLb.toFixed(1)} lb
                </span>
              ) : null}
            </div>
          ) : null}
        </FormSection>

        <FormSection title="Effort & notes">
          <Field label="Overall effort">
            <EffortSlider value={effort} predicted={predictedEffort} onChange={(v) => patch({ effort: v })} />
          </Field>
          <Field label="Trip notes">
            <textarea
              style={textareaStyle}
              value={notes}
              onChange={(e) => patch({ notes: e.target.value })}
              placeholder="How was it? Weather, highlights, lessons…"
            />
          </Field>
        </FormSection>

        {error ? <div style={errorText}>{error}</div> : null}
      </>
    </SportLogModal>
  );
}

const dayCard: CSSProperties = {
  border: "1px solid rgba(128,128,128,0.32)",
  borderRadius: 12,
  padding: 12,
  background: "rgba(128,128,128,0.05)",
};
const dayHeader: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 };
const dayBadge: CSSProperties = { fontWeight: 900, fontSize: 13, opacity: 0.85 };
const dayGrid: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8 };
const miniField: CSSProperties = { display: "grid", gap: 4, minWidth: 0 };
const miniLabel: CSSProperties = { fontSize: 12, fontWeight: 700, opacity: 0.72 };
const gearRow: CSSProperties = { display: "flex", gap: 6, alignItems: "center" };

const addBtn: CSSProperties = {
  marginTop: 10,
  padding: "9px 12px",
  border: "1px dashed rgba(128,128,128,0.6)",
  borderRadius: 12,
  background: "rgba(128,128,128,0.08)",
  color: "inherit",
  fontWeight: 800,
  fontSize: 14,
  cursor: "pointer",
  width: "100%",
};
const removeBtn: CSSProperties = {
  width: 32,
  height: 32,
  minHeight: 32,
  flexShrink: 0,
  borderRadius: 8,
  border: "1px solid rgba(248,113,113,0.3)",
  background: "rgba(248,113,113,0.08)",
  color: "rgba(248,160,160,0.95)",
  fontWeight: 900,
  cursor: "pointer",
};
const consumableBase: CSSProperties = {
  width: 36,
  height: 38,
  minHeight: 38,
  flexShrink: 0,
  borderRadius: 8,
  fontSize: 15,
  cursor: "pointer",
};
const consumableOff: CSSProperties = {
  ...consumableBase,
  border: "1px solid rgba(128,128,128,0.4)",
  background: "rgba(128,128,128,0.08)",
  opacity: 0.45,
};
const consumableOn: CSSProperties = {
  ...consumableBase,
  border: "1px solid rgba(251,191,36,0.5)",
  background: "rgba(251,191,36,0.16)",
  opacity: 1,
};
const tripTotals: CSSProperties = {
  marginTop: 10,
  fontSize: 14,
  fontWeight: 700,
  opacity: 0.9,
};
const btnPrimary: CSSProperties = {
  padding: "10px 16px",
  borderRadius: 12,
  border: "1px solid rgba(51,255,122,0.45)",
  background: "rgba(51,255,122,0.16)",
  color: "#eafff1",
  fontWeight: 900,
  cursor: "pointer",
};
const btnSecondary: CSSProperties = {
  padding: "10px 16px",
  borderRadius: 12,
  border: "1px solid rgba(128,128,128,0.5)",
  background: "rgba(128,128,128,0.12)",
  color: "inherit",
  fontWeight: 800,
  cursor: "pointer",
};
const errorText: CSSProperties = {
  color: "rgba(248,113,113,0.95)",
  fontWeight: 700,
  fontSize: 13,
};
