# Performance Follow-ups

Deferred from the 2026-05-21 audit sweep. Both items have real wins
attached (200-500ms cold-load savings, 50-150ms per progress view, less
JSON shipped to clients) but require focused, careful PRs rather than
inline fixes during a broad polish pass.

---

## 1. Query-level caching (`unstable_cache` + `revalidateTag`)

### The problem

Every server-rendered page in `app/` declares `export const dynamic = "force-dynamic"`. That tells Next.js: never cache, always render fresh. For a single-user app hitting Supabase on every navigation, this is the slowest possible default — repeat visits to the dashboard, routine list, and progress views all re-run the same Prisma queries from cold.

### Why the simple "flip force-dynamic → revalidate: 60" doesn't work

Every page reads:

- The auth session cookie (via `lib/auth.ts` / `routineAccessWhere`)
- Dynamic `searchParams` (filters, modes, ids)

Next.js detects either and forces dynamic rendering regardless of what `revalidate` is set to. So removing `force-dynamic` is cosmetic — no speedup unless we also cache the underlying queries.

### What actually works: cache the queries, not the pages

Wrap slow Prisma queries in [`unstable_cache`](https://nextjs.org/docs/app/api-reference/functions/unstable_cache) with a tag, then call `revalidateTag` in the mutations that should bust them.

```ts
// Before
const routines = await prisma.routine.findMany({
  where: { isActive: true },
  include: { ... },
});

// After
const getActiveRoutines = unstable_cache(
  async () => prisma.routine.findMany({
    where: { isActive: true },
    include: { ... },
  }),
  ["active-routines"],         // cache key prefix
  { tags: ["routines"], revalidate: 300 }
);
const routines = await getActiveRoutines();
```

Then in each mutation that touches routines:

```ts
// Instead of (or in addition to) revalidatePath calls:
revalidateTag("routines");
```

### Risks to design around

- **Tag overreach.** Two queries sharing one tag = invalidating both even when you only need one. Get it wrong and you either over-invalidate (no win) or under-invalidate (stale UI bugs).
- **Cache key must include every input.** If a query depends on `userId` or `today`, those go in the cache key (`[userId, today]`). Bad keys silently leak data between users/days.
- **Cache survives deploys.** Schema changes can serve old shapes to new code. Either bump cache key versions on deploy or accept staleness window.
- **Hard to roll back.** Once entries exist, you wait them out or wipe manually.

### Suggested scope when we tackle this

Pick the 3-5 slowest, safest-to-cache queries and wrap each with a focused tag. Don't try to do the whole app at once.

Initial candidates (in priority order):
1. `getAllZonesWithState()` in `lib/body-zones.ts` — zones rarely change, this is run on every home page hit. Tag: `zone-states`. Bust on: pain log, zone activity, injury create/update.
2. `getRoutineIndex()` in `app/progress/data.ts` — already wrapped in React `cache()` for per-request dedup; promote to `unstable_cache` for cross-request. Tag: `routines`. Bust on: routine create/edit/delete, frequency goal mutations.
3. `getMovementPatternData()` in `app/_home/movement-patterns.ts` — heavy aggregation. Tag: `movement-patterns`. Bust on: any log create/edit/delete.
4. The routine + log fetch in `app/_home/data.ts:88-141` — the dashboard's biggest single fetch. Two tags: `routines` and `logs`.
5. `getMetadataIndex()` in `app/progress/data.ts` — static reference data, almost never changes.

For each: instrument with a simple timing log first to confirm the candidate is actually slow; pick a `revalidate` floor (probably 300-1800s); add `revalidateTag` calls to the matching mutation helpers; test that mutations show fresh data on the next page load.

### Estimated win

200-500ms saved on repeat visits to dashboard / routines / progress. Larger on flaky mobile networks where DB roundtrips dominate. Cold visits still pay full cost — this is a repeat-visit optimization.

---

## 2. `app/progress/data.ts` deep-include trim

### The problem

`getRoutineLogs` at [app/progress/data.ts:240](../app/progress/data.ts#L240) uses this Prisma include on every log row it returns:

```ts
include: {
  routine: {
    select: {
      ...routineScalarSelect,
      metadataGroups: { include: { group: true } },
      sessionDetails: {
        include: {
          template: {
            include: {
              metricDefinitions: { orderBy: { sortOrder: "asc" } },
              metadataGroups: { include: { group: true } },
            },
          },
        },
      },
      ...frequencyGoalInclude,
    },
  },
}
```

That nested chain hydrates the full session template structure for every log. A 12-week progress view with hundreds of logs pays for the same template metadata over and over.

### Why it's wasteful

Most consumers don't need most of the included fields:

- `summarizeRoutineLogs` reads `routine.timesPerWeek`, `routine.kind`, `log.totalDurationSec` — no template.
- `cardioPerformanceSeries`, `cardioWorkloadSeries`, `workoutSessionSeries`, `workoutWeeklySeries` — operate on log scalars + routine.kind.
- `coverage.ts` — uses `metadataGroups` (does need that part).
- `ExerciseTargetPage`, `RoutineTargetPage`, etc. — these probably do need `template.metricDefinitions` to render session metrics.

The include is sized for the heaviest consumer (detail pages) but charged to every list/chart view.

### Why it's risky to fix in a sweep

There are 8+ call sites and each touches a slightly different subset of `log.routine.*`. If a field gets trimmed away and one consumer silently accesses it, that page renders broken (`undefined` template, blank metric labels, sparkline collapses to zeros). TypeScript won't catch it because all the optional fields type as `undefined | T` — the surface is too forgiving.

### Plan

1. **Audit consumers.** Read each of these files top-to-bottom, list every `log.routine.X` field access:
   - `app/activities/page.tsx`
   - `app/progress/CardioIndexView.tsx`
   - `app/progress/ExercisesIndexView.tsx`
   - `app/progress/RoutinesIndexView.tsx`
   - `app/progress/ProgressOverviewContent.tsx`
   - `app/progress/coverage.ts`
   - `app/progress/details/*` (Cardio/Exercise/Group/Routine/Sports target pages)
   - `app/reports/weekly/page.tsx`
   - `app/routines/[id]/log/page.tsx`

2. **Split into two query helpers** in `app/progress/data.ts`:
   - `getRoutineLogsLight(range, filter?)` — `id, name, kind, domain, subtype, timesPerWeek, isActive` only. For series + summaries + index views.
   - `getRoutineLogsFull(range, filter?)` — current shape including template metric definitions. For detail pages.

3. **Migrate consumers one at a time.** After each swap, manually navigate the affected page in dev to confirm rendering survives. TypeScript will catch some access errors; runtime nullability bugs need eyes on the UI.

4. **Decide on the heavy include.** Once every list-view consumer is on the light version, the heavy include only matters for detail pages. Either keep both helpers, or fold the heavy variant into each detail page's own loader.

### Estimated win

50-150ms saved on `/progress` cold load. 5-20KB less JSON shipped to the client per page. Bigger improvement the longer the log history.

### Caveat

Worth doing alongside item #1 above — once queries are cacheable, the cost of over-fetch is paid once per cache window instead of per request, which may de-prioritize this. Run item #1's instrumentation first; if `getRoutineLogs` shows up as a hot path after caching lands, do this next.

---

## Out of scope here

For drift in the audit findings that turned out to be false positives (the `FrequencyGoal.isActive` index already exists, `progress.ts` vs `progress-v2.ts` are layered not duplicates, the three `frequency-*.ts` files have clean separation), see commit `15834c9` and the project memory file `project_frequency_refactor_followups.md`.
