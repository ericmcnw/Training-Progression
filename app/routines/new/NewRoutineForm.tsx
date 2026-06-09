"use client";

import MetadataGroupPicker from "@/app/components/MetadataGroupPicker";
import RoutineFrequencyTargetFields from "../RoutineFrequencyTargetFields";
import SupportsSportsField from "../SupportsSportsField";
import { activitiesByFamily } from "@/lib/activity-families";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createRoutine } from "../actions";
import {
  ROUTINE_SUBTYPE_OPTIONS,
  formatRoutineSubtype,
  ROUTINE_DOMAIN_OPTIONS,
  ROUTINE_KIND_OPTIONS,
  deriveRoutineDomain,
  type RoutineDomain,
} from "@/lib/routines";
import { ROUTINE_SUBTYPE_GROUP_DEFAULTS } from "@/lib/metadata";
import {
  DOMAIN_META,
  ACTIVITY_PRESETS,
  getActivitiesForDomain,
  getDomainMeta,
  type ActivityPreset,
  type DomainMeta,
} from "@/lib/routine-presets";
import type { MetadataGroupKind, RoutineKind } from "@/generated/prisma";

// Sport options for the SupportsSportsField. Pulled from the activity
// registry so adding a new sport there auto-includes it in the picker.
// Accent colors mirror the sports-chart palette so the chip color
// matches the chart segment on /activities/sports.
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

type MetadataGroupOption = {
  id: string;
  slug: string;
  label: string;
  kind: MetadataGroupKind;
};

type Step = "domain" | "activity" | "form";

export default function NewRoutineForm({
  metadataGroups,
  sessionTemplates,
  availableSubstituteRoutines = [],
  inDrawer = false,
  onSuccess,
}: {
  metadataGroups: MetadataGroupOption[];
  sessionTemplates: Array<{
    id: string;
    key: string;
    name: string;
    description: string | null;
    sessionSubtype: string | null;
  }>;
  availableSubstituteRoutines?: Array<{ id: string; name: string }>;
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
          await createRoutine(formData);
          router.refresh();
          onSuccess?.();
        });
      }
    : undefined;
  const [step, setStep] = useState<Step>("domain");
  const [selectedDomain, setSelectedDomain] = useState<Exclude<RoutineDomain, "skill" | "general" | "habit"> | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<ActivityPreset | null>(null);

  // Form state — populated from the preset selection
  const [kind, setKind] = useState<RoutineKind>("COMPLETION");
  const [subtype, setSubtype] = useState<string>("OTHER");
  const [domainOverride, setDomainOverride] = useState<Exclude<RoutineDomain, "skill" | "general" | "habit"> | "">("");

  const derivedDomain = deriveRoutineDomain(kind, subtype);
  const effectiveDomain = domainOverride || derivedDomain;

  const subtypeOptions = useMemo(() => ROUTINE_SUBTYPE_OPTIONS[kind], [kind]);

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
  const [selectedMetadataGroupIds, setSelectedMetadataGroupIds] = useState<string[]>(suggestedMetadataGroupIds);
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

  const matchingSessionTemplates = useMemo(
    () => sessionTemplates.filter((t) => !t.sessionSubtype || t.sessionSubtype === subtype),
    [sessionTemplates, subtype]
  );
  const sessionTemplateOptions = matchingSessionTemplates.length > 0 ? matchingSessionTemplates : sessionTemplates;
  const [sessionTemplateId, setSessionTemplateId] = useState("");
  const effectiveSessionTemplateId = sessionTemplateOptions.some((t) => t.id === sessionTemplateId) ? sessionTemplateId : "";
  const selectedSessionTemplate =
    matchingSessionTemplates.find((t) => t.id === effectiveSessionTemplateId) ??
    sessionTemplates.find((t) => t.id === effectiveSessionTemplateId) ??
    null;

  function chooseDomain(domain: Exclude<RoutineDomain, "skill" | "general" | "habit">) {
    setSelectedDomain(domain);
    setSelectedPreset(null);
    setStep("activity");
  }

  function chooseActivity(preset: ActivityPreset) {
    setSelectedPreset(preset);
    setKind(preset.kind);
    setSubtype(preset.subtype);
    setDomainOverride(preset.domain);
    setSelectedMetadataGroupIds([]);
    if (preset.sessionTemplateKey) {
      const matched = sessionTemplates.find((t) => t.key === preset.sessionTemplateKey);
      if (matched) setSessionTemplateId(matched.id);
    }
    setStep("form");
  }

  function goBack() {
    if (step === "form") {
      // Custom path (no domain selected) goes straight back to domain picker
      setStep(selectedDomain ? "activity" : "domain");
    } else if (step === "activity") {
      setSelectedDomain(null);
      setStep("domain");
    }
  }

  const domainMeta = selectedDomain ? getDomainMeta(selectedDomain) : null;
  const activityList = selectedDomain ? getActivitiesForDomain(selectedDomain) : [];

  // ─── STEP 1: Domain picker ────────────────────────────────────────────────────
  if (step === "domain") {
    return (
      <div style={s.page}>
        <div style={s.pageHeader}>
          <div style={s.pageTitle}>What are you training?</div>
          <div style={s.pageSubtitle}>Pick the area that best fits your routine</div>
        </div>

        <div style={s.domainGrid}>
          {DOMAIN_META.map((meta) => (
            <DomainCard key={meta.domain} meta={meta} onSelect={chooseDomain} />
          ))}
        </div>

        {/* Custom / advanced escape hatch */}
        <button
          type="button"
          onClick={() => {
            setSelectedPreset(null);
            setKind("COMPLETION");
            setSubtype("OTHER");
            setDomainOverride("");
            setStep("form");
          }}
          style={s.customLink}
        >
          Custom (advanced)
        </button>
      </div>
    );
  }

  // ─── STEP 2: Activity picker ──────────────────────────────────────────────────
  if (step === "activity" && selectedDomain && domainMeta) {
    return (
      <div style={s.page}>
        {/* Header with back + domain badge */}
        <div style={s.stepHeader}>
          <button type="button" onClick={goBack} style={s.backBtn}>← Back</button>
          <div style={{ ...s.domainBadge, color: domainMeta.color, background: domainMeta.bgColor, borderColor: domainMeta.borderColor }}>
            {domainMeta.icon} {domainMeta.label}
          </div>
        </div>
        <div style={s.pageTitle}>Choose an activity</div>
        <div style={s.pageSubtitle}>{domainMeta.description}</div>

        {/* Soft nudge for endurance: the new flow logs by activity type
            without needing a saved routine. Users can still create one
            below for scheduled recurring sessions or saved structures. */}
        {selectedDomain === "cardio" && (
          <div style={enduranceNudgeStyle}>
            <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 4, letterSpacing: 0.3 }}>
              💡 No routine needed
            </div>
            <div style={{ fontSize: 12.5, lineHeight: 1.45, opacity: 0.85 }}>
              You can log endurance directly by activity type (Run, Hike, Bike, …) from
              the Endurance section on the routines page — no setup. Create a routine
              here only if you want a scheduled recurring slot or a saved label for a
              specific workout.
            </div>
          </div>
        )}

        <div style={s.activityList}>
          {activityList.map((preset) => (
            <ActivityCard key={preset.key} preset={preset} domainMeta={domainMeta} onSelect={chooseActivity} />
          ))}
        </div>
      </div>
    );
  }

  // ─── STEP 3: Form ────────────────────────────────────────────────────────────
  const activePresetMeta = selectedPreset && domainMeta;

  return (
    <form action={drawerSubmit ?? createRoutine} style={s.form}>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="subtype" value={subtype} />
      <input type="hidden" name="domain" value={effectiveDomain} />
      <input type="hidden" name="category" value={selectedPreset?.label ?? ""} />

      {/* Step header */}
      <div style={s.stepHeader}>
        <button type="button" onClick={goBack} style={s.backBtn}>← Back</button>
        {activePresetMeta && (
          <div style={{ ...s.domainBadge, color: domainMeta!.color, background: domainMeta!.bgColor, borderColor: domainMeta!.borderColor }}>
            {domainMeta!.icon} {domainMeta!.label}
          </div>
        )}
      </div>

      {/* Selected activity summary */}
      {selectedPreset && (
        <div style={s.presetSummary}>
          <div style={s.presetSummaryIcon}>{selectedPreset.icon}</div>
          <div>
            <div style={s.presetSummaryLabel}>{selectedPreset.label}</div>
            <div style={s.presetSummaryDesc}>{selectedPreset.description}</div>
          </div>
        </div>
      )}

      {/* Custom path: show format + activity type selectors */}
      {!selectedPreset && (
        <>
          <div style={s.twoCol}>
            <div>
              <label style={s.label}>Format</label>
              <select
                style={s.input as React.CSSProperties}
                value={kind}
                onChange={(e) => {
                  const nextKind = e.target.value as RoutineKind;
                  setKind(nextKind);
                  setSubtype(ROUTINE_SUBTYPE_OPTIONS[nextKind][0] ?? "OTHER");
                }}
              >
                {ROUTINE_KIND_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={s.label}>Activity type</label>
              <select
                style={s.input as React.CSSProperties}
                value={subtype}
                onChange={(e) => setSubtype(e.target.value)}
              >
                {subtypeOptions.map((opt) => (
                  <option key={opt} value={opt}>{formatRoutineSubtype(opt)}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={s.help}>
            <strong>Format</strong> controls what fields show when you log (sets/reps for Workout, distance/pace for Cardio, etc.).
            <br />
            <strong>Activity type</strong> is the specific kind of session (Climbing, Strength, Run...).
          </div>
        </>
      )}

      {/* Name */}
      <div>
        <label style={s.label}>Name</label>
        <input
          name="name"
          style={s.input}
          defaultValue={selectedPreset?.defaultName ?? ""}
          placeholder={
            selectedPreset
              ? `e.g. ${selectedPreset.label}, Morning ${selectedPreset.label}...`
              : "Morning mobility, Lift A, Trail run, Climbing..."
          }
          required
        />
      </div>

      {/* Session template — SESSION kind only */}
      {kind === "SESSION" && (
        <div>
          <label style={s.label}>
            Session template <span style={s.optional}>(optional)</span>
          </label>
          <select
            name="sessionTemplateId"
            style={s.input as React.CSSProperties}
            value={effectiveSessionTemplateId}
            onChange={(e) => {
              const nextId = e.target.value;
              const nextTemplate = sessionTemplates.find((t) => t.id === nextId) ?? null;
              setSessionTemplateId(nextId);
              if (nextTemplate?.sessionSubtype) setSubtype(nextTemplate.sessionSubtype);
            }}
          >
            <option value="">Open session — no template</option>
            {sessionTemplateOptions.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          {selectedSessionTemplate?.description && (
            <div style={s.help}>{selectedSessionTemplate.description}</div>
          )}
        </div>
      )}

      {/* Frequency goal */}
      <div>
        <label style={s.label}>
          Frequency goal <span style={s.optional}>(optional)</span>
        </label>
        <RoutineFrequencyTargetFields
          initialCount={3}
          initialUnit="WEEK"
          initialInterval={1}
          initialEnabled={false}
          // Substitutes work for any frequency goal — covered-by makes sense
          // for groups (e.g. a climb covers a Pull Day in a 3×/week strength
          // goal) just as much as for daily habits.
          availableSubstituteRoutines={availableSubstituteRoutines}
        />
      </div>

      {/* Training category — drives the Training Balance bars on the dashboard */}
      <div>
        <label style={s.label}>Training category</label>
        <select
          style={s.input as React.CSSProperties}
          value={effectiveDomain}
          onChange={(e) => setDomainOverride(e.target.value as Exclude<RoutineDomain, "skill" | "general" | "habit">)}
        >
          {ROUTINE_DOMAIN_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}{opt.value === derivedDomain && !domainOverride ? " (auto)" : ""}
            </option>
          ))}
        </select>
        <div style={s.help}>
          Which Training Balance bar this routine fills (Strength, Mobility, Endurance, Climb, Lifestyle, etc.).
          Auto-set from your activity — only override if it&apos;s wrong.
        </div>
      </div>

      {/* More options */}
      <details style={s.moreCard}>
        <summary style={s.moreSummary}>More options</summary>
        <div style={{ display: "grid", gap: 14, marginTop: 14 }}>
          <div>
            <label style={s.label}>
              Group Tags <span style={s.optional}>(optional)</span>
            </label>
            <input
              name="tags"
              style={s.input}
              placeholder="pull, climbing, strength..."
            />
            <div style={s.help}>Comma-separated. Tags matching a known activity also update training coverage.</div>
          </div>

          <SupportsSportsField options={SUPPORT_SPORT_OPTIONS} />

          <details style={s.advancedCard}>
            <summary style={s.advancedSummary}>Advanced metadata</summary>
            <div style={{ marginTop: 12 }}>
              <MetadataGroupPicker
                title="Organization & analysis"
                help="These groups power rollups in Progress. Pre-selected from your activity — only adjust if the default grouping is wrong."
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
        <button type="submit" style={s.btn}>Create Routine</button>
        {kind === "WORKOUT" && (
          <button type="submit" name="postCreate" value="template" style={s.btn}>
            Create + Open Template
          </button>
        )}
        {kind === "GUIDED" && (
          <button type="submit" name="postCreate" value="steps" style={s.btn}>
            Create + Open Steps
          </button>
        )}
      </div>
    </form>
  );
}

// ─── Domain card component ────────────────────────────────────────────────────

function DomainCard({
  meta,
  onSelect,
}: {
  meta: DomainMeta;
  onSelect: (domain: Exclude<RoutineDomain, "skill" | "general" | "habit">) => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={() => onSelect(meta.domain)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 8,
        padding: "16px 14px",
        border: `1px solid ${hovered ? meta.color : meta.borderColor}`,
        borderRadius: 16,
        background: hovered ? meta.bgColor : "rgba(255,255,255,0.02)",
        cursor: "pointer",
        textAlign: "left",
        transition: "border-color 0.15s, background 0.15s",
        width: "100%",
      }}
    >
      <div style={{ fontSize: 28, lineHeight: 1 }}>{meta.icon}</div>
      <div style={{ fontWeight: 800, fontSize: 15, color: hovered ? meta.color : "inherit" }}>
        {meta.label}
      </div>
      <div style={{ fontSize: 12, opacity: 0.65, lineHeight: 1.45 }}>{meta.description}</div>
    </button>
  );
}

// ─── Activity card component ──────────────────────────────────────────────────

function ActivityCard({
  preset,
  domainMeta,
  onSelect,
}: {
  preset: ActivityPreset;
  domainMeta: DomainMeta;
  onSelect: (preset: ActivityPreset) => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={() => onSelect(preset)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "14px 16px",
        border: `1px solid ${hovered ? domainMeta.color : "rgba(128,128,128,0.22)"}`,
        borderRadius: 14,
        background: hovered ? domainMeta.bgColor : "rgba(255,255,255,0.02)",
        cursor: "pointer",
        textAlign: "left",
        transition: "border-color 0.15s, background 0.15s",
        width: "100%",
      }}
    >
      <div style={{
        fontSize: 22,
        width: 40,
        height: 40,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(128,128,128,0.08)",
        borderRadius: 10,
        flexShrink: 0,
      }}>
        {preset.icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: hovered ? domainMeta.color : "inherit" }}>
          {preset.label}
        </div>
        <div style={{ fontSize: 12, opacity: 0.62, marginTop: 2, lineHeight: 1.4 }}>
          {preset.description}
        </div>
      </div>
      <div style={{ color: "rgba(128,128,128,0.5)", fontSize: 16, flexShrink: 0 }}>›</div>
    </button>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

// Soft-nudge card shown on the endurance activity picker. Same chrome as
// the existing info banners — borderless, soft tint, modest padding.
const enduranceNudgeStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 12,
  background: "rgba(78,148,255,0.08)",
  border: "1px solid rgba(78,148,255,0.28)",
  color: "rgba(191,219,254,0.95)",
};

const s = {
  page: {
    padding: "16px 14px",
    display: "grid",
    gap: 18,
    maxWidth: 600,
  } as React.CSSProperties,

  form: {
    padding: "16px 14px",
    display: "grid",
    gap: 18,
    maxWidth: 600,
  } as React.CSSProperties,

  pageHeader: {
    display: "grid",
    gap: 5,
  } as React.CSSProperties,

  pageTitle: {
    fontSize: 20,
    fontWeight: 900,
    lineHeight: 1.2,
  } as React.CSSProperties,

  pageSubtitle: {
    fontSize: 13,
    opacity: 0.6,
    lineHeight: 1.4,
  } as React.CSSProperties,

  domainGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
    gap: 10,
  } as React.CSSProperties,

  activityList: {
    display: "grid",
    gap: 8,
  } as React.CSSProperties,

  stepHeader: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  } as React.CSSProperties,

  backBtn: {
    padding: "6px 12px",
    border: "1px solid rgba(128,128,128,0.35)",
    borderRadius: 10,
    background: "rgba(128,128,128,0.07)",
    color: "inherit",
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
  } as React.CSSProperties,

  domainBadge: {
    padding: "4px 12px",
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: "solid",
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 0.2,
  } as React.CSSProperties,

  presetSummary: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "14px 16px",
    border: "1px solid rgba(128,128,128,0.25)",
    borderRadius: 14,
    background: "rgba(128,128,128,0.05)",
  } as React.CSSProperties,

  presetSummaryIcon: {
    fontSize: 26,
    width: 44,
    height: 44,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(128,128,128,0.1)",
    borderRadius: 12,
    flexShrink: 0,
  } as React.CSSProperties,

  presetSummaryLabel: {
    fontWeight: 800,
    fontSize: 15,
  } as React.CSSProperties,

  presetSummaryDesc: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 2,
    lineHeight: 1.4,
  } as React.CSSProperties,

  customLink: {
    padding: "8px 0",
    border: "none",
    background: "none",
    color: "rgba(128,128,128,0.65)",
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
    textDecoration: "underline",
    textDecorationColor: "rgba(128,128,128,0.35)",
    textAlign: "left" as const,
  } as React.CSSProperties,

  label: {
    display: "block",
    fontWeight: 700,
    marginBottom: 5,
    fontSize: 14,
  } as React.CSSProperties,

  optional: {
    fontWeight: 400,
    opacity: 0.6,
    fontSize: 12,
  } as React.CSSProperties,

  input: {
    width: "100%",
    padding: "11px 12px",
    border: "1px solid rgba(128,128,128,0.6)",
    borderRadius: 10,
    background: "#111827",
    color: "#ffffff",
    boxSizing: "border-box",
    fontSize: 16, // dodge iOS Safari auto-zoom on focus
    fontFamily: "inherit",
  } as React.CSSProperties,

  btn: {
    padding: "10px 16px",
    border: "1px solid rgba(34,197,94,0.45)",
    borderRadius: 12,
    background: "rgba(34,197,94,0.12)",
    color: "inherit",
    fontWeight: 800,
    fontSize: 14,
    cursor: "pointer",
  } as React.CSSProperties,

  twoCol: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  } as React.CSSProperties,

  moreCard: {
    border: "1px solid rgba(128,128,128,0.3)",
    borderRadius: 12,
    padding: "12px 14px",
    background: "rgba(128,128,128,0.04)",
  } as React.CSSProperties,

  moreSummary: {
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 13,
    opacity: 0.8,
  } as React.CSSProperties,

  advancedCard: {
    border: "1px solid rgba(128,128,128,0.25)",
    borderRadius: 10,
    padding: "10px 12px",
    background: "rgba(128,128,128,0.03)",
  } as React.CSSProperties,

  advancedSummary: {
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 13,
  } as React.CSSProperties,

  help: {
    marginTop: 6,
    opacity: 0.65,
    fontSize: 12,
    lineHeight: 1.4,
  } as React.CSSProperties,
} as const;
