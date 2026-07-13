# Timesheet approval and correction

Completed shifts begin as `PENDING`, or `NEEDS_REVIEW` after a FLAG-mode issue. Authorized owners/managers can approve, reject/request correction, add a note, correct clock or break timestamps, or void an invalid entry.

Every review uses server time and identifies `auth.uid()`. Every correction requires a reason, saves original values in `time_events.original_values`, appends a `MANAGER_EDIT` or `ENTRY_VOIDED` event, and creates an audit row. Existing events are never rewritten. Approval similarly appends `MANAGER_APPROVAL` and an audit row.

Minutes are recomputed from server timestamps after an edit. Unpaid break minutes are subtracted; paid breaks are reported separately and remain worked time. Overtime and payroll tax outcomes are not asserted in Phase 2.
