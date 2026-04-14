# Codex Prompts — Injury & Body Zone System

This document contains a sequence of detailed, self-contained prompts to build out the injury/body-zone/pain-logging system. Each prompt is designed to be pasted directly into Codex. Execute them in order — later prompts depend on earlier ones.

**Design philosophy for this feature set:**
- Load tracking is based on **real activities**, not abstract scores. Each body zone shows the actual sessions, exercises, and sport tags that loaded it.
- Body zones support **left/right distinction** where it matters (shoulders, hamstrings, knees, hip structures, etc.) and bilateral/central where it doesn't (spine zones, core).
- A **color-graded body map** shows the current state of each zone: fresh, recently worked, recovering, injured.
- Pain logging is granular, zone-anchored, and can happen standalone or post-session.
- The existing `MetadataGroup`/`stimulus` system is preserved — body zones map to it where applicable, but the new system is the source of truth for "what got worked."

---

## Prompt 1 — Database Schema: Body Zones, Zone Activities, Pain Logs, Injuries

```
CONTEXT:
This is a Next.js 16 / Prisma 6 / PostgreSQL app for tracking exercise and sport progression. The Prisma schema lives at `prisma/schema.prisma`. Existing relevant models include `RoutineLog`, `SessionExercise`, `Exercise`, `MetadataGroup` (with a MUSCLE_GROUP kind), and a stimulus tracking system in `RoutineLogStimulus`.

TASK:
Extend `prisma/schema.prisma` with the following new models and enums. Do not modify or remove any existing models. After adding, run `npx prisma migrate dev --name add-injury-body-zone-system` to create the migration. Also update the reverse relations on `RoutineLog` — it needs `zoneActivities` and `painLogs` relations added.

NEW ENUMS:
- Side: LEFT, RIGHT, BILATERAL, CENTRAL
- BodyView: FRONT, BACK, BOTH
- ActivitySource: EXERCISE, SPORT_TAG, MANUAL
- PainContext: AT_REST, DURING_ACTIVITY, AFTER_ACTIVITY, MORNING, GENERAL
- InjuryStatus: ACTIVE, RECOVERING, RESOLVED, FLARED
- ZoneFreshness: FRESH, WORKED_TODAY, RECENTLY_WORKED, RECOVERING, INJURED (this is a derived enum — used in application code, not the schema, but document it in a comment)

NEW MODELS:

model BodyZone {
  id                String         @id @default(cuid())
  slug              String         @unique
  label             String
  region            String         // e.g. "hamstring", "shoulder", "lower-back"
  side              Side
  bodyView          BodyView
  metadataGroupSlug String?        // optional link to existing MetadataGroup slug (MUSCLE_GROUP kind)
  sortOrder         Int            @default(0)
  createdAt         DateTime       @default(now())

  activities        ZoneActivity[]
  painLogs          PainLog[]
  injuryZones       InjuryZone[]
}

model ZoneActivity {
  id            String         @id @default(cuid())
  zoneId        String
  zone          BodyZone       @relation(fields: [zoneId], references: [id], onDelete: Cascade)
  routineLogId  String?
  routineLog    RoutineLog?    @relation(fields: [routineLogId], references: [id], onDelete: Cascade)
  performedAt   DateTime
  source        ActivitySource
  label         String         // human-readable, e.g. "RDL 3×10 @ 95lb", "Surf session", "Climbing outdoors"
  intensity     String?        // optional freeform tag: "easy", "moderate", "hard"
  notes         String?
  createdAt     DateTime       @default(now())

  @@index([zoneId, performedAt])
  @@index([routineLogId])
}

model PainLog {
  id            String       @id @default(cuid())
  zoneId        String
  zone          BodyZone     @relation(fields: [zoneId], references: [id], onDelete: Cascade)
  level         Int          // 0–10
  context       PainContext
  notes         String?
  loggedAt      DateTime     @default(now())
  routineLogId  String?
  routineLog    RoutineLog?  @relation(fields: [routineLogId], references: [id], onDelete: SetNull)

  @@index([zoneId, loggedAt])
  @@index([loggedAt])
}

model ActiveInjury {
  id          String         @id @default(cuid())
  name        String
  severity    Int            // 1–5
  status      InjuryStatus   @default(ACTIVE)
  startedAt   DateTime
  resolvedAt  DateTime?
  notes       String?
  zones       InjuryZone[]
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  @@index([status])
}

model InjuryZone {
  id        String        @id @default(cuid())
  injuryId  String
  injury    ActiveInjury  @relation(fields: [injuryId], references: [id], onDelete: Cascade)
  zoneId    String
  zone      BodyZone      @relation(fields: [zoneId], references: [id], onDelete: Cascade)

  @@unique([injuryId, zoneId])
}

UPDATE RoutineLog MODEL:
Add these reverse relations (do not remove anything else):
  zoneActivities  ZoneActivity[]
  painLogs        PainLog[]

DELIVERABLES:
1. Updated `prisma/schema.prisma` with all above changes
2. A working migration created with `npx prisma migrate dev --name add-injury-body-zone-system`
3. Run `npx prisma generate` to refresh the client
```

---

## Prompt 2 — Seed Body Zones

```
CONTEXT:
Schema from Prompt 1 is now in place. We need to seed the BodyZone table with a comprehensive set of zones covering front and back of the body, with left/right distinction where anatomically meaningful.

TASK:
Create a new seed script at `prisma/seed-body-zones.mjs` that uses the Prisma client to upsert a defined list of body zones. Also add a call to this seed from `prisma/seed.mjs` if a main seed file exists — otherwise make the zones file independently runnable via `node prisma/seed-body-zones.mjs`.

ZONES TO CREATE (slug, label, region, side, bodyView, metadataGroupSlug [if existing MUSCLE_GROUP match], sortOrder):

FRONT, BILATERAL (left/right pairs):
- left-shoulder-front, Left Shoulder (front), shoulder, LEFT, FRONT, null, 10
- right-shoulder-front, Right Shoulder (front), shoulder, RIGHT, FRONT, null, 11
- left-chest, Left Chest, chest, LEFT, FRONT, chest, 20
- right-chest, Right Chest, chest, RIGHT, FRONT, chest, 21
- left-bicep, Left Bicep, bicep, LEFT, FRONT, biceps, 30
- right-bicep, Right Bicep, bicep, RIGHT, FRONT, biceps, 31
- left-forearm-front, Left Forearm, forearm, LEFT, FRONT, forearms, 40
- right-forearm-front, Right Forearm, forearm, RIGHT, FRONT, forearms, 41
- left-hip-flexor, Left Hip Flexor, hip-flexor, LEFT, FRONT, hip-flexors, 50
- right-hip-flexor, Right Hip Flexor, hip-flexor, RIGHT, FRONT, hip-flexors, 51
- left-quad, Left Quad, quad, LEFT, FRONT, quads, 60
- right-quad, Right Quad, quad, RIGHT, FRONT, quads, 61
- left-adductor, Left Adductor, adductor, LEFT, FRONT, adductors, 70
- right-adductor, Right Adductor, adductor, RIGHT, FRONT, adductors, 71
- left-knee-front, Left Knee, knee, LEFT, FRONT, null, 80
- right-knee-front, Right Knee, knee, RIGHT, FRONT, null, 81
- left-shin, Left Shin, shin, LEFT, FRONT, tibialis, 90
- right-shin, Right Shin, shin, RIGHT, FRONT, tibialis, 91

FRONT, CENTRAL:
- abs, Abdominals, abs, CENTRAL, FRONT, abs, 25
- obliques, Obliques, oblique, BILATERAL, FRONT, obliques, 26
- neck-front, Neck (front), neck, CENTRAL, FRONT, neck, 5

BACK, BILATERAL (left/right pairs):
- left-shoulder-back, Left Shoulder (back), shoulder, LEFT, BACK, null, 110
- right-shoulder-back, Right Shoulder (back), shoulder, RIGHT, BACK, null, 111
- left-upper-back, Left Upper Back, upper-back, LEFT, BACK, upper-back, 120
- right-upper-back, Right Upper Back, upper-back, RIGHT, BACK, upper-back, 121
- left-lat, Left Lat, lat, LEFT, BACK, lats, 130
- right-lat, Right Lat, lat, RIGHT, BACK, lats, 131
- left-tricep, Left Tricep, tricep, LEFT, BACK, triceps, 140
- right-tricep, Right Tricep, tricep, RIGHT, BACK, triceps, 141
- left-forearm-back, Left Forearm (back), forearm, LEFT, BACK, null, 150
- right-forearm-back, Right Forearm (back), forearm, RIGHT, BACK, null, 151
- left-glute, Left Glute, glute, LEFT, BACK, glutes, 160
- right-glute, Right Glute, glute, RIGHT, BACK, glutes, 161
- left-lateral-hip, Left Lateral Hip (Glute Med), hip-lateral, LEFT, BACK, glute-medius, 170
- right-lateral-hip, Right Lateral Hip (Glute Med), hip-lateral, RIGHT, BACK, glute-medius, 171
- left-hamstring-proximal, Left Hamstring (proximal), hamstring, LEFT, BACK, hamstrings, 180
- right-hamstring-proximal, Right Hamstring (proximal), hamstring, RIGHT, BACK, hamstrings, 181
- left-hamstring-distal, Left Hamstring (distal), hamstring, LEFT, BACK, hamstrings, 190
- right-hamstring-distal, Right Hamstring (distal), hamstring, RIGHT, BACK, hamstrings, 191
- left-calf, Left Calf, calf, LEFT, BACK, calves, 200
- right-calf, Right Calf, calf, RIGHT, BACK, calves, 201
- left-achilles, Left Achilles, achilles, LEFT, BACK, null, 210
- right-achilles, Right Achilles, achilles, RIGHT, BACK, null, 211
- left-knee-back, Left Knee (back), knee, LEFT, BACK, null, 220
- right-knee-back, Right Knee (back), knee, RIGHT, BACK, null, 221

BACK, CENTRAL:
- neck-back, Neck (back), neck, CENTRAL, BACK, neck, 105
- upper-spine, Upper Spine, spine, CENTRAL, BACK, null, 115
- mid-spine, Mid Spine (thoracic), spine, CENTRAL, BACK, null, 125
- lower-back, Lower Back (lumbar), lower-back, CENTRAL, BACK, lower-back, 135

NOTES:
- For `metadataGroupSlug` values: only include the slug if a matching MetadataGroup with kind=MUSCLE_GROUP likely exists. If unsure, set to null — the seed should use a lookup by existing slugs and fall back to null.
- Use `prisma.bodyZone.upsert` with `where: { slug }` so the seed is idempotent.
- Log a summary at the end: total zones created/updated.

DELIVERABLES:
1. `prisma/seed-body-zones.mjs`
2. Integration into main seed if applicable
3. Script runs successfully and all zones exist in the database
```

---

## Prompt 3 — BodyMap SVG Component (Core Visualization)

```
CONTEXT:
This is the centerpiece visualization. We need a reusable React component that renders a front-and-back human silhouette with clickable zones. Each zone renders in a color that reflects its current state (fresh / worked today / recently worked / recovering / injured). This component will be used on the dashboard, on the standalone pain-logging page, and on the post-session tagger.

The app uses Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4. Keep it a client component where interactivity is needed.

TASK:
Create `app/components/body-map/BodyMap.tsx` and `app/components/body-map/bodyZonePaths.ts`.

`bodyZonePaths.ts` should export a typed record mapping zone slugs to SVG path data for both front and back views. The paths need to be anatomically reasonable — use simplified but recognizable body silhouette shapes. A single SVG viewBox of `0 0 400 800` works well. Front body on left half of a side-by-side layout, back on right (or offer a toggle — see below).

EACH ZONE PATH should be a valid SVG `d` attribute string covering the approximate anatomical area. You do not need perfect anatomy — approximate shapes are fine. Ensure:
- Left/right zones are mirrored across the vertical center
- Zones don't overlap awkwardly — slight gaps between zones for visual clarity
- All zones from the seed list in Prompt 2 are present

INTERFACE:

type ZoneState = {
  slug: string;
  freshness: "FRESH" | "WORKED_TODAY" | "RECENTLY_WORKED" | "RECOVERING" | "INJURED";
  painLevel?: number;     // 0–10, optional
  activityCount?: number; // for tooltip
};

type BodyMapProps = {
  zones: ZoneState[];
  view?: "front" | "back" | "both";  // default "both"
  selectable?: boolean;              // if true, clicking toggles selection
  selectedSlugs?: string[];
  onZoneClick?: (slug: string) => void;
  onZoneHover?: (slug: string | null) => void;
  size?: "sm" | "md" | "lg";         // default "md"
  showLegend?: boolean;              // default true
};

COLOR SCHEME (using Tailwind-compatible hex):
- FRESH: #E5E7EB (gray-200) — neutral baseline
- WORKED_TODAY: #60A5FA (blue-400) — fresh load
- RECENTLY_WORKED: #93C5FD (blue-300) — still loaded, worked in last 2 days
- RECOVERING: #FCD34D (amber-300) — worked but some time has passed (3–5 days)
- INJURED: #F87171 (red-400) — active injury
- SELECTED (overrides): 2px ring of #1F2937 (gray-800)
- HOVER: brightness 1.1 + 1px inner stroke

FEATURES:
- Hovering a zone shows a small tooltip near the cursor with zone label + activity count + pain level
- Clicking a zone (if selectable) toggles selection, calls onZoneClick
- Injured zones get a subtle pulse animation (CSS @keyframes) to draw attention
- Legend at the bottom of the map showing the 5 freshness states with their colors
- If view is "both", render front and back side-by-side at smaller scale; if "front" or "back", render larger
- Responsive — scales down on mobile, side-by-side becomes stacked under 640px width

STYLING:
- Use Tailwind classes where possible
- Body silhouette outline in stroke `#374151` (gray-700), stroke-width 1.5
- Clean, medical-illustration aesthetic, not cartoon
- Comfortable white background with subtle shadow if the map has its own container

ACCESSIBILITY:
- Each zone path should have an `aria-label` with the zone name
- Support keyboard navigation if selectable (tab through zones, enter/space to select)
- Focus ring on focused zone

DELIVERABLES:
1. `app/components/body-map/BodyMap.tsx` — the component
2. `app/components/body-map/bodyZonePaths.ts` — SVG path data for all zones
3. `app/components/body-map/BodyMapLegend.tsx` — legend subcomponent
4. `app/components/body-map/types.ts` — shared types
5. Visual test: create a page at `app/_dev/body-map/page.tsx` (gated behind NODE_ENV=development or a simple route guard) that renders the map with mock data in all freshness states to visually verify the output.
```

---

## Prompt 4 — Zone State Derivation (Freshness Calculation)

```
CONTEXT:
The BodyMap component from Prompt 3 needs zone state to render. That state is derived from ZoneActivity records, PainLog records, and ActiveInjury/InjuryZone records. This prompt creates the server-side logic to compute zone state for any set of zones.

TASK:
Create `lib/body-zones.ts` with the following functions:

async function getAllZonesWithState(): Promise<ZoneState[]>
  Returns state for every BodyZone in the database.

async function getZoneState(slug: string): Promise<ZoneStateDetail>
  Returns detailed state for a specific zone including recent activities, pain history, active injuries.

type ZoneStateDetail = ZoneState & {
  zone: BodyZone;
  recentActivities: ZoneActivity[];    // last 30 days, newest first
  painHistory: PainLog[];              // last 30 days, newest first
  activeInjuries: ActiveInjury[];      // currently active or flared
  lastWorkedAt: Date | null;
  daysSinceWorked: number | null;
};

FRESHNESS LOGIC:
1. If any ActiveInjury with status ACTIVE or FLARED touches this zone → INJURED
2. Else, find the most recent ZoneActivity (if any):
   - If `performedAt` is today (in user's local time) → WORKED_TODAY
   - If within last 2 days → RECENTLY_WORKED
   - If within last 3–5 days → RECOVERING
   - If > 5 days or never → FRESH
3. If a RECOVERING status injury touches this zone, override freshness to RECOVERING (unless already INJURED)

PAIN LEVEL:
- Take the max painLevel from PainLog entries in the last 48 hours for that zone (if any)
- If there's an active injury on the zone with no recent pain log, default painLevel to the injury severity × 2 (cap at 10)

ACTIVITY COUNT:
- Count ZoneActivity records in the last 7 days for the zone

Expose date helpers from the existing `lib/dates.ts` or `lib/week.ts` utilities for consistency. Use the app's existing timezone handling (check the repo for how 'today' is determined — likely via a user setting or Intl.DateTimeFormat).

DELIVERABLES:
1. `lib/body-zones.ts` with all functions and types
2. Unit-test-ready pure functions for freshness calculation (e.g., `computeFreshness(lastWorkedAt, injuries)`) exported separately
3. Efficient queries: use Prisma's `include` to fetch activities/pain/injuries in a single round trip per zone or use a grouped query
```

---

## Prompt 5 — Dashboard Body Map Widget

```
CONTEXT:
The home dashboard at `app/page.tsx` is a Next.js server component that shows momentum summary, training balance, and recent activity. Add a new BodyMap widget showing the current state of all zones at a glance.

TASK:
1. Add a `DashboardBodyMap` component (server component) at `app/components/dashboard/DashboardBodyMap.tsx` that:
   - Calls `getAllZonesWithState()` from `lib/body-zones.ts`
   - Passes the state into the `BodyMap` client component from Prompt 3
   - Displays it in a card with a title "Body Map" and a subtitle "Tap any area for details"
   - Includes a compact summary underneath: "X zones worked this week · Y recovering · Z injured"

2. Make zones clickable — clicking navigates to `/body/[slug]` (page built in Prompt 6).

3. Add the widget to `app/page.tsx` in a sensible location — probably near the top alongside momentum/recent activity. Follow the existing card styling on the dashboard for consistency (use the same rounded corners, padding, shadow, border as other dashboard cards — search the file for existing card className patterns and match them).

4. Make sure it's mobile-responsive: on small screens the body map should stack front/back vertically and not overflow the card.

5. Add a small "Log pain" button in the card header that links to `/body/log-pain` (page built in Prompt 7).

DELIVERABLES:
1. `app/components/dashboard/DashboardBodyMap.tsx`
2. Updated `app/page.tsx` with the widget integrated
3. Widget renders cleanly and passes state through correctly
```

---

## Prompt 6 — Zone Detail Page

```
CONTEXT:
When a user clicks a body zone on the dashboard body map (or anywhere else), they land on a detail page for that zone. This page shows the actual activities that loaded the zone, pain history, and injury status. No numerical load scores — just real data.

TASK:
Create `app/body/[slug]/page.tsx` as a Next.js server component.

PAGE STRUCTURE (top to bottom):

HEADER:
- Zone label (e.g. "Left Hamstring (proximal)")
- Current state badge (Fresh / Worked Today / Recovering / Injured) with appropriate color
- Short description: "This zone has been worked X times in the last 7 days" or "Currently injured since [date]"

INJURY CARD (if applicable):
- Show active injuries touching this zone
- Each injury: name, severity (1–5 dot rating), status, notes, "View details" link to `/injuries/[id]`

RECENT ACTIVITIES LIST (last 30 days):
- Grouped by day, newest first
- Each row shows: date (relative — "Today", "Yesterday", "Tue Apr 8"), activity label, source badge (exercise / sport / manual), optional intensity tag
- No scores, just the actual activities
- If a session had multiple activities touching this zone, group them under the session with a small header

PAIN HISTORY CHART:
- Simple line chart (use a lightweight approach — could be a custom SVG or a small library if one is already in the project; check `package.json` first)
- X axis: last 30 days; Y axis: 0–10 pain level
- Each PainLog entry as a point, connected by line
- Context (at rest / during / after) shown as point color
- If no pain logs, show an empty state: "No pain logged for this zone"

WEEKLY CALENDAR VIEW:
- 7-day strip showing each day of the current week
- Each day shows a count of activities on that day (or an empty circle)
- Click a day to filter the activity list to that day

ACTIONS (at bottom or in header):
- "Log pain here" button → opens pain log modal or navigates to `/body/log-pain?zone=slug`
- "Log activity" button → for manually adding a ZoneActivity (e.g. a sport session)
- "Mark as injured" button → navigates to `/injuries/new?zone=slug`

STYLE:
- Match the existing app's page styling — check other detail pages like `/progress/routines/[routineId]` and `/progress/exercises/[exerciseId]` for the header patterns, card patterns, spacing
- Use the BodyMap component in the header showing only the current zone highlighted, as a visual anchor

SERVER ACTIONS:
- Use `getZoneState(slug)` from `lib/body-zones.ts` for data

DELIVERABLES:
1. `app/body/[slug]/page.tsx`
2. Any subcomponents needed, kept in `app/body/[slug]/_components/`
3. Page renders correctly for a zone with activities, a zone with pain, an injured zone, and a fresh empty zone
```

---

## Prompt 7 — Pain Log Entry (Standalone + Post-Session)

```
CONTEXT:
Pain logging needs two entry points:
1. Standalone — logged during the day without tying to a workout
2. Post-session — optional prompt at the end of any workout log

TASK:

PART A — STANDALONE PAGE:
Create `app/body/log-pain/page.tsx` (client component or server with client form).

UI flow:
1. BodyMap (selectable=true, both views) at the top
2. User taps zones to select (multi-select allowed)
3. Below the map, for each selected zone, show a card with:
   - Zone label
   - Pain level slider (0–10) with large, finger-friendly knob and visible numeric value
   - Context dropdown: At rest, During activity, After activity, Morning, General
   - Optional notes field
4. Submit button "Log pain" — disabled until at least one zone selected with a level > 0
5. After submit, show success toast and either stay on page (with map cleared) or redirect to `/` based on a "Log another" checkbox

PART B — POST-SESSION PROMPT:
Integrate into the existing log flow at `app/routines/[id]/log/page.tsx` (and log-cardio, log-session, log-guided). After the main log form is submitted, if the user has any ACTIVE or FLARED ActiveInjury, show an optional pain check:

- Small card: "Quick pain check" with a short subtitle
- Only shows zones related to the user's active injuries (pre-selected)
- Same slider + context UI but streamlined
- Context default: AFTER_ACTIVITY
- "Skip" button is equally prominent as "Log"

Implementation approach:
- After successful log submission, if injuries exist, render the pain check inline (don't navigate away). If skipped or completed, navigate to wherever the normal post-log flow goes.
- This should be a shared component, e.g. `app/components/pain-log/PostSessionPainCheck.tsx`

PART C — SERVER ACTIONS:
Create `app/body/actions.ts` with:
- `logPain(input: { zoneSlug: string; level: number; context: PainContext; notes?: string; routineLogId?: string }[])` — accepts an array for batch insert
- Uses `revalidatePath('/')` and `revalidatePath('/body')` after insert

DELIVERABLES:
1. `app/body/log-pain/page.tsx`
2. `app/components/pain-log/PostSessionPainCheck.tsx`
3. `app/body/actions.ts` with server action
4. Integration into all four log flows
5. Toast or inline success state after logging
```

---

## Prompt 8 — Active Injury Management

```
CONTEXT:
Users need to record their current injuries so the app can display them and (in a later prompt) factor them into recommendations. Injuries are the high-level concept; they attach to one or more BodyZones via InjuryZone.

TASK:

PAGES:
1. `app/injuries/page.tsx` — list of all injuries (active + resolved), grouped by status
2. `app/injuries/new/page.tsx` — create new injury
3. `app/injuries/[id]/page.tsx` — view/edit injury, mark as recovering / resolved / flared
4. Optional: handle `/injuries/new?zone=slug` query param to pre-select a zone

FORM FIELDS:
- Name (required) — free text, e.g. "Left proximal hamstring tendinopathy"
- Severity — 1–5 slider with tooltips describing each level:
  1 = minor, doesn't affect activity
  2 = noticeable, minor modifications
  3 = moderate, actively changing behavior
  4 = significant, avoiding many activities
  5 = severe, minimal activity possible
- Status — dropdown, default ACTIVE
- Started at — date picker, default today
- Resolved at — date picker, only if status is RESOLVED
- Notes — textarea
- Affected zones — embedded BodyMap in selectable mode, multi-select

INJURY LIST DESIGN:
- Active injuries at top in red-tinted cards
- Recovering in amber-tinted cards
- Resolved in gray-tinted cards at the bottom, collapsed by default
- Each card shows: name, severity dots, status, date started, affected zones as small inline body-part tags

DETAIL PAGE:
- Shows the injury info + affected zones rendered on a BodyMap
- Shows related pain logs (logs for any of the injury's zones since injury started)
- Actions: Edit, Mark as recovering, Mark as resolved, Mark as flared, Delete
- Confirmation modal on delete

SERVER ACTIONS (in `app/injuries/actions.ts`):
- `createInjury(data)`
- `updateInjury(id, data)`
- `updateInjuryStatus(id, status)`
- `deleteInjury(id)`
- `getInjuries()`, `getInjury(id)`

All actions revalidate `/`, `/injuries`, `/body`.

STYLING:
- Follow the styling patterns used on `/goals` and `/routines` pages for list views
- Forms should match existing form patterns — check `app/goals/new/page.tsx` for form layout conventions

DELIVERABLES:
1. All three pages
2. `app/injuries/actions.ts` server actions
3. `app/components/injuries/InjuryCard.tsx` reusable card component
4. `app/components/injuries/InjuryForm.tsx` form used by new + edit
```

---

## Prompt 9 — Wire Logging to Create ZoneActivities Automatically

```
CONTEXT:
For the body map to show what's been worked, every time a workout is logged, we need to create ZoneActivity records for each body zone touched by the exercises in that session. This is the automatic "exercise → zone" mapping based on the existing MetadataGroup (MUSCLE_GROUP) assignments on exercises.

Additionally, for sport sessions (cardio, guided, session kinds), provide a manual zone tagging UI at the end of the log flow since automatic derivation isn't reliable for sports.

TASK:

PART A — AUTO-DERIVE FOR EXERCISES:
In the server action that creates a `RoutineLog` with `SessionExercise` entries (find this in `app/routines/actions.ts`), after successful creation:

1. For each logged exercise, find its MetadataGroup assignments where kind=MUSCLE_GROUP
2. For each matching MetadataGroup, find BodyZone records where metadataGroupSlug equals the group's slug
3. For each such BodyZone, create a ZoneActivity record:
   - zoneId: the BodyZone id
   - routineLogId: the RoutineLog id
   - performedAt: the log's performedAt
   - source: EXERCISE
   - label: human-readable summary, e.g. "RDL 3×10 @ 95 lb" (use the SetEntry data — if multiple sets, summarize as "N sets"; if weight varies, use the heaviest)
   - intensity: derive based on rough heuristic — if weight is over 70% of the user's max for that exercise (use exercise history), mark "hard"; 50–70% "moderate"; else "easy". If no history, leave null.

4. IMPORTANT: When a muscle group is bilateral (e.g. "hamstrings"), create ZoneActivity for BOTH left and right BodyZones unless the exercise is tagged as unilateral. Check for a unilateral flag or metadata on the exercise — if it doesn't exist, add an `isUnilateral` field to Exercise via migration and default to false.

PART B — SPORT SESSION TAGGING:
For log types that don't map cleanly to exercises (cardio, guided sport routines, session kind):
1. Add a final step to those log flows called "What got worked?"
2. Render a BodyMap in selectable mode
3. User multi-selects zones
4. Optional intensity dropdown for the whole session (easy/moderate/hard)
5. On submit, create ZoneActivity for each selected zone:
   - source: SPORT_TAG
   - label: routine name (e.g. "Surf session", "Bouldering")
   - intensity: the selected intensity

This step should be skippable and not block the log submission.

PART C — MANUAL ZONE ACTIVITY:
From any zone detail page, allow users to manually add a ZoneActivity retroactively. Simple form: date, label, intensity, notes, source=MANUAL.

DELIVERABLES:
1. Updated server actions for all log types
2. Migration if `Exercise.isUnilateral` is added
3. New component `app/components/log/SportZoneTagger.tsx`
4. Server action `addManualZoneActivity()` in `app/body/actions.ts`
5. Zone activities appear on the body map and zone detail pages immediately after logging
```

---

## Prompt 10 — Injury-Aware Recommendations

```
CONTEXT:
The existing recommendation engine lives in `lib/recommendations.ts` (1784 lines). It analyzes training balance by stimulus category and suggests routines. Now we need to make it injury-aware — filtering out or penalizing routines that hit injured zones, and boosting recovery/rehab routines that serve injured zones.

TASK:

PART A — INJURY CONTEXT IN THE SCORING PIPELINE:
1. At the start of the recommendation calculation, fetch all ActiveInjury records with status ACTIVE or FLARED
2. Derive a set of "injured zones" (flatten from InjuryZone) and a set of "injured regions" (e.g. from zone.region — so "left-hamstring-proximal" contributes "hamstring" to the region set)
3. Build an "injury context" object passed through the scoring functions

PART B — FILTER / PENALIZE:
For each candidate routine:
1. Find the routine's associated MetadataGroups (via its tags/exercises)
2. Map those to body zones via metadataGroupSlug
3. If the routine hits an injured zone AND status is ACTIVE:
   - If the routine is kind=GUIDED with a ROUTINE_FOCUS tag of "rehab" or "mobility" → do NOT penalize, lightly boost instead
   - Otherwise, apply a heavy penalty to the score (e.g. multiply by 0.1 or exclude entirely)
4. If the routine hits a FLARED injury zone → exclude entirely
5. If a routine hits a RECOVERING injury zone → mild penalty (× 0.6)

PART C — BOOST REHAB OPTIONS:
1. Any routine tagged as mobility, rehab, or recovery gets a boost when any injury is active
2. Routines that specifically target the injured zone (e.g. a glute medius strengthening routine when gluteal tendinopathy is active) get the highest boost

PART D — EXPOSE REASONING:
The existing recommendation engine includes "reasons" for each recommendation. Add injury-related reasons like:
- "Avoiding exercises that load your [injured zone]"
- "Supporting recovery of your [injured zone]"
- "Not recommended — loads your [injured zone]" (for excluded routines, still show them in a collapsed "hidden due to injury" section)

PART E — CARE WITH EXISTING TESTS:
- If `lib/recommendations.ts` has tests, update them to cover injury scenarios
- If there are no tests, add a minimal test file `lib/__tests__/recommendations.test.ts` covering the key new behaviors

DELIVERABLES:
1. Updated `lib/recommendations.ts` with injury integration
2. Reasons clearly shown in the UI — check where recommendations render (likely the dashboard) and make sure the injury-related reasons display
3. A "hidden due to injury" collapsed section on the dashboard showing what's being filtered out and why
4. Tests or documented manual verification steps
```

---

## Prompt 11 — Logging UI Injury Awareness

```
CONTEXT:
When a user is about to log a workout that would load an injured zone, the app should warn them without blocking the log. This is the last layer of the injury-aware system.

TASK:

PART A — ROUTINE DETAIL PAGE WARNING:
On `app/routines/[id]/[[...segments]]/page.tsx` (or wherever the routine detail renders before logging):

1. Compute which zones this routine would load (same logic as in Prompt 10 — routine → metadata groups → zones)
2. If any of those zones are injured (ACTIVE or FLARED):
   - Show a non-blocking warning banner at the top: "⚠ This routine loads your [injured zone(s)]"
   - List the specific exercises in the routine that touch the injured zone
   - Suggest alternatives if the app has substitute-exercise logic; otherwise just inform

PART B — EXERCISE PICKER WARNING:
When building a workout or adding exercises to a log:
1. If an exercise loads an injured zone, show a small caution icon next to it with tooltip
2. Don't prevent selection, just flag it

PART C — POST-LOG REFLECTION:
After logging a workout that hit an injured zone, prompt a pain check automatically (as built in Prompt 7 part B), pre-filled to the injured zones.

PART D — ZONE-AWARE EMPTY STATES:
On `/routines` and the dashboard recommendations section, if the user has active injuries but no rehab routines in their library, show a prompt: "You have active injuries. Want to add a rehab routine?" with a link to the starter pack for rehab routines (if one exists) or the create routine flow.

DELIVERABLES:
1. Updated routine detail page with warning banner
2. Updated exercise picker with caution icons
3. Post-log pain check triggered automatically when injured zone hit
4. Dashboard prompt for adding rehab routines when applicable
5. All warnings are non-blocking — user always retains agency
```

---

## Prompt 12 — Body Map Polish & Final Integration

```
CONTEXT:
With all functionality in place, this final pass focuses on polish — making sure the body map looks and feels great, animations are smooth, and the whole system feels cohesive.

TASK:

VISUAL POLISH:
1. Add smooth transitions on zone state changes (0.3s ease-in-out on fill color)
2. The "injured" pulse animation should be subtle — 2s cycle, slight opacity shift, not overwhelming
3. Tooltip styling: rounded corners, soft shadow, white background with dark text, small arrow pointing to zone
4. Make sure front/back toggle feels snappy — add keyboard shortcut (F for front, B for back, T for toggle to both)

MOBILE UX:
- On touch devices, replace hover with a "tap to preview, tap again to open" pattern for zones
- Ensure zones are at least 44x44 px effective tap area on mobile

KEYBOARD / A11Y PASS:
- All interactive zones are keyboard navigable
- Focus rings clearly visible
- Screen reader announces zone label + state on focus

PERFORMANCE:
- If `getAllZonesWithState()` is slow, add a single-query optimized version
- Cache zone state on the server with a short TTL (e.g. 30 seconds) since it doesn't need to update in realtime

NAV INTEGRATION:
- Add a "Body" section to the main nav with links to the dashboard body map, pain log, and injuries list

DESIGN CONSISTENCY:
- Audit all new pages — spacing, typography, card styles match the rest of the app
- Ensure color tokens used for freshness states are documented in a central place (e.g. `lib/body-colors.ts`)

FINAL VISUAL QA:
- Take screenshots of: dashboard widget, zone detail page (empty/active/injured), pain log, injury list, injury detail, post-session pain check
- Verify they all look polished

DELIVERABLES:
1. All visual and accessibility polish applied
2. New nav entry
3. Central color token file
4. System feels cohesive and ready to use
```

---

## Suggested Execution Order & Workflow Tips

1. **Prompts 1–2** first — schema and seed. Verify in Prisma Studio that zones look right.
2. **Prompt 3** — build the BodyMap in isolation on the dev route. Iterate until the visual feels good before moving on.
3. **Prompt 4** — derivation logic. Can be tested against seed data + manually inserted ZoneActivity rows.
4. **Prompt 5** — wire into dashboard.
5. **Prompts 6–8** — each is mostly independent; do them in any order based on what feels most useful.
6. **Prompt 9** — wire logging to auto-create ZoneActivities. This is when the body map starts showing real data.
7. **Prompts 10–11** — recommendations and warnings. Do these once real data is flowing.
8. **Prompt 12** — final polish pass.

**General tips when working with Codex:**
- Paste one prompt at a time. Don't combine prompts — each is sized to be a coherent unit of work.
- After Codex completes a prompt, verify by running the app and exercising the new functionality. Fix bugs before moving on.
- When Codex makes tradeoffs or creative decisions you don't like, push back with a specific follow-up ("rebuild the zone detail page using full-width layout instead of two-column").
- Keep the dev route from Prompt 3 around — it's a great sandbox for iterating on the body map even after the dashboard widget is built.

**When in doubt on design decisions**, default to: clean, medical, trustworthy, grounded in real data. This system exists because abstract load scores feel fake. The UI should reinforce that — everything it shows should be a real, verifiable thing that happened.
