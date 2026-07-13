# Harbor Time

Harbor Time is a mobile-first employee time clock and manager review experience for small service teams. Phase 2 includes employee PIN sessions, a server-authoritative clock state machine, breaks, per-event location verification, pay-period summaries, correction requests, basic time off, worksite settings, live workforce status, and timesheet review.

## Local development

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`. The local demonstration employee credentials are company `HARBOR`, employee `1042`, PIN `2468`. They exist only in the in-memory development adapter.

## Production setup

1. Create a Supabase project and run migrations in `supabase/migrations` in order.
2. Configure the Supabase URL, anonymous key, service-role key, and a random 32+ character `EMPLOYEE_SESSION_PEPPER`.
3. Replace the development adapter in `lib/demo-store.ts` with repository calls that execute each time-clock action in one database transaction.
4. Seed owner/manager roles, worksites, employee PIN hashes, and employee-worksite assignments through privileged server code.

The service-role key must never be sent to the browser. The demo adapter is intentionally not durable and is not a production datastore.

## Verification

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

See `docs/architecture.md`, `docs/security.md`, and `docs/location-privacy.md` before deployment.
