# AI Coach — Build Roadmap & Program Review

**Purpose:** cross-session handoff doc for building an in-app AI coaching chat, so
work can proceed in a separate Claude chat in parallel with the main coaching
thread. Written 2026-07-27.

**Goal in one line:** put "a coach that knows my case" on the phone — an in-app
Claude chat that carries Eric's standing coaching context and pulls his real
training data (logs / pain / schedule) before answering, so he doesn't need a
laptop running Claude Code to get coached.

The coaching brief that becomes the system prompt lives in
[`ai-coach-context.md`](./ai-coach-context.md).

---

## Coordination (read first)

- **Slice 0 is being done in the main coaching chat** (canonical read + timezone
  fixes already landed — see status below). A parallel chat should pick up at
  **Slice 1**.
- Don't both edit `lib/logs-window.ts` or the chart/date files at once.

---

## Program review (state of the union, 2026-07-27)

The app is in good shape — real features, clean date library (`lib/dates.ts`),
smart synthetic-routine model, mostly-clean reads. What follows is targeted
cleanup, not a rewrite.

### Structure / IA (own stage — does NOT block AI)
- **"Profile" tab is misnamed** — it's a log-history/summaries surface; account
  settings hide at `/profile/settings`.
- **Log history reachable two ways** (`/log?view=history` and `/profile`).
- **Focus has no nav home** (only via Home + Plan cards).
- **Gear + Reports are buried** (Gear only by URL; Reports only via Profile).
- Dead nav match on `/progress` (no such route). ~8 redirect-only route files.
- Inconsistent detail-route nesting (goals under `/plan/goals/[id]`; injuries/
  focus/gear top-level).
- This is the existing **IA reorg plan** — validated by the review.

### Completeness — half-built / dead code
- `dependsOnMilestoneId` (Focus cross-track deps): projection reads it, **nothing
  writes it**. Decide wire-or-cut. (`lib/focus-projection.ts`, `app/focus/actions.ts`)
- 4 superseded Focus actions with no importers: `addMilestone`, `updateMilestone`,
  `reorderMilestones`, `skipMilestone` (`app/focus/actions.ts`). Delete.
- Mobility / Lifestyle world pages are "Phase 2" stubs.
- `sportData` blobs: only golf fully parsed; other sports degrade to "unknown".

### Tech debt that matters for the AI stage
- **🔴 Timezone off-by-one (`.toISOString().slice(0,10)`).** Evening-ET sessions
  landed in the next day/week bucket. **6 genuine log-instant sites fixed in
  Slice 0.** Deeper remaining bug: week-bucketing helpers `startOfWeekMonday` /
  `getMondayOf` (`lib/week.ts` + a local copy in `app/progress/details/
  activity-coverage.ts`) are timezone-unaware — a mechanical slice-swap there
  REGRESSES (blanks the coverage heatmap). Correct fix = make those helpers
  ET-aware (compute Monday from `toAppYmd(date)`, mirroring `getWeekBoundsSunday`).
  Touches `sport-pulse.ts` + `activity-coverage.ts` callers. **Remaining Slice-0
  item.**
- **Unscoped queries.** Core training models (`RoutineLog`, `PainLog`, `Focus`…)
  have no `userId`/`profileKey`; `getAppSession()` is only wired for the ~8
  profile-scoped models. Not a problem today, but **AI tools must route through
  `getAppSession()` from day one** (the new `getLogsInWindow` does).
- **Duplication (quick wins):** sport colors defined twice (`lib/sport-accent.ts`
  ≡ `lib/activities/sports-chart.ts`); day-span kind maps in 3 places
  (`WeekAtGlance.tsx`, `MonthCalendar.tsx`, `DayDetailPopover.tsx` vs the canonical
  `lib/day-span-kinds.ts`); `formatDuration` reimplemented 5+ times.
- **Form styling not centralized** (`form-ui.tsx` scoped to log flow; ~17 forms
  roll their own inputs). Amber accent hand-inlined in ~40 files despite tokens.

### Data layer — AI-tool readiness
- Read primitives are mostly clean and wrappable. `getPainTrend` /
  `getInjuryStatus` / `getRecentLogs` are near-free (wrap existing loaders).
  `getSchedule` / `getRoutineProgress` = compose existing helpers.
- **Two non-negotiables for every tool:** resolve names via `getLogDisplayName`
  (`lib/routine-display.ts`) or you emit walls of literal "Endurance"; and thread
  `getAppSession()` scoping.
- No repository layer — the windowed-log-fetch-then-`toAppYmd`-bucket pattern is
  hand-rolled in 6+ loaders. `lib/logs-window.ts` (new) is the start of a shared
  canonical read.

---

## Slice 0 — foundation (STATUS)

**DONE (this chat):**
- ✅ `lib/logs-window.ts` — `getLogsInWindow({fromYmd,toYmd,routineIds?,domains?})`:
  the canonical log read. Resolves display name (synthetic-aware), effective
  domain, app-tz `ymd`; scoped via `getAppSession()`. This is the base every
  coach read-tool should wrap.
- ✅ Timezone fix: 6 log-instant `.slice(0,10)` sites → `toAppYmd` (chart
  bucketers, ClimbsBrowser, GoalRecentSessions, InjuryTrainingLoad). Verified the
  YMD-arithmetic sites were correctly LEFT.

**REMAINING (Slice 0 tail — do before/with Slice 2):**
- [ ] Make `startOfWeekMonday` / `getMondayOf` ET-aware (`lib/week.ts` + the copy
  in `activity-coverage.ts`) — the deeper week-bucketing bug. Careful: touches
  multiple callers; a naive swap blanks the heatmap.
- [ ] (Optional, low-risk) delete the 4 dead Focus actions; decide `dependsOn`.

---

## AI MVP — architecture

A chat endpoint calling the **Anthropic Messages API with tool use**, plus a
mobile chat screen. Four pieces:
1. **System prompt** = the ported coaching brief (`ai-coach-context.md`).
2. **Read-only tools** the model calls mid-answer to pull live data.
3. **Conversation persistence** (`CoachThread` / `CoachMessage` tables).
4. **Auth gate + prompt caching.**

### Read-only tools (wrap existing loaders; all via `getLogsInWindow` / `getAppSession` / `getLogDisplayName`)
| Tool | Wraps | Effort |
|---|---|---|
| `getRecentLogs(days)` | `getLogsInWindow` | trivial |
| `getPainTrend(days, zone?)` | `PainLog` window (see `home-injuries.ts`) | trivial |
| `getInjuryStatus()` | `getHomeInjuries` / `getInjuryPanelData` | ~ready |
| `getSchedule(from,to)` | `getMonthData` + auto-schedule inference | moderate |
| `getRoutineProgress(routine)` | `getRoutineLogs` + `summarizeRoutineLogs` + set/load series | moderate |
| `getExerciseHistory(exercise)` | `SessionExercise`/`SetEntry` | moderate |

### Guardrail rules (in the system prompt — see context doc for the full set)
- Always pull relevant logs/pain **before** a training rec.
- Injury-specific rules (no hamstring stretching / ROM chasing; the discriminators).
- **Escalate** on red flags (new numbness/tingling/weakness; saddle/bowel → ER).
- **Read-only — never logs training for him.**
- Cite the data, don't fabricate, defer diagnosis to a real eval.

### Ship in slices
- **Slice 0** — foundation (above). *In progress / mostly done.*
- **Slice 1 — MVP:** chat endpoint + system prompt (static context port) +
  `getRecentLogs` + basic phone chat UI. "Coach that knows my profile + sees
  recent logs." Ship, test on phone.
- **Slice 2 — full read tools:** pain / injury / schedule / routine progress.
  Grounds "what should I do today?" in real data. (Do the week-helper fix here.)
- **Slice 3 — memory + cost control:** conversation persistence, prompt caching,
  history summarization.
- **Slice 4 — writeable memory:** the AI appends to its standing context over
  time (the thing that makes it a durable coach, not session-amnesiac).
- **Slice 5 — later:** proactive check-ins, structured sport analytics.

### Model + cost
- Default **Sonnet**; reach for Opus only on hard reasoning.
- Solo cost with prompt caching: realistically **< $15/month** ($10–30 worst
  case). Opus-everywhere would be $50–150 — unnecessary.

### Levers that control cost
1. Model choice (biggest). 2. Prompt caching on the stable system context
   (~90% off the repeated part). 3. Cap/summarize conversation history.
