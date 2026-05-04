# Auth Implementation Checklist

Use this when you are ready to move from auth groundwork to a real multi-user release.

## Phase 1: Provider integration

1. Choose the provider stack.
   Recommended default: Better Auth or Auth.js for Next.js App Router.
2. Add provider env vars and secure session secret handling.
3. Implement sign-in, sign-out, and session lookup in `lib/auth.ts`.
4. Add an account menu and authenticated landing flow.

## Phase 2: Ownership model

1. Add a `User` model.
2. Add nullable `userId` to owned tables.
3. Backfill your current data into one bootstrap account.
4. Update reads and writes to scope by `userId`.
5. Make `userId` required after the app is clean under the new access rules.

## Phase 3: Product obligations

1. Account deletion flow.
2. Passwordless or OAuth recovery path.
3. Privacy policy and terms.
4. Support contact and abuse reporting channel.
5. Monitoring and alerting for auth failures.

## Phase 4: Release gates

1. Staging environment with a separate database.
2. Backup and restore drill before production migrations.
3. Smoke test checklist for sign-in, sign-out, and account isolation.
4. Rate limiting for auth endpoints and write-heavy actions.
5. App Store policy review if you wrap the app for iOS.
