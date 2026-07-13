# Time clock state machine

| Current state | Allowed action | Next state |
|---|---|---|
| `OFF_CLOCK` | `CLOCK_IN` | `CLOCKED_IN` |
| `CLOCKED_IN` | `BREAK_START` | `ON_BREAK` |
| `ON_BREAK` | `BREAK_END` | `CLOCKED_IN` |
| `CLOCKED_IN` | `CLOCK_OUT` | `OFF_CLOCK` |

Every other transition is rejected by the server regardless of client button state. The server locks/selects the current open entry in a transaction, uses `clock_timestamp()`, validates assignment and geofence, mutates the shift/break row, and appends one immutable event. A repeated idempotency key returns the existing result.

The partial unique indexes `time_entries_one_open_per_employee` and `break_entries_one_open_per_entry` are final race-condition protection. Clock out is impossible while a break is open. A completed shift receives `PENDING`, or `NEEDS_REVIEW` when any permitted FLAG-mode event is missing/outside.
