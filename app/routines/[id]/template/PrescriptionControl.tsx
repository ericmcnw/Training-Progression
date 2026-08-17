"use client";

import { useEffect, useRef, useState } from "react";
import type React from "react";
import type { LoadUnit } from "@/generated/prisma";
import {
  LOAD_UNIT_OPTIONS,
  formatPrescription,
  type ExerciseMetricUnit,
  type PrescriptionShape,
} from "@/lib/prescription";
import { Field, FieldGrid, inputStyle } from "../log/form-ui";
import { updatePrescriptionQuiet } from "./actions";

type Draft = {
  sets: string;
  repsMin: string;
  repsMax: string;
  seconds: string;
  load: string;
  loadUnit: LoadUnit;
  tempo: string;
  restSec: string;
  cue: string;
};

function toDraft(p: PrescriptionShape | null): Draft {
  return {
    sets: p?.sets != null ? String(p.sets) : "",
    repsMin: p?.repsMin != null ? String(p.repsMin) : "",
    repsMax: p?.repsMax != null ? String(p.repsMax) : "",
    seconds: p?.seconds != null ? String(p.seconds) : "",
    load: p?.load != null ? String(p.load) : "",
    loadUnit: p?.loadUnit ?? "LB",
    tempo: p?.tempo ?? "",
    restSec: p?.restSec != null ? String(p.restSec) : "",
    cue: p?.cue ?? "",
  };
}

function toShape(draft: Draft): PrescriptionShape {
  const num = (v: string) => (v.trim() === "" ? null : Number(v));
  return {
    sets: num(draft.sets),
    repsMin: num(draft.repsMin),
    repsMax: num(draft.repsMax),
    seconds: num(draft.seconds),
    load: num(draft.load),
    loadUnit: draft.loadUnit,
    tempo: draft.tempo.trim() || null,
    restSec: num(draft.restSec),
    cue: draft.cue.trim() || null,
  };
}

const compactInput: React.CSSProperties = {
  ...inputStyle,
  padding: "8px 10px",
};

export default function PrescriptionControl({
  routineId,
  routineExerciseId,
  unit,
  initial,
}: {
  routineId: string;
  routineExerciseId: string;
  unit: ExerciseMetricUnit;
  initial: PrescriptionShape | null;
}) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(initial));
  const [saved, setSaved] = useState(false);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timer = setTimeout(async () => {
      await updatePrescriptionQuiet(routineId, routineExerciseId, toShape(draft));
      setSaved(true);
    }, 700);
    return () => clearTimeout(timer);
  }, [draft, routineId, routineExerciseId]);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setSaved(false);
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  const summary = formatPrescription(toShape(draft), unit);

  return (
    <details style={{ width: "100%" }}>
      <summary
        data-collapsible-summary
        style={{
          cursor: "pointer",
          minHeight: 44,
          fontSize: 13,
          opacity: summary ? 0.95 : 0.6,
        }}
      >
        <span style={{ fontWeight: 800, letterSpacing: 0.2 }}>{summary ? "Target" : "+ Set target"}</span>
        {summary && <span style={{ fontWeight: 600, opacity: 0.8 }}>{summary}</span>}
        {saved && <span style={{ fontSize: 11, opacity: 0.55 }}>saved</span>}
      </summary>

      <div style={{ display: "grid", gap: 12, paddingTop: 12, paddingBottom: 4 }}>
        <FieldGrid minWidth={130}>
          <Field label="Sets">
            <input
              style={compactInput}
              inputMode="numeric"
              value={draft.sets}
              placeholder="3"
              onChange={(e) => set("sets", e.target.value)}
            />
          </Field>

          {unit === "REPS" ? (
            <Field label="Reps" hint="Leave max blank for a fixed number.">
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  style={compactInput}
                  inputMode="numeric"
                  value={draft.repsMin}
                  placeholder="8"
                  onChange={(e) => set("repsMin", e.target.value)}
                />
                <span style={{ opacity: 0.6 }}>–</span>
                <input
                  style={compactInput}
                  inputMode="numeric"
                  value={draft.repsMax}
                  placeholder="10"
                  onChange={(e) => set("repsMax", e.target.value)}
                />
              </div>
            </Field>
          ) : (
            <Field label="Seconds">
              <input
                style={compactInput}
                inputMode="numeric"
                value={draft.seconds}
                placeholder="30"
                onChange={(e) => set("seconds", e.target.value)}
              />
            </Field>
          )}

          <Field label="Load">
            <input
              style={compactInput}
              inputMode="decimal"
              value={draft.load}
              placeholder="135"
              disabled={draft.loadUnit === "BODYWEIGHT"}
              onChange={(e) => set("load", e.target.value)}
            />
          </Field>

          <Field label="Unit">
            <select
              style={compactInput}
              value={draft.loadUnit}
              onChange={(e) => set("loadUnit", e.target.value as LoadUnit)}
            >
              {LOAD_UNIT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Rest (sec)">
            <input
              style={compactInput}
              inputMode="numeric"
              value={draft.restSec}
              placeholder="90"
              onChange={(e) => set("restSec", e.target.value)}
            />
          </Field>

          <Field label="Tempo">
            <input
              style={compactInput}
              value={draft.tempo}
              placeholder="3s ecc"
              onChange={(e) => set("tempo", e.target.value)}
            />
          </Field>
        </FieldGrid>

        <Field label="Cue" hint="Shows as a tappable note on this exercise while you log.">
          <input
            style={compactInput}
            value={draft.cue}
            placeholder="Slow down, no bounce at the bottom"
            onChange={(e) => set("cue", e.target.value)}
          />
        </Field>
      </div>
    </details>
  );
}
