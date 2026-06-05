"use client";

import MetadataGroupPicker from "@/app/components/MetadataGroupPicker";
import RoutineFrequencyTargetFields from "@/app/routines/RoutineFrequencyTargetFields";
import SupportsSportsField from "@/app/routines/SupportsSportsField";
import { activitiesByFamily } from "@/lib/activity-families";
import Link from "next/link";
import HistoryBackButton from "@/app/components/HistoryBackButton";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateRoutine } from "../../actions";
import {
  ROUTINE_SUBTYPE_OPTIONS,
  formatRoutineSubtype,
  isGuidedKind,
  isWorkoutKind,
  ROUTINE_DOMAIN_OPTIONS,
  ROUTINE_KIND_OPTIONS,
  deriveRoutineDomain,
  effectiveRoutineDomain,
  type RoutineDomain,
} from "@/lib/routines";
import { ROUTINE_SUBTYPE_GROUP_DEFAULTS } from "@/lib/metadata";
import { inferRoutinePreset } from "@/lib/routine-presets";
import type { MetadataGroupKind, RoutineFrequencyUnit, RoutineKind } from "@/generated/prisma";

const SPORT_ACCENT: Record<string, string> = {
  climbing: "rgba(251,146,60,0.9)",
  surfing: "rgba(56,189,248,0.9)",
  snowboarding: "rgba(168,85,247,0.9)",
  skiing: "rgba(99,102,241,0.9)",
  skateboarding: "rgba(244,114,182,0.9)",
  basketball: "rgba(220,38,38,0.9)",
  tennis: "rgba(132,204,22,0.9)",
  golf: "rgba(40,212,160,0.9)",
};
const SUPPORT_SPORT_OPTIONS = activitiesByFamily("sports").map((s) => ({
  slug: s.slug,
  label: s.label,
  accent: SPORT_ACCENT[s.slug] ?? "rgba(255,255,255,0.5)",
}));

export default function EditRoutineForm({
  routine,
  metadataGroups,
  sessionTemplates,
  availableSubstituteRoutines = [],
  initialSubstituteRoutineIds = [],
  inDrawer = false,
  onSuccess,
}: {
  routine: {
    id: string;
    name: string;
    subtype: string | null;
    domain: string;
    kind: RoutineKind;
    targetFrequencyCount: number | null;
    targetFrequencyUnit: RoutineFrequencyUnit | null;
    targetFrequencyInterval: number | null;
    frequencyGoalEnabled: boolean;
    sessionTemplateId: string | null;
    selectedMetadataGroupIds: string[];
    tags: string[];
    supportsSports?: string[];
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
  availableSubstituteRoutines?: Array<{ id: string; name: string }>;
  initialSubstituteRoutineIds?: string[];
  /** When true the form runs in drawer mode: server action runs without
   *  redirecting and onSuccess is called so the host can close the drawer. */
  inDrawer?: boolean;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const drawerSubmit = inDrawer
    ? (formData: FormData) => {
        formData.set("noRedirect", "1");
        startTransition(async () => {
          await updateRoutine(formData);
          router.refresh();
          onSuccess?.();
        });
      }
    : undefined;
  const [tags, setTags] = useState(() => routine.tags.join(", "));
  const [kind, setKind] = useState<RoutineKind>(routine.kind);
  const subtypeOptions = useMemo(() => ROUTINE_SUBTYPE_OPTIONS[kind], [kind]);
  const [subtype, setSubtype] = useState(() =>
    routine.subtype && ROUTINE_SUBTYPE_OPTIONS[routine.kind]?.includes(routine.subtype)
      ? routine.subtype
      : ROUTINE_SUBTYPE_OPTIONS[routine.kind]?.[0] ?? "OTHER"
  );
  const [domainOverride, setDomainOverride] = useState<Exclude<RoutineDomain, "skill" | "general" | "habit"> | "">(() => {
    const eff = effectiveRoutineDomain(routine.domain, routine.kind, routine.subtype);
    const derived = deriveRoutineDomain(routine.kind, routine.subtype);
    return eff !== derived ? eff : "";
  });

  const derivedDomain = deriveRoutineDomain(kind, subtype);
  const effectiveDomainValue = domainOverride || derivedDomain;

  const matchingSessionTemplates = useMemo(
    () => sessionTemplates.filter((t) => !t.sessionSubtype || t.sessionSubtype === subtype),
    [sessionTemplates, subtype]
  );
  const sessionTemplateOptions = matchingSessionTemplates.length > 0 ? matchingSessionTemplates : sessionTemplates;
  const [sessionTemplateId, setSessionTemplateId] = useState(routine.sessionTemplateId ?? "");
  const effectiveSessionTemplateId = sessionTemplateOptions.some((t) => t.id === sessionTemplateId) ? sessionTemplateId : "";
  const selectedSessionTemplate =
    sessionTemplateOptions.find((t) => t.id === effectiveSessionTemplateId) ??
    sessionTemplates.find((t) => t.id === effectiveSessionTemplateId) ??
    null;

  const metadataGroupIdBySlug = useMemo(
    () => new Map(metadataGroups.map((g) => [g.slug, g.id])),
    [metadataGroups]
  );
  const suggestedMetadataGroupIds = useMemo(
    () =>
      (ROUTINE_SUBTYPE_GROUP_DEFAULTS[subtype] ?? [])
        .map((slug) => metadataGroupIdBySlug.get(slug))
        .filter((v): v is string => Boolean(v)),
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
      setSelectedMetadataGroupIds((cur) => Array.from(new Set([...cur, ...additions])));
    }
    previousSuggestedRef.current = suggestedMetadataGroupIds;
  }, [suggestedMetadataGroupIds]);

  return (
    <form action={drawerSubmit ?? updateRoutine} style={{ padding: 14, display: "grid", gap: 18, maxWidth: 600 }}>
      <input type="hidden" name="id" value={routine.id} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="subtype" value={subtype} />
      <input type="hidden" name="tags" value={tags} />
      <input type="hidden" name="domain" value={effectiveDomainValue} />

      {/* Format + Activity type */}
      <div style={styles.twoCol}>
        <div>
          <label style={styles.label}>Format</label>
          <select
            style={styles.input as React.CSSProperties}
            value={kind}
            onChange={(e) => {
              const nextKind = e.target.value as RoutineKind;
              setKind(nextKind);
              setSubtype(ROUTINE_SUBTYPE_OPTIONS[nextKind][0] ?? "OTHER");
              setDomainOverride("");
            }}
          >
            {ROUTINE_KIND_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={styles.label}>Activity type</label>
          <select
            style={styles.input as React.CSSProperties}
            value={subtype}
            onChange={(e) => {
              setSubtype(e.target.value);
              setDomainOverride("");
            }}
          >
            {subtypeOptions.map((opt) => (
              <option key={opt} value={opt}>{formatRoutineSubtype(opt)}</option>
            ))}
          </select>
        </div>
      </div>
      <div style={styles.help}>
        <strong>Format</strong> controls what fields show when you log (sets/reps for Workout, distance/pace for Cardio, etc.).
        <br />
        <strong>Activity type</strong> is the specific kind of session (Climbing, Strength, Run...).
      </div>

      {/* Name */}
      <div>
        <label style={styles.label}>Name</label>
        <input name="name" style={styles.input} defaultValue={routine.name} />
      </div>

      {/* Session template */}
      {kind === "SESSION" && (
        <div>
          <label style={styles.label}>
            Session template <span style={styles.optional}>(optional)</span>
          </label>
          <select
            name="sessionTemplateId"
            style={styles.input as React.CSSProperties}
            value={effectiveSessionTemplateId}
            onChange={(e) => setSessionTemplateId(e.target.value)}
          >
            <option value="">Open session — no template</option>
            {sessionTemplateOptions.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          {selectedSessionTemplate?.description && (
            <div style={styles.help}>{selectedSessionTemplate.description}</div>
          )}
        </div>
      )}

      {/* Frequency goal */}
      <div>
        <label style={styles.label}>
          Frequency goal <span style={styles.optional}>(optional)</span>
        </label>
        <RoutineFrequencyTargetFields
          initialCount={routine.targetFrequencyCount}
          initialUnit={routine.targetFrequencyUnit}
          initialInterval={routine.targetFrequencyInterval}
          initialEnabled={routine.frequencyGoalEnabled}
          // Substitutes work for any frequency goal — a climb can cover a
          // Pull Day slot, not just a daily fingers habit.
          availableSubstituteRoutines={availableSubstituteRoutines}
          initialSubstituteRoutineIds={initialSubstituteRoutineIds}
        />
      </div>

      {/* Training category — drives the Training Balance bars on the dashboard */}
      <div>
        <label style={styles.label}>Training category</label>
        <select
          style={styles.input as React.CSSProperties}
          value={effectiveDomainValue}
          onChange={(e) => setDomainOverride(e.target.value as Exclude<RoutineDomain, "skill" | "general" | "habit">)}
        >
          {ROUTINE_DOMAIN_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}{opt.value === derivedDomain && !domainOverride ? " (auto)" : ""}
            </option>
          ))}
        </select>
        <div style={styles.help}>
          Which Training Balance bar this routine fills (Strength, Mobility, Endurance, Climb, Lifestyle, etc.).
          Auto-set from your activity — only override if it&apos;s wrong.
        </div>
      </div>

      {/* More options */}
      <details style={styles.moreCard}>
        <summary style={styles.moreSummary}>More options</summary>
        <div style={{ display: "grid", gap: 14, marginTop: 14 }}>
          <div>
            <label style={styles.label}>
              Group Tags <span style={styles.optional}>(optional)</span>
            </label>
            <input
              style={styles.input}
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="pull, climbing, strength..."
            />
            <div style={styles.help}>Comma-separated. Tags matching a known activity also update training coverage.</div>
          </div>

          <SupportsSportsField
            options={SUPPORT_SPORT_OPTIONS}
            initialSelected={routine.supportsSports ?? []}
          />

          <details style={styles.advancedCard}>
            <summary style={styles.advancedSummary}>Advanced metadata</summary>
            <div style={{ marginTop: 12 }}>
              <MetadataGroupPicker
                title="Organization & analysis"
                help="These groups power rollups in Progress. Preselected from your routine type — only adjust if the default grouping is wrong."
                groups={metadataGroups}
                selectedIds={selectedMetadataGroupIds}
                onSelectionChange={setSelectedMetadataGroupIds}
                collapsible
                defaultOpen={selectedMetadataGroupIds.length > 0}
              />
            </div>
          </details>
        </div>
      </details>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="submit" style={styles.btn}>Save</button>
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
        <HistoryBackButton fallbackHref="/routines" label="← Back" style={styles.linkBtn} />
        {isWorkoutKind(kind) && isWorkoutKind(routine.kind) && (
          <Link href={`/routines/${routine.id}/template`} style={styles.linkBtn}>Template</Link>
        )}
        {isGuidedKind(kind) && isGuidedKind(routine.kind) && (
          <Link href={`/routines/${routine.id}/guided`} style={styles.linkBtn}>Steps</Link>
        )}
      </div>
    </form>
  );
}

const styles = {
  label: { display: "block", fontWeight: 700 as const, marginBottom: 5, fontSize: 14 },
  optional: { fontWeight: 400 as const, opacity: 0.6, fontSize: 12 },
  input: {
    width: "100%",
    padding: "11px 12px",
    border: "1px solid rgba(128,128,128,0.6)",
    borderRadius: 10,
    background: "#111827",
    color: "#ffffff",
    boxSizing: "border-box" as const,
    fontSize: 16, // dodge iOS Safari auto-zoom on focus
    fontFamily: "inherit" as const,
  },
  btn: {
    padding: "10px 14px",
    border: "1px solid rgba(128,128,128,0.8)",
    borderRadius: 10,
    background: "rgba(128,128,128,0.12)",
    color: "inherit",
    fontWeight: 700 as const,
  },
  linkBtn: {
    padding: "8px 14px",
    border: "1px solid rgba(128,128,128,0.8)",
    borderRadius: 10,
    textDecoration: "none",
    color: "inherit",
    fontWeight: 700 as const,
    background: "rgba(128,128,128,0.12)",
  },
  twoCol: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },
  moreCard: {
    border: "1px solid rgba(128,128,128,0.3)",
    borderRadius: 12,
    padding: "12px 14px",
    background: "rgba(128,128,128,0.04)",
  },
  moreSummary: {
    cursor: "pointer",
    fontWeight: 600 as const,
    fontSize: 13,
    opacity: 0.8,
  },
  advancedCard: {
    border: "1px solid rgba(128,128,128,0.25)",
    borderRadius: 10,
    padding: "10px 12px",
    background: "rgba(128,128,128,0.03)",
  },
  advancedSummary: { cursor: "pointer", fontWeight: 600 as const, fontSize: 13 },
  help: { marginTop: 6, opacity: 0.65, fontSize: 12, lineHeight: 1.4 as const },
};
