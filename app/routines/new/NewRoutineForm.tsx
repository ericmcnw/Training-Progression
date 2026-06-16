"use client";

import MetadataGroupPicker from "@/app/components/MetadataGroupPicker";
import RoutineFrequencyTargetFields from "../RoutineFrequencyTargetFields";
import SupportsSportsField from "../SupportsSportsField";
import { activitiesByFamily } from "@/lib/activity-families";
import { sportAccent } from "@/lib/sport-accent";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
  KIND_META,
  getActivitiesForDomain,
  getActivitiesForKind,
  getDomainMeta,
  getKindMeta,
  type ActivityPreset,
  type DomainMeta,
  type KindMeta,
} from "@/lib/routine-presets";
import type { MetadataGroupKind, RoutineFrequencyUnit, RoutineKind } from "@/generated/prisma";

// Sport options for the SupportsSportsField. Pulled from the activity
// registry so adding a new sport there auto-includes it in the picker.
const SUPPORT_SPORT_OPTIONS = activitiesByFamily("sports").map((s) => ({
  slug: s.slug,
  label: s.label,
  accent: sportAccent(s.slug),
}));

type MetadataGroupOption = {
  id: string;
  slug: string;
  label: string;
  kind: MetadataGroupKind;
};

// Three-step flow:
//   "kind"     — pick a routine kind (Workout / Guided / Completion / Cardio /
//                Sport). Only entered from the top-level /routines/new path;
//                domain-scoped entry points (presetDomain) skip it.
//   "activity" — pick a preset within the chosen kind OR within the scoped
//                domain. Both flows funnel through this step.
//   "form"     — the actual routine creation form.
type Step = "kind" | "activity" | "form";

export default function NewRoutineForm({
  metadataGroups,
  sessionTemplates,
  availableSubstituteRoutines = [],
  inDrawer = false,
  onSuccess,
  presetDomain,
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
  /** When set, skip Step 1 (domain picker) and land on the activity picker
   *  for that domain. Used by domain-scoped "+ New routine" entry points
   *  on /activities/strength, /activities/mobility, etc. */
  presetDomain?: Exclude<RoutineDomain, "skill" | "general" | "habit" | "recovery">;
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
  const [step, setStep] = useState<Step>(presetDomain ? "activity" : "kind");
  const [selectedDomain, setSelectedDomain] = useState<Exclude<RoutineDomain, "skill" | "general" | "habit"> | null>(
    presetDomain ?? null
  );
  // Track the picked kind alongside the picked domain. Only one is set at
  // a time depending on entry mode: presetDomain → selectedDomain; the
  // top-level path → selectedKind. Step 3 (form) reads from neither —
  // the preset's domain + kind flow through their own state below.
  const [selectedKind, setSelectedKind] = useState<RoutineKind | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<ActivityPreset | null>(null);

  // Form state — populated from the preset selection
  const [kind, setKind] = useState<RoutineKind>("COMPLETION");
  const [subtype, setSubtype] = useState<string>("OTHER");
  const [domainOverride, setDomainOverride] = useState<Exclude<RoutineDomain, "skill" | "general" | "habit"> | "">("");

  const derivedDomain = deriveRoutineDomain(kind, subtype);
  const effectiveDomain = domainOverride || derivedDomain;

  // Domain-aware field visibility. Hides irrelevant fields per the three-axis
  // model: Sport/Cardio/Lifestyle don't need supportsSports (not training that
  // supports a sport). Daily-habit-style Lifestyle presets lock format + domain
  // + default the frequency goal to "daily, on" — the express habit flow.
  const isExpressHabitPreset =
    selectedPreset?.key === "DAILY_HABIT" || selectedPreset?.key === "HEALTH_CHECKIN";
  const showSupportsSports = effectiveDomain === "strength" || effectiveDomain === "mobility";
  const showTrainingCategory = !isExpressHabitPreset;
  const showFormatAndSubtype = !selectedPreset && !isExpressHabitPreset;
  const freqGoalInitialEnabled = isExpressHabitPreset;
  const freqGoalInitialCount = isExpressHabitPreset ? 1 : 3;
  const freqGoalInitialUnit: RoutineFrequencyUnit = isExpressHabitPreset ? "DAY" : "WEEK";

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

  function chooseKind(nextKind: RoutineKind) {
    setSelectedKind(nextKind);
    setSelectedDomain(null);
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

  // "Blank" path inside a chosen kind — skip preset selection, jump to the
  // form with that kind as the default. User can still adjust subtype.
  function chooseBlankForKind(kindMeta: KindMeta) {
    setSelectedPreset(null);
    setKind(kindMeta.kind);
    const defaultSubtype = ROUTINE_SUBTYPE_OPTIONS[kindMeta.kind][0] ?? "OTHER";
    setSubtype(defaultSubtype);
    setDomainOverride("");
    setSelectedMetadataGroupIds([]);
    setStep("form");
  }

  function goBack() {
    if (step === "form") {
      // From the form, back to the activity picker if we have a context to
      // return to (kind or domain). The fully custom path (entered via the
      // "Custom (advanced)" link from step 1) has neither, so it goes all
      // the way back to the kind picker.
      if (selectedDomain || selectedKind) setStep("activity");
      else setStep("kind");
    } else if (step === "activity") {
      // With a presetDomain, the activity picker IS the entry — there's no
      // earlier step to go back to. Closing the drawer is the natural undo.
      if (presetDomain) {
        onSuccess?.();
        return;
      }
      setSelectedKind(null);
      setSelectedDomain(null);
      setStep("kind");
    }
  }

  // domainMeta and activityList both flex by entry mode: presetDomain entries
  // show domain-scoped presets (legacy behavior), top-level entries show
  // kind-scoped presets.
  const domainMeta = selectedDomain ? getDomainMeta(selectedDomain) : null;
  const kindMeta = selectedKind ? getKindMeta(selectedKind) : null;
  const activityList = selectedDomain
    ? getActivitiesForDomain(selectedDomain)
    : selectedKind
    ? getActivitiesForKind(selectedKind)
    : [];

  // ─── STEP 1: Kind picker ──────────────────────────────────────────────────────
  // Asks "how does this routine get logged?" since the kind dictates the
  // log form's shape. Domain (dashboard bucket) is derived from the preset
  // pick on the next step.
  if (step === "kind") {
    return (
      <div style={s.page}>
        <div style={s.pageHeader}>
          <div style={s.pageTitle}>What kind of routine?</div>
          <div style={s.pageSubtitle}>
            Pick how this routine gets logged. The dashboard category is set automatically after you pick a starting point.
          </div>
        </div>

        <div style={s.kindGrid}>
          {KIND_META.map((meta) => (
            <KindCard key={meta.kind} meta={meta} onSelect={chooseKind} />
          ))}
        </div>

        {/* Custom / advanced escape hatch — bypasses both pickers and lands
            in the form with COMPLETION/OTHER defaults the user can override. */}
        <button
          type="button"
          onClick={() => {
            setSelectedPreset(null);
            setSelectedKind(null);
            setSelectedDomain(null);
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

  // ─── STEP 2a: Activity picker — entered via presetDomain (legacy) ────────────
  // Domain-scoped entry points (`/activities/strength`, `/activities/sport`,
  // etc.) skip the kind picker. The list is filtered by domain to preserve
  // the muscle memory of "+ New routine" on those pages.
  if (step === "activity" && selectedDomain && domainMeta) {
    return (
      <div style={s.page}>
        <div style={s.stepHeader}>
          <button type="button" onClick={goBack} style={s.backBtn}>← Back</button>
          <div style={{ ...s.domainBadge, color: domainMeta.color, background: domainMeta.bgColor, borderColor: domainMeta.borderColor }}>
            {domainMeta.icon} {domainMeta.label}
          </div>
        </div>
        <div style={s.pageTitle}>Choose an activity</div>
        <div style={s.pageSubtitle}>{domainMeta.description}</div>

        {/* Cardio domain redirect — endurance is logged by activity type,
            not via a saved routine. Legacy presets stay reachable in a
            collapsed expander for the rare scheduled-recurring case. */}
        {selectedDomain === "cardio" && (
          <div style={enduranceNudgeStyle}>
            <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 4, letterSpacing: 0.3 }}>
              💡 No routine needed
            </div>
            <div style={{ fontSize: 12.5, lineHeight: 1.45, opacity: 0.85, marginBottom: 12 }}>
              Endurance is logged directly by activity type (Run, Hike, Bike, …) — no
              routine setup needed. Pick a type and go.
            </div>
            <Link href="/activities/endurance" style={primaryRedirectLinkStyle}>
              Go to Endurance →
            </Link>
          </div>
        )}

        {/* Sport domain redirect — same shape as cardio. */}
        {selectedDomain === "sport" && (
          <div style={sportNudgeStyle}>
            <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 4, letterSpacing: 0.3 }}>
              💡 Enable a sport instead
            </div>
            <div style={{ fontSize: 12.5, lineHeight: 1.45, opacity: 0.85, marginBottom: 12 }}>
              Sports are enabled from the sport picker — each gets a session shape
              automatically. Pick one and start logging.
            </div>
            <Link href="/activities/sports" style={primaryRedirectLinkStyleSport}>
              Go to Sports →
            </Link>
          </div>
        )}

        {(selectedDomain === "cardio" || selectedDomain === "sport") && (
          <details style={legacyPresetCardStyle}>
            <summary style={legacyPresetSummaryStyle}>
              Create a {domainMeta.label.toLowerCase()} routine manually (advanced)
            </summary>
            <div style={{ marginTop: 12 }}>
              <div style={s.activityList}>
                {activityList.map((preset) => (
                  <ActivityCard key={preset.key} preset={preset} domainMeta={domainMeta} onSelect={chooseActivity} />
                ))}
              </div>
            </div>
          </details>
        )}

        {selectedDomain !== "cardio" && selectedDomain !== "sport" && (
          <div style={s.activityList}>
            {activityList.map((preset) => (
              <ActivityCard key={preset.key} preset={preset} domainMeta={domainMeta} onSelect={chooseActivity} />
            ))}
          </div>
        )}
      </div>
    );
  }

  // ─── STEP 2b: Activity picker — entered via kind picker ───────────────────────
  // The list is filtered by kind. CARDIO + SESSION kinds carry a redirect
  // banner that points the user at the right entry point; their preset
  // lists stay reachable behind a collapsed "manual fallback" expander.
  if (step === "activity" && selectedKind && kindMeta) {
    const showRedirect = !!kindMeta.redirect;
    return (
      <div style={s.page}>
        <div style={s.stepHeader}>
          <button type="button" onClick={goBack} style={s.backBtn}>← Back</button>
          <div
            style={{
              ...s.domainBadge,
              color: kindMeta.color,
              background: kindMeta.bgColor,
              borderColor: kindMeta.borderColor,
            }}
          >
            {kindMeta.icon} {kindMeta.label}
          </div>
        </div>
        <div style={s.pageTitle}>Pick a starting point</div>
        <div style={s.pageSubtitle}>{kindMeta.description}</div>

        {/* Redirect nudge for CARDIO + SESSION (the two kinds the routine
            builder is no longer the primary path for). */}
        {showRedirect && kindMeta.redirect && (
          <div
            style={{
              ...redirectNudgeBaseStyle,
              background: kindMeta.bgColor,
              borderColor: kindMeta.borderColor,
              color: kindMeta.color,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 4, letterSpacing: 0.3 }}>
              💡 Try this instead
            </div>
            <div style={{ fontSize: 12.5, lineHeight: 1.45, opacity: 0.85, marginBottom: 12, color: "rgba(255,255,255,0.85)" }}>
              {kindMeta.redirect.reason}
            </div>
            <Link
              href={kindMeta.redirect.href}
              style={{
                ...redirectLinkBaseStyle,
                borderColor: kindMeta.color,
                background: kindMeta.bgColor,
                color: kindMeta.color,
              }}
            >
              {kindMeta.redirect.label} →
            </Link>
          </div>
        )}

        {/* Preset list — for CARDIO/SESSION it lives behind a collapsed
            expander (legacy fallback only); for the other three kinds the
            list is the primary content. A "Start blank" card heads the
            list when the kind has a real builder path. */}
        {showRedirect ? (
          <details style={legacyPresetCardStyle}>
            <summary style={legacyPresetSummaryStyle}>
              Create a {kindMeta.label.toLowerCase()} routine manually (advanced)
            </summary>
            <div style={{ marginTop: 12 }}>
              <div style={s.activityList}>
                <BlankKindCard meta={kindMeta} onSelect={chooseBlankForKind} />
                {activityList.map((preset) => (
                  <ActivityCard
                    key={preset.key}
                    preset={preset}
                    domainMeta={getDomainMeta(preset.domain)}
                    onSelect={chooseActivity}
                  />
                ))}
              </div>
            </div>
          </details>
        ) : (
          <div style={s.activityList}>
            <BlankKindCard meta={kindMeta} onSelect={chooseBlankForKind} />
            {activityList.map((preset) => (
              <ActivityCard
                key={preset.key}
                preset={preset}
                domainMeta={getDomainMeta(preset.domain)}
                onSelect={chooseActivity}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // ─── STEP 3: Form ────────────────────────────────────────────────────────────
  // Header badge prefers the preset's resolved domain (so the user sees what
  // dashboard bucket the routine will land in) and falls back to the kind
  // badge when there's no preset yet — e.g. the "blank kind" or "custom"
  // paths. domainMeta from earlier is only set in the presetDomain entry
  // mode; for the top-level kind path we derive from effectiveDomain.
  const badgeDomainMeta = selectedPreset ? getDomainMeta(effectiveDomain) : domainMeta;
  const badgeKindMeta = !badgeDomainMeta ? (kindMeta ?? getKindMeta(kind)) : null;

  return (
    <form action={drawerSubmit ?? createRoutine} style={s.form}>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="subtype" value={subtype} />
      <input type="hidden" name="domain" value={effectiveDomain} />
      <input type="hidden" name="category" value={selectedPreset?.label ?? ""} />

      {/* Step header */}
      <div style={s.stepHeader}>
        <button type="button" onClick={goBack} style={s.backBtn}>← Back</button>
        {badgeDomainMeta ? (
          <div
            style={{
              ...s.domainBadge,
              color: badgeDomainMeta.color,
              background: badgeDomainMeta.bgColor,
              borderColor: badgeDomainMeta.borderColor,
            }}
          >
            {badgeDomainMeta.icon} {badgeDomainMeta.label}
          </div>
        ) : badgeKindMeta ? (
          <div
            style={{
              ...s.domainBadge,
              color: badgeKindMeta.color,
              background: badgeKindMeta.bgColor,
              borderColor: badgeKindMeta.borderColor,
            }}
          >
            {badgeKindMeta.icon} {badgeKindMeta.label}
          </div>
        ) : null}
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

      {/* Custom path: show format + activity type selectors. Hidden when an
          express-habit Lifestyle preset is locked — those routines are
          kind=COMPLETION + lifestyle by construction. */}
      {showFormatAndSubtype && (
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

      {/* Frequency goal. Defaults to ON + daily for express-habit Lifestyle
          presets (Daily Habit, Health Check-in) so the most common case is one
          tap less. */}
      <div>
        <label style={s.label}>
          {isExpressHabitPreset ? "How often?" : <>Frequency goal <span style={s.optional}>(optional)</span></>}
        </label>
        <RoutineFrequencyTargetFields
          // `key` forces a remount when the user navigates back to the
          // activity picker and chooses a different preset. Without it,
          // RoutineFrequencyTargetFields keeps the freq state from the
          // first preset (its `useState(initialEnabled)` only runs once),
          // so picking "Cold Plunge" after "Daily Habit" would inherit the
          // daily-on defaults instead of resetting to off.
          key={selectedPreset?.key ?? "custom"}
          initialCount={freqGoalInitialCount}
          initialUnit={freqGoalInitialUnit}
          initialInterval={1}
          initialEnabled={freqGoalInitialEnabled}
          // Substitutes work for any frequency goal — covered-by makes sense
          // for groups (e.g. a climb covers a Pull Day in a 3×/week strength
          // goal) just as much as for daily habits.
          availableSubstituteRoutines={availableSubstituteRoutines}
        />
      </div>

      {/* Training category — drives the Training Balance bars on the dashboard.
          Hidden when an express-habit Lifestyle preset is locked (domain is
          fixed to lifestyle by the preset). The hidden `domain` input above
          still submits the effective value. */}
      {showTrainingCategory && (
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
      )}

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

          {/* "Supports sports" is for training routines that train you FOR a
              sport (hangboard → climbing). Doesn't make sense for sport
              sessions themselves, cardio (already endurance-typed), or
              lifestyle (not training). */}
          {showSupportsSports && <SupportsSportsField options={SUPPORT_SPORT_OPTIONS} />}

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

// ─── Kind card component ──────────────────────────────────────────────────────
// The Step-1 picker tile. KIND_META drives the data; visuals follow the
// same shape the domain badges + activity cards use on later steps so the
// flow reads as one design language. The shortDescription sits inline
// with the label so the card stays compact; the longer description fills
// the body.
function KindCard({
  meta,
  onSelect,
}: {
  meta: KindMeta;
  onSelect: (kind: RoutineKind) => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={() => onSelect(meta.kind)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 6,
        padding: "16px 14px",
        border: `1px solid ${hovered ? meta.color : meta.borderColor}`,
        borderRadius: 16,
        background: hovered ? meta.bgColor : "rgba(255,255,255,0.02)",
        cursor: "pointer",
        textAlign: "left",
        transition: "border-color 0.15s, background 0.15s",
        width: "100%",
        minHeight: 124,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, width: "100%" }}>
        <div style={{ fontSize: 26, lineHeight: 1 }}>{meta.icon}</div>
        <div style={{ display: "grid", gap: 1, minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 900, fontSize: 15, color: hovered ? meta.color : "inherit" }}>
            {meta.label}
          </div>
          <div style={{ fontSize: 11.5, opacity: 0.6, fontWeight: 700 }}>
            {meta.shortDescription}
          </div>
        </div>
      </div>
      <div style={{ fontSize: 12, opacity: 0.62, lineHeight: 1.45 }}>{meta.description}</div>
      {meta.redirect && (
        <div
          style={{
            fontSize: 10.5,
            fontWeight: 800,
            letterSpacing: 0.3,
            opacity: 0.78,
            color: meta.color,
            marginTop: 2,
          }}
        >
          → Usually logged via {meta.redirect.label.replace("Go to ", "")}
        </div>
      )}
    </button>
  );
}

// ─── Blank-kind card — "start fresh in this kind" ─────────────────────────────
// Sits at the top of each kind's preset list so the user can bypass presets
// while still keeping the kind they picked. Visually muted vs the actual
// presets so it doesn't pretend to be one.
function BlankKindCard({
  meta,
  onSelect,
}: {
  meta: KindMeta;
  onSelect: (meta: KindMeta) => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={() => onSelect(meta)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "14px 16px",
        border: `1px dashed ${hovered ? meta.color : "rgba(128,128,128,0.35)"}`,
        borderRadius: 14,
        background: hovered ? meta.bgColor : "rgba(255,255,255,0.015)",
        cursor: "pointer",
        textAlign: "left",
        transition: "border-color 0.15s, background 0.15s",
        width: "100%",
      }}
    >
      <div
        style={{
          fontSize: 20,
          width: 40,
          height: 40,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(128,128,128,0.06)",
          borderRadius: 10,
          flexShrink: 0,
          opacity: 0.85,
        }}
      >
        ＋
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: hovered ? meta.color : "inherit" }}>
          Start blank
        </div>
        <div style={{ fontSize: 12, opacity: 0.62, marginTop: 2, lineHeight: 1.4 }}>
          Skip the preset and configure a {meta.label.toLowerCase()} routine from scratch.
        </div>
      </div>
      <div style={{ color: "rgba(128,128,128,0.5)", fontSize: 16, flexShrink: 0 }}>›</div>
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

// Soft-nudge cards shown on the cardio + sport activity pickers. Both
// domains are "redirect tiles" — the routine builder isn't the right entry
// point for them. Accent color matches the domain (cardio = blue,
// sport = orange) so the redirect feels on-theme.
const enduranceNudgeStyle: React.CSSProperties = {
  padding: "14px 16px",
  borderRadius: 14,
  background: "rgba(78,148,255,0.08)",
  border: "1px solid rgba(78,148,255,0.28)",
  color: "rgba(191,219,254,0.95)",
};

const sportNudgeStyle: React.CSSProperties = {
  padding: "14px 16px",
  borderRadius: 14,
  background: "rgba(251,146,60,0.08)",
  border: "1px solid rgba(251,146,60,0.28)",
  color: "rgba(254,215,170,0.95)",
};

const primaryRedirectLinkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "10px 16px",
  borderRadius: 10,
  border: "1px solid rgba(78,148,255,0.5)",
  background: "rgba(78,148,255,0.18)",
  color: "rgba(191,219,254,1)",
  fontSize: 13,
  fontWeight: 900,
  textDecoration: "none",
  minHeight: 44,
};

const primaryRedirectLinkStyleSport: React.CSSProperties = {
  ...primaryRedirectLinkStyle,
  border: "1px solid rgba(251,146,60,0.5)",
  background: "rgba(251,146,60,0.18)",
  color: "rgba(254,215,170,1)",
};

// Generic redirect-nudge tokens used by the kind-mode Step 2. Colors are
// applied inline per kind (CARDIO blue, SESSION orange) so the same
// markup re-skins to match whichever kind the user picked.
const redirectNudgeBaseStyle: React.CSSProperties = {
  padding: "14px 16px",
  borderRadius: 14,
  borderWidth: 1,
  borderStyle: "solid",
};

const redirectLinkBaseStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "10px 16px",
  borderRadius: 10,
  borderWidth: 1,
  borderStyle: "solid",
  fontSize: 13,
  fontWeight: 900,
  textDecoration: "none",
  minHeight: 44,
};

const legacyPresetCardStyle: React.CSSProperties = {
  border: "1px solid rgba(128,128,128,0.25)",
  borderRadius: 12,
  padding: "10px 14px",
  background: "rgba(128,128,128,0.04)",
};

const legacyPresetSummaryStyle: React.CSSProperties = {
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 800,
  opacity: 0.75,
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

  // Kind picker grid. Wider min so each card has room for icon + label +
  // short tag inline at the top, and a 2-line description below. Auto-fill
  // means PC shows 2-3 across (5 cards land 3+2), mobile collapses to 1.
  kindGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
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

  // Label / input / help tokens kept locally for now but tuned to match the
  // log-form `form-ui.tsx` shared tokens (inputStyle, labelStyle, hintStyle)
  // so the routine builder visually aligns with the log forms. If we ever
  // refactor away from the local `s` object, importing form-ui directly is
  // the right next step.
  label: {
    display: "block",
    fontWeight: 900,
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
    // minWidth/maxWidth fix iOS Safari's datetime-local intrinsic-width
    // behavior; matches form-ui.tsx's inputStyle.
    minWidth: 0,
    maxWidth: "100%",
    padding: "10px 12px",
    border: "1px solid rgba(128,128,128,0.6)",
    borderRadius: 12,
    background: "#111827",
    color: "#ffffff",
    boxSizing: "border-box",
    // 16px+ avoids iOS Safari auto-zooming the viewport on focus. Required
    // for any input shown in a drawer/modal where zoom would crop the chrome.
    fontSize: 16,
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
    opacity: 0.72,
    fontSize: 12,
    lineHeight: 1.4,
  } as React.CSSProperties,
} as const;
