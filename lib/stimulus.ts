import type { Prisma } from "@/generated/prisma";
import { inferExerciseMetadataSlugs, inferGuidedStepMetadataSlugs, inferRoutineMetadataSlugs } from "@/lib/metadata";
import { prisma } from "@/lib/prisma";

export const STIMULUS_CATEGORY_SEEDS = [
  { slug: "push", label: "Push", sortOrder: 10 },
  { slug: "pull", label: "Pull", sortOrder: 20 },
  { slug: "squat", label: "Squat", sortOrder: 30 },
  { slug: "hinge", label: "Hinge", sortOrder: 40 },
  { slug: "core", label: "Core", sortOrder: 50 },
  { slug: "grip", label: "Grip", sortOrder: 60 },
  { slug: "cardio", label: "Cardio", sortOrder: 70 },
] as const;

type StimulusRow = {
  stimulusCategoryId: string;
  slug: string;
  label: string;
  sortOrder: number;
  loadValue: number;
  stretchValue: number;
  confidence: number | null;
  sourceKind: string | null;
};

type MetadataMapping = {
  metadataGroupId: string;
  loadWeight: number;
  stretchWeight: number;
  stimulusCategory: { id: string; slug: string; label: string; sortOrder: number };
};

type Contribution = {
  metadataGroupIds: string[];
  magnitude: number;
  confidence: number;
  sourceKind: string;
};

type LoadedRoutineLog = Prisma.RoutineLogGetPayload<{
  include: {
    routine: {
      include: {
        metadataGroups: { include: { group: { select: { id: true; slug: true } } } };
        sessionDetails: {
          include: {
            template: {
              include: {
                metadataGroups: { include: { group: { select: { id: true; slug: true } } } };
                metricDefinitions: { select: { id: true; key: true; unit: true } };
              };
            };
          };
        };
      };
    };
    exercises: {
      include: {
        exercise: {
          include: {
            metadataGroups: { include: { group: { select: { id: true; slug: true } } } };
          };
        };
        sets: true;
      };
    };
    guidedSteps: {
      include: {
        guidedStep: {
          include: {
            metadataGroups: { include: { group: { select: { id: true; slug: true } } } };
          };
        };
        exercise: {
          include: {
            metadataGroups: { include: { group: { select: { id: true; slug: true } } } };
          };
        };
      };
    };
    sessionMetricValues: {
      include: {
        metricDefinition: { select: { id: true; key: true; unit: true } };
      };
    };
  };
}>;

function roundStimulusValue(value: number) {
  return Math.round(value * 100) / 100;
}

function averageConfidence(values: number[]) {
  if (values.length === 0) return null;
  return roundStimulusValue(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function collectGroupRefs(entries: Array<{ group: { id: string; slug: string } }>) {
  return entries.map((entry) => entry.group);
}

async function getMetadataTaxonomy() {
  const groups = await prisma.metadataGroup.findMany({
    select: {
      id: true,
      slug: true,
      parentRelations: { select: { parentGroupId: true } },
    },
  });
  return new Map(
    groups.map((group) => [
      group.id,
      {
        ...group,
        parentIds: group.parentRelations.map((relation) => relation.parentGroupId),
      },
    ])
  );
}

function expandMetadataGroupIds(metadataGroupIds: string[], taxonomy: Map<string, { parentIds: string[] }>) {
  const expanded = new Set(metadataGroupIds);
  const queue = [...metadataGroupIds];
  while (queue.length > 0) {
    const currentId = queue.shift();
    if (!currentId) continue;
    const current = taxonomy.get(currentId);
    if (!current) continue;
    for (const parentId of current.parentIds) {
      if (expanded.has(parentId)) continue;
      expanded.add(parentId);
      queue.push(parentId);
    }
  }
  return [...expanded];
}

export async function getStimulusMappingsForMetadata(metadataGroupIds: string[]) {
  if (metadataGroupIds.length === 0) return [] as MetadataMapping[];
  const taxonomy = await getMetadataTaxonomy();
  const expandedIds = expandMetadataGroupIds(metadataGroupIds, taxonomy);
  return prisma.metadataStimulusMapping.findMany({
    where: { metadataGroupId: { in: expandedIds } },
    include: {
      stimulusCategory: {
        select: { id: true, slug: true, label: true, sortOrder: true },
      },
    },
  });
}

function fallbackMetadataSlugsForRoutine(log: LoadedRoutineLog) {
  return inferRoutineMetadataSlugs(log.routine.subtype);
}

function workoutExerciseMagnitude(params: {
  supportsWeight: boolean;
  sets: Array<{ reps: number | null; seconds: number | null; weightLb: number | null }>;
}) {
  // First-pass normalization: give weighted reps more credit, still preserve bodyweight and time-based work.
  return params.sets.reduce((sum, set) => {
    if (set.reps && set.reps > 0) {
      const effectiveLoad = set.weightLb ?? (params.supportsWeight ? 12 : 8);
      return sum + set.reps * effectiveLoad / 25;
    }
    if (set.seconds && set.seconds > 0) {
      const weightedBonus = set.weightLb ? set.weightLb / 20 : 0;
      return sum + set.seconds / 20 + weightedBonus;
    }
    return sum + (set.weightLb ? set.weightLb / 30 : 0.5);
  }, 0);
}

function cardioMagnitude(log: LoadedRoutineLog) {
  const distanceMi = log.distanceMi ?? 0;
  const durationMin = (log.durationSec ?? 0) / 60;
  const elevationGainFt = log.elevationGainFt ?? 0;
  return distanceMi * 8 + durationMin * 0.6 + elevationGainFt / 500;
}

function sessionMagnitude(log: LoadedRoutineLog) {
  const durationMin = (log.durationSec ?? 0) / 60;
  const numericMetricBonus = log.sessionMetricValues.reduce((sum, value) => {
    const metricValue = value.numberValue ?? 0;
    if (!Number.isFinite(metricValue) || metricValue <= 0) return sum;
    const unit = (value.metricDefinition.unit ?? "").toLowerCase();
    if (unit === "mi") return sum + metricValue * 3;
    if (unit === "ft") return sum + metricValue / 300;
    if (unit === "routes" || unit === "climbs" || unit === "attempts" || unit === "runs") return sum + metricValue * 0.4;
    return sum + Math.min(metricValue, 30) * 0.15;
  }, 0);
  return durationMin * 1.25 + numericMetricBonus;
}

function guidedStepMagnitude(step: LoadedRoutineLog["guidedSteps"][number]) {
  const totalRounds = Math.max(1, (step.repCount ?? step.repeatCount ?? 1) * (step.setCount ?? 1));
  const workSec = step.durationSec ?? 0;
  const weightBonus = step.weightLb ? step.weightLb / 25 : 0;
  if (workSec > 0) return workSec * totalRounds / 18 + weightBonus;
  return totalRounds + weightBonus;
}

function completionMagnitude(log: LoadedRoutineLog) {
  return Math.max(0, (log.completionCount ?? 1) * 0.25);
}

async function buildContributionRows(log: LoadedRoutineLog): Promise<Contribution[]> {
  const allGroups = await prisma.metadataGroup.findMany({
    select: { id: true, slug: true },
  });
  const groupIdBySlug = new Map(allGroups.map((group) => [group.slug, group.id]));
  const metadataGroupIdsForSlugs = (slugs: string[]) =>
    slugs.map((slug) => groupIdBySlug.get(slug)).filter((value): value is string => Boolean(value));

  const routineGroups = collectGroupRefs(log.routine.metadataGroups);
  const subtypeFallbackGroupIds = metadataGroupIdsForSlugs(fallbackMetadataSlugsForRoutine(log));
  const contributions: Contribution[] = [];
  const normalizeMobilityInferenceSlugs = (slugs: string[]) => {
    const slugSet = new Set(slugs);
    const isMobilityContext = slugSet.has("mobility") || slugSet.has("recovery") || slugSet.has("rehab");
    const hasLowerBodyBias =
      slugSet.has("hinge") || slugSet.has("squat") || slugSet.has("lunge") || slugSet.has("legs") || slugSet.has("lower-body");
    const hasExplicitUpperBodyPull =
      slugSet.has("horizontal-pull") ||
      slugSet.has("vertical-pull") ||
      slugSet.has("back") ||
      slugSet.has("biceps") ||
      slugSet.has("fingers") ||
      slugSet.has("forearms");

    if (isMobilityContext && hasLowerBodyBias && slugSet.has("pull") && !hasExplicitUpperBodyPull) {
      slugSet.delete("pull");
    }

    return Array.from(slugSet);
  };

  if (log.routine.kind === "WORKOUT") {
    for (const exercise of log.exercises) {
      const directGroups = collectGroupRefs(exercise.exercise.metadataGroups);
      const inferredGroupIds =
        directGroups.length > 0
          ? directGroups.map((group) => group.id)
          : metadataGroupIdsForSlugs(inferExerciseMetadataSlugs(exercise.exercise.name));
      const metadataGroupIds =
        inferredGroupIds.length > 0
          ? inferredGroupIds
          : routineGroups.map((group) => group.id);
      const magnitude = workoutExerciseMagnitude({
        supportsWeight: exercise.exercise.supportsWeight,
        sets: exercise.sets,
      });
      if (magnitude <= 0 || metadataGroupIds.length === 0) continue;
      contributions.push({
        metadataGroupIds,
        magnitude,
        confidence: directGroups.length > 0 ? 0.92 : inferredGroupIds.length > 0 ? 0.68 : 0.54,
        sourceKind: directGroups.length > 0 ? "WORKOUT_EXERCISE" : inferredGroupIds.length > 0 ? "WORKOUT_INFERRED_EXERCISE" : "WORKOUT_ROUTINE",
      });
    }
  } else if (log.routine.kind === "CARDIO") {
    const routineGroupIds = routineGroups.map((group) => group.id);
    const metadataGroupIds = routineGroupIds.length > 0 ? routineGroupIds : subtypeFallbackGroupIds;
    const magnitude = cardioMagnitude(log);
    if (magnitude > 0 && metadataGroupIds.length > 0) {
      contributions.push({
        metadataGroupIds,
        magnitude,
        confidence: routineGroupIds.length > 0 ? 0.8 : 0.62,
        sourceKind: routineGroupIds.length > 0 ? "CARDIO_ROUTINE" : "CARDIO_SUBTYPE",
      });
    }
  } else if (log.routine.kind === "SESSION") {
    const templateGroups = collectGroupRefs(log.routine.sessionDetails?.template?.metadataGroups ?? []);
    const routineGroupIds = routineGroups.map((group) => group.id);
    const metadataGroupIds =
      templateGroups.length > 0
        ? templateGroups.map((group) => group.id)
        : routineGroupIds.length > 0
        ? routineGroupIds
        : subtypeFallbackGroupIds;
    const magnitude = sessionMagnitude(log);
    if (magnitude > 0 && metadataGroupIds.length > 0) {
      contributions.push({
        metadataGroupIds,
        magnitude,
        confidence: templateGroups.length > 0 ? 0.88 : routineGroupIds.length > 0 ? 0.72 : 0.58,
        sourceKind: templateGroups.length > 0 ? "SESSION_TEMPLATE" : routineGroupIds.length > 0 ? "SESSION_ROUTINE" : "SESSION_SUBTYPE",
      });
    }
  } else if (log.routine.kind === "GUIDED") {
    for (const step of log.guidedSteps) {
      const stepGroups = collectGroupRefs(step.guidedStep?.metadataGroups ?? []);
      const exerciseGroups = collectGroupRefs(step.exercise?.metadataGroups ?? []);
      const inferredSlugs =
        step.kind === "STEP" && stepGroups.length === 0
          ? normalizeMobilityInferenceSlugs(inferGuidedStepMetadataSlugs(step.title))
          : [];
      const inferredGroupIds = metadataGroupIdsForSlugs(inferredSlugs);
      const metadataGroupIds =
        stepGroups.length > 0
          ? stepGroups.map((group) => group.id)
          : exerciseGroups.length > 0
          ? exerciseGroups.map((group) => group.id)
          : inferredGroupIds.length > 0
          ? inferredGroupIds
          : routineGroups.map((group) => group.id);
      const magnitude = guidedStepMagnitude(step);
      if (magnitude <= 0 || metadataGroupIds.length === 0) continue;
      contributions.push({
        metadataGroupIds,
        magnitude,
        confidence:
          stepGroups.length > 0
            ? 0.9
            : exerciseGroups.length > 0
            ? 0.86
            : inferredGroupIds.length > 0
            ? 0.65
            : 0.52,
        sourceKind:
          stepGroups.length > 0
            ? "GUIDED_STEP"
            : exerciseGroups.length > 0
            ? "GUIDED_EXERCISE"
            : inferredGroupIds.length > 0
            ? "GUIDED_INFERRED_STEP"
            : "GUIDED_ROUTINE",
      });
    }
  } else {
    const routineGroupIds = routineGroups.map((group) => group.id);
    const metadataGroupIds = routineGroupIds.length > 0 ? routineGroupIds : subtypeFallbackGroupIds;
    const magnitude = completionMagnitude(log);
    if (magnitude > 0 && metadataGroupIds.length > 0) {
      contributions.push({
        metadataGroupIds,
        magnitude,
        confidence: routineGroupIds.length > 0 ? 0.5 : 0.35,
        sourceKind: "COMPLETION_ROUTINE",
      });
    }
  }

  return contributions;
}

export async function inferStimulusCategoriesForRoutine(routineId: string) {
  const routine = await prisma.routine.findUnique({
    where: { id: routineId },
    include: {
      metadataGroups: { include: { group: { select: { id: true } } } },
      sessionDetails: {
        include: {
          template: {
            include: {
              metadataGroups: { include: { group: { select: { id: true } } } },
            },
          },
        },
      },
      exercises: {
        include: {
          exercise: {
            include: {
              metadataGroups: { include: { group: { select: { id: true } } } },
            },
          },
        },
      },
      guidedSteps: {
        include: {
          metadataGroups: { include: { group: { select: { id: true } } } },
          exercise: {
            include: {
              metadataGroups: { include: { group: { select: { id: true } } } },
            },
          },
        },
      },
    },
  });
  if (!routine) return [];

  const groupIds = new Set<string>();
  for (const entry of routine.metadataGroups) groupIds.add(entry.group.id);
  for (const entry of routine.sessionDetails?.template?.metadataGroups ?? []) groupIds.add(entry.group.id);
  for (const entry of routine.exercises) {
    for (const groupEntry of entry.exercise.metadataGroups) groupIds.add(groupEntry.group.id);
  }
  for (const step of routine.guidedSteps) {
    for (const groupEntry of step.metadataGroups) groupIds.add(groupEntry.group.id);
    for (const groupEntry of step.exercise?.metadataGroups ?? []) groupIds.add(groupEntry.group.id);
  }

  const mappings = await getStimulusMappingsForMetadata([...groupIds]);
  return Array.from(
    new Map(mappings.map((mapping) => [mapping.stimulusCategory.id, mapping.stimulusCategory])).values()
  ).sort((left, right) => left.sortOrder - right.sortOrder || left.label.localeCompare(right.label));
}

export async function calculateRoutineLogStimulus(log: LoadedRoutineLog) {
  const contributions = await buildContributionRows(log);
  if (contributions.length === 0) return [] as StimulusRow[];

  const metadataGroupIds = Array.from(new Set(contributions.flatMap((contribution) => contribution.metadataGroupIds)));
  const mappings = await getStimulusMappingsForMetadata(metadataGroupIds);
  if (mappings.length === 0) return [] as StimulusRow[];

  const mappingByMetadataGroupId = new Map<string, MetadataMapping[]>();
  for (const mapping of mappings) {
    const current = mappingByMetadataGroupId.get(mapping.metadataGroupId) ?? [];
    current.push(mapping);
    mappingByMetadataGroupId.set(mapping.metadataGroupId, current);
  }

  const rows = new Map<string, StimulusRow>();

  for (const contribution of contributions) {
    const contributionMappings = contribution.metadataGroupIds.flatMap((metadataGroupId) => mappingByMetadataGroupId.get(metadataGroupId) ?? []);
    if (contributionMappings.length === 0) continue;

    const loadWeightTotal = contributionMappings.reduce((sum, mapping) => sum + Math.max(0, mapping.loadWeight), 0);
    const stretchWeightTotal = contributionMappings.reduce((sum, mapping) => sum + Math.max(0, mapping.stretchWeight), 0);

    for (const mapping of contributionMappings) {
      const current =
        rows.get(mapping.stimulusCategory.id) ??
        {
          stimulusCategoryId: mapping.stimulusCategory.id,
          slug: mapping.stimulusCategory.slug,
          label: mapping.stimulusCategory.label,
          sortOrder: mapping.stimulusCategory.sortOrder,
          loadValue: 0,
          stretchValue: 0,
          confidence: null,
          sourceKind: contribution.sourceKind,
        };

      if (loadWeightTotal > 0 && mapping.loadWeight > 0) {
        current.loadValue += contribution.magnitude * (mapping.loadWeight / loadWeightTotal);
      }
      if (stretchWeightTotal > 0 && mapping.stretchWeight > 0) {
        current.stretchValue += contribution.magnitude * (mapping.stretchWeight / stretchWeightTotal);
      }

      const nextConfidenceValues = [current.confidence, contribution.confidence].filter((value): value is number => value !== null);
      current.confidence = averageConfidence(nextConfidenceValues);
      rows.set(mapping.stimulusCategory.id, current);
    }
  }

  return [...rows.values()]
    .filter((row) => row.loadValue > 0 || row.stretchValue > 0)
    .map((row) => ({
      ...row,
      loadValue: roundStimulusValue(row.loadValue),
      stretchValue: roundStimulusValue(row.stretchValue),
    }))
    .sort((left, right) => left.sortOrder - right.sortOrder || left.label.localeCompare(right.label));
}

async function loadRoutineLogForStimulus(logId: string) {
  return prisma.routineLog.findUnique({
    where: { id: logId },
    include: {
      routine: {
        include: {
          metadataGroups: { include: { group: { select: { id: true, slug: true } } } },
          sessionDetails: {
            include: {
              template: {
                include: {
                  metadataGroups: { include: { group: { select: { id: true, slug: true } } } },
                  metricDefinitions: { select: { id: true, key: true, unit: true } },
                },
              },
            },
          },
        },
      },
      exercises: {
        include: {
          exercise: {
            include: {
              metadataGroups: { include: { group: { select: { id: true, slug: true } } } },
            },
          },
          sets: true,
        },
      },
      guidedSteps: {
        include: {
          guidedStep: {
            include: {
              metadataGroups: { include: { group: { select: { id: true, slug: true } } } },
            },
          },
          exercise: {
            include: {
              metadataGroups: { include: { group: { select: { id: true, slug: true } } } },
            },
          },
        },
      },
      sessionMetricValues: {
        include: {
          metricDefinition: { select: { id: true, key: true, unit: true } },
        },
      },
    },
  });
}

export async function recalculateRoutineLogStimulus(logId: string) {
  const log = await loadRoutineLogForStimulus(logId);
  if (!log) return [];

  const rows = await calculateRoutineLogStimulus(log);

  await prisma.$transaction(async (tx) => {
    await tx.routineLogStimulus.deleteMany({ where: { routineLogId: logId } });
    if (rows.length === 0) return;
    await tx.routineLogStimulus.createMany({
      data: rows.map((row) => ({
        routineLogId: logId,
        stimulusCategoryId: row.stimulusCategoryId,
        loadValue: row.loadValue,
        stretchValue: row.stretchValue,
        confidence: row.confidence,
        sourceKind: row.sourceKind,
      })),
      // Backfill can run concurrently across dashboard/progress requests.
      // The unique key keeps the cache correct, so later duplicate inserts should no-op.
      skipDuplicates: true,
    });
  });

  return rows;
}

async function backfillRecentStimulusCache(days: number) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const uncachedLogs = await prisma.routineLog.findMany({
    where: {
      performedAt: { gte: since },
      stimuli: { none: {} },
    },
    orderBy: [{ performedAt: "desc" }],
    take: 80,
    select: { id: true },
  });

  for (const log of uncachedLogs) {
    await recalculateRoutineLogStimulus(log.id);
  }
}

export async function getRecentStimulusSummary(days = 28) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  try {
    await backfillRecentStimulusCache(days);

    const rows = await prisma.routineLogStimulus.findMany({
      where: {
        routineLog: {
          performedAt: { gte: since },
        },
      },
      include: {
        stimulusCategory: {
          select: { slug: true, label: true, sortOrder: true },
        },
      },
    });

    const summary = new Map<string, { slug: string; label: string; sortOrder: number; loadValue: number; stretchValue: number }>();
    for (const row of rows) {
      const current =
        summary.get(row.stimulusCategoryId) ??
        {
          slug: row.stimulusCategory.slug,
          label: row.stimulusCategory.label,
          sortOrder: row.stimulusCategory.sortOrder,
          loadValue: 0,
          stretchValue: 0,
        };
      current.loadValue += row.loadValue;
      current.stretchValue += row.stretchValue;
      summary.set(row.stimulusCategoryId, current);
    }

    return [...summary.values()]
      .map((row) => ({
        ...row,
        loadValue: roundStimulusValue(row.loadValue),
        stretchValue: roundStimulusValue(row.stretchValue),
      }))
      .sort((left, right) => left.sortOrder - right.sortOrder || left.label.localeCompare(right.label));
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("RoutineLogStimulus") || message.includes("StimulusCategory")) {
      return [];
    }
    throw error;
  }
}
