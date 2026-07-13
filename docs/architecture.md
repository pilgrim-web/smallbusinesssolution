# Architecture

The Next.js App Router provides employee and admin interfaces plus server route handlers. `lib/time-clock.ts` is the deterministic domain layer; `lib/demo-store.ts` is a local, in-memory adapter for demonstration and tests. Production replaces the adapter with Supabase transactions while retaining the domain contract.

Employee sign-in produces a random token in an HttpOnly, Secure, SameSite=Strict cookie. Only a peppered SHA-256 token hash is stored. Each employee endpoint resolves that session to company and employee identity before reading or mutating data. Client-supplied identity fields are ignored.

PostgreSQL provides the final concurrency boundary: partial unique indexes permit one open shift per employee and one open break per shift. RLS limits manager access to company records. Employee operations use a trusted server transaction because Supabase Auth does not represent PIN employees. Time and audit events are append-only.

Server timestamps are UTC `timestamptz`; display uses worksite/company IANA timezone. Browser time powers only the live clock and optional diagnostic client timestamp.
