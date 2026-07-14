# Location privacy

CrewLedger Time asks for location to verify that a clock event occurred near the selected worksite. The browser requests a single position only when clocking in or out, and optionally at break events when a worksite enables that setting. It does not continuously collect location, track routes, or collect off-clock movement.

Stored event fields can include latitude, longitude, accuracy, client capture time, server-calculated distance, configured radius, inside/outside result, and permission state. The server—not the device—calculates distance. The employee who generated the event and authorized managers in the same company can access it. Cross-company access is prohibited by server scope and RLS.

`STRICT` blocks missing/outside events. `FLAG` (default) saves them as needing review. `OPTIONAL` saves without location. Employees can report incorrect records from shift detail. Companies must define a documented retention period and schedule deletion according to professional legal/privacy advice; no universal duration is claimed here.
