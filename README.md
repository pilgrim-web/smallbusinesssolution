# CrewLedger Time

CrewLedger Time is a mobile-first employee time clock and manager review application backed by Supabase/PostgreSQL. Production APIs use durable database repositories, hashed PIN and manager-code authentication, atomic clock RPCs, tenant-scoped manager authorization, immutable event history, and event-only location verification.

Managers can create employees, reset PINs (revoking active employee sessions), assign worksites, and manage company-scoped team groups from `/admin/team`. A PWA manifest and Capacitor iOS shell support staged mobile pilots; see [App Store test deployment](docs/app-store-test-deployment.md) and the [1–3 company pilot plan](docs/pilot-test-plan.md).

## Requirements

- Node.js 22 and npm
- Supabase CLI and Docker for local database development
- A Supabase project for preview/staging and a separate project for production
- Vercel projects/environments for preview and production

## Local development

```bash
npm ci
supabase start
supabase db reset
cp .env.example .env.local
npm run dev
```

Populate `.env.local` from `supabase status -o env`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<local ANON_KEY>
SUPABASE_SERVICE_ROLE_KEY=<local SERVICE_ROLE_KEY>
EMPLOYEE_SESSION_PEPPER=<random value of at least 32 characters>
```

`supabase/seed.sql` is explicitly local-only and provides `HARBOR / 1042 / 2468`. Production code contains no hard-coded employee identity, worksite, company, or PIN.

## Preview/staging environment

Create a non-production Supabase project and configure these Vercel Preview variables:

- `NEXT_PUBLIC_SUPABASE_URL`: staging project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: staging anonymous key
- `SUPABASE_SERVICE_ROLE_KEY`: staging service-role key, server-only
- `EMPLOYEE_SESSION_PEPPER`: staging-only random 32+ character secret

Link the Supabase CLI to staging, apply migrations without the local seed, create manager users and company memberships, then verify:

```bash
supabase link --project-ref <staging-project-ref>
supabase db push
npm ci
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
```

Run the database integration suite against staging only with explicit test credentials. Do not point destructive/reset commands at production.

## Production environment

Use a separate Supabase project and separate Vercel Production secrets. Generate a different `EMPLOYEE_SESSION_PEPPER`; never reuse staging secrets. Apply reviewed migrations with `supabase db push`, confirm RLS and service-role isolation, seed real data through privileged administration, and deploy only after staging passes.

The service-role key and session pepper must never use a `NEXT_PUBLIC_` prefix, appear in browser bundles, logs, screenshots, commits, or support messages.

## Verification

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
```

When local Supabase is running:

```bash
supabase db reset
SUPABASE_TEST_URL=http://127.0.0.1:54321 \
SUPABASE_SERVICE_ROLE_KEY=<local-service-role-key> \
SUPABASE_TEST_ANON_KEY=<local-anon-key> \
npm run test:integration
```

See [production deployment](docs/production-deployment.md), [security](docs/security.md), and [location privacy](docs/location-privacy.md) before staging.
