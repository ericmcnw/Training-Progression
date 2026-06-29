# Profile & Reports — Design Plan

Status: **planning** (no code yet). Owner: Eric. Drafted 2026-06-29.

Decisions locked with the user:
- Reports become a **navigable `/reports/[period]` hub** (week/month/year, page backward through time).
- Reports are **fully evaluative + per-sport drill-down** (descriptive + vs-goals + trend + per-discipline detail).
- Settings stays reachable **from the profile** via a button → popup or its own page (exact chrome TBD; possibly a frozen-header entry later).
- Plan thoroughly before building.

---

## 1. North star

Three distinct jobs, three distinct surfaces:

| Surface | Question it answers | Route |
|---|---|---|
| **Profile** | "Who am I / what's my lifetime shape / what's my pulse right now?" | `/profile` |
| **Reports** | "How am I doing over *this* period, vs my goals and vs before?" | `/reports/week`, `/reports/month`, `/reports/year` |
| **History** | "What exactly did I log?" | `/profile?view=history` (unchanged) |
| **Settings** | "Configure my account/units/spots/data" | button from profile → modal or `/profile/settings` |

Today all four are fused onto one `/profile` scroll (see §2). The work is to **split Reports out into a navigable hub, make it evaluative, and slim the profile back to identity + a glance.**

---

## 2. Current state (what we're starting from)

`/profile` → renders `app/manual-log/ManualLogPageContent.tsx`, toggled by `?view=`:

- **Profile view:** `ProfileHeader` (lifetime KPIs + domain split) → quick-nav → 3 summary cards → `ProfileMilestones` (personal bests) → **`WeeklySummary` + `MonthlySummary` + `YearlySummary` (all inlined, always "current period")** → Recent Activity (5) → `ProfileSettings`.
- **History view:** month calendar + domain filter + 500-log feed.

`/reports/weekly` → a **separate, older** report (`app/reports/weekly/page.tsx`): fixed Sun–Sat week, prev/next nav, dense per-day log list. Linked from profile nav.

### Problems this plan resolves
1. **Two conflicting "weeks":** `WeeklySummary` = rolling trailing-7-days, not navigable. `/reports/weekly` = calendar Sun–Sat, navigable. Same word, different math.
2. **Month/year not navigable:** they only ever show the *current* month/year — no way to page back.
3. **Reports are descriptive only:** counts/time/distance/domain-split. No "was it enough" (goals), no "which way am I trending."
4. **Domain-flat, sport-blind:** everything collapses to 5 domains; climbing grades, running pace/mileage, strength PRs never surface. Summed `distanceMi` across swim+bike+run is semantically muddy.
5. **Profile does four jobs on one scroll**, with settings buried under the yearly heatmap.

### Assets we keep / reuse
- The three summary modules are well-built (pure CSS/SVG). Their *visual* design carries forward; what changes is *where they live*, *what window they use*, and *what content they gain*.
- `lib/profile-summary.ts` helpers: `currentDailyStreak`, `longestDailyStreak`, `trailingYmds`, `ymdWeekday`, `PROFILE_DOMAIN_*`.
- `lib/progress-v2.ts`: `weekKey`, `fillWeeklySeries`, `trendLabel`, `countGoalMetWeeks`, `incrementWeekMap` (currently under-used).
- `lib/dates.ts`: `getWeekBoundsSunday`, `getAppDayRange`, `toAppYmd`, `addDaysYmd`, `diffYmdDays`.

---

## 3. The period model (the rule that unifies everything)

**Rolling = dashboard pulse. Calendar = report.**

- **Profile** keeps exactly one rolling glance: "Last 7 days" pulse (sessions, time, a 7-dot rhythm, streak). Glance-only, not navigable.
- **Reports** are strictly **calendar** periods, each navigable:
  - **Week** = Sun–Sat (`getWeekBoundsSunday`), `?week=YYYY-MM-DD` (the Sunday).
  - **Month** = calendar month, `?month=YYYY-MM`.
  - **Year** = calendar year, `?year=YYYY`.
- All periods clamp to "no future navigation past the current period." First period = first-ever log (disable "prev" before it).
- `/reports/weekly` (the old route) is **replaced** by `/reports/week` and redirected.

This single rule kills problem #1 and #2.

---

## 4. Reports hub architecture

### Routes
```
/reports                 → redirect to /reports/week (current week)
/reports/week?week=YYYY-MM-DD
/reports/month?month=YYYY-MM
/reports/year?year=YYYY
```
Shared chrome: a `ReportShell` with (a) period-type tabs (Week | Month | Year), (b) a prev/◀ [period label] ▶/next stepper, (c) "jump to current" when not on the current period. Tabs preserve the anchor where sensible (clicking Month from a given week lands on that week's month).

### The three-question framework (every period answers all three)
1. **What did I do** — the descriptive layer we already have (KPIs, rhythm/heatmap, domain composition, top routines, highlights/records). Carried over from the existing modules.
2. **Was it enough** — the *evaluative* layer (new): for each active `Goal` and `FrequencyGoal` whose window overlaps this period, show hit/missed/progress. (§6)
3. **Which way am I trending** — the *comparative* layer (new): this period vs the previous comparable period (Δ sessions, Δ time, Δ distance, Δ load) + `trendLabel`. (§6)

### Per-period content

**Week (`/reports/week`)**
- KPI strip: sessions, time, distance*, load (from `sessionLoad`), streak. (*distance shown per-family on expand, not blindly summed — see §5 note.)
- 7-day rhythm (Sun–Sat) — the existing `WeeklySummary` day cards.
- By-domain stacked bar + legend.
- **Goals/frequency for the week** (new): each frequency goal's `status` for *this* week; each volume/perf goal's progress.
- **vs last week** (new): compact delta row.
- **Drill-downs** (new, §5): per active domain, an expandable detail — climbing grades, running pace/mileage, strength volume/PRs.
- Highlights (existing).
- Day-by-day log list (port the good per-day grouping from old `/reports/weekly`, with edit links).

**Month (`/reports/month`)**
- KPI strip: sessions, time, distance, active days (X/elapsed).
- Calendar heatmap (existing `MonthlySummary`).
- Domain composition + top-routines leaderboard (existing).
- Goals/frequency for the month + vs last month (new).
- Drill-downs (new).

**Year (`/reports/year`)**
- KPI strip + GitHub-style year heatmap + monthly trend bars + records (existing `YearlySummary`).
- Best/worst month, longest streak, biggest PRs of the year (extend existing records).
- Per-sport year-in-review drill-downs (new): grades pyramid for the year, total mileage by family, total volume, etc.

---

## 5. Per-sport / per-discipline drill-down (the main technical lift)

### The blocker
The existing rich loaders are **hardcoded to a rolling 12-week window** and cannot answer "March 2026" or "2025":
- `lib/activities/sports-chart.ts` → `loadSportsChartData(now?)` — 12w cutoff at line ~60.
- `lib/activities/endurance-chart.ts` → `loadEnduranceChartData(input?)` — 12w cutoff at line ~46.
- `lib/activities/strength-chart.ts` → `buildStrengthChartData(stats, now?)` — 12w cutoff at line ~47.
- `lib/activities/endurance-pace.ts` → `loadEndurancePaceChart(input)` — 12w cutoff at line ~73.

The ones that are **already window-agnostic** (the pattern to follow):
- `lib/climb-stats.ts` → `buildPyramidRows(attempts)` — pure aggregation, caller pre-filters. ✅
- `lib/activities/climbing-chart.ts` → `buildClimbingChartData(sessions, {weeks})` — accepts a window. ✅

### The approach
**Separate fetch from aggregation.** Refactor each window-bound loader into:
- a thin DB-fetch that accepts an explicit `{ start: Date; end: Date }` (or pre-fetched logs), and
- a pure aggregator over the returned rows (mirrors `buildPyramidRows` / `computeFrequencyState`).

Then the report passes its calendar window in, and the rolling-12w "activity world" pages keep working by passing their existing cutoff. **No behavior change for existing pages — additive only** (CLAUDE.md rule 2, rule 4).

Concretely, introduce a shared report aggregation module:
```
lib/reports/
  period.ts        // PeriodKey + bounds: week/month/year → {start,end,label,prev,next,isCurrent}
  load.ts          // loadReportLogs({start,end}) → enriched logs (domain, activityType, sportData, climbAttempts, sets)
  domain.ts        // domain composition, KPIs, rhythm/heatmap buckets (period-agnostic)
  drilldown.ts     // per-domain detail builders that call the refactored aggregators
  evaluate.ts      // goals + frequency status for a given window (wraps existing fns)
  compare.ts       // this-period vs previous-period deltas + trendLabel
```

### Drill-down content by domain
- **Climbing** → `buildPyramidRows(attempts in window)` grade pyramid + sends by discipline + hardest send. (Already pure — just pre-filter `ClimbAttempt` by `performedAt`.)
- **Endurance** → mileage by family (no cross-family sum), pace trend (refactor `endurance-pace` to a window), longest run, elevation. Respect `hasPace`/`hasDistance` per activity type.
- **Strength** → total volume, top exercises by volume, any new MAX_WEIGHT PRs in window (compare to prior best via `SetEntry`).
- **Sport (other)** → session count + the `sportData` summaries we already render elsewhere (e.g. golf scorecard rollup, tennis/spikeball W–L via the `SportPeopleStats` extraction logic).
- **Mobility / lifestyle** → session count + frequency-goal adherence (these are habit-shaped).

**Distance note:** never sum `distanceMi` across families in a headline KPI. Show a single "distance" KPI only when one family dominates, else break it out in the endurance drill-down. (profile-stats.ts already acknowledges this for milestones.)

---

## 6. Evaluative + comparative layers (reuse map)

All of this already exists and is date-flexible — we wrap, we don't rebuild (CLAUDE.md rule 2):

| Need | Reuse | Notes |
|---|---|---|
| Frequency goal status for a period | `getFrequencyGoalProgress({goal, logs, now})` (`lib/frequency-goals.ts`) | Pass `now` = end of the report period. Returns `status: behind/on_track/ahead`, counts, labels. |
| Per-day done/covered/miss + streaks | `computeFrequencyState({target, logs, today})` (`lib/frequency-state.ts`) | For week rhythm coloring by goal adherence. |
| Volume/perf/completion goal progress | `getGoalsOverview()` / `buildGoalInsightCore` (`lib/goals.ts`) → `GoalInsight` (`actualValue`, `targetValue`, `fractionComplete`, `isAchieved`) | Filter to goals whose window overlaps the period. |
| Does a log count toward a goal | `logMatchesFrequencyGoal(goal, log)` (`lib/frequency-goals.ts`) | Single source of truth. |
| Trend label | `trendLabel()` (`lib/progress-v2.ts`) | Split-half or vs-previous. |
| Goal-met weeks | `countGoalMetWeeks()` (`lib/progress-v2.ts`) | For month/year "X/Y weeks on target." |

`compare.ts` just runs the descriptive aggregation over `[prevStart, prevEnd]` and diffs.

---

## 7. Profile page (slimmed)

`/profile` (default view) becomes identity + lifetime + one glance + entry points:
1. **`ProfileHeader`** — keep lifetime KPIs + domain split. Avatar/name stay a decorative stub until auth (do not invest now).
2. **Personal bests** (`ProfileMilestones`) — keep.
3. **"Last 7 days" pulse** — a *compact* rolling glance (the slimmed essence of today's `WeeklySummary`), with **"View reports →"** linking to `/reports/week`.
4. **Recent activity (5)** → link to history (keep).
5. **Settings button** → opens settings (modal or `/profile/settings`; see §8).

Removed from profile: the three full inline W/M/Y modules (they move to `/reports`). This is the one place we *intentionally drop* surface from profile — noted here per CLAUDE.md rule 1, because it moves rather than disappears.

History view: unchanged.

---

## 8. Settings surface

User direction: a **button on the profile** → popup or page; maybe a frozen-header entry later.

Plan:
- Phase 1: a "Settings" button in the profile header opening **its own route `/profile/settings`** (simplest, no modal-in-transformed-ancestor pitfalls; full-page on mobile is fine). Move `ProfileSettings` contents there (account stub, units stub, home location, sports picker, export).
- Defer: modal version and/or frozen-header entry — revisit after the reports hub ships. If we do a modal, it **must use the `SportLogModal` portal pattern** (CLAUDE.md rule 5) to escape transformed ancestors.

---

## 9. Multi-user / data-model considerations

The schema is single-user (`AppProfile`, no `User` table) but auth is scaffolded (`lib/auth.ts`, `getAppSession()`). To avoid a rewrite when multi-user lands:
- Build all new report loaders to take the **session/profile scope** as a parameter from day one (even if it resolves to the single default profile now). Thread it like existing loaders do.
- The export route is already flagged unscoped — out of scope here, tracked in the auth migration hit-list.
- No new per-user columns needed for reports; everything derives from `RoutineLog` + relations.

---

## 10. Phasing (each phase independently shippable + verifiable on device — CLAUDE.md rule 6)

**Phase 0 — Foundations (no visible change).**
`lib/reports/period.ts` (period bounds/nav) + `lib/reports/load.ts` (windowed log fetch) + refactor the four 12w loaders to separate fetch/aggregate with an explicit window (existing pages pass their 12w window → no behavior change). Unit-verify period math (week/month/year boundaries, leap year, app-TZ New Year's Eve).

**Phase 1 — Navigable Week report.**
`/reports/week` with descriptive content ported from `WeeklySummary` + the old `/reports/weekly` day list, now navigable (prev/next, jump-to-current). Redirect `/reports/weekly` → `/reports/week`. Verify paging back through real past weeks.

**Phase 2 — Month + Year reports.**
`/reports/month`, `/reports/year` with their existing visual modules, navigable. `ReportShell` tabs + stepper unified.

**Phase 3 — Evaluative layer.**
Wire goals + frequency status (`evaluate.ts`) and vs-previous deltas (`compare.ts`) into all three periods. "Was it enough / which way am I trending."

**Phase 4 — Per-sport drill-downs.**
`drilldown.ts`: climbing pyramid, endurance mileage/pace, strength volume/PRs, sport `sportData` rollups. Per-domain expandable sections.

**Phase 5 — Profile slim-down + Settings route.**
Replace inline W/M/Y on profile with the compact pulse + "View reports" link. Add Settings button → `/profile/settings`. Remove now-dead inline summary usage.

**Deferred / revisit:** settings modal vs frozen-header entry; "week in review" notification/cadence; shareable/exportable report artifact; avatar/name (with auth).

---

## 11. Open questions (decide before/within the relevant phase)
1. **Goal-window overlap rule:** when a WEEK goal's window only partially overlaps a calendar month report, show it pro-rated, as-of-period-end, or list under the weeks? (Phase 3)
2. **Drill-down default state:** collapsed-by-default with a count badge, or auto-expand the user's dominant domain? (Phase 4)
3. **Empty/low-data periods:** how minimal should a near-empty week look — full skeleton or a one-line "rest week"? (Phase 1)
4. **Settings chrome:** confirm own-page now vs modal; frozen-header entry timing. (Phase 5)
5. **Should the rolling profile pulse and the calendar week report ever disagree visibly** (they will around week boundaries) — is a one-line "(last 7 days)" vs "(this week)" label enough? (Phase 1/5)
