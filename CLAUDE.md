# Progression-Tracker — Working Rules

Rules-of-engagement for any Claude (or other agent) editing this repo. Auto-loaded into Claude Code sessions in this directory. Update as new rules emerge — keep entries dense and concrete, no abstract platitudes.

---

## 1. Port existing capability before adding new features

If you're rewriting or replacing a form, the new version must cover **everything the old one did** unless the user has explicitly asked you to drop a feature. Specifically:

- Read the existing component end-to-end before writing the replacement.
- Catalog every visible field, optional input, dropdown, and helper.
- Write the new version with at least that surface, then layer on the new asks.
- If a field is going away on purpose, call it out in the commit message.

Recent precedent: `ClimbLogSheet` shipped without route names, areas, tries-count, or outcome color-coding because the rewrite started from a clean spec instead of the existing `SessionLogForm` + `ClimbSessionLogger`. Don't do that again.

---

## 2. Honor existing infrastructure, don't duplicate it

Before introducing a "new" way to do something that already exists in the codebase, find the existing primitive and use it. The big ones:

- **Locations / spots → `app/components/log/SpotPicker.tsx`** with `lib/activity-spots.ts` helpers. Every sport that asks "where" uses this. OSM autocomplete, recent chips, cross-activity reuse, OSM-identity dedup are already built. The picker writes into `ActivitySpot` for non-climbing sports and `ClimbLocation` for climbing.
- **Climbing locations → `ClimbLocation`** with `ClimbArea` for sub-regions and `ClimbProblem` for routes. Tied to `/activities/climbing/map`. **Never** route climbing through `ActivitySpot` — it breaks the climbing-side relationships (problems, areas, gym/crag enum).
- **Sport-specific rich data → `RoutineLog.sportData` (Json?)** with a `sport: "<slug>"` discriminator. Today golf uses it; future sports add their own shape under the same column. Don't add new columns per sport.
- **Sport log chrome → `app/routines/SportLogModal.tsx`** (renders `.logDrawerSheet` via portal). Don't write custom bottom-sheet styles per sheet.
- **Draft persistence → `app/routines/useSportLogDraft.ts`** (localStorage-backed, debounced, merges over initial). All sport sheets should use this so close-and-reopen doesn't lose work. When you add a new field to a draft shape, add it to the `initial` value too or the merge leaves it `undefined`.
- **Sport routine model → `lib/synthetic-sport-routines.ts`**. One `sports-{slug}-synthetic` per sport (kind=SESSION, isPlaceholder=true). Existence of the routine *is* the user's selection.
- **"Routine supports a sport" → `Routine.supportsSports String[]`**. For training routines (Fingers, Pull Day) that aren't sessions themselves. Distinct from the routine BEING that sport.
- **Bilingual loaders** — every per-sport stats query must read BOTH legacy metadata-tagged routine logs AND new synthetic-routine logs in one OR clause. See `lib/activities/sports-chart.ts` for the pattern.
- **Color palette** — climb outcomes in `lib/climb-types.ts` (`climbOutcomeColor` / `climbOutcomeBg`). Sport accents are inlined in a few places (chart loaders, picker components); keep them in sync.

---

## 3. Form / font / style consistency — match the endurance log

Every sport log form should look and behave like the endurance log (`app/routines/[id]/log-cardio/ui.tsx`). Same fonts, same input padding, same chrome via `SportLogModal`, same `SpotPicker` for location, same Apple-HIG 44px tap targets. If you're tempted to invent a new visual treatment for a sport form, stop — pull from endurance instead. Visual consistency across the sports family is non-negotiable.

Concrete defaults:
- Input: `fontSize: 16` (prevents iOS auto-zoom), `padding: 12px 14px`, `minHeight: 44`, `borderRadius: 10`
- Label: `fontSize: 11, fontWeight: 800, textTransform: uppercase, letterSpacing: 0.3`
- Modal body gap: `18px`
- Field stacking: `display: grid; gap: 8` inside each label
- Modal: `SportLogModal` (full-screen on mobile via `.logDrawerSheet`, centered on desktop via the existing media query)

---

## 4. Data safety — never destroy work

- **Soft-delete only** — `isActive: false`, `isDeleted: true`. Never `prisma.routine.delete()` or any hard delete without user confirmation.
- **Never `prisma migrate reset`** — it wipes the database. If you hit migration drift, fix the `_prisma_migrations` checksums in place (see the 2026-06-05 drift-fix precedent in git history).
- **Migrations are additive by default** — new optional columns, new tables. Schema changes that drop columns / rename / change types require explicit user sign-off and a plan for existing data.
- **No bulk modification of legacy data** without explicit ask. If a user has metadata-tagged routines from before a new model landed, leave them as-is and write a bilingual loader that handles both shapes.

---

## 5. Mobile-first, but verify both surfaces

- All new UI must work on both mobile (≤720px) and desktop (≥721px). Use the existing `.logDrawerSheet` media-query pattern (full-screen mobile → centered modal desktop) rather than inventing per-component breakpoints.
- Input `fontSize: 16` or higher — iOS auto-zooms on smaller inputs.
- `min-height: 44px` on tap targets (Apple HIG).
- `touch-action: manipulation` on bar-chart-style interactive elements to suppress double-tap-zoom.
- **Modals that render inside transformed ancestors must use a React portal** to escape the containing block — `position: fixed` is relative to the nearest transformed ancestor, not the viewport. `SportLogModal` already does this; if you write a new sheet, do the same.

---

## 6. Phasing discipline — verify, then continue

When the user asks for a big multi-phase change, ship each phase as its own reviewable PR/push. Don't bundle 6 phases into one commit.

- Each phase should be testable end-to-end on the user's actual device (their phone, typically).
- Pause at phase boundaries and ask the user to verify before continuing.
- Stripping features silently while "porting forward" counts as a bug, not a rewrite — see rule 1.

---

## 7. Two log philosophies — keep them straight

The app has two log philosophies, by design. Don't blur them:

- **Template-based** — strength, guided. You build a reusable routine, you log against it, progressive overload is the point. Lives in `/routines`.
- **Type-based** — endurance, sports. No template needed; pick what you did from a sport tile or activity-type dropdown. Synthetic placeholder routine holds the logs. Lives in the SPORT section on `/log` + `EnduranceQuickLogButton`.

Habits are a third philosophy (definition-based: name + frequency target + data shape). Routines with a daily-frequency goal render as habits; weekly+ render as scheduled completion routines. They use the same `RoutineLog` table, but the surfaces treat them differently.

---

## 8. Climbing-specific rules

- Outcome chips and stripe colors come from `lib/climb-types.ts` (`climbOutcomeColor` / `climbOutcomeBg`). Match the existing palette — FLASH/ONSIGHT amber, SEND/REDPOINT green, PROJECT violet, FELL red (legacy).
- Tries-count is only meaningful for SEND/REDPOINT — hide it for FLASH/PROJECT.
- Grade system follows discipline — BOULDER → V scale, TOP_ROPE/SPORT_LEAD → YDS.
- Area picker should search saved `ClimbArea` rows for the picked location before letting the user type new ones. Don't make users re-type "Cave Wall" every session.
- Climb location picker should integrate the existing climb-map library (`/activities/climbing/map`) — show saved climbs/routes for a picked location, not just the location list.

---

## 9. Default to writing no comments

- Only add a comment when the WHY is non-obvious (a hidden constraint, a subtle invariant, a workaround for a specific bug).
- Don't explain WHAT the code does — well-named identifiers cover that.
- Don't reference the current task/fix/caller in comments — that belongs in the PR/commit message and rots over time.
- Never write multi-paragraph docstrings.

---

## 10. Trust internal code; validate at system boundaries

- Don't add try/catch + fallbacks for scenarios that can't happen inside trusted code paths.
- Validate at the boundary — user input, external APIs, deserialized blobs from storage (the draft-merge defensive pattern in `useSportLogDraft.ts`).
- No "feature flags" / "backwards-compatibility shims" unless you can point at a real user who needs them.

---

*Add new rules here as they emerge. Keep entries to one section. Reference file paths and commits when the rule comes from a specific incident.*
