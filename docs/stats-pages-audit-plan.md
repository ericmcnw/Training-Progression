# Stats & Activity Pages — Audit + Sequenced Plan

Full-detail audit of every stats/detail page (2026-07-02), verified against code
2026-07-03, RE-AUDITED 2026-07-04 against the parallel tracks (reports-hub
branch + Goals v2 + AI thesis) and re-sequenced through a user lens. Each phase
is a shippable PR-sized chunk (CLAUDE.md rule 6): ship → verify → continue.

**Design constraints this plan honors (locked decisions — do NOT re-litigate):**
- Native metrics per domain. NO Load toggle on strength/cardio activity charts
  (Load lives on sports/climbing charts + the injury chart only).
- Coverage chart is the PRIMARY body graphic; silhouette is location-only.
- Effort slider is sports/freeform-Activity only. Whole-body load-score deferred to wearable.
- **"Rolling = profile/world-page pulse, calendar = report"** (reports-hub rule):
  world pages own rolling state + ALL-TIME bests; vs-previous-period evaluation
  belongs to /reports — do NOT duplicate it on world pages.

**Division of labor vs parallel tracks (2026-07-04):**
- `reports-hub` branch (UNMERGED; carries Reports phases 0-5 + Goals v2 P2-P4 +
  gear work): owns calendar-period evaluation, per-sport drill-downs, strength
  PR reporting, vs-previous trends. Its Phase 0 made chart loaders take explicit
  {start,end} — a big piece of the P5 registry substrate.
- Goals v2 (locked plan in memory): owns goal creation, milestones/progression
  tracks, activity-hub goal surfacing (its P5). Complementary, not conflicting.
- AI thesis (primitives-first): NL goal creation = first AI slice; the chart
  REGISTRY (this plan's P5) = the substrate for the second slice ("pull up X vs
  Y over Z") + the manual pinboard.

**User-lens framing — the question each phase answers:**
- P1: "Is my training hurting my injury?" (can I keep running?)
- P1.5: "Stop making me tap so much for daily actions."
- P2: "Am I getting better?" (+ "is anything new/worse?")
- P3: "Show me what I actually logged."
- P4: "Make it clean."
- P5: "Let me compose my own view" (and later, ask the AI to).

**USER-FLOW AUDIT (2026-07-06) — walked the actual daily flows (active rehab:
hamstring tendinopathy + knee flare, daily morning reading protocol, Session
A/B/C plan). Findings folded into phases below:**
1. Daily morning pain reading = ~5 taps + a zone pick via FAB→/body/log-pain.
   The app's most important daily rehab action needs 1 tap (→P1.5).
2. The rehab decision rule is NEXT-MORNING response ("settles by morning"), but
   the injury chart is weekly-only. Lightweight session→next-morning delta
   promoted from later-pool (→P2).
3. Rehab lift progression invisible: strength page = top-8 by session count;
   rehab lifts may never surface; no path to an arbitrary exercise's
   progression (→P2). PLUS a live logging bug: TIME exercises w/
   supportsWeight=false can't record load (his iso stack number) — make
   weight-support editable on an exercise (→P1.5, tiny).
4. World-page Log CTAs are generic: sport pages link to /log instead of opening
   THAT sport's sheet; strength has no Log CTA at all (→P1.5).
5. "New pain hotspot" surfacing (his 7/5 medial spot) promoted P4→P2.
6. Stale-audit note: strength page has since gained the goals frequency chip +
   recent/all-time PR pulse slots (parallel branch work) — trim items softened.

**The unifying finding:** the app logs far more than it surfaces. Most gaps are
wiring, not new capture: `triesCount` never queried, sport `extras` (waves/runs/
points) never rendered, strength `load` computed & dropped, endurance `effort`
queried & dropped, `CoverageDetailLog` drops distance/duration/elevation.

---

## Phase 0 — GATE: verify + merge `reports-hub`  (do first, blocks everything)

The working branch carries Reports 0-5 + Goals v2 P2-P4 + gear, all pending
on-device verify + merge. It refactored the SAME chart loaders this plan
touches — any stats work on main first guarantees conflicts. Verify on phone,
merge to main, then start P1.

## Phase 1 — Injury "pain vs miles" plumbing  ⭐ flagship

The injury chart shows cardio as session-counts/RPE-load; it structurally cannot
show weekly miles because `CoverageDetailLog` (app/progress/coverage.ts) drops
`distanceMi` / `durationSec` / `elevationGainFt` (they exist on RoutineLog; only
consumed inside `sessionLoad()` at coverage.ts:486).

1. Add optional `distanceMi` / `durationSec` to `CoverageDetailLog` + populate.
2. Injury chart (`InjuryTrainingLoad`): extend the Sessions⇄Load toggle with
   **Miles** (sums distanceMi of contributing cardio logs per week) and
   optionally **Time**. Pain line stays overlaid → "pain rose the week I ramped
   15→28 mi" reads directly.
3. Week-tap drilldown: show per-log native metric + a small load badge.

Effort: S-M. One data shape + one chart component. Unlocks body-page uses later.

## Phase 1.5 — Buttons & taps quick pass (small, daily-felt; can ride with P1)

1. **One-tap daily pain reading**: home injury card (and/or injury page hero)
   gets a direct "log today's reading" that opens pre-scoped to the active
   injury's zone — level slider + save. Kills the daily 5-tap FAB→zone-picker trip.
2. **Direct-log CTAs on world pages**: sport page "Log" opens THAT sport's
   sheet (not /log); endurance page CTA opens the endurance form; strength
   header gains a "Log workout" CTA (quick-log drawer). Most-frequent action
   becomes the primary button everywhere.
3. **Exercise weight-support edit**: allow enabling supportsWeight on an
   existing TIME exercise so loads (cable stack) are recordable on isometrics.
   Tiny; unblocks real rehab logging today.
4. **Injury hero reorder**: returning-user layout — trajectory + latest reading
   first; identity block (name/zones/map/start date/factors) collapses below.

## Phase 2 — "Am I getting better?" (rolling improvement metrics, world pages)

User-lens: this is THE question a returning user asks a stats page. Scoped to
rolling/all-time so it complements (not duplicates) reports' calendar evaluation.

1. **Injury trajectory**: improving/stable/worsening arrow next to status
   (slope of daily pain peaks). Cheap, and it's the #1 injury question.
2. **Session → next-morning response** (PROMOTED from later-pool — it's the
   user's actual load-decision rule): on the injury page, recent zone-loading
   sessions each show the next-morning pain reading beside them ("settled" vs
   "elevated"). Simple join of session dates × next-day pain logs.
3. **Pain hotspots** (PROMOTED from P4): body page "new/recent pain spots
   (7d)" list — surfaces emerging spots (e.g. a new medial-knee signal) before
   they're injuries.
4. **Per-exercise progression reachability**: any exercise (not just top-8) →
   its load/reps trend. Search or "all exercises" path from the strength page;
   rehab lifts must be findable.
5. **Endurance PRs/bests**: fastest pace, longest distance, most elevation per
   type/family (+ date). All-time stat tiles on family tabs. Data already loaded.
6. **Climbing tries-to-send avg** (query `triesCount` — currently never
   selected). NOTE: send-rate headline promotion TABLED by user 2026-07-06
   (moved to later-pool; user unsure about the stat).
7. **Pace trend direction**: ↑/↓ per series on the pace chart legend (rolling
   12w slope — direction only; period comparisons stay in reports).

DEMOTED from original plan: pulse-strip vs-prior-window arrows everywhere —
reports own vs-previous evaluation. Optional garnish later, not a phase item.

## Phase 3 — Surface the hidden data ("show me what I logged")

1. **Sport extras** (app/activities/[slug]): render `sportData.extras` in Recent
   Sessions chips (waves, runs, points, tricks) + per-sport aggregate pulse slot
   (e.g. "75 waves this month"). Config-driven via SPORT_LOG_CONFIG.
2. **Climbing time-on-wall** (durationSec already loaded) as a stat.
3. **Session-type visibility**: sport Recent Sessions rows show sessionType
   ("Pickup", "Park") as a chip.
4. Tiny cleanups: drop unused `effort` select in endurance-chart.ts; drop unused
   `lastNotes` in climbing project rollup (or render it).
5. **Verify freeform-Activity containment**: catch-all logs have no world page
   (by design) — confirm they don't leak into the sports rollup charts/stats.

Effort: S each. High delight — data users already entered finally shows up.

## Phase 4 — Trim + UI polish (bundled small fixes)

- **Injury chart y-axis mismatch**: pain (0-10) vs bars scaled to global peak
  reads lopsided; normalize or dual-axis. Collapse the redundant raw
  "Recent logs" list (trend + correlations already cover it).
- **Endurance**: Overview family-cards duplicate the tabs — slim or remove;
  30-row Recent Sessions cap → "showing X of Y" + show-more.
- **Climbing**: venue split rendered twice (pyramid columns + chart shading) —
  drop the chart-level venue encoding; training-tags panel auto-open when the
  training chart is empty.
- **Strength**: replace "Heaviest Set" pulse (mixes lifts) with recent top lift;
  retire or upgrade the single-row 52-week heatmap.
- **Mobility/Lifestyle** (thinnest pages): add streak/consistency aggregates +
  time-per-week (durationSec already queried); consistency-strip legend; cap
  long routine lists; extract the shared template the two pages duplicate.
- **Body page**: "recent pain hotspots (7d)" list (pre-injury warning) +
  weekly load summary line; sparkline encodes intensity via color.

Effort: M, parallelizable. Do after 1-3 so polish doesn't churn.

## Phase 5 — Chart registry → pinnable dash + AI substrate  (decision gate)

Rationale: a pinboard needs every chart describable as
`{ type, config } → loader → renderer`. That registry is ALSO the exact tool
surface an AI assistant needs ("pull up my knee load vs cardio miles for 3
months" → resolve to descriptors → render). Manual pinning and AI-driven chart
retrieval share one foundation; the AI tier (post-auth) is what makes the dash
truly pay off. Fits the AI thesis: NL goal creation is AI slice #1; registry-
driven chart retrieval is the natural slice #2.

HEAD START (found 2026-07-04): reports-hub Phase 0 already refactored the chart
loaders to take explicit {start,end} windows — a large piece of the config-
driven substrate. Registry cost is materially lower than first estimated.

Approach: don't big-bang refactor. As Phases 1-4 touch charts, keep each one a
config-driven unit (loader takes explicit params; component takes data+config).
Then:
1. Registry module mapping chart-type → loader + renderer + config schema.
2. `/board` page reading pins (localStorage first; DB table when auth lands).
3. 📌 buttons on registered charts (capture config incl. toggle state).
4. Later: AI tool-calling resolves natural language → registry configs.

Effort: S-M for registry+board given the head start. Decide GO/NO-GO after
Phase 2 — by then the remaining cost is visible.

## Later-pool (user-lens ideas, deliberately not scheduled)

- **Injury "what's been SAFE"** — inverse correlation: activities done since
  injury with no pain spike ("surfing 6× since, never spiked"). Answers "what
  can I still do?" — pairs with the AI coach later.
- **Descent tracking** — only elevation GAIN is captured; downhill (the big
  eccentric load, e.g. a 4800ft descent) is invisible. New capture field;
  weigh before adding.
- **Left/right + test-battery support** — side-to-side rehab tests (calf-raise
  counts, bridge-to-failure per leg) have no model; per-set side tagging or a
  simple "test" log type. Niche; notes work meanwhile.
- **Injury ↔ rehab-routine link** — "Rehab this week: iso 5/7, curls 2/3" on
  the injury page needs an ActiveInjury↔routine association (additive). Interim:
  frequency goals on rehab routines already show on the home grid.
- Session-to-pain lag analysis (pain spikes 1-3 days after which loads).
- Strength per-lift PR history + e1RM trends (own build; reports P4 covers
  period PRs first — see how far that gets).
- People&Records for more sports; per-sport performance lenses.
- Habit velocity chart (lifestyle); mobility "what got worked" chips.
- Sends-by-grade-over-time; area rollups; project progress dashboards (climbing).

---

## Per-page audit detail (reference)

### Injury detail (app/injuries/[id])
- Rendered: hero (status/severity/days/map/factors), pain stats chips, pain line
  over domain-stacked weekly bars w/ Sessions⇄Load, factor correlations,
  post-activity spikes, recent logs, edit form.
- Missing: native-metric correlation (→P1), trajectory arrow (→P3), load
  breakdown on week-tap (→P1), lag analysis (later), pain distribution (later).
- Trim: raw recent-logs list (→P4). Fix: y-axis mismatch (→P4).

### Body (app/body)
- Rendered: status chips, injuries, collapsible map w/ zone panel, needs
  attention (cold 7d+), coverage chart (muscles/patterns lens + range).
- Missing: pain hotspots, weekly load summary (→P4); intensity in sparkline (→P4).
- Note: audit suggested map-dominant layout — REJECTED (coverage is primary by design).

### Endurance (app/activities/endurance)
- Rendered: family tabs + type pills, Miles/Time/Elevation chart, pace chart
  (weekly lines / session dots), range pills, family cards, stats, recent 30.
- Missing: PRs/bests, consistency, pace trend direction (→P3); comparison table (later).
- Trim: overview family-card redundancy, 30-row cap (→P4). effort queried unused (→P2).

### Strength (app/activities/strength)
- Rendered: pulse (sets/PR/heaviest/streak w/ deltas), Sessions⇄Sets chart,
  Volume chart, goals, 52w heatmap, top exercises w/ sparkline + PR badge,
  routines, recent sessions.
- Missing: per-lift PR history + e1RM trends (later, own build), muscle-group
  coverage lens (later). Trim: heaviest-set pulse, single-row heatmap (→P4).
- REJECTED: Volume⇄Load toggle (Load is off strength by design).

### Sport generic (app/activities/[slug])
- Rendered: pulse (4 count windows), sessions chart (bars/effort lenses),
  People&Records (spikeball/tennis), goals, supporting training, spots,
  recent sessions (10→100), coming-soon.
- Missing: extras surfaced (→P2), sessionType chip (→P2), pulse trends (→P3),
  People&Records for more sports (later), per-sport performance lens (later).

### Climbing (app/activities/climbing)
- Rendered: pulse, hub tiles, discipline×venue chart, training-by-domain chart,
  tags panel, grade pyramid w/ discipline pills + venue columns + send-rate
  subtitle, active projects (3, 60d), recent locations (5), recent sessions.
- Missing: tries-to-send, time-on-wall, send-rate headline (→P2); send-rate
  trend, sends-by-grade-over-time, area rollups, project progress (later).
- Trim: double venue encoding (→P4); 60d project cutoff is opaque (→P4).

### Mobility + Lifestyle (app/activities/mobility, /lifestyle)
- Rendered: pulse, weekly chart, routine/habit list (lifestyle adds 84d
  consistency strip + 7d badge), recent sessions/completions.
- Missing: streaks/consistency aggregates, time-per-week, adherence ("2x/wk
  avg") (→P4); habit velocity chart (later).
- Trim: near-identical templates → extract shared component (→P4).

---

## Sequencing vs other tracks (updated 2026-07-04)
This plan is the "stats depth" track. Reality check: the `reports-hub` branch
(Reports 0-5 + Goals v2 P2-P4 + gear) is the ACTIVE unmerged work — it gates
this plan (P0). After merge, this track interleaves with: Goals v2 remaining
phases (P5 hub surfacing touches the same world pages — coordinate), Rotation
testing, Reminders (pre-iOS), Auth (gates the AI tier → which supercharges
Phase 5 and the "safe activities" coach ideas).
