/**
 * Export all exercises and stretches with their metadata to an Excel file.
 * Run with: node scripts/export-exercises.mjs
 * Output: exports/exercises-export.xlsx
 */

import { PrismaClient } from "../generated/prisma/index.js";
import * as XLSX from "xlsx";
import { mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();

const LIBRARY_KIND_LABELS = {
  STRENGTH: "Strength",
  CONDITIONING: "Conditioning",
  MOBILITY: "Mobility",
  STRETCH: "Stretch",
  BREATHWORK: "Breathwork",
  SKILL: "Skill",
};

const UNIT_LABELS = {
  REPS: "Reps",
  TIME: "Time",
};

const KIND_ORDER = [
  "MUSCLE_GROUP",
  "MOVEMENT_PATTERN",
  "TRAINING_GROUP",
  "CARDIO_ACTIVITY",
  "ROUTINE_FOCUS",
];

const KIND_LABELS = {
  MUSCLE_GROUP: "Muscle Group",
  MOVEMENT_PATTERN: "Movement Pattern",
  TRAINING_GROUP: "Training Group",
  CARDIO_ACTIVITY: "Cardio Activity",
  ROUTINE_FOCUS: "Routine Focus",
};

// Where each metadata kind is surfaced in the app
const KIND_USAGE = {
  MUSCLE_GROUP: "Exercise metadata · Coverage (Muscles tab) · Stimulus scoring · Progress/Groups",
  MOVEMENT_PATTERN: "Exercise metadata · Coverage (Patterns tab) · Progress/Groups",
  TRAINING_GROUP: "Routine metadata · Coverage (Sports tab) · Stimulus scoring · Goals (Group target)",
  CARDIO_ACTIVITY: "Cardio routine classification · Coverage (Sports tab) · Goals (Cardio target)",
  ROUTINE_FOCUS: "Routine metadata · tagging/filtering",
};

async function main() {
  console.log("Fetching exercises...");

  const exercises = await prisma.exercise.findMany({
    orderBy: [{ libraryKind: "asc" }, { name: "asc" }],
    include: {
      metadataGroups: {
        include: {
          group: { select: { slug: true, label: true, kind: true } },
        },
      },
    },
  });

  console.log(`Found ${exercises.length} exercises.`);

  // Fetch ALL metadata groups with full usage counts
  const allGroups = await prisma.metadataGroup.findMany({
    orderBy: [{ kind: "asc" }, { label: "asc" }],
    include: {
      exerciseAssignments: {
        include: {
          exercise: { select: { name: true, libraryKind: true } },
        },
      },
      routineAssignments: {
        include: {
          routine: { select: { name: true, kind: true, isDeleted: true } },
        },
      },
      sessionTemplateAssignments: {
        include: {
          template: { select: { name: true } },
        },
      },
    },
  });

  // Helper to collect labels for a given metadata kind
  function getGroupLabels(exercise, kind) {
    return exercise.metadataGroups
      .filter((mg) => mg.group.kind === kind)
      .map((mg) => mg.group.label)
      .sort()
      .join(", ");
  }

  const wb = XLSX.utils.book_new();

  // ── Sheet 1: All exercises ──────────────────────────────────────────────────
  const allRows = exercises.map((ex) => ({
    Name: ex.name,
    Category: LIBRARY_KIND_LABELS[ex.libraryKind] ?? ex.libraryKind,
    Unit: UNIT_LABELS[ex.unit] ?? ex.unit,
    "Supports Weight": ex.supportsWeight ? "Yes" : "No",
    "Muscle Groups": getGroupLabels(ex, "MUSCLE_GROUP"),
    "Movement Patterns": getGroupLabels(ex, "MOVEMENT_PATTERN"),
    "Training Groups": getGroupLabels(ex, "TRAINING_GROUP"),
  }));

  const wsAll = XLSX.utils.json_to_sheet(allRows);
  setColumnWidths(wsAll, [32, 14, 8, 14, 36, 36, 24]);
  XLSX.utils.book_append_sheet(wb, wsAll, "All Exercises");

  // ── Per-category sheets ─────────────────────────────────────────────────────
  const categories = ["STRENGTH", "CONDITIONING", "MOBILITY", "STRETCH", "BREATHWORK", "SKILL"];
  for (const kind of categories) {
    const filtered = exercises.filter((ex) => ex.libraryKind === kind);
    if (filtered.length === 0) continue;

    const rows = filtered.map((ex) => ({
      Name: ex.name,
      Unit: UNIT_LABELS[ex.unit] ?? ex.unit,
      "Supports Weight": ex.supportsWeight ? "Yes" : "No",
      "Muscle Groups": getGroupLabels(ex, "MUSCLE_GROUP"),
      "Movement Patterns": getGroupLabels(ex, "MOVEMENT_PATTERN"),
      "Training Groups": getGroupLabels(ex, "TRAINING_GROUP"),
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    setColumnWidths(ws, [32, 8, 14, 36, 36, 24]);
    XLSX.utils.book_append_sheet(wb, ws, LIBRARY_KIND_LABELS[kind]);
  }

  // ── Sheet: Metadata Key ─────────────────────────────────────────────────────
  // One row per metadata group. Shows all available options, their type,
  // where they are used in the app, and current assignment counts.
  console.log("Building metadata key sheet...");

  const keyRows = [];
  for (const kind of KIND_ORDER) {
    const groups = allGroups.filter((g) => g.kind === kind);
    for (const group of groups) {
      const activeRoutines = group.routineAssignments.filter((r) => !r.routine.isDeleted);
      const exerciseNames = group.exerciseAssignments
        .map((a) => a.exercise.name)
        .sort()
        .join(", ");
      const routineNames = activeRoutines
        .map((a) => a.routine.name)
        .sort()
        .join(", ");
      const templateNames = group.sessionTemplateAssignments
        .map((a) => a.template.name)
        .sort()
        .join(", ");

      keyRows.push({
        "Metadata Label": group.label,
        "Type": KIND_LABELS[kind] ?? kind,
        "Used In App For": KIND_USAGE[kind] ?? "",
        "Applies to Exercises": group.appliesToExercise ? "Yes" : "No",
        "Applies to Routines": group.appliesToRoutine ? "Yes" : "No",
        "# Exercises": group.exerciseAssignments.length,
        "# Routines": activeRoutines.length,
        "# Session Templates": group.sessionTemplateAssignments.length,
        "Assigned Exercises": exerciseNames,
        "Assigned Routines": routineNames,
        "Assigned Session Templates": templateNames,
      });
    }
  }

  const wsKey = XLSX.utils.json_to_sheet(keyRows);
  setColumnWidths(wsKey, [28, 18, 62, 20, 20, 12, 12, 18, 60, 60, 40]);
  XLSX.utils.book_append_sheet(wb, wsKey, "Metadata Key");

  // ── Sheet: By Metadata Group (exercise drill-down) ──────────────────────────
  const metaRows = [];
  for (const kind of KIND_ORDER) {
    const groups = allGroups.filter((g) => g.kind === kind && g.exerciseAssignments.length > 0);
    for (const group of groups) {
      const members = group.exerciseAssignments
        .slice()
        .sort((a, b) => a.exercise.name.localeCompare(b.exercise.name));
      for (const member of members) {
        metaRows.push({
          "Type": KIND_LABELS[kind] ?? kind,
          "Metadata Label": group.label,
          "Exercise Name": member.exercise.name,
          "Exercise Category": LIBRARY_KIND_LABELS[member.exercise.libraryKind] ?? member.exercise.libraryKind,
        });
      }
    }
  }

  if (metaRows.length > 0) {
    const wsMeta = XLSX.utils.json_to_sheet(metaRows);
    setColumnWidths(wsMeta, [18, 28, 32, 14]);
    XLSX.utils.book_append_sheet(wb, wsMeta, "By Metadata Group");
  }

  // ── Write file ──────────────────────────────────────────────────────────────
  const outDir = path.join(__dirname, "..", "exports");
  if (!existsSync(outDir)) await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, "exercises-export-v2.xlsx");
  XLSX.writeFile(wb, outPath);

  const usedCategories = categories.filter((k) => exercises.some((e) => e.libraryKind === k));
  console.log(`\nDone! Saved to: ${outPath}`);
  console.log(`  Sheets:`);
  console.log(`    All Exercises      — ${allRows.length} exercises`);
  for (const k of usedCategories) {
    const count = exercises.filter((e) => e.libraryKind === k).length;
    console.log(`    ${LIBRARY_KIND_LABELS[k].padEnd(18)} — ${count} exercises`);
  }
  console.log(`    Metadata Key       — ${keyRows.length} metadata groups`);
  console.log(`    By Metadata Group  — ${metaRows.length} exercise-group assignments`);
}

function setColumnWidths(ws, widths) {
  ws["!cols"] = widths.map((w) => ({ wch: w }));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
