# Security

PINs are bcrypt hashes and are never returned or logged. Authentication returns one generic failure, rate-limits attempts, locks the employee temporarily after five failures, and creates an eight-hour random session. The cookie is HttpOnly, SameSite=Strict, Secure in production; the database stores only a peppered token hash.

The trusted server derives both employee and company from the session. It verifies worksite activation, tenant ownership, assignment, current clock state, and location mode. Idempotency keys, state checks, transactions, and partial unique indexes protect against duplicates.

RLS scopes managers to memberships in their company. Employee PIN endpoints do not directly expose database credentials. No ordinary role can read sessions, PIN hashes, mutate event history, or mutate audit history. Exact location is limited to the generating employee through the scoped server and authorized managers through RLS.

Secrets belong only in server environment variables. Production must add edge/IP rate limiting and retention jobs. This design is security-conscious but is not a claim of legal or regulatory compliance; obtain professional review for local labor and privacy rules.
