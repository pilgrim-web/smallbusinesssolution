import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import path from "node:path";

const sql = readFileSync(path.join(process.cwd(), "supabase/migrations/202607130001_phase2_time_clock.sql"), "utf8");
const productionSql = readFileSync(path.join(process.cwd(), "supabase/migrations/202607130003_production_transactions.sql"), "utf8");
const managerCodeSql = readFileSync(path.join(process.cwd(), "supabase/migrations/202607130004_manager_access_codes.sql"), "utf8");
describe("database security migration", () => {
  it("enforces one open entry and one open break", () => { expect(sql).toContain("time_entries_one_open_per_employee"); expect(sql).toContain("break_entries_one_open_per_entry"); });
  it("prevents cross-company worksite assignments", () => expect(sql).toContain("enforce_employee_worksite_tenant"));
  it("enables RLS on every Phase 2 table", () => { for (const table of ["worksites","employee_worksites","time_entries","break_entries","time_events","employee_sessions","time_correction_requests","time_off_requests","audit_logs"]) expect(sql).toContain(`alter table public.${table} enable row level security`); });
  it("does not expose PIN hashes and prevents event/audit mutation", () => { expect(sql).toContain("revoke select(pin_hash"); expect(sql).toContain("time_events_no_update"); expect(sql).toContain("audit_logs_no_update"); });
  it("uses server-generated timestamps", () => expect((sql.match(/default now\(\)/g) ?? []).length).toBeGreaterThan(10));
  it("runs clock transitions in one security-definer transaction", () => { expect(productionSql).toContain("function public.employee_clock_action"); expect(productionSql).toContain("for update"); expect(productionSql).toContain("clock_timestamp()"); expect(productionSql).toContain("idempotency_key=p_idempotency_key"); });
  it("keeps employee session RPCs service-role only", () => { for (const fn of ["employee_login_candidate","record_employee_login_attempt","create_employee_session","resolve_employee_session","revoke_employee_session"]) { expect(productionSql).toContain(`grant execute on function public.${fn}`); } expect(productionSql).toContain("to service_role"); });
  it("adds audited manager edit and time-off review transactions", () => { expect(productionSql).toContain("manager_edit_time_entry"); expect(productionSql).toContain("original_values"); expect(productionSql).toContain("review_time_off_request"); });
  it("enables tenant RLS on company principals", () => { for (const table of ["companies","company_users","employees"]) expect(productionSql).toContain(`alter table public.${table} enable row level security`); });
  it("stores only manager code hashes and enforces lockout server-side", () => { expect(managerCodeSql).toContain("access_code_hash text"); expect(managerCodeSql).toContain("failed_access_code_attempts >= 4"); expect(managerCodeSql).toContain("interval '15 minutes'"); expect(managerCodeSql).not.toContain("access_code text"); });
  it("keeps manager code verification RPCs service-role only", () => { expect(managerCodeSql).toContain("revoke all on function public.manager_login_candidates(text) from public, anon, authenticated"); expect(managerCodeSql).toContain("grant execute on function public.manager_login_candidates(text) to service_role"); expect(managerCodeSql).toContain("revoke select(access_code_hash"); });
});
