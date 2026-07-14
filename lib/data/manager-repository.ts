import "server-only";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { getCookieSupabase } from "@/lib/supabase/server";
import bcrypt from "bcryptjs";
import { DataAccessError, dataError } from "./errors";

export type ManagerContext = { userId: string; companyId: string; role: "OWNER" | "MANAGER" };

export async function requireManager(): Promise<ManagerContext> {
  const user = await getAuthenticatedUser();
  if (!user) throw new DataAccessError("ADMIN_UNAUTHENTICATED", "Manager sign-in is required.", 401);
  const { data, error } = await getAdminSupabase().from("company_users").select("company_id,role")
    .eq("user_id", user.id).eq("status", "ACTIVE").in("role", ["OWNER", "MANAGER"]).limit(1).maybeSingle();
  if (error || !data) throw new DataAccessError("ADMIN_FORBIDDEN", "Manager access is required.", 403);
  return { userId: user.id, companyId: data.company_id, role: data.role };
}

export async function getWorkforce() {
  const manager = await requireManager();
  const { data, error } = await getAdminSupabase().from("time_entries")
    .select("id,employee_id,worksite_id,clock_in_at,approval_status,employees(preferred_name),worksites(name),break_entries(id,started_at,ended_at),time_events(location_verification_result,server_timestamp)")
    .eq("company_id", manager.companyId).eq("status", "OPEN").order("clock_in_at");
  if (error) throw dataError(error, "Unable to load workforce status.");
  return (data ?? []).map((entry) => ({
    id: entry.id, employeeId: entry.employee_id,
    employeeName: (entry.employees as unknown as { preferred_name: string })?.preferred_name ?? "Employee",
    worksiteName: (entry.worksites as unknown as { name: string })?.name ?? "Worksite",
    clockInAt: entry.clock_in_at,
    state: (entry.break_entries as unknown as { ended_at: string | null }[] | null)?.some((item) => !item.ended_at) ? "ON_BREAK" : "CLOCKED_IN",
    location: [...((entry.time_events as unknown as { location_verification_result: string; server_timestamp: string }[]) ?? [])].sort((a,b) => b.server_timestamp.localeCompare(a.server_timestamp))[0]?.location_verification_result ?? "MISSING",
  }));
}

export async function getTimesheets() {
  const manager = await requireManager();
  const { data, error } = await getAdminSupabase().from("time_entries")
    .select("id,employee_id,worksite_id,clock_in_at,clock_out_at,total_work_minutes,total_break_minutes,approval_status,manager_note,employees(preferred_name),worksites(name),time_events(location_verification_result)")
    .eq("company_id", manager.companyId).neq("status", "VOIDED").order("clock_in_at", { ascending: false }).limit(200);
  if (error) throw dataError(error, "Unable to load timesheets."); return data ?? [];
}

export async function getTeamRecords() {
  const manager = await requireManager();
  const admin = getAdminSupabase();
  const [employeesResult, assignmentsResult, entriesResult] = await Promise.all([
    admin.from("employees").select("id,employee_number,preferred_name,status,created_at").eq("company_id", manager.companyId).order("preferred_name"),
    admin.from("employee_worksites").select("employee_id,worksite_id,status,worksites(name)").eq("company_id", manager.companyId).eq("status", "ACTIVE"),
    admin.from("time_entries").select("id,employee_id,status,clock_in_at,clock_out_at,total_work_minutes,approval_status,break_entries(status)").eq("company_id", manager.companyId).neq("status", "VOIDED").order("clock_in_at", { ascending: false }).limit(1000),
  ]);
  if (employeesResult.error) throw dataError(employeesResult.error, "Unable to load team members.");
  if (assignmentsResult.error) throw dataError(assignmentsResult.error, "Unable to load team worksites.");
  if (entriesResult.error) throw dataError(entriesResult.error, "Unable to load team records.");
  const assignments = new Map<string, string[]>();
  const assignmentIds = new Map<string, string[]>();
  for (const assignment of assignmentsResult.data ?? []) {
    const worksite = assignment.worksites as unknown as { name: string } | null;
    if (!worksite?.name) continue;
    assignments.set(assignment.employee_id, [...(assignments.get(assignment.employee_id) ?? []), worksite.name]);
    assignmentIds.set(assignment.employee_id, [...(assignmentIds.get(assignment.employee_id) ?? []), assignment.worksite_id]);
  }
  const entriesByEmployee = new Map<string, NonNullable<typeof entriesResult.data>>();
  for (const entry of entriesResult.data ?? []) entriesByEmployee.set(entry.employee_id, [...(entriesByEmployee.get(entry.employee_id) ?? []), entry]);
  return (employeesResult.data ?? []).map((employee) => {
    const entries = entriesByEmployee.get(employee.id) ?? [];
    const open = entries.find((entry) => entry.status === "OPEN");
    const openBreaks = (open?.break_entries as unknown as { status: string }[] | null) ?? [];
    return {
      ...employee,
      worksites: assignments.get(employee.id) ?? [],
      assignedWorksiteIds: assignmentIds.get(employee.id) ?? [],
      currentState: open ? (openBreaks.some((item) => item.status === "OPEN") ? "ON_BREAK" : "CLOCKED_IN") : "OFF_CLOCK",
      completedShifts: entries.filter((entry) => entry.status === "COMPLETED").length,
      approvedMinutes: entries.filter((entry) => entry.status === "COMPLETED" && entry.approval_status === "APPROVED").reduce((sum, entry) => sum + (entry.total_work_minutes ?? 0), 0),
      lastShiftAt: entries.find((entry) => entry.status === "COMPLETED")?.clock_out_at ?? null,
    };
  });
}

export async function getEmployeeManagementData() {
  const manager = await requireManager();
  const admin = getAdminSupabase();
  const [members, worksitesResult, teamsResult, membershipsResult] = await Promise.all([
    getTeamRecords(),
    admin.from("worksites").select("id,name,status").eq("company_id",manager.companyId).order("name"),
    admin.from("team_groups").select("id,name,description,status").eq("company_id",manager.companyId).order("name"),
    admin.from("employee_team_memberships").select("employee_id,team_group_id").eq("company_id",manager.companyId).eq("status","ACTIVE"),
  ]);
  if(worksitesResult.error)throw dataError(worksitesResult.error,"Unable to load worksites.");
  if(teamsResult.error)throw dataError(teamsResult.error,"Unable to load team groups.");
  if(membershipsResult.error)throw dataError(membershipsResult.error,"Unable to load team memberships.");
  const teamIds=new Map<string,string[]>();
  for(const membership of membershipsResult.data??[])teamIds.set(membership.employee_id,[...(teamIds.get(membership.employee_id)??[]),membership.team_group_id]);
  const teams=teamsResult.data??[];
  return {members:members.map((member)=>({...member,teamGroupIds:teamIds.get(member.id)??[],teamNames:teams.filter((team)=>teamIds.get(member.id)?.includes(team.id)).map((team)=>team.name)})),worksites:worksitesResult.data??[],teams};
}

type EmployeeCreateInput={employeeNumber:string;preferredName:string;pin:string;worksiteIds:string[];teamGroupIds:string[]};
export async function createEmployee(input:EmployeeCreateInput){
  const manager=await requireManager();const pinHash=await bcrypt.hash(input.pin,12);
  const{data,error}=await getAdminSupabase().rpc("manager_create_employee",{p_actor_user_id:manager.userId,p_company_id:manager.companyId,p_employee_number:input.employeeNumber,p_preferred_name:input.preferredName,p_pin_hash:pinHash,p_worksite_ids:input.worksiteIds,p_team_group_ids:input.teamGroupIds});
  if(error)throw dataError(error,"Unable to create employee. Check that the employee number is unique.");return data;
}
export async function resetEmployeePin(employeeId:string,pin:string){
  const manager=await requireManager();const pinHash=await bcrypt.hash(pin,12);
  const{error}=await getAdminSupabase().rpc("manager_reset_employee_pin",{p_actor_user_id:manager.userId,p_company_id:manager.companyId,p_employee_id:employeeId,p_pin_hash:pinHash});
  if(error)throw dataError(error,"Unable to reset employee PIN.");
}
export async function updateEmployeeAssignments(employeeId:string,worksiteIds:string[],teamGroupIds:string[]){
  const manager=await requireManager();const{error}=await getAdminSupabase().rpc("manager_set_employee_assignments",{p_actor_user_id:manager.userId,p_company_id:manager.companyId,p_employee_id:employeeId,p_worksite_ids:worksiteIds,p_team_group_ids:teamGroupIds});
  if(error)throw dataError(error,"Unable to update employee assignments.");
}
export async function updateEmployeeProfile(employeeId:string,preferredName:string,status:"ACTIVE"|"INACTIVE"){
  const manager=await requireManager();const{error}=await getAdminSupabase().rpc("manager_update_employee_profile",{p_actor_user_id:manager.userId,p_company_id:manager.companyId,p_employee_id:employeeId,p_preferred_name:preferredName,p_status:status});
  if(error)throw dataError(error,"Unable to update employee profile.");
}
export async function saveTeamGroup(input:{name:string;description:string;status:"ACTIVE"|"INACTIVE"},teamGroupId?:string){
  const manager=await requireManager();const{data,error}=await getAdminSupabase().rpc("manager_save_team_group",{p_actor_user_id:manager.userId,p_company_id:manager.companyId,p_name:input.name,p_description:input.description,p_status:input.status,p_team_group_id:teamGroupId??null});
  if(error)throw dataError(error,"Unable to save team group. Team names must be unique.");return data;
}

export async function getTimesheet(entryId: string) {
  const manager = await requireManager();
  const { data, error } = await getAdminSupabase().from("time_entries")
    .select("*,employees(preferred_name),worksites(name,address_line_1,city,state),break_entries(*),time_events(*),time_correction_requests(*)")
    .eq("id", entryId).eq("company_id", manager.companyId).single();
  if (error || !data) throw new DataAccessError("NOT_FOUND", "Timesheet was not found.", 404); return data;
}

export async function reviewTimesheet(entryId: string, decision: "APPROVED" | "REJECTED", note: string | null) {
  await requireManager();
  const { data, error } = await (await getCookieSupabase()).rpc("approve_time_entry", { p_entry_id: entryId, p_approved: decision === "APPROVED", p_note: note });
  if (error) throw dataError(error, "Unable to review timesheet."); return data;
}

export async function editTimesheet(entryId: string, input: { clockInAt?: string; clockOutAt?: string; breaks?: unknown; reason: string }) {
  await requireManager();
  const { data, error } = await (await getCookieSupabase()).rpc("manager_edit_time_entry", {
    p_entry_id: entryId, p_clock_in_at: input.clockInAt ?? null, p_clock_out_at: input.clockOutAt ?? null,
    p_breaks: input.breaks ?? null, p_reason: input.reason,
  });
  if (error) throw dataError(error, "Unable to correct timesheet."); return data;
}

export async function listWorksites() {
  const manager = await requireManager();
  const { data, error } = await getAdminSupabase().from("worksites").select("*").eq("company_id", manager.companyId).order("name");
  if (error) throw dataError(error, "Unable to load worksites."); return data ?? [];
}

export async function saveWorksite(input: Record<string, unknown>, id?: string) {
  const manager = await requireManager();
  const record = { ...input, company_id: manager.companyId, updated_by: manager.userId, updated_at: new Date().toISOString() };
  const operation = id
    ? getAdminSupabase().from("worksites").update(record).eq("id", id).eq("company_id", manager.companyId)
    : getAdminSupabase().from("worksites").insert({ ...record, created_by: manager.userId });
  const { data, error } = await operation.select().single();
  if (error) throw dataError(error, "Unable to save worksite."); return data;
}

export async function reviewTimeOff(requestId: string, decision: "APPROVED" | "DENIED", note: string | null) {
  await requireManager();
  const { data, error } = await (await getCookieSupabase()).rpc("review_time_off_request", { p_request_id: requestId, p_decision: decision, p_note: note });
  if (error) throw dataError(error, "Unable to review time-off request."); return data;
}

export async function getTimeOffRequests() {
  const manager=await requireManager();
  const{data,error}=await getAdminSupabase().from("time_off_requests").select("*,employees(preferred_name)").eq("company_id",manager.companyId).order("created_at",{ascending:false}).limit(200);
  if(error)throw dataError(error,"Unable to load time-off requests.");return data??[];
}
