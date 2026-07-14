# Production deployment

## Current production environment

- Product: CrewLedger Time
- Supabase project: `smallbusinesssolution-production`
- Supabase project ref: `zvffacwobghakfifainv`
- Supabase region: `us-west-1`
- Public application: `https://smallbusinesssolution.vercel.app`
- Vercel environment: Production
- Production secrets are separate from Preview and are never committed.
- Database passwords and the recoverable session pepper are stored in the operator's macOS Keychain.

The staging project remains separate. Never run `supabase db reset` against either linked cloud project. Production was initialized with reviewed migrations only; staging seed and simulation data were not copied.

## Promotion path

1. Reset a disposable local Supabase database from empty and run integration tests.
2. Apply migrations to a dedicated staging project without `seed.sql`.
3. Configure Vercel Preview with staging-only keys and pepper.
4. Verify employee login, each clock transition, geofence modes, restart persistence, manager approval/edit, RLS, and immutable events.
5. Review database backups, retention, observability redaction, and rollback procedures.
6. Apply the same reviewed migration set to production and configure independent production secrets.
7. Deploy Vercel Production only after a signed staging verification record.

## Required manual provisioning

- Create the first Platform Admin only with `scripts/production/bootstrap-platform-admin.mjs`. The script generates a strong password, stores it in macOS Keychain, creates no company membership, and compensates by deleting the Auth user if database bootstrap fails.
- The first Platform Admin must enroll TOTP at `/support-admin/login`; platform pages reject sessions below Supabase `aal2`.
- Create Supabase Auth owner/manager users.
- Insert tenant-scoped `company_users` roles.
- Create companies, employees with bcrypt PIN hashes, worksites, and assignments using privileged tooling.
- Set allowed redirect URLs and Vercel domains in Supabase Auth.
- Configure rate limiting at the edge for employee and manager authentication endpoints.
- Configure database backups, session cleanup, and location/event retention jobs.

The platform bootstrap command requires a real, recoverable email address:

```sh
PLATFORM_ADMIN_EMAIL=admin@example.com node scripts/production/bootstrap-platform-admin.mjs
```

Do not use `admin@crewledger.com` until the domain has working MX records and the mailbox has been tested. The password is intentionally not printed; retrieve it from the `crewledger-production-platform-admin` entry in macOS Keychain Access.

## Rollback

Application rollback uses the prior Vercel deployment. Database migrations are forward-only: prepare and review a compensating migration rather than editing applied migrations. Never delete or rewrite `time_events` or `audit_logs` to roll back an application release.
