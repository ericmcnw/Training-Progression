# Repository Guidelines

## Project Structure & Module Organization
- `app/`: Next.js App Router pages and route-level server actions (for example, `app/routines/actions.ts`).
- `lib/`: Shared utilities and infrastructure helpers (`lib/prisma.ts`, date/week helpers).
- `prisma/`: Database schema and migrations (`schema.prisma`, `migrations/*`).
- `public/`: Static assets served directly.
- Root config: `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`.
- Local SQLite files (`dev.db`, `prisma/dev.db`) are development data, not source code.

## Build, Test, and Development Commands
- `npm run dev`: Start local dev server at `http://localhost:3000`.
- `npm run build`: Create a production build.
- `npm run start`: Run the production build locally.
- `npm run lint`: Run ESLint with Next.js + TypeScript rules.
- Prisma workflow examples:
  - `npx prisma migrate dev -n <name>`: Create/apply a migration.
  - `npx prisma generate`: Regenerate Prisma client after schema changes.

## Coding Style & Naming Conventions
- Language: TypeScript (`strict: true`) with React 19 + Next.js App Router.
- Indentation: 2 spaces; keep files formatted consistently with existing code.
- Components: `PascalCase` for reusable components (for example, `RoutineEditRow.tsx`).
- Routes: lowercase folder names and Next conventions (`page.tsx`, `layout.tsx`, `actions.ts`).
- Utilities: short, domain-specific modules in `lib/`.
- Run `npm run lint` before opening a PR.

## Testing Guidelines
- No automated test framework is configured yet.
- Minimum gate today: `npm run lint` and a local smoke test via `npm run dev`.
- If adding tests, place them next to source as `*.test.ts`/`*.test.tsx` or under `__tests__/`, and add a `test` script in `package.json`.

## Commit & Pull Request Guidelines
- Use clear, imperative commits. Prefer Conventional Commit style:
  - `feat(routines): add run log distance validation`
  - `fix(prisma): handle deleted routines in dashboard query`
- Keep commits focused (UI, schema, and data migration changes should be separable when possible).
- PRs should include:
  - concise description of behavior changes,
  - linked issue/task,
  - screenshots for UI changes,
  - migration notes for `prisma/` updates.

## Security & Configuration Tips
- Keep secrets in `.env`; do not commit credentials.
- Confirm `DATABASE_URL` before running migrations.
- Review generated SQL in `prisma/migrations/*/migration.sql` before merging.
