import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read=(file:string)=>readFileSync(path.join(process.cwd(),file),"utf8");
describe("production data boundary",()=>{
  it("has no production import of the deleted demo store",()=>{const files=["lib/api.ts","app/api/employee/auth/route.ts","app/api/employee/action/route.ts","app/api/employee/state/route.ts","app/api/employee/time-off/route.ts","app/api/employee/corrections/route.ts","app/admin/dashboard/page.tsx","app/admin/timesheets/page.tsx"];for(const file of files)expect(read(file)).not.toContain("demo-store");});
  it("never accepts employee or company identity in clock action input",()=>{const route=read("app/api/employee/action/route.ts");expect(route).not.toContain("employeeId:");expect(route).not.toContain("companyId:");expect(route).toContain("employeeToken(request)");});
  it("keeps service-role access in server-only modules",()=>{expect(read("lib/supabase/admin.ts")).toContain('import "server-only"');expect(read("lib/supabase/admin.ts")).toContain("SUPABASE_SERVICE_ROLE_KEY");});
  it("contains no Phase 2 demo credentials outside local seed",()=>{const files=["app/employee/login/page.tsx","lib/data/employee-repository.ts","tests/store.test.ts"];for(const file of files){expect(read(file)).not.toContain('"HARBOR"');expect(read(file)).not.toContain('"2468"');}});
  it("uses a server-created Supabase session for manager code sign-in",()=>{const route=read("app/api/admin/auth/route.ts");expect(route).toContain('rpc("manager_login_candidates"');expect(route).toContain("bcrypt.compare");expect(route).toContain("generateLink");expect(route).toContain("verifyOtp");expect(route).not.toContain("console.");});
  it("provides a tenant-scoped team records screen",()=>{expect(read("app/admin/layout.tsx")).toContain('href="/admin/team"');const repository=read("lib/data/manager-repository.ts");expect(repository).toContain("getTeamRecords");expect(repository).toContain('eq("company_id", manager.companyId)');});
  it("derives employee management tenant identity from the manager session",()=>{const repository=read("lib/data/manager-repository.ts");expect(repository).toContain("manager_create_employee");expect(repository).toContain("manager_reset_employee_pin");expect(repository).toContain("const manager=await requireManager()");const route=read("app/api/admin/employees/route.ts");expect(route).not.toContain("companyId");expect(route).not.toContain("actorUserId");});
  it("never displays or returns stored employee PIN hashes",()=>{for(const file of ["components/employee-management.tsx","app/admin/team/page.tsx","app/api/admin/employees/route.ts"])expect(read(file)).not.toContain("pin_hash");});
});
