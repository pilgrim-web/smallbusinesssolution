import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import path from "node:path";

const sql = readFileSync(path.join(process.cwd(), "supabase/migrations/202607130001_phase2_time_clock.sql"), "utf8");
describe("database security migration", () => {
  it("enforces one open entry and one open break", () => { expect(sql).toContain("time_entries_one_open_per_employee"); expect(sql).toContain("break_entries_one_open_per_entry"); });
  it("prevents cross-company worksite assignments", () => expect(sql).toContain("enforce_employee_worksite_tenant"));
  it("enables RLS on every Phase 2 table", () => { for (const table of ["worksites","employee_worksites","time_entries","break_entries","time_events","employee_sessions","time_correction_requests","time_off_requests","audit_logs"]) expect(sql).toContain(`alter table public.${table} enable row level security`); });
  it("does not expose PIN hashes and prevents event/audit mutation", () => { expect(sql).toContain("revoke select(pin_hash"); expect(sql).toContain("time_events_no_update"); expect(sql).toContain("audit_logs_no_update"); });
  it("uses server-generated timestamps", () => expect((sql.match(/default now\(\)/g) ?? []).length).toBeGreaterThan(10));
});
