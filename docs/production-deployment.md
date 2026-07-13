# Production deployment

## Promotion path

1. Reset a disposable local Supabase database from empty and run integration tests.
2. Apply migrations to a dedicated staging project without `seed.sql`.
3. Configure Vercel Preview with staging-only keys and pepper.
4. Verify employee login, each clock transition, geofence modes, restart persistence, manager approval/edit, RLS, and immutable events.
5. Review database backups, retention, observability redaction, and rollback procedures.
6. Apply the same reviewed migration set to production and configure independent production secrets.
7. Deploy Vercel Production only after a signed staging verification record.

## Required manual provisioning

- Create Supabase Auth owner/manager users.
- Insert tenant-scoped `company_users` roles.
- Create companies, employees with bcrypt PIN hashes, worksites, and assignments using privileged tooling.
- Set allowed redirect URLs and Vercel domains in Supabase Auth.
- Configure rate limiting at the edge for employee and manager authentication endpoints.
- Configure database backups, session cleanup, and location/event retention jobs.

## Rollback

Application rollback uses the prior Vercel deployment. Database migrations are forward-only: prepare and review a compensating migration rather than editing applied migrations. Never delete or rewrite `time_events` or `audit_logs` to roll back an application release.
