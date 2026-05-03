# Active Logging Overhaul — Implementation Plan

The goal is a professional, powerful logging tool that feels cohesive across all activity types and stays out of the way while you're actually training. Six phases, ordered by dependency.

### Post-activity logging
The draft/tray system must not create friction for logging after the fact — sometimes you don't have your phone during training, or you're locked in and log everything at the end. Key rules throughout all phases:
- The "Performed at" date/time picker must always be easy to reach — never buried in a collapsed section
- Tray chip elapsed time only shows for recent drafts (< 3 hours); older drafts show a neutral date label instead
- No UI element implies the log is "late" or overdue
- Draft expiry: drafts older than 7 days prompt "This draft is from X days ago — continue or start fresh?" rather than auto-restoring silently

---

## Phase 1 — Draft Persistence

**The foundation. Everything else depends on this.**

Right now every log form is pure local React state with no escape hatch — navigate away and the log is gone. Fix this by saving form state to `localStorage` keyed by `routineId`. On open, check for a draft and pre-populate. On save or explicit cancel, clear it.

What gets saved per draft:
- `routineId`, `routineName`, `routineKind`, `categoryColor` (for tray chip)
- Full form state: exercise blocks + sets for workouts; metric values + climb entries for sessions
- `startedAt` timestamp (shown in tray chip as elapsed time)

Drafts should survive: navigation, background app state, accidental back-swipe. They should not survive: an explicit "Discard" action or a successful save.

---

## Phase 2 — Active Session Tray

**The multi-activity solution — no schema changes, sessions stay independent.**

A fixed bar sits just above the bottom nav. Each active draft shows as a compact chip: routine name, category color dot, elapsed time ("Push · 22m"). Tapping a chip navigates to that log page with state fully restored. A badge on the Log nav icon shows draft count when you're elsewhere.

**The PT + workout use case:** Start Push Workout, switch to start Hamstring PT, both chips live in the tray. Work through each independently, switching freely. Each saves or discards on its own.

Design details:
- Tray hides when there are no active drafts
- Chips are swipe-dismissable (with a "Discard this session?" confirm)
- Tray z-index: 16 (above bottom nav at 15, below sticky header at 20)
- A "New session" shortcut in the tray lets you start a second routine without going through the main nav

Technical: Phase 1 requires introducing a React context or lightweight store at the root layout (`app/layout.tsx`) to share draft state across routes. No Zustand or Redux needed — a single context with a `Map<routineId, Draft>` is sufficient.

---

## Phase 3 — Exercise Log UX Overhaul

**Fix the daily-use friction in workout logging. No schema changes needed.**

### Last-session reference
The form already prefills from the last workout, but once you've changed a value there's no way to reference what you did last time. Fix:
- Show last-session values as ghost/placeholder text on each input (e.g., weight input placeholder `"135"`, reps input placeholder `"8"`) — only when pre-populated data exists
- Add a "Reset to last session" button in each exercise block header, visible only when a previous log exists
- The `smartDefaultLabel` ("Pre-filled from Apr 30") moves from the collapsed Session Details into the top of the exercise card where it's actually visible

### Set row controls
Currently: ↑ copies the row directly above it (confusing — looks like "copy last session" but isn't). Fix:
- Rename ↑ to something unambiguous, e.g., a duplicate icon with tooltip "Copy set above"
- Add a clear-row control (⌫) that zeroes out weight/reps without removing the row — useful when you want the row structure but need to enter different numbers
- The ✕ remove-row button stays but only removes the row

### Exercise tab improvements
- Set count badge on each tab ("Bench · 4 sets") so you can see at a glance which exercises are done
- Tabs should scroll horizontally without clipping — current overflow-x setup can clip the active tab indicator

### Data entry flow
- On mobile: when you finish entering weight and tap Done/Next, auto-advance focus to the reps/seconds field in the same row. When you finish reps, auto-advance to weight of the next set. This turns a 3-exercise workout into a smooth tap-through instead of hunting for the next field.

### Post-session pain check
Currently the pain check component replaces the entire log form on save — a jarring swap. Replace with a smooth slide-up transition. The log form fades back, pain check slides up from the bottom.

### Visual cohesion
- Replace all `rgba(128,128,128,...)` raw palette values with the same card/border/hero tokens used in the progress pages
- Section headers use the same SectionCard/SectionHeader pattern, not raw uppercase divs
- Inputs across workout and session logs use the same `bigInput` style — currently they diverge between the two form types

---

## Phase 4 — Sport / Session Log Overhaul + Per-Climb Logging

**The biggest phase. Requires a Prisma migration for climbing.**

### Session log prefill
Session logs (climbing, swimming, cycling, running, etc.) currently start blank every time. Like workouts, they should prefill from the most recent log for that routine:
- Duration pre-populated (user can adjust)
- Location pre-populated
- All metric values pre-populated as a starting point
- `smartDefaultLabel` shown at the top of the form

### Structure and section cleanup
The current `SessionLogForm` has `FormSection` descriptions that are internal implementation notes accidentally rendered as user-facing text (e.g., "Use the same review-friendly structure as the other routine logs, then fill in only the fields that matter for this session type"). Remove all of those.

Restructure sections by activity type:
- **Non-climbing sessions** (cardio, yoga, sport): Overview (duration + location) → Metrics → Notes. Flat, no unnecessary nesting.
- **Climbing sessions**: Overview → Climbs (the new per-climb list) → Session notes. Metrics section only appears if non-climbing metrics are defined.

The "Session metrics" section label is meaningless. Rename to match the template context — or remove the label and let the fields speak for themselves.

### Per-climb logging — schema migration required

Replace the Done/Flashed grade table entirely. The new model:

```prisma
model ClimbEntry {
  id           String     @id @default(cuid())
  routineLogId String
  routineLog   RoutineLog @relation(fields: [routineLogId], references: [id], onDelete: Cascade)
  grade        String     // "V5", "5.11a"
  gradeSystem  String     // "BOULDER_V", "YOSEMITE"
  color        String?    // tape color or setter name
  wallAngle    String?    // "slab", "vertical", "overhang", "cave"
  climbStyle   String?    // "crimp", "sloper", "pinch", "dynamic", "static"
  attempts     Int        @default(1)
  result       String     // "FLASH", "SEND", "PROJECT"
  notes        String?
  loggedAt     DateTime   @default(now())
  sortOrder    Int        @default(0)
}
```

**New UI — ClimbEntryList:**
- Each climb is a card in a live list, added as you complete them during the session
- Quick-add via a bottom sheet: grade → result (Flash / Send / Project) → optional details (color, wall angle, style, attempt count, notes)
- The quick-add path should be 2–3 taps for a basic entry; details are always optional
- Each card shows: grade badge, result indicator, color swatch if set, and a one-line summary of any extra details
- Tap a card to expand and edit details; swipe to remove
- At the top of the section, a live grade summary updates as you add climbs: "V4: 3 sends (1 flash) · V5: 2 sends · V6: project"
- Flash is a subset of sends — a flash is always a send on attempt 1. No more "Done vs Flashed" ambiguity.

**Retire:** `ClimbingGradeRowsEditor.tsx`, Done/Flashed `SessionMetricDefinition` records for climbing templates, and the related `SessionLogMetricValue` rows for those metrics. Existing logged data should be migrated to `ClimbEntry` records or kept as-is with a migration script that converts old Done/Flashed counts into aggregate `ClimbEntry` records.

**Existing session metric definitions for climbing grades:** These can be left in the DB but should no longer be rendered in the form. A migration step marks them as `archived` or removes them from the template.

---

## Phase 5 — Log History: Search, Filter, and Review

**Standalone. Can be done any time after Phase 1.**

The current history view loads 120 logs grouped by date with no search or filtering. Replace with:

### Search
- Text search on routine name, template name, and location — instant filter as you type
- Results update live without a full page reload (client-side filter over the loaded set, with server-side re-fetch if you scroll past the loaded window)

### Filter chips
A compact filter bar above the history list:
- **Category**: All · Climbing · Strength · Cardio · Mobility · ...
- **Location**: populated dynamically from logged locations — lets you filter to "all climbing sessions at Movement" or "all runs at the trail"
- **Date range**: last 7d · 30d · 90d · custom
- **Activity type**: for climbing — bouldering vs sport vs trad; for cardio — run vs bike vs row

### Per-session detail expansion
Tapping a log in history expands it inline (or navigates to the detail view) showing:
- For workouts: full exercise/set breakdown with weights and reps
- For climbing: ClimbEntry list with grade breakdown and individual climb details
- For cardio: distance, pace, elevation

### Summary stats in context
When a filter is active, show a summary bar: "14 sessions · 3 gyms · V5 avg grade" — gives the filtered view meaning beyond just a list.

---

## Phase 6 — Inline Expansion (Stretch Goal)

**The premium experience. Requires Phases 1–2 to be solid.**

Rather than navigating away when you tap a tray chip, the expanded log renders as a slide-up drawer while the current page stays visible underneath. Tap the chip → drawer slides up to 80% screen height with the full log form inside. Save or collapse and the drawer dismisses, tray chip updates.

This is the right endgame UX for the PT-between-sets use case: you're looking at your routine overview or a rest timer, and you can log a set without losing your place. But it's a meaningful lift — `WorkoutExerciseEditor` (~890 lines) holds the most complex log state and needs its rendering cleanly separated from its navigation context before it can be embedded in a drawer.

Prerequisite: Phase 3 leaves `WorkoutExerciseEditor` in a state where it's a pure presentational component driven by props, with all state management extracted into a hook. That separation is required before Phase 6 is feasible.

---

## Key Technical Context

- Server actions (`logWorkout`, `logRun`, `logSession`, etc.) in `app/routines/actions.ts` are fully route-agnostic — can be called from a floating drawer anywhere without refactoring
- Fixed bottom nav: `z-index: 15`; sticky header: `z-index: 20` — tray needs `z-index: 16+`, drawer needs `z-index: 18+`
- No global state currently (no Zustand, no Redux) — Phase 1 introduces a React context at `app/layout.tsx`
- `WorkoutExerciseEditor` (~890 lines) is the main complexity target — Phase 3 should leave it cleaner and Phase 6 depends on it being extractable as a hook + view pair
- Per-climb `ClimbEntry` model (Phase 4) replaces the `SessionMetricDefinition` / `SessionLogMetricValue` pattern for climbing grades entirely — the old pattern stays for non-climbing session metrics
- Log history (Phase 5) is the only phase with meaningful DB query work — the filter/search logic hits existing indexed fields (`performedAt`, `routineId`, `location`) so no new indexes are needed beyond what Prisma generates
