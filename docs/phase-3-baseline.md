# Phase 3 baseline

Baseline captured on 2026-07-13 before productionization changes on `phase-3-production`.

| Command | Result |
|---|---|
| `npm run lint` | Passed, no warnings |
| `npm run typecheck` | Passed |
| `npm run test` | Passed: 39 tests in 4 files |
| `npm run build` | Passed: Next.js 15.5.20, 18 routes |

The baseline had no failing application checks. Inspection found that six employee API routes, the employee session helper, the admin workforce dashboard, and admin timesheets imported `lib/demo-store.ts`. The database had table/RLS migrations and an approval RPC but no atomic employee clock RPC, durable PIN/session RPCs, audited manager-edit RPC, Supabase-backed application repository, database integration suite, E2E suite, or CI workflow.

Neither Docker, Supabase CLI, nor `psql` was available locally, so an actual `supabase db reset` could not be run in the initial environment. CI now provisions local Supabase, resets from empty, and runs the database integration suite.
