# Architecture

The Next.js App Router provides employee and admin interfaces plus server route handlers. `lib/time-clock.ts` is the deterministic domain layer. Production data access lives in `lib/data`, uses a server-only Supabase service client for employee PIN sessions, and uses Supabase Auth plus company roles for managers. No production route imports an in-memory adapter.

Employee sign-in produces a random token in an HttpOnly, Secure, SameSite=Strict cookie. Only a peppered SHA-256 token hash is stored. Each employee endpoint resolves that session to company and employee identity before reading or mutating data. Client-supplied identity fields are ignored.

PostgreSQL provides the final concurrency boundary: `employee_clock_action` resolves the hashed session, locks session/employee/open shift rows, verifies assignments and geofence mode, performs the transition, and appends an event in one transaction. Partial unique indexes permit one open shift per employee and one open break per shift. RLS limits managers to company records. Employee operations use trusted server RPCs because Supabase Auth does not represent PIN employees. Time and audit events are append-only.

Server timestamps are UTC `timestamptz`; display uses worksite/company IANA timezone. Browser time powers only the live clock and optional diagnostic client timestamp.
