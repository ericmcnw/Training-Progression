# Program Platform: Phase 0 Foundation and Audit

## Product promise

Progression is an easy way to log training, see progress clearly, and connect sport-specific training to the outcomes it supports.

AI is an optional planning assistant. It is not the product's primary promise and it does not own the user's data or plan.

## Canonical structure

1. **Program**: a time-bounded or ongoing outcome. Persisted by the existing `Focus` model so the four current programs and 29 milestones remain intact.
2. **Goal**: a measurable result or frequency target. Goals may support multiple programs.
3. **Stage**: a high-level phase such as Base, Build, Peak, Send season, or Return to sport. Stages can be date- or gate-dependent.
4. **Block**: several repeatable weeks within a stage. A block references routines; it does not copy them.
5. **Routine**: the reusable session template.
6. **Prescription**: targets for an exercise. Block prescriptions may override the routine target without changing historical logs.
7. **Schedule**: planned instances placed on real dates.
8. **Log**: immutable history of what happened.

Programs can run concurrently. A routine or goal can contribute to more than one program. The calendar composes work across active programs instead of giving each program a separate calendar.

## Progress shapes

Sport-specific progress is represented by reusable shapes instead of hard-coding every sport:

- **Best/ceiling**: hardest grade, maximum load, fastest effort.
- **Scalar trend**: weight, pace, pain, volume, or another repeated number.
- **Repeated test**: made shots out of attempts, golf range dispersion, timed drill.
- **Volume and adherence**: sessions, distance, duration, attempts, or planned work completed.
- **Named target list**: climbs, tricks, routes, or skills.
- **Progression ladder**: ordered skill stages such as tuck lever to advanced variants.

Activities can declare which shapes they support. Unknown sports still work through repeated tests, volume, and user-named targets.

## Phase 0 implementation

- Existing `Focus` rows are surfaced as Programs; they were not copied or renamed.
- New tables are additive: program links, stages, stage gates, blocks, block items, block prescriptions, target lists, and body measurements.
- Program pages use `Overview`, `Plan`, and `Progress` views.
- Manual creation has guided and full-editor paths that save through the same `saveFocus` action.
- Program relationships save independently from milestones, stages, and blocks.
- Profile now owns Health, Measurements, history, settings, and gear.
- Plan is reduced to Programs, Goals, and Calendar. The unused Rotation model remains in the database but is not a primary surface.

## Existing-data audit (2026-08-18)

- 4 Programs backed by existing Focus rows.
- 29 existing progression milestones retained.
- 381 routine logs, 82 climb attempts, 1,675 set entries, and 67 pain readings present at the final read-only audit. These counts may continue to rise through normal logging.
- 0 Rotation rows. One legacy SchedulePlan exists with no cycle entries.
- 6 routine links were backfilled only from unambiguous routine-scoped milestones.
- 6 existing performance/volume goals and 5 existing frequency goals were linked without creating duplicates.
- Fall climbing prep received the six explicitly selected outdoor projects as a target list; completion remains derived from climb attempts.
- No stages or blocks were invented from uncertain notes. The current milestone roadmap remains the fallback until they are authored.

## Data safety rules

- Program metadata never owns or rewrites logs.
- A block references a routine and may add prescription overrides; it does not clone the routine.
- Target completion is derived from source activity where possible (for example, a climbing send).
- Relationship backfills are idempotent and limited to explicit identifiers already present in the data.
- New owned records use `profileKey`; existing single-user records default to `default`.

## AI boundary

The intended use is training tracking, general wellness planning, and educational guidance. AI may summarize data and suggest editable training options with stated reasoning. It may not diagnose, prescribe medical treatment, interpret medical tests, claim medical clearance, or make changes without confirmation.

A disclaimer is supplemental. The functional behavior and marketing claims must stay inside this boundary.

## Next stages

### Phase 1: use real programs

- Author stages and blocks for the climbing, aerobic-base, and hamstring programs.
- Add block editing, reordering, activation, and archival controls.
- Connect block weekly targets to the calendar without duplicating schedule rows.
- Add goal progress calculations directly to Program Progress.

### Phase 2: sport progress adapters

- Add a generic repeated-test result for made/attempted drills and scored sessions.
- Define adapters for climbing, basketball, golf, running/endurance, strength, and weight change.
- Let target lists link to sport entities where they exist and remain free-form where they do not.

### Phase 3: suggestions and review

- Generate a `ProgramDraft`, never direct writes.
- Show the data used, the named training principle, uncertainty, and proposed changes.
- Require explicit acceptance for every created or changed program object.
- Add evaluation fixtures for unsafe medical claims and unsupported numerical recommendations.
