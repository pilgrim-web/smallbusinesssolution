# Product requirements

## Product identity

The product brand is **CrewLedger**, and the first product is **CrewLedger Time**. Its purpose is to connect employee labor and business-owner responsibility through accurate, transparent records. The product line may later expand to payroll preparation, bookkeeping, and business insights, but current screens and claims must remain limited to implemented and tested timekeeping capabilities.

Product decisions follow these principles:

- Every hour deserves an honest record.
- Records establish trust; they are not a pretext for continuous surveillance.
- Employees can see their records and request corrections.
- Manager changes preserve the original value, actor, reason, and audit event.
- Location is collected only for configured clock actions, never continuously off the clock.
- Technology organizes evidence and flags review; it does not declare employee misconduct.
- Estimated hours and payroll preparation are never represented as final payroll, tax, or legal-compliance results.
- Simplicity is a form of respect for employees and small-business operators.

Product tagline: **From clock-in to payroll-ready.**

Phase 2 gives employees a one-handed mobile workflow for clock in/out, breaks, status, hours, corrections, and time-off requests. Managers receive real-data-ready worksite configuration, workforce status, filters, approval, correction, and audit views.

Core outcomes are accurate server time, explicit state, clear recovery messages, tenant isolation, event-only location collection, and review rather than false payroll certainty. Overtime and statutory leave accrual are explicitly out of scope. The product must never describe estimated hours as final payroll.

Acceptance requires accessible action labels, keyboard operation, non-color availability text, no silent offline success, strict server transition checks, idempotency, database uniqueness, RLS, immutable event history, and the full automated verification suite.
