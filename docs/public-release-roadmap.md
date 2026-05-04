# Public Release Roadmap

This app is not ready for public release yet. It is still structured like a single-user app, even though it now runs against a hosted Postgres database.

## Current blockers

1. There is no real auth or account model yet.
   Most data models are global and do not have `userId` ownership, so a public deployment would mix data across users unless ownership is added everywhere it matters.

2. Server actions and route handlers assume trusted access.
   They look up records directly by IDs and do not consistently scope reads and writes to a current user session.

3. The app has limited production hardening.
   There is no rate limiting, audit logging, error monitoring, analytics, abuse handling, or privacy/legal surface yet.

4. The app is still a web app, not an App Store-ready native app.
   There is no PWA manifest/service worker and no Capacitor/native wrapper setup yet.

5. Release operations are still developer-oriented.
   There is no staging environment, no test suite, and no release checklist for schema changes.

## Recommended release order

### Phase 1: Auth-ready architecture

1. Choose an auth stack that fits Next.js App Router cleanly.
   Recommended default: Better Auth or Auth.js with email magic links and OAuth later if needed.

2. Add a real `User` model and attach ownership to user data.
   High-priority models:
   - `Routine`
   - `RoutineLog`
   - `Goal`
   - `FrequencyGoal`
   - `SchedulePlan`
   - `ScheduleManualEntry`
   - `ActiveInjury`
   - `PainLog`
   - `ZoneActivity`
   - `AppProfile`
   - user-created `Exercise` records if you want custom exercises to stay private

3. Keep seed/reference data global.
   Good candidates to remain shared system data:
   - `BodyZone`
   - `MetadataGroup`
   - `StimulusCategory`
   - `SessionTemplate`
   - starter exercise catalog, if you split it from user-created exercises

4. Add a central session/access layer.
   All route handlers and server actions should read current user identity from one shared helper, then apply ownership filters consistently.

### Phase 2: Data migration

1. Create the `User` table and auth tables.
2. Add nullable `userId` columns first.
3. Backfill existing records into one bootstrap account that represents your current personal data.
4. Update app queries/actions to require user ownership.
5. Make `userId` required on owned tables after the app runs cleanly.

This staged migration keeps development practical and avoids a big-bang rewrite.

### Phase 3: Production hardening

1. Add request validation with a schema library such as `zod`.
2. Add error monitoring.
   Recommended default: Sentry.
3. Add rate limiting on auth endpoints and write-heavy routes.
4. Add database backups and a rollback plan for migrations.
5. Add privacy policy, terms, support contact, and account deletion flow.
6. Remove or guard any debug/dev-only routes before launch.
   Current example: `app/_dev/body-map/page.tsx`

### Phase 4: Mobile/App Store path

There are two realistic options:

1. Ship as a web app first.
   Lowest friction. You can launch publicly on the web, validate demand, and keep release velocity high.

2. Wrap the web app with Capacitor for iOS later.
   Best if you want App Store presence without rewriting the app in React Native.

Recommended order: public web launch first, then Capacitor if usage justifies native packaging work.

For App Store readiness you will need:
1. App icons, splash screens, native metadata, privacy labels.
2. Stable auth flows on mobile browsers and inside a webview/native shell.
3. Deep link handling for sign-in links if you use magic-link auth.
4. Safe-area polish, offline/error states, and background/resume testing on iPhone.
5. Apple review compliance, including account deletion if accounts are created in-app.

## How development changes after auth

Development does get stricter, but not dramatically more annoying if the architecture is set up correctly.

What changes:

1. Most new queries need a user scope.
   You stop writing `where: { id }` and start writing `where: { id, userId }` or using a helper that does that for you.

2. You need local auth test accounts.
   This is normal and manageable.

3. Schema changes need more care.
   Migrations become part of the release process instead of an afterthought.

What does not become terrible:

1. Normal UI work is still normal UI work.
2. Shipping updates is still easy on the web.
   Deploy the new version, run migrations carefully, and users get it immediately.
3. App Store updates are slower than web updates.
   Apple review adds delay, so you should expect urgent fixes to land on web faster than in the store.

## Practical release model

Recommended model:

1. Keep the web app as the source of truth.
2. Deploy continuously to a staging environment and production.
3. Add a native wrapper only after the web version is stable.
4. Treat native releases as periodic snapshots of the web product, not the fastest path for every tiny update.

## Immediate next steps

1. Install and integrate an auth provider.
2. Add the `User` model plus staged `userId` ownership columns.
3. Refactor the highest-risk server actions and API routes to use a central access helper.
4. Create a staging database and document migration steps.
5. Add monitoring and basic validation.

## What was started in this repo

1. `lib/auth.ts` now exists as a single place to plug in real session resolution.
2. Profile-oriented code can now move behind that auth seam instead of hardcoding a permanent global profile assumption.
