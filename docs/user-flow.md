# User flows

## Employee

The employee enters company code, employee number, and PIN. After generic server verification, the clock screen displays assigned worksite, current server-derived state, live display time, valid actions, and pay-period totals. Clock in/out shows a location disclosure before requesting one browser position. Breaks default to unpaid. Completed shifts appear under Time & Hours; corrections are separate requests, never silent edits. Time Off permits submission, viewing, and cancellation of pending requests.

When offline, expired, unassigned, denied location in strict mode, or rejected by the server state check, the UI reports that the action was not saved and gives a recovery path. Buttons remain disabled while a request is active.

## Manager

Managers configure tenant worksites and assignments, view current status without continuous tracking, filter completed shifts, review location flags, approve/reject, or make reasoned corrections. Each decision appends an event and audit entry.
