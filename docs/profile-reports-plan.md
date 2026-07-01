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

## 7. Profile page (deep design)

`/profile` (default view) becomes **identity → lifetime → pulse → ways in**. Glance-and-go; nothing requires interaction to understand. Top to bottom:

1. **Identity header** — avatar + display name + "Tracking since {month year} · best streak Nd", with a **⚙ gear button top-right** = the settings entry point (§8).
   - **Decision: lightweight-real identity now.** Add to `AppProfile` (additive migration, CLAUDE.md rule 4): `displayName String?`, `avatarEmoji String?`, `avatarColor String?`. User can set a name and pick an emoji (or initials-on-color) avatar. Falls back to today's "Your Training" / 🏔 when unset. Editing lives in Settings → Account (§8). Forward-compatible: when auth lands, these migrate to the real user record.
2. **Lifetime KPI row** — sessions / active days / hours / current streak. Keep `ProfileHeader`'s row as-is.
3. **Domain split bar** — keep, but make it **tappable** → `/profile?view=history&domain=<d>`. Turns inert decoration into navigation.
4. **Personal bests** (`ProfileMilestones`) — keep; the natural place to grow more record types over time.
5. **"Last 7 days" pulse** — a *compact* rolling glance (slimmed essence of today's `WeeklySummary`), with **"View reports →"** linking to `/reports/week`. The only rolling element on the page.
6. **Ways in** — button row: Reports · History · Goals · Activities · Routines.
7. **Recent activity (5)** → link to history (keep).

Removed from the profile scroll: the three full inline W/M/Y modules (move to `/reports`) **and** the inline settings block (moves behind the gear). Both *move*, not disappear — noted per CLAUDE.md rule 1.

History view: unchanged.

---

## 8. Settings page (deep design)

**Decision: own route `/profile/settings`**, full-page (full-screen on mobile, no modal-in-transformed-ancestor pitfalls). Reached by the ⚙ gear on the profile header. (A frozen-header gear and/or modal variant is deferred; if a modal ever happens it must use the `SportLogModal` portal pattern — CLAUDE.md rule 5.)

**Decision: hub that links out.** `/profile/settings` owns the *global* prefs and **links to** the existing per-domain config pages rather than absorbing them (respects existing infra — CLAUDE.md rule 2). Grouped cards:

| Group | Contents | Source |
|---|---|---|
| **Account** | Single-user notice now → name/email/sign-out with auth. **Identity editor** (displayName + avatarEmoji/avatarColor) lives here. | New (identity) + existing auth stub |
| **Units & display** | Imperial/Metric — **deferred**, kept as a visible "coming soon" affordance (not wired). Week-start stays **Sunday, no toggle** (decided). | Existing dead placeholder stays inert |
| **Location & weather** | Home location picker. | ✅ `HomeLocationSetting` (move here) |
| **Activities & sports** | Sports selection (✅ `SportsAddButton`). **Links out** to endurance type visibility (`/activities/endurance/settings`) and training-emphasis / stimulus preferences (`lib/stimulus-preferences.ts`). | Mix: own + link-out |
| **Habits & reminders** | Reminder opt-in (per the "gentle visibility, opt-in" principle). Placeholder until habit reminders are built. | Future |
| **Data** | Export (✅ `/profile/export`). Later: import, danger-zone delete-all. | Partial |

Deferred-but-noted: **Units (Imperial/Metric) is its own mini-project** — the toggle is trivial but every distance/weight/pace/elevation display across logs, charts, reports, and milestones must respect it. Out of scope here; revisit as a focused pass.

### New schema (additive only)
```prisma
model AppProfile {
  // ...existing...
  displayName  String?
  avatarEmoji  String?
  avatarColor  String?
}
```

---

## 8a. Printable / "full read" report mode (captured — decisions pending)

Agreed direction: every report has two faces over the same aggregated data — **interactive** (navigate + expand + drill) and **printable** ("full read": one period, everything expanded, a linear document you can print / save-as-PDF / screenshot to share). Cheap because Phase 0 already splits aggregation from rendering — this is a *second renderer*, not a second pipeline. Lands ~Phase 4 (once drill-downs exist).

Pending decisions (do not block earlier phases): (1) **light "paper" theme** for print vs match dark app — lean light; (2) **delivery** browser print-to-PDF (zero new deps, works on iOS via share→print) vs server-generated PDF — lean print-to-PDF first; (3) whether it **doubles as the share artifact** — design header/footer (date stamp, name) as if yes even if sharing ships later.

---

## 9. Multi-user / data-model considerations

The schema is single-user (`AppProfile`, no `User` table) but auth is scaffolded (`lib/auth.ts`, `getAppSession()`). To avoid a rewrite when multi-user lands:
- Build all new report loaders to take the **session/profile scope** as a parameter from day one (even if it resolves to the single default profile now). Thread it like existing loaders do.
- The export route is already flagged unscoped — out of scope here, tracked in the auth migration hit-list.
- No new per-user columns needed for reports; everything derives from `RoutineLog` + relations.

---

## 10. Phasing (each phase independently shippable + verifiable on device — CLAUDE.md rule 6)

**Phase 0 — Foundations (no visible change). ✅ DONE.**
`lib/reports/period.ts` (period bounds/nav — week/month/year, resolve anchor → {start,end,label,prev,next,isCurrent}, future-clamped) + `lib/reports/load.ts` (windowed log fetch → enriched `ReportLog[]`). Both composed over proven `lib/week.ts`/`lib/dates.ts` primitives; typecheck clean.
**Reorder:** the four-12w-loader refactor moved OUT of Phase 0 → into "Phase 3.5 (drill-down prep)", because Phases 1–3 aggregate at the domain level and don't touch the per-sport chart loaders. Smaller, lower-risk foundation; faster path to a visible report.
Note: no test runner exists in the repo (open decision — add vitest, or keep verifying on-device per rule 6). Period math currently verified by composition + typecheck; on-device verification lands with Phase 1.

**Phase 1 — Navigable Week report. ✅ DONE (pending on-device verify).**
Dynamic `app/reports/[period]/page.tsx` (validates kind, resolves period, fetches earliest log for prev-clamp) + `ReportShell` (Week/Month/Year tabs + prev/next stepper + jump-to-current) + `WeekReport` (KPI strip sessions/time/distance/active, 7-day rhythm, by-domain bar, highlights, totals line, and the legacy per-day detail list ported verbatim) + month/year `PeriodPlaceholder` (Phase 2 fills). `/reports` and `/reports/weekly` redirect to `/reports/week` (anchor preserved); in-app links updated. Project typecheck clean (0 errors).

**Phase 2 — Month + Year reports. ✅ DONE (pending on-device verify).**
`MonthReport` + `YearReport` (navigable). Shared `lib/reports/aggregate.ts` (`summarize` → sessions/time/distance/elev/**load**/active-days/longest-streak/domains/dayCounts/topRoutines/longest/furthest + `delta`) and `lib/reports/totals.ts` (windowed per-domain headline numbers — climb sends + hardest grade, strength volume + sets, via log-id filter). Shared `app/reports/_ui.tsx` (Kpi/DomainBar/DeltaChips/NumbersGrid + `buildNumbers`). Month = KPIs + vs-last-month + calendar heatmap + composition + in-numbers + top routines. Year = KPIs + vs-last-year + year heatmap + domain-stacked monthly bars + in-numbers (incl. best month). Typecheck + prod build clean.
**Pulled forward from Phase 3:** the *trend* half (this-vs-previous-period deltas) shipped here to make the reports genuinely useful. Phase 3 now = the *goals/frequency evaluation* half only.

**Phase 3 — Evaluative layer (goals/frequency). ✅ DONE (pending on-device verify).**
`lib/reports/evaluate.ts` (`loadPeriodGoals(kind)` reuses `getGoalsOverview({active})` and filters to the timeframes that match the report — week→DAY/WEEK, month→MONTH, year→ONE_TIME) + `app/reports/GoalsBlock.tsx` ("VS YOUR GOALS" leading panel: status chip + progress bar + actual/target, tone matched to ActivityGoalsSection). Wired into Week/Month/Year. **Current-period only** — `getGoalsOverview` evaluates the current window, so past periods show the trend deltas instead (arbitrary-past-window goal eval deferred). Clean `.next` build verified.

**Phase 3.5 — Drill-down prep. ❌ DROPPED (not needed).**
The 12w activity-world loaders return week-series shapes tuned for their own bar charts, not a calendar-period breakdown — reusing them would be awkward. Instead the report drill-downs use their own lean windowed aggregations (the `buildPyramidRows` pattern). No loader refactor; activity-world pages untouched.

**Phase 4 — Per-sport drill-downs + printable mode. ✅ DONE (pending on-device verify).**
`lib/reports/drilldown.ts` (`loadDrilldowns(window, logs)` → climbing grade pyramid via `buildPyramidRows` + sends/hardest, endurance-by-family sessions/miles/time, strength top exercises by volume, non-climbing sport sessions-by-name; each section only runs when its domain appears). `app/reports/DrilldownSections.tsx` renders a "BREAKDOWN" panel of native `<details>` drawers (zero client JS, forced open in print). Wired into Month + Year (Week keeps its per-day list as its detail view). **Printable mode:** `PrintButton` (client, `window.print()`) + scoped `@media print` CSS in ReportShell — drops nav chrome, forces drawers open, reveals a print-only period header, keeps colors faithful (`print-color-adjust: exact`). Light "paper" theme remains the deferred refinement (inline-rgba override is a separate pass). Typecheck + clean build verified.

**Phase 5a — Profile slim-down + Settings route. ✅ DONE (pending on-device verify).**
New `/profile/settings` (hub: `ProfileSettings` + link-out to endurance type config). Slimmed `/profile`: dropped inline Month/Year modules (now at /reports) + inline settings; kept the WeeklySummary "last 7 days" pulse; added a ⚙ Settings link in the ways-in row; made the domain split tappable into filtered history. Deleted the now-dead `MonthlySummary`/`YearlySummary` modules. No DB changes. Clean build verified.

**Phase 5b — Identity editor. ✅ DONE (pending on-device verify).**
Additive migration `20260630160000_add_profile_identity` (`displayName`, `avatarEmoji`, `avatarColor` — nullable) applied via `migrate deploy`; DB up to date (58 migrations). `lib/profile-identity.ts` (`getProfileIdentity`) + `app/profile/identity-actions.ts` (`setProfileIdentity`, sanitized at boundary, home-location pattern) + `app/profile/IdentitySetting.tsx` (name input + emoji picker + color swatches, live preview, fontSize-16 input per rule 3a) rendered atop `/profile/settings`. `ProfileHeader` now shows the chosen name + emoji-on-color avatar, falling back to "Your Training" / 🏔 when unset. Typecheck + clean build verified. (Client regen required pausing the dev server — remember to `npm run dev` again.)

**Deferred / revisit:** Units Imperial/Metric (own focused pass); settings modal vs frozen-header entry; week-start Sun/Mon toggle; "week in review" notification/cadence; share artifact (link/image); auth-backed real account identity.

---

## 11. Open questions (decide before/within the relevant phase)
1. **Goal-window overlap rule:** when a WEEK goal's window only partially overlaps a calendar month report, show it pro-rated, as-of-period-end, or list under the weeks? (Phase 3)
2. **Drill-down default state:** collapsed-by-default with a count badge, or auto-expand the user's dominant domain? (Phase 4)
3. **Empty/low-data periods:** how minimal should a near-empty week look — full skeleton or a one-line "rest week"? (Phase 1)
4. **Settings chrome:** confirm own-page now vs modal; frozen-header entry timing. (Phase 5)
5. **Should the rolling profile pulse and the calendar week report ever disagree visibly** (they will around week boundaries) — is a one-line "(last 7 days)" vs "(this week)" label enough? (Phase 1/5)
