# Auth Migration Hit-List

The concrete, file-level inventory behind Phase 2 ("Ownership model") of
[auth-implementation-checklist.md](./auth-implementation-checklist.md). Generated
from a full sweep of every Prisma call site (2026-06-16).

**Current state:** the app is single-user. No Prisma model has a `userId`
column, and almost no query is scoped by session. The auth seam already exists
in `lib/auth.ts` (`getAppSession`, `scopeOwnedWhere`, `requireAuthenticatedUser`,
`routineAccessWhere`) but only 3 runtime files use it.

**Scale:** ~511 Prisma call sites across 86 files; ~360 hit owned data; ~135 are
owned-data mutations; ~20 are raw SQL; ~25 are `$transaction` blocks.

The one already-correct example to copy: `app/api/routines/[id]/log-data/route.ts`
uses `routineAccessWhere(id)`.

---

## 0. Decisions to make first (block the migration)

- [ ] **`Exercise` — global catalog or per-user?** Users can create/edit/rename
  exercises (`app/exercises/actions.ts`, `app/routines/[id]/template/actions.ts`).
  If it stays global, those writes are edits to shared data; if per-user, the
  model flips to OWNED. Decide before adding columns.
- [ ] **`UserActivityTypePreference`** — keyed only by `activityTypeId`
  (`@unique`) today. Treat as OWNED; the unique constraint becomes
  `(userId, activityTypeId)`.

## 1. Schema — add ownership

Add `userId` to the **parent** owned tables; children inherit ownership via
cascade FKs and get scoped through their parent.

- [ ] Add `User` model (or map to Supabase `auth.users` id).
- [ ] Add nullable `userId` + index to: `Routine`, `RoutineLog`, `Goal`,
  `FrequencyGoal`, `Rotation`, `SchedulePlan`, `ScheduleManualEntry`,
  `ClimbLocation`, `ClimbProblem`, `ClimbMedia`, `ActivitySpot`, `ActiveInjury`,
  `PainLog`, `ZoneActivity`, `AppProfile`, `DayTodo`,
  `UserActivityTypePreference`.
- [ ] Backfill all existing rows to one bootstrap account.
- [ ] Leave GLOBAL/reference tables unscoped: `ActivityType`, `EnduranceFamily`,
  `SessionTemplate`, `SessionMetricDefinition`, `Exercise` (pending decision),
  `MetadataGroup` + relations, `StimulusCategory`, `BodyZone`.
- [ ] Make `userId` required after reads/writes are clean.

## 2. Top-priority surfaces (worst leak / cross-tenant-write risk — do first)

- [ ] **`app/profile/export/route.ts`** — unauthenticated GET, full-DB JSON dump
  (8 `findMany`). Gate with `requireAuthenticatedUser()` + scope every query.
- [ ] **`app/schedule/actions.ts`** — ~14 raw `$executeRawUnsafe` writes across
  all schedule tables. Raw SQL gets NO automatic scoping — add explicit
  `WHERE "userId" = $n` to every statement.
- [ ] **`app/api/climb-problems/[id]/route.ts`** — PATCH (line 50) + GET (10),
  reachable by id, no session check.
- [ ] **`app/routines/actions.ts`** — ~75 owned mutations incl. all log
  create/update/delete. The `findUnique`-by-id-then-mutate paths (2727, 2820,
  2876, 2930, 3197, 1215, 1333) must verify ownership.
- [ ] **`app/activities/climbing/locations/[id]/actions.ts`** — merge/delete
  `$transaction` (135) sweeps updateMany/delete across RoutineLog, ClimbMedia,
  ClimbProblem, ClimbArea, ClimbAttempt, ClimbLocation.
- [ ] **Other unauthenticated owned-data GET routes:** `app/api/spots/recent/route.ts`,
  `app/api/climb-areas/route.ts`, `app/api/climb-problems/route.ts`,
  `app/api/routine-form-data/route.ts`, `app/api/quick-log-data/route.ts`.

## 3. Raw SQL (no auto-scoping — hand-edit each)

- [ ] `app/schedule/actions.ts` — INSERT/UPDATE/DELETE + SELECT validation
  (lines 57,64,89,95,116,122,129,162,186,199,201,249,267,269).
- [ ] `app/_home/data.ts` — schedule-join `$queryRawUnsafe` (169,172).
- [ ] `app/plan/month/data.ts` — schedule-join `$queryRawUnsafe` (191,194).

## 4. Server actions — mutations (scope writes + verify ownership on reads)

- [ ] `app/routines/actions.ts` (~75 owned mutations, 11 `$transaction`)
- [ ] `app/log/sport-actions.ts` (RoutineLog create/update, ActivitySpot create)
- [ ] `app/log/golf-log-actions.ts` (RoutineLog create/update, ActivitySpot create)
- [ ] `app/goals/actions.ts` (Goal + FrequencyGoal create/update/delete, 2 tx)
- [ ] `app/injuries/actions.ts` (ActiveInjury + InjuryZone, 1 tx)
- [ ] `app/body/actions.ts` (PainLog, ZoneActivity)
- [ ] `app/plan/cycles/rotation-actions.ts` (Rotation/RotationSlot/Coverage)
- [ ] `app/activities/climbing/media/actions.ts` (ClimbMedia CRUD, reorder tx)
- [ ] `app/activities/climbing/map/actions.ts` + `app/activities/[slug]/map/actions.ts` (pins)
- [ ] `app/activities/climbing/climbs/actions.ts` (ClimbArea, ClimbAttempt)
- [ ] `app/activities/sports/support-actions.ts` (Routine.update)
- [ ] `app/activities/endurance/settings/actions.ts` (UserActivityTypePreference, Routine)
- [ ] `app/_home/schedule-actions.ts` (ScheduleManualEntry.create)
- [ ] `app/components/dashboard/day-todo-actions.ts` (DayTodo CRUD)
- [ ] `app/routines/[id]/guided/actions.ts` (GuidedStep + metadata, 3 tx)
- [ ] `app/routines/[id]/template/actions.ts` (RoutineExercise + Exercise variant, 6 tx)
- [ ] `app/manual-log/actions.ts` (AppProfile.update — already profile-scoped)
- [ ] `lib/synthetic-sport-routines.ts` (Routine upsert/update — per-user synthetic routine)

## 5. Read layer — thread a session/userId param through

These shared `lib/` loaders feed many pages and currently take no session:

- [ ] `lib/goals.ts` (~30 owned reads — largest)
- [ ] `lib/recommendations.ts` (Routine, RoutineLog, InjuryZone)
- [ ] `lib/rotation.ts` (Rotation, Routine, RoutineLog)
- [ ] `lib/profile-stats.ts` (RoutineLog, ClimbAttempt, SetEntry)
- [ ] `lib/frequency-consistency.ts`, `lib/routine-frequency-context.ts`
- [ ] `lib/injury-warnings.ts` (InjuryZone, Routine)
- [ ] `lib/log-edit-data.ts`, `lib/log-summary.ts`
- [ ] `lib/activities/{endurance-chart,endurance-pace,sports-chart}.ts`
- [ ] `lib/activity-goals.ts`, `lib/all-spots.ts`, `lib/body-zones.ts`

Page/component reads that call the above or query directly (lower risk than
mutations, but still cross-tenant leaks): `app/_home/data.ts`, `app/progress/*`,
`app/manual-log/*` (note: `ManualLogPageContent` already fetches `getAppSession()`
but doesn't use it to scope), `app/reports/weekly`, `app/routines/*`,
`app/activities/**`, `app/plan/**`, `app/goals/*`, `app/injuries/*`,
`app/body/*`, `app/exercises/details/*`.

## 6. Sequencing

1. Resolve §0 decisions.
2. §1 schema + backfill.
3. §2 top-priority surfaces (export route, schedule raw SQL, climb-problems PATCH).
4. Wrap remaining route handlers + server actions with `requireAuthenticatedUser()`.
5. Push `scopeOwnedWhere(…, userId)` into parent reads/writes; thread session
   into the §5 `lib/` helpers.
6. Hand-edit §3 raw SQL.
7. Flip `userId` to required; run the §2/§3 surfaces through an isolation smoke test.
