# Gear & Gear Lists — Implementation Plan

Status: planning
Owner: Eric (ericmcnw@gmail.com)
Last updated: 2026-06-29

## Vision

Three converging ideas, built on one shared `Gear` primitive:

1. **Gear** — a catalog of what you own, with **lifetime usage tracking** (320 mi on these shoes, retire soon; this rope has 18 months on it). The killer feature for individual items.
2. **Gear lists** — named collections, in two flavors:
   - **Loadouts** — reusable sets of owned gear ("Trad rack", "Winter run kit"). Each item carries a weight, so a loadout doubles as a **pack-weight sheet**.
   - **Checklists** — pre-activity, checkable lists that may include **non-inventory** items (sunscreen, 2 L water, fuel). A prep tool, not usage tracking.
3. **Backpacking trips** — a new cardio activity under the hiking umbrella where gear, weighted loadouts, and **multi-day logging** all meet. A trip is a weighted loadout carried over several days of trail miles.

The unifying mechanic: **applying a loadout to a log expands into per-item usage links (`RoutineLogGear`) and snapshots the pack weight.** That ties list-building, usage rollups, and trip logging into one flow.

---

## Build order: Backpacking trip first (v0 — NO migration)

We're building **backpacking trip logging first** (Eric just took a trip and wants
to log it). This deliberately rides existing rails and needs **zero schema
changes**: the trip lives in `RoutineLog.sportData` (like golf), location reuses
`ActivitySpot`, and gear is an **inline weighted list inside `sportData`** — the
full `Gear`/loadout tables come later and will *populate* this list, not replace
it. The inline list is the trip's permanent gear snapshot either way (see
"snapshot" in the model section), so this is forward-compatible, not throwaway.

### Why this rides the golf path
Golf is the exact template: a dedicated sheet → a discriminated `sportData` blob →
the synthetic-routine + weather/zone hooks → parsed in `lib/log-summary.ts` →
rendered in `RoutineLogSummary`. Backpacking swaps golf's per-hole grid for
**per-day rows** and golf's per-club shots for an **inline gear list**.

### `sportData` shape (v0)
```ts
sportData = {
  sport: "backpacking",
  trail?: string,                     // overall route, "John Muir Trail"
  days: [                             // miles is the only required field
    { ymd: string, miles: number, elevGainFt?: number, campsite?: string,
      trail?: string, notes?: string },
  ],
  gear: [                             // inline snapshot; no Gear table yet
    { name: string, weightGrams?: number, quantity?: number, consumable?: boolean },
  ],
  packWeightGrams?: number,           // computed total at save (denormalized for display)
  baseWeightGrams?: number,           // computed total excluding consumables
}
```
- `RoutineLog.distanceMi` = sum of `days[].miles` → counts as cardio miles (the
  home Last-7-days sum is domain-agnostic; confirmed in [data.ts](app/_home/data.ts)).
- `performedAt` = first day at local noon; nights = `days.length - 1`; miles/day
  derived. Pack weight shows one total by default; the base/total split only
  appears when an item is flagged consumable.

### Placement / categorization (decided)
Backpacking reads as **cardio under the hiking umbrella**, so:
- Register `{ slug: "backpacking", label: "Backpacking", family: "endurance",
  eyebrow: "Endurance · Outdoor", icon: "🎒", sortHint: 61 }` (right after Hiking)
  in [lib/activity-families.ts](lib/activity-families.ts).
- Give it a **dedicated synthetic routine with `domain: "cardio"`** (not the
  generic `ensureSportSelected`, which hardcodes `domain: "sport"` and rejects
  non-sports families). Add a small `ensureBackpackingRoutine()` helper, or
  generalize the synthetic-routine factory to take `{ family, domain }`.
- Dispatch the dedicated sheet from the FAB / quick-log surfaces the same way
  golf's sheet is ([Fab.tsx](app/_home/Fab.tsx), SportQuickLogRow, QuickLogPicker),
  and surface an entry point near Hiking in the endurance log area.

### Files — v0 backpacking
**New**
- [ ] `app/log/backpacking-log-actions.ts` — `logBackpackingAction` / `updateBackpackingLogAction` (mirror [golf-log-actions.ts](app/log/golf-log-actions.ts)): build `sportData`, compute `distanceMi` + pack/base weight, resolve `ActivitySpot`, `stampLogWeather`, `createActivityZoneActivitiesForLog`.
- [ ] `app/routines/BackpackingLogSheet.tsx` — dedicated sheet (mirror [GolfLogSheet.tsx](app/routines/GolfLogSheet.tsx)): `SportLogModal` chrome, `SpotPicker` for trailhead/area, repeatable **day rows** (add/remove, miles required), repeatable **gear rows** (name + weight + qty + consumable toggle) with a live pack-weight readout, `EffortSlider`, `form-ui` inputs (all `fontSize >= 16`).
- [ ] `lib/synthetic-backpacking-routine.ts` (or extend `synthetic-sport-routines.ts`) — `ensureBackpackingRoutine()` + id helper, `domain: "cardio"`, `kind: "SESSION"`, `isPlaceholder: true`.

**Modified**
- [ ] [lib/activity-families.ts](lib/activity-families.ts) — registry entry.
- [ ] [lib/log-summary.ts](lib/log-summary.ts) — parse `sport: "backpacking"` into a `LogSummarySportData` variant (days + gear + weights + totals).
- [ ] [app/components/RoutineLogSummary.tsx](app/components/RoutineLogSummary.tsx) — a Backpacking panel: trail/location header, per-day table (day, miles, elev, campsite, notes), totals (miles, nights, miles/day), gear list with pack/base weight.
- [ ] FAB + quick-log dispatch ([Fab.tsx](app/_home/Fab.tsx), SportQuickLogRow, QuickLogPicker) — offer the backpacking sheet.
- [ ] Draft persistence — a `BackpackingDraft` via the existing `useSportLogDraft` pattern (day rows + gear rows survive close/reopen; add new fields to `initial`).

### Deferred out of v0 (becomes the rest of this plan)
- `Gear` inventory table + lifetime/mileage rollups (Phase 1 below).
- `GearList` loadouts + checklists (Phase 2) — later, "save these as a loadout"
  and "fill gear from a loadout" buttons on the backpacking sheet.
- Per-item usage links (`RoutineLogGear`) — once `Gear` exists, expand the inline
  list into links so trip mileage/nights accrue to real inventory items.
- Multi-day → child day-logs (only if week-view attribution becomes annoying).

> After v0 ships and the trip is logged, the phases below proceed in order, and the
> inline backpacking gear list becomes the first consumer of the real `Gear` model.

---

## Refined gear spec (2026-06-30) — typed inventory + picker

This supersedes the inline `sportData.gear` list in the backpacking v0 sheet:
that list is replaced by a **picker backed by a real `Gear` inventory**, so gear
is entered once and reused. Driven by Eric's ask: a typeable **type** dropdown,
a **name**, a **weight**, saved + reusable, with footwear carrying across log
types.

### The gear row → a picker
Each gear line becomes:
- **Type** — a *typeable dropdown* (combobox / `<input list>`): presets +
  free-type your own. Presets: Footwear, Pack, Tent, Sleeping bag, Sleeping pad,
  Stove, Cookware, Water (filter/bottles), Clothing, Electronics, Other.
- **Name** — free text ("Hyperlite 2400", "Brooks Ghost 16").
- **Weight** — number (oz in the UI, stored grams).
- Plus **select-from-saved**: typing/opening shows your existing gear of relevant
  types to pick instead of re-entering; "＋ Save new" creates an inventory row.

### Model
Refines the `Gear` table below. Key fields for this ask:
```prisma
model Gear {
  id           String   @id @default(cuid())
  profileKey   String
  type         String   // "footwear" | "tent" | "sleeping-bag" | "pack" | … (free)
  name         String
  weightGrams  Int?
  // Where it was created — drives cross-activity visibility together with
  // type scope. Universal-type gear ignores this.
  activitySlug String?
  consumable   Boolean  @default(false)
  retiredAt    DateTime?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  @@index([profileKey, type])
}
```

### Cross-log-type visibility ("footwear saves over log types")
A small **type → scope** config (`GEAR_TYPE_PRESETS`):
- **Universal** types (footwear, watch, headlamp, sunglasses, clothing) show on
  *any* gear-enabled log regardless of `activitySlug`.
- **Activity-scoped** types (pack, tent, sleeping bag, sleeping pad, stove,
  cookware, water) show only where `activitySlug ∈ compatibleActivitySlugs(current)`.
- Free-typed custom types default to **activity-scoped** (the activity they were
  created on); can be promoted to universal later.

Picker query for activity A:
`type ∈ UNIVERSAL_TYPES  OR  activitySlug ∈ compatibleActivitySlugs(A)` — reuses
the existing compat graph from `lib/activity-spots.ts`. So footwear logged on a
run surfaces on a backpacking trip; a tent stays out of the run picker.

### Trip ↔ inventory link
On a backpacking save, the picked gear writes a **snapshot** into the trip
(`sportData.gear` keeps `{ gearId?, name, weightGrams, quantity, consumable }`)
so pack-weight history is stable even if the inventory item is later edited —
exactly the snapshot pattern already used for `packWeightGrams`. New gear created
inline also lands in the `Gear` table for reuse.

### Phasing
1. **Backpacking form** — `Gear` table + `GearPicker` (type/name/weight +
   select-from-saved) replacing the inline rows. Delivers the whole ask within
   backpacking.
2. **Cardio logs (footwear)** — add the picker to run/hike (`log-cardio/ui.tsx`)
   so footwear carries across. This is the "saves over log types" payoff and the
   original Phase-1 footwear-mileage hook.
3. **Gear management page** (`/gear`) + retire + mileage/usage rollups — the rest
   of this plan below.

### Open calls (decide at build time)
- A dedicated `/gear` management screen vs. manage-inline-only for v1.
- Whether `quantity` lives on the trip's snapshot only (yes) or also on `Gear`.
- Retire flow + whether the picker hides retired gear (yes).

---

## Cross-app gear + usage surfacing (2026-06-30)

Gear is a primitive across the whole app, not just backpacking/footwear. Same
`Gear` table; the picker appears wherever an activity has hardware worth tracking.

### Sports hardware (savable boards, etc.)
Activity-scoped gear types feed the relevant sport sheets:
- `snowboard` → Snowboarding · `skis` → Skiing · `surfboard`/`bodyboard` →
  Surfing/Bodysurfing · `skateboard` → Skateboarding · (climbing: `rope`,
  `harness`, `shoes`, `rack` — though climbing has its own world).
- Pick "your board" on a snowboard log the same way you pick footwear on a run.
  Saved once, reused; activity-scoped so a surfboard never shows on a ski log.

### Usage metrics by type (the interesting part)
Each gear **type** maps to a natural lifetime unit, computed from the logs/trips
that reference it:

| Type | Unit | Source |
|---|---|---|
| footwear | **miles** | Σ `distanceMi` of linked logs (cardio + backpacking days) |
| tent · sleeping bag · sleeping pad | **nights** | Σ trip nights (`days−1`) of linked trips |
| pack | **trips + nights** | count + Σ nights |
| snowboard · skis | **days / sessions** | count of linked sport logs |
| surfboard · bodyboard | **sessions** (+ waves if tracked) | count of linked logs |
| rope · harness | **sessions + age** | count + months since `purchasedAt` |
| (generic) | **sessions + age** | count + age |

Unit/scope/surfacing all come from one `GEAR_TYPE` registry (preset types →
`{ label, scope: universal|activity, unit, surfacesIn: activitySlug }`).

### Where gear shows up
- **`/gear` hub** — the home for gear. Inventory grouped by activity, each card
  showing its type-appropriate usage ("Brooks Ghost 16 · 247 mi", "Big Agnes ·
  18 nights", "Lib Tech · 24 days") + retire status / lifetime bar.
- **Endurance world** (`/activities/endurance`) — a **Footwear** widget: shoe
  mileage + retire nudge. (Per Eric: shoe miles read as endurance.)
- **Sport worlds** (`/activities/[sport]`) — that sport's gear + usage (snowboard
  days on Snowboarding, boards on Surfing, …).
- **Backpacking / trip** — tent nights, pack-weight trend across trips.
- **`/gear/[id]` detail** — usage timeline + trend chart + retire/replace ("Ghost
  16 replaces Ghost 15").
- **Log form picker** — selection (already specced above).
- **Home nudge** (optional) — "your shoes passed 400 mi — retire?".

### Model implication
Usage needs gear↔log links, not just the trip snapshot:
- `RoutineLogGear` (logId ↔ gearId) for cardio + sport logs.
- Backpacking gear links to the trip (so nights derive from the trip's days).
- Aggregations are cheap on-demand reads (Σ over linked logs); cache later if
  the `/gear` hub feels slow.

### Phasing (revised)
1. **Inventory + picker** across backpacking → cardio footwear → sport boards
   (the `Gear` table + `GearPicker`, type/name/weight + select-from-saved).
2. **Usage rollups + `/gear` hub** — per-type units, lifetime bars, retire.
3. **World-page widgets** — footwear on Endurance, boards on sport worlds, tent
   nights on backpacking.
4. **`/gear/[id]` detail + replacement graph + home nudges.**

## Information architecture (2026-06-30) — gear lives across three verbs

Gear has three distinct jobs that map onto the app's sections, so it isn't a
single destination:

- **Log → *use* gear.** The picker (what you brought). Inline in log forms; no
  page needed. (Phase 1 above.)
- **Plan → *prep* gear.** Checklists + loadouts (packing list / "winter run
  kit"). Plan = "get ready", so the gear-lists feature lands here — a strong
  backpacking payoff (tick off your pack before a trip; reuse a saved loadout).
- **Stats → *review* gear.** Inventory + usage rollups (miles/nights/days,
  retire). The "see all my kit" surface.

Candidate nav reframe (separate, bigger effort — do NOT couple to the gear
build): rename **Activities → "Stats"** and make it a tabbed review hub —
**Activity · Body · Gear** — giving the whole app a clean three-verb model:
**Log** (record) · **Plan** (prep) · **Stats** (review). Body gets a more
deliberate home; Gear's inventory/usage sits alongside it.

None of this blocks Phase 1, which is entirely inside the Log forms.

---

## Usage rollups — build plan (2026-06-30)

The payoff: per-gear lifetime stats ("247 mi on these shoes", "18 nights in the
tent", "24 days on the board"), computed on demand from the links we now record.

### Data sources (both already exist)
- **`RoutineLogGear`** (cardio + sport logs) — join to `RoutineLog` for
  `distanceMi` / `durationSec` / `performedAt`.
- **`BackpackingTrip.gear`** snapshot (`gearId` per item) — join to the trip's
  day-logs for miles + nights (`days − 1`).

### Compute (`lib/gear-usage.ts`)
`getGearUsage(gearIds: string[]): Map<gearId, GearUsage>` where
```ts
type GearUsage = {
  unit: "miles" | "nights" | "days" | "sessions"; // from gearTypeMeta(type).unit
  value: number;        // miles / nights / days / sessions per the unit
  sessions: number;     // # of logs/trips it appears on
  firstUsed: string | null;
  lastUsed: string | null;
};
```
Per unit:
- **miles** → Σ `distanceMi` of linked cardio/sport logs **＋** Σ backpacking day
  miles for trips whose snapshot lists the gear.
- **nights** → Σ trip nights for trips listing the gear.
- **days** → count of **distinct days** with a linked log (boards/skis).
- **sessions** → count of linked logs/trips.

One batched query per source (links by `gearId IN (...)`, trips by profile then
filter snapshots in Node — trips are few), grouped in memory. Sub-100ms at real
scale; add a cached `lifetimeAccrued` column only if the `/gear` hub feels slow.

### Retire threshold
Add optional `lifetimeCap Float?` to `Gear` (unit implied by type). Usage view
shows a progress bar; ≥90 % amber "approaching", ≥100 % red "retire?". No
auto-retire — the user decides (matches the retire flow already specced).

### Surfacing (in priority order)
1. **`/gear` hub or Gear tab** — cards: icon · name · "247 / 500 mi" + bar +
   last-used. Grouped by activity. The home for usage.
2. **Endurance world** — a Footwear strip (shoe miles + retire nudge).
3. **Sport worlds** — that sport's boards/skis + days/sessions.
4. **Backpacking / trip** — tent nights, pack-weight trend.
5. **`/gear/[id]`** — usage timeline + trend + "replaces" relation.

### Phase order
1. `lib/gear-usage.ts` + a minimal usage read.
2. `/gear` hub (or Gear tab) rendering the cards.
3. World-page widgets (footwear on Endurance first).
4. `lifetimeCap` + retire warnings + `/gear/[id]` detail.

---

## Core data model

### `Gear` — generalized from day one

The original plan was distance-only. Because we know backpacking (weight) and climbing (age/sessions) are coming, the generalized fields go in now as optional columns — additive, zero retrofit later.

```prisma
model Gear {
  id           String   @id @default(cuid())
  profileKey   String   // session-keyed, multi-user-ready (same pattern as LocationPing)
  name         String   // "Brooks Ghost 16 — orange", "Hyperlite 2400 pack"
  activitySlug String   // primary activity: "running", "backpacking", "sport-climbing"…
  type         String?  // free-form: "trail shoe", "pack", "rope", "tent"
  brand        String?
  model        String?

  // Pack-weight support (null for things you don't weigh, e.g. shoes).
  weightGrams  Int?
  // Consumables (food/fuel/water) are excluded from "base weight". Opt-in:
  // if you never set it, pack weight is just one total.
  consumable   Boolean  @default(false)

  // Generalized lifetime: cap + unit, instead of a hardcoded miles cap.
  lifetimeCap  Float?   // e.g. 500 (mi), 200 (days), 150 (sessions)
  lifetimeUnit String?  // "miles" | "sessions" | "days"  (null = no warnings)

  purchasedAt  DateTime?
  retiredAt    DateTime?   // soft retirement; preserves historical accuracy
  notes        String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  logs      RoutineLogGear[]
  listItems GearListItem[]

  @@index([profileKey, activitySlug, retiredAt])
}
```

### `RoutineLogGear` — per-log usage link (N:M)

```prisma
model RoutineLogGear {
  routineLogId String
  gearId       String
  // Reserved for v2 multi-gear where usage splits across items. v1 writes 1.0.
  weight       Float    @default(1.0)
  createdAt    DateTime @default(now())

  routineLog RoutineLog @relation(fields: [routineLogId], references: [id], onDelete: Cascade)
  gear       Gear       @relation(fields: [gearId], references: [id], onDelete: Cascade)

  @@id([routineLogId, gearId])
  @@index([gearId])
}
```

`RoutineLog` gains `gear RoutineLogGear[]`.

### `GearList` / `GearListItem` — loadouts + checklists

```prisma
model GearList {
  id           String   @id @default(cuid())
  profileKey   String
  name         String   // "Trad rack", "JMT resupply kit"
  kind         String   // "loadout" | "checklist"
  activitySlug String?  // optional association ("backpacking", "sport-climbing")
  notes        String?
  isActive     Boolean  @default(true)
  isDeleted    Boolean  @default(false)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  items GearListItem[]

  @@index([profileKey, kind, isActive])
}

model GearListItem {
  id        String  @id @default(cuid())
  listId    String
  // EITHER a ref to owned gear (loadout; inherits weight + identity + usage)…
  gearId    String?
  // …OR a free-text entry not in inventory (checklist: "sunscreen", "2 L water").
  label     String?
  // Weight for label-only items, or a per-list override of a gear's weight.
  weightGramsOverride Int?
  consumableOverride  Boolean?  // override the gear/item consumable flag for this list
  quantity  Int     @default(1)
  checked   Boolean @default(false)  // checklist progress
  sortOrder Int     @default(0)

  list GearList @relation(fields: [listId], references: [id], onDelete: Cascade)
  gear Gear?    @relation(fields: [gearId], references: [id], onDelete: SetNull)

  @@index([listId])
  @@index([gearId])
}
```

**List weight math** (loadouts):
- An item's weight = `gearId ? gear.weightGrams : weightGramsOverride` × `quantity`.
- An item's consumable = `consumableOverride ?? gear.consumable ?? false`.
- **Total weight** = sum over all items. **Base weight** = sum excluding consumables.
- UI shows total by default; base/total split appears only when at least one item is flagged consumable (so non-backpackers never see clutter). → satisfies "either a single number or the split."

### Backpacking trip detail — `RoutineLog.sportData` JSON

A backpacking trip is **one `RoutineLog`** under a `backpacking` activity slug (hiking family), with the multi-day detail in `sportData` (CLAUDE.md rule 2 — same pattern golf uses):

```ts
sportData = {
  sport: "backpacking",
  trail?: string,                 // overall route, e.g. "John Muir Trail"
  days: [                         // miles is the only required field per row
    {
      ymd: string,                // the calendar day
      miles: number,
      elevGainFt?: number,
      campsite?: string,
      trail?: string,             // segment, if different from overall
      notes?: string,
    },
  ],
  loadoutId?: string,             // the GearList carried
  packWeightGrams?: number,       // snapshot at save time (loadout can change later)
  baseWeightGrams?: number,       // snapshot (non-consumables) at save time
}
```

- `RoutineLog.distanceMi` = sum of `days[].miles` (so existing totals/charts still work).
- `performedAt` = first day; days count + miles/day average are derived.
- Applying a loadout: expand it into `RoutineLogGear` links (per-item usage accrues) **and** snapshot `packWeightGrams` / `baseWeightGrams` so later edits to the loadout don't rewrite trip history.

---

## Phasing

Each phase is independently shippable and useful on its own.

### Phase 1 — Gear + footwear/cardio (proof of concept)
The original plan, with the **generalized model** above (weight + lifetimeUnit ship now, only miles is used).
- `Gear` + `RoutineLogGear` + migration.
- `GearPicker` (single-select UI; schema is N:M-ready) in run/hike log forms.
- `/gear` inventory page with lifetime mileage + cap progress bar.
- Lifetime rollups computed on demand from `RoutineLog.distanceMi`.

### Phase 2 — Gear lists (loadouts + checklists)
- `GearList` / `GearListItem` + migration.
- `/gear` grows a **Lists** tab. Loadout editor shows running **base/total weight**; checklist editor supports free-text items + checkboxes.
- "Apply loadout" affordance in the log picker (expands to gear links).
- This delivers a **pack-weight planner** before backpacking trips even exist.

### Phase 3 — Backpacking trips
- New `backpacking` activity type under the hiking family.
- Multi-day trip log form: per-day rows (miles required; elevation/campsite/trail/notes optional), overall trail + location via [SpotPicker](app/components/log/SpotPicker.tsx), attach a loadout → pack weight (base/total).
- Trip detail view: per-day breakdown, miles/day, pack weight, gear carried.

### Phase 4 — Polish / other activities
- Multi-gear select UI (chip stack; schema already supports).
- `/gear/[id]` detail page: log timeline + usage trend.
- Climbing (rope/harness): `lifetimeUnit: "days" | "sessions"`, age-based retirement.
- Biking mileage (same as running). Skis/boards/surf: session/day units.
- Photo upload per gear (reuse climb-media blob infra), brand/model autocomplete, "replaces" relation, cached `lifetimeAccrued` if read perf demands it.

---

## Phase 1 mechanics (footwear/cardio) — still the starting point

### Activities included
`running`, `road-running`, `trail-running`, `walking`, `hiking`. Picker renders only when the routine resolves to one of these slugs (or a compatible one via the existing `COMPATIBLE_ACTIVITY_SPOTS` symmetric map — trail-running shoes surface on running logs and vice-versa).

### Server: `lib/gear.ts`
Mirrors `lib/activity-spots.ts`:
- `GearBasic` type (id, name, type, brand, model, activitySlug, retired, optional aggregates).
- `getActivityGearConfig(slug)` → per-activity defaults (`noun: "shoes" | "boots"`, type options).
- `compatibleGearActivitySlugs(slug)` — reuse the existing compatible-activities graph.
- `buildGearPickerItems()` — mirror of `buildSpotPickerItems`.

### Server actions: `app/gear/actions.ts`
```ts
saveGear({ id?, name, activitySlug, type?, brand?, model?, weightGrams?, consumable?,
           purchasedAt?, lifetimeCap?, lifetimeUnit?, notes? })   // create or update by id
retireGear(id)   // sets retiredAt = now
unretireGear(id) // clears retiredAt
deleteGear(id)   // only if no log refs; else throw → suggest retire
```

### Extend log actions
`logCardio` / `logRun` / `updateCardioLog` accept:
```ts
gearIds?: string[]
newGear?: { name, activitySlug, type?, brand?, model?, weightGrams?, lifetimeCap?, lifetimeUnit? }
clearGear?: boolean
```
`resolveGearIdsForLog(input)`: if `newGear.name` set, dedup by `(activitySlug, name)` case-insensitive (create if missing); concat with `gearIds[]`; return final id list. Same shape as `resolveActivitySpotId`.

### APIs
- `/api/gear/recent` — most-recently-used gear for the activity slug (+ compatible) in the last 180 days. Drives recent-chips. Mirrors `/api/spots/recent`.
- Extend `/api/routines/[id]/log-data` to return `savedGear: GearPickerItem[]` filtered to active + compatible activities.

### `GearPicker.tsx` (sibling to SpotPicker)
Simpler than SpotPicker — no GPS/OSM/coords/region. Just: search saved → pick or create new → chip.

Collapsed:
```
[+ Add gear]                                            ← none selected
[👟 Brooks Ghost 16 (running shoe) · 247 mi]  [✎] [✕]   ← selected
```
Expanded: search input, recent chips, dropdown of YOUR GEAR (with miles) + a CREATE row. "Create new" keeps a confirmation card open with name/type/brand/model/weight/lifetime-cap/notes. Rich editing lives on `/gear`.

### `/gear` inventory page
- **Active gear** cards: name, type, miles / cap, % bar, last-used date.
- **Retired gear** in a collapsed `<details>`, dimmed.
- Card actions: Edit (modal or `/gear/[id]/edit`), Retire/Unretire. Warning chip at 90% (amber) / 100% (red) for capped gear.

### Form integration
| Form | Change |
|---|---|
| [`LogRunForm`](app/routines/%5Bid%5D/log-cardio/ui.tsx) | `GearPicker` after `SpotPicker`; save gains `gearIds`/`newGear`. |
| [`EditRunLogForm`](app/routines/%5Bid%5D/log-cardio/%5BlogId%5D/EditRunLogForm.tsx) | Same + preload via `initialGear: GearPickerValue`. |
| [`EditRoutineLogPage`](app/routines/%5Bid%5D/logs/%5BlogId%5D/details/EditRoutineLogPage.tsx) | Server-side: fetch saved gear + current refs, pass through. |

Draft persistence: add `gearValue?: GearPickerValue` to `CardioDraft` in [`lib/log-draft.ts`](lib/log-draft.ts); restore in `LogRunForm` draft load.

Picker value shape (`lib/gear-picker-types.ts`, parallel to `lib/spot-picker-types.ts`):
```ts
export type GearPickerValue =
  | { kind: "saved"; ref: { id: string }; display: { name: string; lifetimeProgress: number | null } }
  | { kind: "new"; draft: { name: string; type: string | null; brand: string | null; model: string | null; weightGrams: number | null; lifetimeCap: number | null; lifetimeUnit: string | null } }
  | null;
```

### Lifetime tracking semantics
Computed on demand (no cached aggregate in v1):
```ts
const logs = await prisma.routineLogGear.findMany({
  where: { gearId: id },
  select: { weight: true, routineLog: { select: { distanceMi: true, performedAt: true } } },
});
const totalMiles = logs.reduce((s, r) => s + (r.routineLog.distanceMi ?? 0) * r.weight, 0);
```
Batch by `gearId IN (...)` for the inventory page, group in Node. Sub-100ms at realistic scale. If perf bites later: add `lifetimeAccrued Float @default(0)`, increment on save / decrement on delete-unlink.

Display: `247 / 500 mi · used 2d ago` + bar. Null cap → total only, no bar. ≥90% amber "Approaching lifetime"; ≥100% red "Retire?". No auto-retirement — user decides.

What counts: only logs linked via `RoutineLogGear`; miles from `RoutineLog.distanceMi`; distance-less logs count toward session count but not miles.

---

## Edge cases

| Case | Handling |
|---|---|
| Delete a log linked to gear | `RoutineLogGear` `onDelete: Cascade` → join row gone; accrued usage updates on next read. |
| Delete gear that has logs | `deleteGear` throws "Has X logs — retire instead?". |
| Retired gear shown historically | Yes. Old logs keep their gear chip; picker hides retired gear from new logs. |
| Gear used across activities | Picker includes `compatibleActivitySlugs()`; mileage accrues regardless of which log triggered it. |
| Rename gear after logs | Logs link by ID; display updates everywhere. |
| `lifetimeCap` below current accrued | Bar >100%, red "Retire?". No auto-retire. |
| Two identical pairs | Differentiate by name; dedup is `(slug, name)` case-insensitive. |
| Loadout edited after a trip used it | Trip stores **snapshot** `packWeightGrams`/`baseWeightGrams` + its own `RoutineLogGear` links → history is stable. |
| List item references deleted gear | `GearListItem.gearId` `onDelete: SetNull`; item falls back to its `label`/override, or is pruned in the editor. |
| Checklist item not in inventory | `label` + optional `weightGramsOverride`; never creates a `Gear` row. |
| Backpacking trip spanning a week boundary | v1: all miles attributed to `performedAt` (trip start) in week views; per-day split is detail-only. Upgrade path: child day-logs (see below). |

---

## Open design notes

- **Multi-day modeling — start with one `RoutineLog` + `sportData.days[]`** (option A). Simplest, reuses all existing infra. Known caveat: week/Last-7-days views attribute trip miles to the start date. Only graduate to a trip-parent-with-child-day-logs model (option B) if that attribution actually becomes annoying. Clean upgrade, not a rewrite.
- **Pack weight — support either.** One total by default; base/total split surfaces only when an item is flagged consumable. (Resolved 2026-06-29.)
- **Per-day rows — miles required, rest optional.** Elevation, campsite, trail segment, notes all optional. (Resolved 2026-06-29.)
- **Multi-gear UI** — single-select in P1; schema is N:M from day one so no migration for the P4 chip-stack upgrade.
- **Lifetime unit** generalized from day one; P1 only exercises `"miles"`.

---

## Migration story

Pure additive — no existing data touched.
- P1: new `Gear`, `RoutineLogGear` tables (`add_gear_tracking_footwear`).
- P2: new `GearList`, `GearListItem` tables (`add_gear_lists`).
- P3: no new tables — `backpacking` rides existing `RoutineLog.sportData` + a new activity type row.
- Existing `RoutineLog` rows get an empty `gear` relation; UI shows "no gear logged" gracefully. No backfill.

> Deploy note: Vercel build runs only `next build` (no `prisma migrate deploy`), so each migration must be applied to the production DB separately. Gear reads should be best-effort where they sit on hot paths, so a not-yet-migrated prod never 500s.

---

## File checklist

### Phase 1 (new)
- [ ] `prisma/migrations/{ts}_add_gear_tracking_footwear/migration.sql`
- [ ] `lib/gear.ts`, `lib/gear-picker-types.ts`
- [ ] `app/gear/actions.ts`, `app/gear/page.tsx`, `app/gear/[id]/edit/page.tsx`
- [ ] `app/components/log/GearPicker.tsx`
- [ ] `app/api/gear/recent/route.ts`

### Phase 1 (modified)
- [ ] `prisma/schema.prisma`
- [ ] `lib/log-draft.ts` — `gearValue` on `CardioDraft`
- [ ] `app/routines/actions.ts` — `logCardio`/`logRun`/`updateCardioLog` + `resolveGearIdsForLog`
- [ ] `app/api/routines/[id]/log-data/route.ts` — return `savedGear`
- [ ] `app/routines/[id]/log-cardio/ui.tsx`, `.../[logId]/EditRunLogForm.tsx`, `.../logs/[logId]/details/EditRoutineLogPage.tsx`

### Phase 2 (lists)
- [ ] `prisma/migrations/{ts}_add_gear_lists/migration.sql`
- [ ] `lib/gear-lists.ts`
- [ ] `app/gear/lists/page.tsx`, `app/gear/lists/[id]/edit/page.tsx`, list actions
- [ ] Loadout/checklist editors; "apply loadout" in the gear picker

### Phase 3 (backpacking)
- [ ] `backpacking` activity type seed under the hiking family
- [ ] Backpacking log form (per-day rows + loadout + trail/location) + `sportData` shape
- [ ] Trip detail panel in `RoutineLogSummary`
