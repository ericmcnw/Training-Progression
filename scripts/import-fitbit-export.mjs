// Backfills DailyMetric from a Fitbit data export.
//
//   node scripts/import-fitbit-export.mjs <export-dir>            # dry run
//   node scripts/import-fitbit-export.mjs <export-dir> --commit   # write
//
// Takes the unzipped export directory and walks it recursively, so it doesn't
// matter whether it came from Google Takeout or the legacy fitbit.com export —
// the layouts differ between vintages but the filenames don't.
//
// Writes source="fitbit", which per the schema comment outranks a hand-typed
// row for the same day. Dry run by default because this overwrites.

import "dotenv/config";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, basename } from "node:path";
import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();

const root = process.argv[2];
const COMMIT = process.argv.includes("--commit");
if (!root) {
  console.error("usage: node scripts/import-fitbit-export.mjs <export-dir> [--commit]");
  process.exit(1);
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const header = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map((line) => {
    const cells = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    return Object.fromEntries(header.map((h, i) => [h, cells[i]]));
  });
}

/** Fitbit dates appear as "2026-08-15", "08/15/26 00:00:00", and ISO stamps
 *  depending on the file. Normalize everything to YYYY-MM-DD. */
function toYmd(value) {
  if (!value) return null;
  const s = String(value).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{2})/);
  if (m) return `20${m[3]}-${m[1]}-${m[2]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${String(m[1]).padStart(2, "0")}-${String(m[2]).padStart(2, "0")}`;
  return null;
}

const days = new Map(); // ymd -> { sleepMinutes, sleepScore, steps, distanceMi }
const logIdToYmd = new Map();
const unknown = [];

function bump(ymd, key, value) {
  if (!ymd || value == null || !Number.isFinite(value)) return;
  const row = days.get(ymd) ?? { sleepMinutes: null, sleepScore: null, steps: null, distanceMi: null };
  // Steps/distance files can be minute-level; sum them. Sleep is per night.
  row[key] = key === "steps" || key === "distanceMi" ? (row[key] ?? 0) + value : value;
  days.set(ymd, row);
}

const files = walk(root);
console.log(`scanning ${files.length} files under ${root}\n`);

const counts = { sleep: 0, sleepScore: 0, steps: 0, distance: 0 };

for (const file of files) {
  const name = basename(file).toLowerCase();

  if (name.startsWith("sleep_score") && name.endsWith(".csv")) {
    for (const row of parseCsv(readFileSync(file, "utf8"))) {
      const score = Number(row.overall_score);
      if (!Number.isFinite(score)) continue;
      // Prefer joining by log id (exact); fall back to the timestamp's date.
      const ymd = logIdToYmd.get(String(row.sleep_log_entry_id)) ?? toYmd(row.timestamp);
      bump(ymd, "sleepScore", score);
      counts.sleepScore++;
    }
    continue;
  }

  if (!name.endsWith(".json")) continue;
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    continue;
  }
  const rows = Array.isArray(parsed) ? parsed : [parsed];
  if (rows.length === 0) continue;

  if (name.startsWith("sleep")) {
    for (const row of rows) {
      const ymd = toYmd(row.dateOfSleep ?? row.startTime);
      if (!ymd) continue;
      if (row.logId != null) logIdToYmd.set(String(row.logId), ymd);
      // Naps are separate entries; only the main sleep is the night.
      if (row.mainSleep === false) continue;
      const minutes = Number(row.minutesAsleep);
      if (Number.isFinite(minutes)) {
        bump(ymd, "sleepMinutes", minutes);
        counts.sleep++;
      }
    }
    continue;
  }

  if (name.startsWith("steps")) {
    for (const row of rows) {
      const ymd = toYmd(row.dateTime);
      const value = Number(row.value);
      if (ymd && Number.isFinite(value)) {
        bump(ymd, "steps", value);
        counts.steps++;
      }
    }
    continue;
  }

  if (name.startsWith("distance")) {
    for (const row of rows) {
      const ymd = toYmd(row.dateTime);
      // Fitbit distance JSON is in centimeters.
      const value = Number(row.value);
      if (ymd && Number.isFinite(value)) {
        bump(ymd, "distanceMi", value / 160934.4);
        counts.distance++;
      }
    }
    continue;
  }

  // Record anything unrecognized so a first dry run tells us what's in there.
  if (unknown.length < 12) unknown.push({ file: basename(file), keys: Object.keys(rows[0] ?? {}).slice(0, 8) });
}

console.log(
  `parsed rows — sleep:${counts.sleep}  sleepScore:${counts.sleepScore}  steps:${counts.steps}  distance:${counts.distance}`
);

const ordered = [...days.entries()].sort(([a], [b]) => a.localeCompare(b)).filter(([, v]) => v.sleepMinutes != null);
console.log(`days with sleep: ${ordered.length}`);
if (ordered.length > 0) {
  console.log(`range: ${ordered[0][0]} .. ${ordered[ordered.length - 1][0]}`);
  console.log("\nsample (last 7):");
  for (const [ymd, v] of ordered.slice(-7)) {
    const h = v.sleepMinutes != null ? `${Math.floor(v.sleepMinutes / 60)}h ${String(v.sleepMinutes % 60).padStart(2, "0")}m` : "—";
    console.log(`  ${ymd}  ${h.padEnd(9)} score=${v.sleepScore ?? "—"}  steps=${v.steps ?? "—"}  mi=${v.distanceMi ? v.distanceMi.toFixed(2) : "—"}`);
  }
}

if (unknown.length > 0) {
  console.log("\nunrecognized JSON files (first keys), in case something useful is in here:");
  for (const u of unknown) console.log(`  ${u.file}  [${u.keys.join(", ")}]`);
}

if (!COMMIT) {
  console.log("\nDRY RUN — nothing written. Re-run with --commit to write.");
  await prisma.$disconnect();
  process.exit(0);
}

let created = 0;
let updated = 0;
for (const [ymd, v] of ordered) {
  const day = new Date(`${ymd}T00:00:00.000Z`);
  const existing = await prisma.dailyMetric.findUnique({
    where: { profileKey_day: { profileKey: "default", day } },
    select: { id: true },
  });
  const data = {
    sleepMinutes: v.sleepMinutes,
    sleepScore: v.sleepScore,
    steps: v.steps != null ? Math.round(v.steps) : null,
    distanceMi: v.distanceMi != null ? Math.round(v.distanceMi * 100) / 100 : null,
    source: "fitbit",
  };
  if (existing) {
    await prisma.dailyMetric.update({ where: { id: existing.id }, data });
    updated++;
  } else {
    await prisma.dailyMetric.create({ data: { profileKey: "default", day, ...data } });
    created++;
  }
}
console.log(`\nwrote ${created} new days, updated ${updated}`);

await prisma.$disconnect();
