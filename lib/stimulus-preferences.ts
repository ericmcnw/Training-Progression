import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { STIMULUS_CATEGORY_SEEDS, getRecentStimulusSummary } from "@/lib/stimulus";

export const STIMULUS_RECENT_WINDOW_DAYS = 14;
export const STIMULUS_NEGLECT_WINDOW_DAYS = 28;

const DEFAULT_PRIORITY_WEIGHT = 1;
const DEFAULT_MAINTENANCE_FLOOR = 0.58;
export const STRETCH_EQUIVALENT_MULTIPLIER = 0.6;
export const STIMULUS_PRESET_COOKIE = "stimulus-preset-keys";

type StimulusSeed = (typeof STIMULUS_CATEGORY_SEEDS)[number];
type StimulusSlug = StimulusSeed["slug"];

type PresetDefinition = {
  key: string;
  label: string;
  description: string;
  weights: Record<StimulusSlug, number>;
  maintenanceFloors?: Partial<Record<StimulusSlug, number>>;
};

type PreferenceRow = {
  stimulusCategoryId: string;
  priorityWeight: number;
  maintenanceFloor: number | null;
};

type StimulusSummaryRow = Awaited<ReturnType<typeof getRecentStimulusSummary>>[number];

export type EffectiveStimulusPreference = {
  slug: StimulusSlug;
  label: string;
  sortOrder: number;
  priorityWeight: number;
  maintenanceFloor: number;
  isEmphasized: boolean;
  isDeemphasized: boolean;
};

export type StimulusOverviewEntry = EffectiveStimulusPreference & {
  recentLoad: number;
  recentStretch: number;
  recentCombined: number;
  recentShare: number;
  recentTargetShare: number;
  recentAlignmentRatio: number;
  longLoad: number;
  longStretch: number;
  longCombined: number;
  longShare: number;
  longMaintenanceShare: number;
  longMaintenanceRatio: number;
  status: "aligned" | "below_target" | "maintenance" | "neglect" | "neutral";
  note: string;
};

export type InferredStimulusSuggestion = {
  presetKey: string;
  presetLabel: string;
  confidence: "low" | "medium";
  reasons: string[];
} | null;

export type StimulusOverviewModel = {
  selectedPresetKeys: string[];
  selectedPresetLabels: string[];
  effectivePreferences: EffectiveStimulusPreference[];
  entries: StimulusOverviewEntry[];
  insights: string[];
  inferredSuggestion: InferredStimulusSuggestion;
};

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function toCombinedStimulus(loadValue: number, stretchValue: number) {
  // Stretching still counts, but less than direct load when interpreting training emphasis.
  return round(loadValue + stretchValue * STRETCH_EQUIVALENT_MULTIPLIER);
}

export const STIMULUS_EMPHASIS_PRESETS: PresetDefinition[] = [
  {
    key: "balanced",
    label: "Balanced",
    description: "Keeps all seven categories close to neutral.",
    weights: { push: 1, pull: 1, squat: 1, hinge: 1, core: 1, grip: 1, cardio: 1 },
  },
  {
    key: "climbing-focus",
    label: "Climbing Focus",
    description: "Biases pull, grip, and core while keeping the rest at maintenance.",
    weights: { push: 0.8, pull: 1.5, squat: 0.85, hinge: 0.9, core: 1.2, grip: 1.55, cardio: 0.8 },
    maintenanceFloors: { push: 0.5, squat: 0.56, hinge: 0.56, cardio: 0.48 },
  },
  {
    key: "surfing-focus",
    label: "Surfing Focus",
    description: "Leans toward pull, core, grip, and cardio without dropping lower body entirely.",
    weights: { push: 0.82, pull: 1.2, squat: 0.9, hinge: 0.95, core: 1.35, grip: 1.1, cardio: 1.08 },
    maintenanceFloors: { push: 0.5, squat: 0.55, hinge: 0.56 },
  },
  {
    key: "running-focus",
    label: "Running Focus",
    description: "Elevates cardio with enough leg and core emphasis to stay resilient.",
    weights: { push: 0.72, pull: 0.8, squat: 1.12, hinge: 1.08, core: 1.02, grip: 0.68, cardio: 1.6 },
    maintenanceFloors: { push: 0.46, pull: 0.48, grip: 0.42 },
  },
  {
    key: "strength-focus",
    label: "Strength Focus",
    description: "Pushes the main lifting patterns up while keeping cardio in the mix.",
    weights: { push: 1.18, pull: 1.2, squat: 1.22, hinge: 1.18, core: 1.02, grip: 0.86, cardio: 0.72 },
    maintenanceFloors: { grip: 0.48, cardio: 0.46 },
  },
];

const presetByKey = new Map(STIMULUS_EMPHASIS_PRESETS.map((preset) => [preset.key, preset]));

function toPreferenceMap(rows: PreferenceRow[]) {
  return new Map(rows.map((row) => [row.stimulusCategoryId, row]));
}

function normalizePresetKeys(presetKeys: string[]) {
  return Array.from(new Set(presetKeys.filter((key) => presetByKey.has(key))));
}

async function readStimulusPresetCookie() {
  const cookieStore = await cookies();
  const rawValue = cookieStore.get(STIMULUS_PRESET_COOKIE)?.value ?? "";
  return normalizePresetKeys(
    rawValue
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );
}

export async function ensureAppProfile() {
  const profileDelegate = (prisma as typeof prisma & {
    appProfile?: {
      upsert: typeof prisma.$extends extends never
        ? never
        : (args: {
            where: { key: string };
            update: Record<string, never>;
            create: { key: string };
            include: { stimulusPreferences: true };
          }) => Promise<{
            id: string;
            key: string;
            selectedStimulusPresetKeys: string[];
            createdAt: Date;
            updatedAt: Date;
            stimulusPreferences: PreferenceRow[];
          }>;
    };
  }).appProfile;
  if (!profileDelegate) return null;

  try {
    return await profileDelegate.upsert({
      where: { key: "default" },
      update: {},
      create: { key: "default" },
      include: {
        stimulusPreferences: true,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("AppProfile") || message.includes("UserStimulusPreference")) {
      return null;
    }
    throw error;
  }
}

export async function loadStimulusPreferenceProfile() {
  const profile = await ensureAppProfile();
  const cookiePresetKeys = await readStimulusPresetCookie();
  return {
    selectedPresetKeys: normalizePresetKeys(profile?.selectedStimulusPresetKeys ?? cookiePresetKeys),
    preferenceRows: profile?.stimulusPreferences ?? [],
  };
}

export function mergeStimulusPresetPreferences(params: {
  selectedPresetKeys: string[];
  overrides?: PreferenceRow[];
  categories?: ReadonlyArray<{ id?: string; slug: StimulusSlug; label: string; sortOrder: number }>;
}) {
  const selectedPresets = normalizePresetKeys(params.selectedPresetKeys)
    .map((key) => presetByKey.get(key))
    .filter((preset): preset is PresetDefinition => Boolean(preset));
  const preferenceMap = toPreferenceMap(params.overrides ?? []);
  const categories = params.categories ?? STIMULUS_CATEGORY_SEEDS;
  const maxPriority = 1.9;
  const maxMaintenance = 1.25;

  const merged = categories.map((category) => {
    const selectedWeights = selectedPresets.map((preset) => preset.weights[category.slug] ?? DEFAULT_PRIORITY_WEIGHT);
    const selectedMaintenanceFloors = selectedPresets.map(
      (preset) => preset.maintenanceFloors?.[category.slug] ?? Math.max(DEFAULT_MAINTENANCE_FLOOR, (preset.weights[category.slug] ?? 1) * 0.52)
    );
    const strongestSelectedWeight = selectedWeights.length > 0 ? Math.max(...selectedWeights) : DEFAULT_PRIORITY_WEIGHT;
    const additionalPositiveDeviation = selectedWeights
      .filter((weight) => weight > strongestSelectedWeight)
      .reduce((sum, weight) => sum + (weight - strongestSelectedWeight), 0);
    const supportingPositiveDeviation = selectedWeights
      .filter((weight) => weight < strongestSelectedWeight && weight > DEFAULT_PRIORITY_WEIGHT)
      .reduce((sum, weight) => sum + (weight - DEFAULT_PRIORITY_WEIGHT), 0);
    const allSelectedDeemphasized = selectedWeights.length > 0 && selectedWeights.every((weight) => weight < 0.95);
    const negativeDeviation = selectedWeights.reduce((sum, weight) => sum + Math.max(0, DEFAULT_PRIORITY_WEIGHT - weight), 0);
    const basePriority =
      selectedWeights.length === 0
        ? DEFAULT_PRIORITY_WEIGHT
        : strongestSelectedWeight + additionalPositiveDeviation * 0.2 + supportingPositiveDeviation * 0.4 - (allSelectedDeemphasized ? negativeDeviation / selectedWeights.length * 0.35 : 0);
    const baseMaintenance =
      selectedMaintenanceFloors.length === 0
        ? DEFAULT_MAINTENANCE_FLOOR
        : Math.max(
            DEFAULT_MAINTENANCE_FLOOR,
            selectedMaintenanceFloors.reduce((sum, value) => sum + value, 0) / selectedMaintenanceFloors.length,
            strongestSelectedWeight > 1 ? DEFAULT_MAINTENANCE_FLOOR + (strongestSelectedWeight - 1) * 0.16 : DEFAULT_MAINTENANCE_FLOOR
          );

    const override = "id" in category && category.id ? preferenceMap.get(category.id) : undefined;
    const priorityWeight = round(clamp(override?.priorityWeight ?? basePriority, 0.55, maxPriority));
    const maintenanceFloor = round(clamp(override?.maintenanceFloor ?? baseMaintenance, 0.35, maxMaintenance));

    return {
      slug: category.slug,
      label: category.label,
      sortOrder: category.sortOrder,
      priorityWeight,
      maintenanceFloor,
      isEmphasized: priorityWeight >= 1.04,
      isDeemphasized: priorityWeight <= 0.92,
    } satisfies EffectiveStimulusPreference;
  });

  return merged.sort((left, right) => left.sortOrder - right.sortOrder || left.label.localeCompare(right.label));
}

function summarizeBySlug(rows: StimulusSummaryRow[]) {
  return new Map(rows.map((row) => [row.slug, row]));
}

function buildInsightList(entries: StimulusOverviewEntry[]) {
  const warnings = entries.filter((entry) => entry.status === "neglect");
  const maintenance = entries.filter((entry) => entry.status === "maintenance");
  const belowTarget = entries.filter((entry) => entry.status === "below_target");
  const aligned = entries.filter((entry) => entry.status === "aligned");
  const insights: string[] = [];

  for (const entry of warnings.slice(0, 2)) insights.push(entry.note);
  for (const entry of belowTarget.slice(0, 2)) {
    if (insights.length >= 4) break;
    insights.push(entry.note);
  }
  for (const entry of aligned.slice(0, 2)) {
    if (insights.length >= 4) break;
    insights.push(entry.note);
  }
  for (const entry of maintenance.slice(0, 2)) {
    if (insights.length >= 4) break;
    insights.push(entry.note);
  }

  return insights.slice(0, 4);
}

function buildStimulusNote(entry: Omit<StimulusOverviewEntry, "note">) {
  if (entry.status === "neglect") {
    return `${entry.label} stimulus has been very low for an extended period.`;
  }
  if (entry.status === "maintenance") {
    return entry.isEmphasized
      ? `${entry.label} has drifted toward maintenance-only levels.`
      : entry.isDeemphasized
      ? `${entry.label} is currently de-emphasized, but has been minimal long enough that a maintenance session may be worth considering.`
      : `${entry.label} is a supporting emphasis right now and may be worth topping up soon.`;
  }
  if (entry.status === "below_target") {
    return `${entry.label} is below your recent emphasis target.`;
  }
  if (entry.status === "aligned") {
    return `${entry.label} is being emphasized as intended.`;
  }
  return `${entry.label} is sitting near a neutral training level right now.`;
}

export async function inferLikelyStimulusPreset() {
  try {
    const since = new Date();
    since.setDate(since.getDate() - STIMULUS_NEGLECT_WINDOW_DAYS);

    const [logs, stimulusRows] = await Promise.all([
      prisma.routineLog.findMany({
        where: { performedAt: { gte: since } },
        include: {
          routine: {
            include: {
              metadataGroups: { include: { group: { select: { slug: true } } } },
            },
          },
        },
      }),
      getRecentStimulusSummary(STIMULUS_NEGLECT_WINDOW_DAYS),
    ]);

    if (logs.length === 0 && stimulusRows.length === 0) return null;

    const recentStimulus = summarizeBySlug(stimulusRows);
    const combined = (slug: StimulusSlug) => {
      const row = recentStimulus.get(slug);
      return toCombinedStimulus(row?.loadValue ?? 0, row?.stretchValue ?? 0);
    };

    const counts = {
      climbing: 0,
      running: 0,
      workout: 0,
      cardio: 0,
      boardSports: 0,
    };

    for (const log of logs) {
      const slugs = new Set(log.routine.metadataGroups.map((entry) => entry.group.slug));
      if (slugs.has("climbing")) counts.climbing += 1;
      if (slugs.has("running") || slugs.has("run-walk")) counts.running += 1;
      if (slugs.has("board-sports")) counts.boardSports += 1;
      if (log.routine.kind === "WORKOUT") counts.workout += 1;
      if (log.routine.kind === "CARDIO") counts.cardio += 1;
    }

    const scores = new Map<string, { score: number; reasons: string[] }>();
    const addScore = (key: string, score: number, reason: string) => {
      const current = scores.get(key) ?? { score: 0, reasons: [] };
      current.score += score;
      current.reasons.push(reason);
      scores.set(key, current);
    };

    if (counts.climbing >= 2 || combined("grip") >= 6 || combined("pull") >= 8) {
      addScore("climbing-focus", 3 + counts.climbing, "Recent logs skew toward climbing-style pull and grip work.");
    }
    if (counts.running >= 2 || combined("cardio") >= 10) {
      addScore("running-focus", 3 + counts.running, "Recent logs show a clear cardio and running bias.");
    }
    if (counts.workout >= 3 && combined("push") + combined("pull") + combined("squat") + combined("hinge") >= 16) {
      addScore("strength-focus", 3 + counts.workout * 0.4, "Recent logs look strength-led across the main lifting patterns.");
    }
    if (counts.boardSports >= 1 || (combined("core") >= 6 && combined("cardio") >= 6 && combined("grip") >= 3)) {
      addScore("surfing-focus", 2.8 + counts.boardSports, "Recent logs suggest repeated board-sport style core and conditioning demands.");
    }

    const sorted = [...scores.entries()].sort((left, right) => right[1].score - left[1].score);
    const top = sorted[0];
    if (!top || top[1].score < 3) return null;

    const preset = presetByKey.get(top[0]);
    if (!preset) return null;

    return {
      presetKey: preset.key,
      presetLabel: preset.label,
      confidence: top[1].score >= 5 ? "medium" : "low",
      reasons: top[1].reasons.slice(0, 2),
    } satisfies InferredStimulusSuggestion;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (
      message.includes("AppProfile") ||
      message.includes("UserStimulusPreference") ||
      message.includes("RoutineLogStimulus") ||
      message.includes("StimulusCategory")
    ) {
      return null;
    }
    throw error;
  }
}

export async function getStimulusOverviewModel() {
  try {
    const [profile, recentRows, longRows, inferredSuggestion, categories] = await Promise.all([
      loadStimulusPreferenceProfile(),
      getRecentStimulusSummary(STIMULUS_RECENT_WINDOW_DAYS),
      getRecentStimulusSummary(STIMULUS_NEGLECT_WINDOW_DAYS),
      inferLikelyStimulusPreset(),
      prisma.stimulusCategory.findMany({
        orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
        select: { id: true, slug: true, label: true, sortOrder: true },
      }),
    ]);

    const categoryRows = categories.filter((category): category is { id: string; slug: StimulusSlug; label: string; sortOrder: number } =>
      STIMULUS_CATEGORY_SEEDS.some((seed) => seed.slug === category.slug)
    );

    const effectivePreferences = mergeStimulusPresetPreferences({
      selectedPresetKeys: profile.selectedPresetKeys,
      overrides: profile.preferenceRows,
      categories: categoryRows.length > 0 ? categoryRows : STIMULUS_CATEGORY_SEEDS,
    });

    const recentBySlug = summarizeBySlug(recentRows);
    const longBySlug = summarizeBySlug(longRows);
    const totalRecentCombined = Math.max(
      0.01,
      effectivePreferences.reduce((sum, preference) => {
        const row = recentBySlug.get(preference.slug);
        return sum + toCombinedStimulus(row?.loadValue ?? 0, row?.stretchValue ?? 0);
      }, 0)
    );
    const totalLongCombined = Math.max(
      0.01,
      effectivePreferences.reduce((sum, preference) => {
        const row = longBySlug.get(preference.slug);
        return sum + toCombinedStimulus(row?.loadValue ?? 0, row?.stretchValue ?? 0);
      }, 0)
    );
    const totalPriority = effectivePreferences.reduce((sum, entry) => sum + entry.priorityWeight, 0);
    const totalMaintenance = effectivePreferences.reduce((sum, entry) => sum + entry.maintenanceFloor, 0);
    const averageLongCombined = totalLongCombined / Math.max(1, effectivePreferences.length);

    const entries = effectivePreferences.map((preference) => {
      const recent = recentBySlug.get(preference.slug);
      const long = longBySlug.get(preference.slug);
      const recentLoad = round(recent?.loadValue ?? 0);
      const recentStretch = round(recent?.stretchValue ?? 0);
      const longLoad = round(long?.loadValue ?? 0);
      const longStretch = round(long?.stretchValue ?? 0);
      const recentCombined = toCombinedStimulus(recentLoad, recentStretch);
      const longCombined = toCombinedStimulus(longLoad, longStretch);
      const recentTargetShare = preference.priorityWeight / totalPriority;
      const longMaintenanceShare = preference.maintenanceFloor / totalMaintenance;
      const recentShare = recentCombined / totalRecentCombined;
      const longShare = longCombined / totalLongCombined;
      const recentAlignmentRatio = recentTargetShare > 0 ? recentShare / recentTargetShare : 1;
      const longMaintenanceRatio = longMaintenanceShare > 0 ? longShare / longMaintenanceShare : 1;
      const longNeglectThreshold = Math.max(1.1, averageLongCombined * 0.18);
      const maintenanceThreshold = Math.max(2.25, averageLongCombined * 0.4);
      const strongNeglect =
        longCombined < longNeglectThreshold &&
        recentCombined < Math.max(0.45, totalRecentCombined / effectivePreferences.length / 6);
      const maintenanceGap = longCombined < maintenanceThreshold && longMaintenanceRatio < 0.68;
      const belowTarget = preference.isEmphasized && recentAlignmentRatio < 0.82 && recentCombined < averageLongCombined * 0.85;

      let status: StimulusOverviewEntry["status"] = "neutral";
      if (strongNeglect) status = "neglect";
      else if (belowTarget) status = "below_target";
      else if (maintenanceGap) status = "maintenance";
      else if (preference.isEmphasized && recentAlignmentRatio >= 0.92 && recentCombined >= 1.2) status = "aligned";

      const baseEntry = {
        ...preference,
        recentLoad,
        recentStretch,
        recentCombined,
        recentShare: round(recentShare),
        recentTargetShare: round(recentTargetShare),
        recentAlignmentRatio: round(recentAlignmentRatio),
        longLoad,
        longStretch,
        longCombined,
        longShare: round(longShare),
        longMaintenanceShare: round(longMaintenanceShare),
        longMaintenanceRatio: round(longMaintenanceRatio),
        status,
      };

      return {
        ...baseEntry,
        note: buildStimulusNote(baseEntry),
      } satisfies StimulusOverviewEntry;
    });

    return {
      selectedPresetKeys: profile.selectedPresetKeys,
      selectedPresetLabels: profile.selectedPresetKeys.map((key) => presetByKey.get(key)?.label ?? key),
      effectivePreferences: effectivePreferences,
      entries,
      insights: buildInsightList(entries),
      inferredSuggestion,
    } satisfies StimulusOverviewModel;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (
      message.includes("AppProfile") ||
      message.includes("UserStimulusPreference") ||
      message.includes("RoutineLogStimulus") ||
      message.includes("StimulusCategory")
    ) {
      const effectivePreferences = mergeStimulusPresetPreferences({ selectedPresetKeys: [] });
      return {
        selectedPresetKeys: [],
        selectedPresetLabels: [],
        effectivePreferences,
        entries: effectivePreferences.map((entry) => ({
          ...entry,
          recentLoad: 0,
          recentStretch: 0,
          recentCombined: 0,
          recentShare: 0,
          recentTargetShare: round(1 / effectivePreferences.length),
          recentAlignmentRatio: 0,
          longLoad: 0,
          longStretch: 0,
          longCombined: 0,
          longShare: 0,
          longMaintenanceShare: round(1 / effectivePreferences.length),
          longMaintenanceRatio: 0,
          status: "neutral",
          note: `${entry.label} has no cached stimulus data yet.`,
        })),
        insights: [],
        inferredSuggestion: null,
      } satisfies StimulusOverviewModel;
    }
    throw error;
  }
}
