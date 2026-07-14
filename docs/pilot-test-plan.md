# 1–3 company pilot plan

## Scope

Recruit one company first, then expand to at most three after the first company completes three consecutive days without a security or data-integrity incident. Suitable cohorts are one cleaning company, one restaurant, and one field-service company, with 3–15 employees each.

Every pilot company receives a separate `companies` tenant, manager membership, worksite records, employee records, team groups, and assignments. Never reuse company `0000` for real pilot payroll activity; it remains simulation data.

## Onboarding checklist

1. Obtain signed pilot consent covering test status, location events, retention, support, and no payroll-compliance claim.
2. Record company timezone, pay frequency, location mode, worksites, geofence radius, break-location preference, managers, and employee roster.
3. Create the company and manager identity with unique codes. Require the manager to replace temporary employee PINs through Employee Management.
4. Verify each employee can see only their own time and time-off data and each manager can see only their company.
5. Run one supervised shift: Clock In, Start Break, End Break, Clock Out, correction request, manager review, and approval.
6. Confirm employees understand that location is captured only at configured events and that internet access is required.

## Pilot cadence

- Days 1–3: one company, supervised daily review.
- Days 4–7: add the second company only if no cross-tenant, missing-event, or timestamp issue exists.
- Week 2: optionally add the third company and exercise cleaning/restaurant/field-service patterns.
- Daily: review open shifts, geofence flags, missing location, duplicate attempts, corrections, and unapproved entries.
- Weekly: export a reconciliation report against the company’s existing timekeeping system. Harbor Time remains parallel test software, not the final payroll source.

## Exit criteria

- zero cross-company access findings
- zero lost or duplicated authoritative clock events
- all server timestamps and state transitions reconcile with audit history
- at least 95% of normal clock actions complete without manager intervention
- managers complete employee creation, PIN reset, assignment, review, and approval without developer database access
- privacy/support requests have a named owner and documented response

Stop the pilot immediately for tenant leakage, unexplained audit mutation, repeat missing events, or exposure of PINs, hashes, tokens, or precise location in logs.
