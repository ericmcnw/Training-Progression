# Gear Tracking — Implementation Plan

Status: planning
Owner: Eric (ericmcnw@gmail.com)
Last updated: 2026-05-19

## Goal

Let users record which piece of gear they used on each log, and track lifetime use (miles, sessions) per item. Phase 1 ships footwear tracking for cardio activities — running, walking, trail-running, road-running, hiking. Future phases extend to bikes, boards, skis, climbing gear.

The unlock isn't just "what gear was used"; it's **lifetime tracking** (320 mi on these shoes, time to replace; this rope has 18 months on it, retire soon). Mileage rollups are the killer feature, not the metadata.

---

## Scope — Phase 1 (this build)

### Activities included
- `running`
- `road-running`
- `trail-running`
- `walking`
- `hiking`

Picker only renders when the routine resolves to one of these slugs (or a slug that's compatible with one via the existing `COMPATIBLE_ACTIVITY_SPOTS` symmetric map — which means a "trail-running" shoe surfaces for "running" logs and vice-versa).

### Gear category
**Footwear only.** Generic enough to cover road shoes, trail shoes, hiking boots, walking shoes. No bikes, boards, skis, ropes in v1.

### Per-log gear selection
**Single-select** in the v1 UI. The schema is N:M from day one (so we never need to migrate) but the UI shows one chip and one picker. Multi-select is a v2 UI upgrade.

### Lifetime tracking
Per-gear rollups computed on demand from `RoutineLog.distanceMi`:
- Total miles
- Session count
- First / last use date
- Optional `lifetimeMiles` cap → progress bar + retire prompt at 90% / 100%

### Inventory page
`/gear` lists active gear with lifetime stats. Retired gear available behind a toggle. No detail page in v1 (Phase 2).

---

## Out of scope (Phase 2+)

- **Bikes, snowboards, skis, surfboards, climbing gear** — each its own follow-up, same data model.
- **Multi-gear per log** — schema supports, UI doesn't yet.
- **Gear detail page** (`/gear/[id]`) with log timeline and mileage trend chart.
- **Inline edit/retire on the picker** — v1 = manage from `/gear` page only.
- **Photo upload** per gear.
- **Replacement graph** ("Brooks Ghost 16 replaces my Ghost 15").
- **Custom attributes per activity** (drivetrain on bikes, length on boards).
- **Session/duration rollups for non-distance activities** (deferred — Phase 2 sport gear).
- **Gear sharing across users** — app is single-user.

---

## Data model

### New Prisma models

```prisma
model Gear {
  id           String   @id @default(cuid())
  name         String   // user-set: "Brooks Ghost 16 — orange"
  activitySlug String   // primary activity: "running", "trail-running", etc.
  type         String?  // free-form category: "trail shoe", "hiking boot"
  brand        String?
  model        String?
  // Optional purchase/retirement dates for lifetime context.
  purchasedAt  DateTime?
  retiredAt    DateTime?
  // Lifetime mileage cap. Drives the warning UI. Null = no warnings.
  // Typical: 400-600 mi for running shoes, 500-800 for trail shoes.
  lifetimeMiles Float?
  notes        String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  logs RoutineLogGear[]

  // Active gear lookup ("show me my running shoes"); retired stays
  // queryable behind a filter.
  @@index([activitySlug, retiredAt])
}

// M:N join — same pattern as RoutineMetadataGroup, ExerciseMetadataGroup.
model RoutineLogGear {
  routineLogId String
  gearId       String
  // Reserved for v2 multi-gear UI where mileage might split across
  // multiple pieces (e.g., shoes + insoles). v1 always writes 1.0.
  weight       Float    @default(1.0)
  createdAt    DateTime @default(now())

  routineLog RoutineLog @relation(fields: [routineLogId], references: [id], onDelete: Cascade)
  gear       Gear       @relation(fields: [gearId], references: [id], onDelete: Cascade)

  @@id([routineLogId, gearId])
  @@index([gearId])
}
```

### RoutineLog gets a relation

```prisma
model RoutineLog {
  // ...existing fields...
  gear RoutineLogGear[]
}
```

### Cross-activity surfacing

A gear with `activitySlug: "trail-running"` surfaces on `running` logs too because the picker queries:

```ts
where: { activitySlug: { in: compatibleActivitySlugs(routineActivitySlug) }, retiredAt: null }
```

Reuses [lib/activity-spots.ts](lib/activity-spots.ts)'s `compatibleActivitySlugs()` so we don't duplicate the compat graph.

### Why N:M from day one
Changing N:1 → N:M after launch requires a migration (drop column, create join table, backfill). Cheap to do up front, expensive to retrofit.

---

## Server changes

### New lib file: `lib/gear.ts`

Mirrors the shape of `lib/activity-spots.ts`. Defines:
- `GearBasic` type (id, name, type, brand, model, activitySlug, retired, optional aggregates)
- `getActivityGearConfig(slug)` returning per-activity defaults (`noun: "shoes" | "boots"`, type options if any)
- `compatibleGearActivitySlugs(slug)` — reuse the existing compatible-activities graph
- `buildGearPickerItems()` — mirror of `buildSpotPickerItems`

### Server actions in `app/gear/actions.ts`

```ts
saveGear({ id?, name, activitySlug, type?, brand?, model?, purchasedAt?, lifetimeMiles?, notes? })
  → creates or updates by id

retireGear(id)        → sets retiredAt = now
unretireGear(id)      → clears retiredAt
deleteGear(id)        → only if no log refs; otherwise throws (suggest retire)
```

### Extend log actions

`logCardio` / `logRun` / `updateCardioLog` accept new params:

```ts
gearIds?: string[]                       // saved gear refs
newGear?: { name, activitySlug, type?, brand?, model?, lifetimeMiles? }
clearGear?: boolean                      // edit-only: explicitly unlink all
```

Resolution helper `resolveGearIdsForLog(input)`:
1. If `newGear.name` provided, dedup by `(activitySlug, name)` case-insensitive; create if missing.
2. Concat resolved id with `gearIds[]`.
3. Return final id list.

Dedup follows the same shape as `resolveActivitySpotId` after the recent rewrite — name-based, no surprises.

### New API endpoint: `/api/gear/recent`

Mirrors `/api/spots/recent`. Returns the user's most-recently-used gear for the given activity slug (and compatible activities) within the last 180 days. Drives the recent-chips row in the picker.

### Optional Phase 1 extra: `/api/gear/search`

Not strictly needed since the form already loads saved gear at mount via log-data. Add only if perceived lag.

### Extend log-data API

`/api/routines/[id]/log-data` already returns `savedSpots` for cardio. Add `savedGear: GearPickerItem[]` filtered to active + compatible activities. Same query shape: filter by `activitySlug IN compatibleActivitySlugs(slug)`, `retiredAt: null`, order by `name`.

---

## UI components

### `app/components/log/GearPicker.tsx`

Sibling to SpotPicker. Same UX patterns, simpler because:
- No GPS, no OSM, no coords, no region
- No "pin to a known location" mode
- Just: search saved → pick OR create new → chip

#### Collapsed states

```
[+ Add gear]   ← no gear selected, collapsed
[👟 Brooks Ghost 16 (running shoe) · 247 mi]   [✎] [✕]   ← selected, collapsed
```

#### Expanded states

```
GEAR                                              [✕]
[🔍 Search saved gear, or type a name…       ]
Recent: [Brooks Ghost 16]  [Salomon Speedcross]

(dropdown when typing 2+ chars)
┌─────────────────────────────────┐
│ YOUR GEAR                       │
│ 👟 Brooks Ghost 16 · 247 mi     │
│ 👟 Salomon Speedcross 5 · 612 mi │
│                                 │
│ CREATE                          │
│ ✏️  Save "{typed}" as new gear  │
└─────────────────────────────────┘
```

#### After picking a saved gear → chip (collapses)

#### After "Create new" → confirmation card stays expanded:
```
✓ {editable name input}                [Search again] [✕]
[Type: Trail shoe | Road shoe | Hiking boot | …]   ← optional, only when config defines types
[Brand:           ] [Model:          ]
[Lifetime cap: 500 mi (optional)]
[Notes (optional)]
```

#### Saved-gear confirmation card (when expanded):
- Show name + miles + lifetime cap + active progress bar.
- "Edit in /gear" link for full editing (v1 keeps picker confirmation read-only-ish; rich editing lives on the inventory page).

### `app/gear/page.tsx`

Inventory listing. Sections:
1. **Active gear** (top): cards with name, type, miles / cap, % bar, last-used date.
2. **Retired gear** (collapsed `<details>`): same cards, dimmed.

Each card has:
- `[Edit]` → opens a modal/drawer with full edit form (or links to `/gear/[id]/edit`)
- `[Retire]` / `[Unretire]` → server action
- Mileage warning chip at 90% (amber) / 100% (red) for active gear with a cap.

### `app/gear/[id]/edit/page.tsx`

Server-rendered edit form. Reuses standard form pattern (`FormStack`, `FormSection`, `inputStyle`, `textareaStyle`).

Fields: name, type, brand, model, purchasedAt (date picker), lifetimeMiles (numeric), notes. Plus retire toggle.

(`/gear/[id]/page.tsx` detail page with log history + chart deferred to Phase 2.)

---

## Form integration

### v1 forms wired

| Form | Change |
|---|---|
| [`LogRunForm`](app/routines/%5Bid%5D/log-cardio/ui.tsx) | Add `GearPicker` after `SpotPicker`. Save flow gains `gearIds`/`newGear` params. |
| [`EditRunLogForm`](app/routines/%5Bid%5D/log-cardio/%5BlogId%5D/EditRunLogForm.tsx) | Same — preload current gear via `initialGear: GearPickerValue`. |
| [`EditRoutineLogPage`](app/routines/%5Bid%5D/logs/%5BlogId%5D/details/EditRoutineLogPage.tsx) | Server-side: fetch saved gear + log's current gear refs and pass through. |

### Draft persistence
Extend `CardioDraft` in [`lib/log-draft.ts`](lib/log-draft.ts):

```ts
gearValue?: GearPickerValue;  // mirrors spotValue
```

Restore in `LogRunForm.useEffect(loadDraft)`.

### Picker value shape

Mirror of `SpotPickerValue`:

```ts
export type GearPickerValue =
  | { kind: "saved"; ref: { id: string }; display: { name: string; lifetimeProgress: number | null } }
  | { kind: "new"; draft: { name: string; type: string | null; brand: string | null; model: string | null; lifetimeMiles: number | null } }
  | null;
```

Lives in `lib/gear-picker-types.ts` (parallel to `lib/spot-picker-types.ts`) so log-draft can reference it without a React component dep.

---

## Lifetime tracking semantics

### Computing mileage

Computed on demand. No cached aggregate in the table (v1 keeps it simple). Query shape:

```ts
const logs = await prisma.routineLogGear.findMany({
  where: { gearId: id },
  select: { weight: true, routineLog: { select: { distanceMi: true, performedAt: true } } },
});
const totalMiles = logs.reduce((s, r) => s + (r.routineLog.distanceMi ?? 0) * r.weight, 0);
```

For the inventory page, batch-fetch by `gearId IN (...)` and group in Node. With dozens of gear and thousands of logs this is sub-100ms.

If perf becomes an issue: add `lifetimeMilesAccrued: Float @default(0)` on Gear, increment in `logCardio` save (and decrement on log delete / unlink). Out of v1 scope.

### Display

Inventory card:
```
👟 Brooks Ghost 16          247 / 500 mi
   trail shoe · used 2d ago  ━━━━━━━━━━░░░░░░░░░░ 49%
```

When `lifetimeMiles` is null: just show total miles, no bar.
When `% >= 90`: bar turns amber, small "Approaching lifetime" tag.
When `% >= 100`: bar turns red, "Retire?" CTA.

### What counts toward mileage
- Only logs that link the gear via `RoutineLogGear`.
- Distance comes from `RoutineLog.distanceMi` (set by `logCardio` / `logRun`).
- Sessions without `distanceMi` (shouldn't happen for cardio, but defensive) count toward session count but not miles.

---

## Edge cases

| Case | Handling |
|---|---|
| User deletes a log linked to gear | `RoutineLogGear.routineLogId` has `onDelete: Cascade` → join row deleted, gear's accrued miles update naturally on next read. |
| User wants to delete gear with logs | `deleteGear` throws with a friendly "Has X logs — retire instead?" message. User retires. |
| Retired gear still shown historically | Yes. Logs from before retirement still display the gear chip. New logs don't see retired gear in the picker. |
| Gear used across activities (trail runners worn for road running too) | Picker for `running` includes gear with `activitySlug` in `compatibleActivitySlugs("running")` → trail-running gear surfaces. Mileage accrues correctly regardless of which log's activity slug triggered the use. |
| User renames gear after some logs | Logs still link via ID; display updates everywhere automatically. |
| `lifetimeMiles` set lower than current accrued | Bar shows >100%, red "Retire?" CTA. No automatic retirement — user decides. |
| Lifetime cap edited mid-life | Re-renders progress correctly. No data migration needed. |
| Two pairs of identical shoes | User differentiates by name ("Brooks Ghost 16 — orange" vs "Brooks Ghost 16 — black"). Dedup is `(slug, name)` case-insensitive, so different names = different records. |
| Same name typed in two formats ("Ghost 16" vs "ghost 16") | Dedup matches case-insensitively → links to existing. |

---

## Migration story

Pure additive — no existing data touched.

- New tables (`Gear`, `RoutineLogGear`) created via Prisma migration.
- Existing `RoutineLog` rows have empty `gear` relation; UI shows "no gear logged" gracefully.
- No backfill script needed.

Migration name suggestion: `add_gear_tracking_footwear`

---

## Phasing

### Phase 1 — Footwear for cardio (this build)
1. Prisma schema additions + migration
2. `lib/gear.ts`, `lib/gear-picker-types.ts`
3. Server actions in `app/gear/actions.ts`
4. Extend `logCardio` / `logRun` / `updateCardioLog` with gear params + `resolveGearIdsForLog` helper
5. `GearPicker.tsx` component (single-select UI)
6. Wire into `LogRunForm` + `EditRunLogForm`
7. Extend `EditRoutineLogPage` server-side to fetch saved gear + initial gear
8. Extend `log-data` API to return `savedGear`
9. `/api/gear/recent` endpoint
10. Draft persistence in `CardioDraft`
11. `/gear` inventory page (cards with mileage + lifetime bar)
12. `/gear/[id]/edit` edit form + retire/unretire actions

### Phase 2 — Polish + multi-gear
- Multi-gear select UI (schema already supports — chip stack instead of single chip)
- `/gear/[id]` detail page with log timeline + mileage trend sparkline
- Mileage warning UI (amber 90% / red 100%)
- Inline edit / retire on the picker itself (small affordance, mirrors spot)
- Cached `lifetimeMilesAccrued` if read perf becomes an issue

### Phase 3 — Other activities
- **Biking** (`biking`, `road-cycling`, `mountain-biking`, `gravel-cycling`) — mileage tracking same as running. Generic shape covers it.
- **Climbing** (rope/sport/lead templates only — bouldering skipped). Different rollup: session count + age, no miles. Lifetime in years for ropes.
- **Skiing / snowboarding / surfing** — session count + days, not miles.

Generalize the lifetime metric: add `lifetimeUnit: "miles" | "sessions" | "days"` to Gear. v1 hardcodes miles for cardio; v3 generalizes.

### Phase 4 — Optional richer attributes
- Photo upload per gear
- Brand/model autocomplete from a small seed list
- Bike component sub-records (drivetrain, tires, etc.) — JSON blob on Gear or new related table
- "Replaces" relation between gear pieces

---

## Open questions

1. **Multi-gear UI in v1?** — Recommend single-select v1 for simpler UX, schema-ready for v2 multi.
2. **Inline gear editing on the picker?** — Probably no. Push edits to `/gear`. Picker stays focused on selection. (If users complain, easy to add later.)
3. **Where does the "Add gear" entry-point live?** — Inside the log form, below the spot picker. Also a top-level "+ Add gear" on `/gear` page for proactive management.
4. **Should logs without distance (e.g., misc cardio) still link gear?** — Yes. They count toward session count but not miles. Cheap to allow.
5. **Pre-populate brand/model autocomplete?** — Skip in v1. User types freeform. Add a seed list of common brands in Phase 4 if it feels worth it.
6. **`/gear` page navigation entry?** — Add a link in the activities index (e.g., next to "Map") for any activity that supports gear. Or a top-level nav item.
7. **Surfacing gear on the routine card?** — "Your last run used Brooks Ghost 16 (244 mi)" — small contextual UI. Defer to Phase 2.

---

## File checklist (Phase 1)

### New
- [ ] `prisma/migrations/{ts}_add_gear_tracking_footwear/migration.sql`
- [ ] `lib/gear.ts`
- [ ] `lib/gear-picker-types.ts`
- [ ] `app/gear/actions.ts`
- [ ] `app/gear/page.tsx`
- [ ] `app/gear/[id]/edit/page.tsx`
- [ ] `app/components/log/GearPicker.tsx`
- [ ] `app/api/gear/recent/route.ts`

### Modified
- [ ] `prisma/schema.prisma`
- [ ] `lib/log-draft.ts` — add `gearValue` to `CardioDraft`
- [ ] `app/routines/actions.ts` — `logCardio`/`logRun`/`updateCardioLog` extension + `resolveGearIdsForLog`
- [ ] `app/api/routines/[id]/log-data/route.ts` — return `savedGear` for cardio
- [ ] `app/routines/[id]/log-cardio/ui.tsx` — `GearPicker` wired in
- [ ] `app/routines/[id]/log-cardio/[logId]/EditRunLogForm.tsx` — picker + save mapper
- [ ] `app/routines/[id]/logs/[logId]/details/EditRoutineLogPage.tsx` — gear fetch + prop pass

---

## Quick decision log (resolved during planning)

- **Generic gear shape, not per-activity schemas** — start with `name + type + brand + model + dates + notes`. Specialize later if needed.
- **N:M from day one** — schema supports multi-gear, UI ships single-select.
- **Lifetime in miles for v1** — generalize the unit when sport gear lands (Phase 3).
- **Cross-activity compat via existing graph** — reuse `compatibleActivitySlugs()` so trail-running shoes show up on running logs.
- **Dedup by `(slug, name)` case-insensitive** — same pattern as the post-rewrite spot logic.
- **Soft retirement, hard delete only when no logs** — preserves historical accuracy.
