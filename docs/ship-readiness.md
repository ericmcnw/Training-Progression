# Ship-Readiness Audit

Status checklist for getting Progression-Tracker from "works for me" to "proud to hand a friend." Compiled 2026-06-30 from a multi-agent audit pass. File:line refs are starting points, not gospel — verify before editing.

Legend: 🔴 blocks sharing · 🟠 friend hits a wall/blank · 🟡 looks unfinished/confusing · ⚪ cleanup

---

## P0 — Multi-user (the real blocker to sharing) 🔴

Auth is fully scaffolded but **OFF by default**, and there are no `userId` columns — so today **every visitor shares one global dataset**. This is the honest answer to "is it per-user ready": no. Three things must land together:

- [ ] Set `PROGRESSION_AUTH_MODE=authenticated` (defaults to `single-user-dev` in `lib/auth-paths.ts:14`)
- [ ] Add `userId` columns + backfill + wire `scopeOwnedWhere` across the ~360 owned-data query sites (`docs/auth-migration-hit-list.md`)
- [ ] Make `middleware.ts` actually redirect unauthenticated requests to `/signin` (helpers exist in `lib/auth-paths.ts`, not called)
- [ ] Reconcile the parallel `profileKey` ownership scheme (BackpackingTrip/DaySpan/LocationPing) with `userId`

Scaffolding already present: Supabase magic-link (`app/signin/`), session middleware, the `lib/auth.ts` seam. This is "finish the wiring," not greenfield.

---

## P1 — Robustness: friend hits a wall or silent failure 🟠

- [x] **Export route gated** — `app/profile/export/route.ts` now 401s unauthenticated requests once auth is on (was an unauthenticated full-DB dump).
- [x] **Error boundaries added** — `app/log/error.tsx`, `app/activities/error.tsx`, `app/global-error.tsx`, `app/not-found.tsx`. (Existing: root, routines, goals, schedule, body.)
- [ ] **Swallowed save errors** — `WorkoutExerciseEditor.tsx:536` (backs BOTH strength-log forms) has try/finally, no catch → failed save shows nothing. Same: `CompletionLogForm`, `schedule/ScheduleBoard.tsx:358`, `CycleBuilder.tsx:178`. Copy the `useTransition`+`setError` pattern from ClimbLogSheet/GolfLogSheet.
- [ ] **`alert()`-based feedback** (~18 sites: SessionLogForm, log-cardio/ui, log-guided, Edit*LogForm, CompletionLogForm) → replace with inline `errorText` like the sport sheets.
- [ ] **README is stock boilerplate** — a friend who self-deploys without running the seed gets an empty exercise library. Write real setup docs (`prisma migrate deploy` + `npm run db:seed`) or a bootstrap script.
- [ ] **Hard deletes (no recovery)** — RoutineLog/ActiveInjury/PainLog/Goal/FrequencyGoal are `prisma.*.delete()`'d (`actions.ts:3258`, `injuries/actions.ts:183`, `body/actions.ts:144`, `goals/actions.ts:311`, `plan/cycles/rotation-actions.ts:24`). Needs `isDeleted` columns + read-filters across the RoutineLog hub — its own careful PR (migration + wide read-filter blast radius), not a hot-fix.
- [ ] **Weather fetch has no timeout** (`lib/weather.ts:121`) — a hung Open-Meteo socket blocks the save's `await`. Add an `AbortSignal` timeout.
- [ ] **No `map.on("error")`** anywhere (ClimbingMapView/GlobalMapView/SpotMapView) — tile/style failure = blank map.

---

## P2 — Captured-but-not-represented data (the standout theme) 🟡

You log rich data and the app silently drops it after save. Single biggest "pride" gap. The render funnel is `RoutineLogSummary.tsx` ← `lib/log-summary.ts` — if a field isn't pulled/rendered there, it's invisible.

| Stored field | Captured where | Shown? | Should appear |
|---|---|---|---|
| **`effort` (RPE 1–10)** | every sport/cardio sheet (EffortSlider) | **NOWHERE** | log summary, session rows, weekly report, an effort-trend chart |
| Activity `tags` + `bodyParts` | `activity-actions.ts:74` | no | log summary (falls through `parseSportData` to generic → hidden) |
| **`ClimbAttempt.triesCount`** | ClimbLogSheet | **NOWHERE** (write-only) | attempt rows; "tries-to-send" stat (CLAUDE §8 first-class) |
| `ClimbAttempt.discipline` | log form | not as a label | climb rows (boulder vs rope ambiguity) |
| Golf per-hole `notes` | GolfLogSheet:477 | no | GolfCoursePanel |
| `PainLog.aggravatingFactors` / `notes` / `context` | pain log | only on injury detail; **not on `/body/[slug]`** (chart-only dead-end, no legend) | zone detail entry list |
| `ZoneActivity.notes` | `body/actions.ts:179` | no | body zone detail |
| `ActiveInjury.resolvedAt` | editable | no | injury detail (resolved date + duration) |
| `FrequencyGoal.weekdayMask` + substitutes + trigger rules | GoalForm | **NOWHERE on live list/detail** | GoalRow meta + detail |
| `SessionLogMetricValue` + `showInProgress` | full capture path | **read NOWHERE** | per-template metric progress charts |
| `RoutineLog.weather` | per-log | nowhere | session rows, weekly report |
| `intervalsConfig` | interval runs | nowhere | endurance session detail |
| `sportData` golf scores/clubs | golf | not charted | sport stats; score/handicap trend |
| Exercise volume (Σ reps×wt) + e1RM | computable | not on exercise detail | the two most-expected strength metrics |
| `BackpackingTrip.effort` | sheet:449 | no | BackpackingPanel (trivial) |

---

## P3 — Dead code to delete ⚪

Confirmed orphaned (zero importers):
- [ ] `app/activities/ui.tsx` (~280 lines: ActivitiesShell/FamilySection/ActivityCard)
- [ ] `app/schedule/*` UI tree (ScheduleWorkspace/Board/CycleBuilder/HabitsBlock + `schedule/actions.ts` all raw SQL) — keep the redirect; drop dead CSS `globals.css:1288-1289`
- [ ] `app/goals/GoalsPageContent.tsx`, `FrequencyGoalsSection.tsx`, `FrequencyGoalRow.tsx` (~600 lines; live surface is `app/plan/goals/*`)
- [ ] `app/WeeklyMomentumSectionClient.tsx` + `WeeklyMomentumSectionBoundary.tsx`
- [ ] `app/components/injuries/QuickInjuryPainLog.tsx` (superseded by PainLogSheet)
- [ ] `app/routines/.../ClimbingGradeRowsEditor.tsx` + its dead filter in `SessionMetricFields.tsx:20`
- [ ] `app/reports/mockup/` (hardcoded sample page)
- [ ] `vercel-deploy.log` (committed build log — gitignore + remove)
- [ ] Half-abandoned SchedulePlan/cycle READ path (`plan/month/data.ts:191` raw SQL) feeds an always-0 "Cycles" stat the user can't create — remove or finish

---

## P4 — Polish & understandability 🟡

- [ ] **Two clashing card systems** side-by-side on Home (`tokens.ts:76` solid vs `CollapsibleSection.tsx:85` faint); Activities pages disagree on width (760 vs 1120). Unify.
- [ ] **Unexplained jargon, no tooltips:** "Load"/"Magnitude" (effort×duration, never defined), "Domain volume", FLASH/ONSIGHT/SEND/PROJECT, grade systems (V vs YDS unlabeled), movement-pattern "lacking/absent". Add tooltips/legends.
- [ ] **Debug-looking copy:** `Target Frequency: 3 logs/week [1/3 this week]` (`RoutineCard.tsx:133`); pipe-delimited `"Pull Day | session | 3× per week"` (`goals.ts:882`). "Streak broken" in red contradicts the gentle-habit-lens preference.
- [ ] **Weak/missing empty states:** Routines list (primary destination, no first-run hero), Last-7-days strip (`0 / — / —`), home empty states HIDE the "+ Log pain"/"+ Add" CTAs.
- [ ] **Inert Units toggle** (`ProfileSettings.tsx:71`) — friends tap, nothing happens. Hide or wire.
- [ ] **Body map hardcoded male** (`body-map/types.ts:42`) — female art exists, never selected. A non-male friend can't get a correct map.
- [ ] **Multi-zone injury bug** (`LogPainButton.tsx:60`) — always logs against `zones[0]`; can't log pain on the 2nd zone of a multi-zone injury.
- [ ] **Scheduling vocabulary collision** — Cycle (dead) vs Rotation (live) vs Slot vs Coverage. Collapse to one.
- [ ] **iOS focus-zoom (`fontSize < 16`, CLAUDE §3a):** SpotPicker (shared → every sport), InjuryForm, PainLogForm, SessionMetricFields, ClimbSessionLogger, GuidedReviewForm. Spread `inputStyle`.
- [ ] **Profile name/avatar placeholders** ("Your Training", 🏔) — no editing UI.
- [ ] **Sport dashboards generic** — every non-climbing sport shows "More {sport} metrics land here…"; climbing alone is deep.

---

## P5 — Inefficiencies ⚪

- [ ] **Routines loader: 3 overlapping full-table log scans** incl. an unscoped `groupBy` over ALL RoutineLog (`RoutinesPageContent.tsx:180`). Collapse to one windowed fetch.
- [ ] **Endurance triple-fetches logs**; `[slug]/page.tsx:125` loads the full log table to filter in JS. Mobility/lifestyle do unbounded `findMany` (no `take`).
- [ ] **`getRoutineLogs` over-fetches** (its own TODO `data.ts:41`) — heavy include hydrated for every caller.
- [ ] **Shared-helper extractions** (duplicated & diverging): `niceAxisMax` (×3, one has a `7.5` bucket the others don't → inconsistent axes), `formatDuration` (×3+), `withAlpha`/accent string-replace (×4, each fragile to a different rgba format), the `getWeekBoundsSunday` 12-week index loop (×4), `spotParamsFor*`/`resolveActivitySpot` (×6), golf `sportData` builder duplicated in create vs update.
- [ ] **Color palette triplicated** (`sport-accent.ts`, `sports-chart.ts:40`, slug path) — import one source.
- [ ] **`isMissingExerciseLibraryKindError` compat shim repeated 6+×** for a column that exists (violates CLAUDE §10).

---

## Done
- Export route auth-gated (`app/profile/export/route.ts`).
- Error/not-found boundaries: `app/log/error.tsx`, `app/activities/error.tsx`, `app/global-error.tsx`, `app/not-found.tsx`.
- Effort made sport-only (removed from session create/edit forms) + surfaced on sport session graphs (sports overview / per-sport / climbing).
- Cycles system fully removed (dead `app/schedule/*` UI + `_home`/`plan/month` loader read-paths + "Cycles" stat).
- Orphans deleted: WeeklyMomentum, `app/activities/ui.tsx`, QuickInjuryPainLog, ClimbingGradeRowsEditor, `/reports/mockup`, `vercel-deploy.log`, and the goals trio (GoalsPageContent / FrequencyGoalsSection / FrequencyGoalRow — trigger chip harvested first).
- **P2 pain:** `/body/[slug]` now shows a context legend + per-entry list (level, context, aggravating-factor chips, notes).
- **P2 frequency-goals:** live goal row shows a "+N triggers" chip (harvested); detail page shows a "Days" row (weekday mask) — minimal, no noise.
- **P1 robustness:** `WorkoutExerciseEditor` save failures now surface an inline error + preserve the draft (was a silent reset on both strength-log forms).
