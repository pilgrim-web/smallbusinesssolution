# Development roadmap

Phase 1 established the small-business foundation. Phase 2 adds the employee clock, location validation, breaks, hours, time off, workforce status, approval, RLS, and privacy documentation.

Recommended Phase 3 work:

1. Replace the development adapter with deployed Supabase transaction functions and integration tests.
2. Add employee/worksite assignment controls to the existing employee-detail data layer.
3. Implement company pay-period boundaries for every configured Phase 1 frequency.
4. Add durable notifications, manager correction forms, and an offline read cache (never an unconfirmed write queue).
5. Add configurable overtime rules only after jurisdictional review and deterministic compliance tests.
6. Add retention automation, exports, observability with field redaction, and kiosk presentation reusing the same session authorization.

Employee Management now supports employee creation, audited PIN reset with session revocation, worksite assignment, and company-scoped team groups. The iOS shell and pilot documentation are prepared, but TestFlight upload remains gated on Apple signing, a public pilot deployment, permanent support contact, and App Store Connect privacy metadata.

Biometrics, continuous GPS, final tax calculations, legal leave accrual, and compliance claims remain out of scope.
