"use client";

import MetadataGroupPicker from "@/app/components/MetadataGroupPicker";
import RoutineFrequencyTargetFields from "@/app/routines/RoutineFrequencyTargetFields";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { updateRoutine } from "../../actions";
import { ROUTINE_SUBTYPE_OPTIONS, formatRoutineSubtype, isGuidedKind, isWorkoutKind } from "@/lib/routines";
import { ROUTINE_SUBTYPE_GROUP_DEFAULTS } from "@/lib/metadata";
import { getRoutinePreset, inferRoutinePreset, ROUTINE_PRESETS, type RoutinePresetKey } from "@/lib/routine-presets";
import type { MetadataGroupKind, RoutineFrequencyUnit, RoutineKind } from "@/generated/prisma";

export default function EditRoutineForm({
  routine,
  metadataGroups,
  sessionTemplates,
}: {
  routine: {
    id: string;
    name: string;
    category: string;
    subtype: string | null;
    kind: RoutineKind;
    targetFrequencyCount: number | null;
    targetFrequencyUnit: RoutineFrequencyUnit | null;
    targetFrequencyInterval: number | null;
    sessionTemplateId: string | null;
    selectedMetadataGroupIds: string[];
    tags: string[];
  };
  metadataGroups: Array<{
    id: string;
    slug: string;
    label: string;
    kind: MetadataGroupKind;
  }>;
  sessionTemplates: Array<{
    id: string;
    name: string;
    description: string | null;
    sessionSubtype: string | null;
  }>;
}) {
  const [presetKey, setPresetKey] = useState<RoutinePresetKey>(() => inferRoutinePreset(routine.kind, routine.subtype));
  const [kind, setKind] = useState<RoutineKind>(routine.kind);
  const [category, setCategory] = useState(routine.category.trim() || getRoutinePreset(presetKey).categoryHint);
  const subtypeOptions = useMemo(() => ROUTINE_SUBTYPE_OPTIONS[kind], [kind]);
  const [subtype, setSubtype] = useState(routine.subtype && subtypeOptions.includes(routine.subtype) ? routine.subtype : subtypeOptions[0]);
  const matchingSessionTemplates = useMemo(
    () => sessionTemplates.filter((template) => !template.sessionSubtype || template.sessionSubtype === subtype),
    [sessionTemplates, subtype]
  );
  const sessionTemplateOptions = matchingSessionTemplates.length > 0 ? matchingSessionTemplates : sessionTemplates;
  const [sessionTemplateId, setSessionTemplateId] = useState(routine.sessionTemplateId ?? "");
  const effectiveSessionTemplateId = sessionTemplateOptions.some((template) => template.id === sessionTemplateId)
      ? sessionTemplateId
      : "";
  const selectedSessionTemplate =
    sessionTemplateOptions.find((template) => template.id === effectiveSessionTemplateId) ??
    sessionTemplates.find((template) => template.id === effectiveSessionTemplateId) ??
    null;
  const metadataGroupIdBySlug = useMemo(
    () => new Map(metadataGroups.map((group) => [group.slug, group.id])),
    [metadataGroups]
  );
  const suggestedMetadataGroupIds = useMemo(
    () =>
      (ROUTINE_SUBTYPE_GROUP_DEFAULTS[subtype] ?? [])
        .map((slug) => metadataGroupIdBySlug.get(slug))
        .filter((value): value is string => Boolean(value)),
    [metadataGroupIdBySlug, subtype]
  );
  const [selectedMetadataGroupIds, setSelectedMetadataGroupIds] = useState<string[]>(() =>
    Array.from(new Set([...routine.selectedMetadataGroupIds, ...suggestedMetadataGroupIds]))
  );
  const previousSuggestedRef = useRef<string[]>(suggestedMetadataGroupIds);

  useEffect(() => {
    const previous = new Set(previousSuggestedRef.current);
    const next = new Set(suggestedMetadataGroupIds);
    const additions = Array.from(next).filter((id) => !previous.has(id));
    if (additions.length > 0) {
      setSelectedMetadataGroupIds((current) => Array.from(new Set([...current, ...additions])));
    }
    previousSuggestedRef.current = suggestedMetadataGroupIds;
  }, [suggestedMetadataGroupIds]);

  const activePreset = getRoutinePreset(presetKey);

  return (
    <form action={updateRoutine} style={{ padding: 14, display: "grid", gap: 12, maxWidth: 980 }}>
      <input type="hidden" name="id" value={routine.id} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="subtype" value={subtype} />
      <input type="hidden" name="category" value={category} />
      <input type="hidden" name="tags" value={routine.tags.join(", ")} />

      <div>
        <label style={styles.label}>Routine Type Selection</label>
        <div style={styles.presetGrid}>
          {ROUTINE_PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              onClick={() => {
                setPresetKey(preset.key);
                if (preset.key !== "CUSTOM") {
                  setKind(preset.kind);
                  setSubtype(preset.subtype ?? ROUTINE_SUBTYPE_OPTIONS[preset.kind][0] ?? "OTHER");
                  setCategory(preset.categoryHint);
                }
              }}
              style={{
                ...styles.presetCard,
                ...(presetKey === preset.key ? styles.presetCardActive : null),
              }}
            >
              <div style={styles.presetTitle}>{preset.label}</div>
              <div style={styles.presetDescription}>{preset.description}</div>
            </button>
          ))}
        </div>
        <div style={styles.help}>
          Presets control the tracking shape. Advanced is reserved for metadata adjustments only.
        </div>
      </div>

      <div style={styles.selectionCard}>
        <div style={styles.selectionLabel}>Selected setup</div>
        <div style={styles.selectionTitle}>{activePreset.label}</div>
        <div style={styles.selectionSub}>
          {kind} | {formatRoutineSubtype(subtype)} | {category}
        </div>
      </div>

      <div>
        <label style={styles.label}>Name</label>
        <input name="name" style={styles.input} defaultValue={routine.name} />
      </div>

      <div>
        <label style={styles.label}>Frequency Target (optional)</label>
        <RoutineFrequencyTargetFields
          initialCount={routine.targetFrequencyCount}
          initialUnit={routine.targetFrequencyUnit}
          initialInterval={routine.targetFrequencyInterval}
        />
      </div>

      {kind === "SESSION" ? (
        <div style={styles.sessionTemplateCard}>
          <label style={styles.label}>Session template</label>
          <select
            name="sessionTemplateId"
            style={styles.input as React.CSSProperties}
            value={effectiveSessionTemplateId}
            onChange={(event) => setSessionTemplateId(event.target.value)}
          >
            <option value="">Open session (no metric template)</option>
            {sessionTemplateOptions.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
          <div style={styles.help}>
            {selectedSessionTemplate?.description ??
              "Leave this open for a free-form session, or choose a template for structured metric fields."}
          </div>
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="submit" style={styles.btn}>
          Save
        </button>
        {isGuidedKind(kind) && !isGuidedKind(routine.kind) && (
          <button type="submit" name="postSave" value="steps" style={styles.btn}>
            Save + Open Steps
          </button>
        )}
        {isWorkoutKind(kind) && !isWorkoutKind(routine.kind) && (
          <button type="submit" name="postSave" value="template" style={styles.btn}>
            Save + Open Template
          </button>
        )}
        <Link href="/routines" style={styles.linkBtn}>
          Back
        </Link>
        {isWorkoutKind(kind) && isWorkoutKind(routine.kind) && (
          <Link href={`/routines/${routine.id}/template`} style={styles.linkBtn}>
            Template
          </Link>
        )}
        {isGuidedKind(kind) && isGuidedKind(routine.kind) && (
          <Link href={`/routines/${routine.id}/guided`} style={styles.linkBtn}>
            Steps
          </Link>
        )}
      </div>

      <details style={styles.advancedCard}>
        <summary data-collapsible-summary style={styles.advancedSummary}>
          Advanced metadata
        </summary>
        <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
          <MetadataGroupPicker
            title="Organization & analysis (optional)"
            help="These groups power rollups in Progress. The app preselects suggestions from subtype, so you only need to change this when the default grouping is wrong."
            groups={metadataGroups}
            selectedIds={selectedMetadataGroupIds}
            onSelectionChange={setSelectedMetadataGroupIds}
            collapsible
            defaultOpen={selectedMetadataGroupIds.length > 0}
          />
        </div>
      </details>
    </form>
  );
}

const styles = {
  label: { display: "block", fontWeight: 900 as const, marginBottom: 4 },
  input: {
    width: "100%",
    padding: 8,
    border: "1px solid rgba(128,128,128,0.6)",
    borderRadius: 10,
    background: "#111827",
    color: "#ffffff",
  },
  btn: {
    padding: "10px 12px",
    border: "1px solid rgba(128,128,128,0.8)",
    borderRadius: 10,
    background: "rgba(128,128,128,0.12)",
    color: "inherit",
    fontWeight: 900 as const,
  },
  linkBtn: {
    padding: "8px 12px",
    border: "1px solid rgba(128,128,128,0.8)",
    borderRadius: 10,
    textDecoration: "none",
    color: "inherit",
    fontWeight: 800 as const,
    background: "rgba(128,128,128,0.12)",
  },
  presetGrid: {
    display: "grid",
    gap: 12,
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    alignItems: "stretch" as const,
  },
  presetCard: {
    textAlign: "left" as const,
    minHeight: 112,
    padding: 14,
    borderWidth: 1,
    borderStyle: "solid" as const,
    borderColor: "rgba(128,128,128,0.4)",
    borderRadius: 12,
    background: "rgba(128,128,128,0.06)",
    color: "inherit",
  },
  presetCardActive: {
    borderColor: "rgba(76,163,255,0.7)",
    background: "rgba(76,163,255,0.12)",
  },
  presetTitle: { fontWeight: 900 as const, marginBottom: 6 },
  presetDescription: { fontSize: 12, opacity: 0.8 },
  selectionCard: {
    border: "1px solid rgba(128,128,128,0.3)",
    borderRadius: 12,
    padding: 12,
    background: "rgba(128,128,128,0.05)",
    display: "grid",
    gap: 4,
  },
  selectionLabel: { fontSize: 11, fontWeight: 900 as const, letterSpacing: 0.4, opacity: 0.7, textTransform: "uppercase" as const },
  selectionTitle: { fontSize: 15, fontWeight: 900 as const },
  selectionSub: { fontSize: 12, opacity: 0.74 },
  sessionTemplateCard: {
    border: "1px solid rgba(128,128,128,0.3)",
    borderRadius: 12,
    padding: 12,
    background: "rgba(128,128,128,0.05)",
  },
  advancedCard: {
    border: "1px solid rgba(128,128,128,0.35)",
    borderRadius: 12,
    padding: 12,
    background: "rgba(128,128,128,0.04)",
  },
  advancedSummary: { cursor: "pointer", fontWeight: 900 as const },
  help: { marginTop: 6, opacity: 0.7, fontSize: 12 },
};
