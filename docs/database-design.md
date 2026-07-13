# Database design

`worksites` stores tenant-owned address, timezone, coordinates, radius, mode, and active status. `employee_worksites` is tenant-validated and has a partial unique index preventing duplicate active assignments.

`time_entries` owns a shift and integer minute totals. `break_entries` stores paid/unpaid intervals. Partial unique indexes enforce one `OPEN` shift per employee and one `OPEN` break per shift. `time_events` preserves each action, authoritative time, optional client time, event location result, source, device metadata, actor, reason, and idempotency key.

`employee_sessions` stores only token hashes, expiration, revocation, and activity timestamps. `time_correction_requests` and `time_off_requests` preserve employee requests and manager decisions. `audit_logs` and `time_events` reject updates/deletes by trigger and omit client mutation policies.

All durations use integer minutes. Net work equals elapsed shift minutes minus completed or open unpaid-break minutes. Paid breaks remain in net work but appear in break reporting.
