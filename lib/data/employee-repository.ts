import "server-only";
import bcrypt from "bcryptjs";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { hashSessionToken, newSessionToken, SESSION_HOURS } from "@/lib/security";
import { calculateDurations } from "@/lib/time-clock";
import type { ClockAction, LocationCapture } from "@/lib/types";
import { DataAccessError, dataError } from "./errors";

const GENERIC_LOGIN_ERROR = "The sign-in details could not be verified. Try again later.";

type EmployeeContext = { employee_id: string; company_id: string; preferred_name: string };
type DbBreak = { id: string; break_type: "PAID" | "UNPAID"; started_at: string; ended_at: string | null };
type DbEntry = {
  id: string; company_id: string; employee_id: string; worksite_id: string; clock_in_at: string; clock_out_at: string | null;
  status: "OPEN" | "COMPLETED" | "VOIDED"; approval_status: "PENDING" | "APPROVED" | "REJECTED" | "NEEDS_REVIEW";
  total_work_minutes: number | null; total_break_minutes: number | null; break_entries?: DbBreak[];
};

function pepper() {
  const value = process.env.EMPLOYEE_SESSION_PEPPER;
  if (!value || value.length < 32) throw new DataAccessError("SERVER_MISCONFIGURED", "Employee sign-in is temporarily unavailable.", 503);
  return value;
}

function tokenHash(token: string) {
  return hashSessionToken(token, pepper());
}

export async function authenticateEmployee(companyCode: string, employeeNumber: string, pin: string) {
  const database = getAdminSupabase();
  const { data, error } = await database.rpc("employee_login_candidate", {
    p_company_code: companyCode,
    p_employee_number: employeeNumber,
  });
  const candidate = Array.isArray(data) ? data[0] : data;
  if (error || !candidate || candidate.pin_locked) {
    throw new DataAccessError("INVALID_CREDENTIALS", GENERIC_LOGIN_ERROR, 401);
  }

  const valid = await bcrypt.compare(pin, candidate.pin_hash);
  const { data: attempt, error: attemptError } = await database.rpc("record_employee_login_attempt", {
    p_employee_id: candidate.employee_id,
    p_success: valid,
  });
  if (attemptError || !valid || attempt?.locked === true) {
    throw new DataAccessError("INVALID_CREDENTIALS", GENERIC_LOGIN_ERROR, 401);
  }

  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 3_600_000).toISOString();
  const { error: sessionError } = await database.rpc("create_employee_session", {
    p_employee_id: candidate.employee_id,
    p_token_hash: tokenHash(token),
    p_expires_at: expiresAt,
  });
  if (sessionError) throw dataError(sessionError, "Employee sign-in is temporarily unavailable.");
  return { token };
}

export async function resolveEmployee(token: string | undefined): Promise<EmployeeContext | null> {
  if (!token) return null;
  const { data, error } = await getAdminSupabase().rpc("resolve_employee_session", { p_token_hash: tokenHash(token) });
  if (error || !data) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return row ?? null;
}

export async function revokeEmployeeSession(token: string | undefined) {
  if (!token) return;
  const { error } = await getAdminSupabase().rpc("revoke_employee_session", { p_token_hash: tokenHash(token) });
  if (error) throw dataError(error, "Unable to sign out.");
}

function payPeriodStart(frequency: string, now: Date) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (frequency === "WEEKLY") start.setUTCDate(start.getUTCDate() - start.getUTCDay());
  else if (frequency === "BIWEEKLY") {
    const epoch = Date.UTC(2020, 0, 5); const days = Math.floor((start.getTime() - epoch) / 86_400_000);
    start.setUTCDate(start.getUTCDate() - ((days % 14 + 14) % 14));
  } else if (frequency === "SEMIMONTHLY") start.setUTCDate(start.getUTCDate() <= 15 ? 1 : 16);
  else start.setUTCDate(1);
  return start.toISOString();
}

function serializeEntry(row: DbEntry, now = new Date()) {
  const entry = {
    id: row.id, companyId: row.company_id, employeeId: row.employee_id, worksiteId: row.worksite_id,
    clockInAt: new Date(row.clock_in_at), clockOutAt: row.clock_out_at ? new Date(row.clock_out_at) : undefined,
    approvalStatus: row.approval_status,
    breaks: (row.break_entries ?? []).map((item) => ({ id: item.id, type: item.break_type, startedAt: new Date(item.started_at), endedAt: item.ended_at ? new Date(item.ended_at) : undefined })),
  };
  const durations = calculateDurations(entry, now);
  return { ...entry, clockInAt: entry.clockInAt.toISOString(), clockOutAt: entry.clockOutAt?.toISOString(), breaks: entry.breaks.map((item) => ({ ...item, startedAt: item.startedAt.toISOString(), endedAt: item.endedAt?.toISOString() })), durations };
}

export async function employeeSnapshot(token: string) {
  const context = await resolveEmployee(token);
  if (!context) throw new DataAccessError("SESSION_EXPIRED", "Your employee session has expired. Please sign in again.", 401);
  const database = getAdminSupabase();
  const [{ data: company }, { data: assignments }, { data: requests }] = await Promise.all([
    database.from("companies").select("pay_frequency").eq("id", context.company_id).single(),
    database.from("employee_worksites").select("worksite_id").eq("company_id", context.company_id).eq("employee_id", context.employee_id).eq("status", "ACTIVE"),
    database.from("time_off_requests").select("id,request_type,start_date,end_date,reason,status,created_at").eq("company_id", context.company_id).eq("employee_id", context.employee_id).order("created_at", { ascending: false }),
  ]);
  const worksiteIds = (assignments ?? []).map((row) => row.worksite_id);
  const { data: worksites } = worksiteIds.length ? await database.from("worksites").select("*").eq("company_id", context.company_id).in("id", worksiteIds).eq("status", "ACTIVE") : { data: [] };
  const periodStart = payPeriodStart(company?.pay_frequency ?? "BIWEEKLY", new Date());
  const { data: entries, error } = await database.from("time_entries")
    .select("id,company_id,employee_id,worksite_id,clock_in_at,clock_out_at,status,approval_status,total_work_minutes,total_break_minutes,break_entries(id,break_type,started_at,ended_at)")
    .eq("company_id", context.company_id).eq("employee_id", context.employee_id).gte("clock_in_at", periodStart).neq("status", "VOIDED").order("clock_in_at", { ascending: false });
  if (error) throw dataError(error, "Unable to load employee time records.");
  const typedEntries = (entries ?? []) as DbEntry[];
  const open = typedEntries.find((entry) => entry.status === "OPEN");
  const completed = typedEntries.filter((entry) => entry.status === "COMPLETED");
  const activeBreak = open?.break_entries?.some((item) => !item.ended_at);
  const serialized = completed.map((entry) => serializeEntry(entry));
  const worksite = (worksites ?? []).find((item) => item.id === open?.worksite_id) ?? worksites?.[0];
  const total = completed.reduce((sum, entry) => sum + (entry.total_work_minutes ?? serializeEntry(entry).durations.netWorkMinutes), 0);
  return {
    employee: { preferredName: context.preferred_name, initials: context.preferred_name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() },
    state: !open ? "OFF_CLOCK" : activeBreak ? "ON_BREAK" : "CLOCKED_IN",
    worksite: worksite ? {
      id: worksite.id, companyId: worksite.company_id, name: worksite.name,
      address: [worksite.address_line_1, worksite.address_line_2, worksite.city, worksite.state, worksite.postal_code].filter(Boolean).join(", "),
      timezone: worksite.timezone, latitude: Number(worksite.latitude), longitude: Number(worksite.longitude),
      geofenceRadiusMeters: worksite.geofence_radius_meters, requireLocation: worksite.require_location,
      captureBreakLocation: worksite.capture_break_location, geofenceMode: worksite.location_mode, active: worksite.status === "ACTIVE",
    } : null,
    openEntry: open ? serializeEntry(open) : null,
    entries: serialized,
    payPeriod: {
      regularMinutes: completed.reduce((sum, entry) => sum + (entry.total_work_minutes ?? 0), 0),
      breakMinutes: completed.reduce((sum, entry) => sum + (entry.total_break_minutes ?? 0), 0),
      pendingMinutes: completed.filter((entry) => entry.approval_status === "PENDING" || entry.approval_status === "NEEDS_REVIEW").reduce((sum, entry) => sum + (entry.total_work_minutes ?? 0), 0),
      approvedMinutes: completed.filter((entry) => entry.approval_status === "APPROVED").reduce((sum, entry) => sum + (entry.total_work_minutes ?? 0), 0),
      totalMinutes: total,
    },
    timeOff: (requests ?? []).map((item) => ({ id: item.id, type: item.request_type, startDate: item.start_date, endDate: item.end_date, reason: item.reason ?? "", status: item.status, createdAt: item.created_at })),
  };
}

export async function performClockAction(token: string, input: { action: ClockAction; worksiteId: string; location: LocationCapture; idempotencyKey: string }) {
  const { location } = input;
  const { error } = await getAdminSupabase().rpc("employee_clock_action", {
    p_token_hash: tokenHash(token), p_action: input.action, p_worksite_id: input.worksiteId, p_idempotency_key: input.idempotencyKey,
    p_client_timestamp: location.clientTimestamp ?? null, p_latitude: location.latitude ?? null, p_longitude: location.longitude ?? null,
    p_accuracy_meters: location.accuracyMeters ?? null, p_permission_status: location.permissionStatus,
    p_source: "EMPLOYEE_WEB", p_device_metadata: {},
  });
  if (error) throw new DataAccessError("CLOCK_ACTION_REJECTED", error.message, 409);
  return employeeSnapshot(token);
}

export async function createCorrection(token: string, timeEntryId: string, requestedChange: string, reason: string) {
  const context = await resolveEmployee(token); if (!context) throw new DataAccessError("SESSION_EXPIRED", "Your employee session has expired.", 401);
  const { data: entry } = await getAdminSupabase().from("time_entries").select("id").eq("id", timeEntryId).eq("company_id", context.company_id).eq("employee_id", context.employee_id).single();
  if (!entry) throw new DataAccessError("NOT_FOUND", "Time entry was not found.", 404);
  const { data, error } = await getAdminSupabase().from("time_correction_requests").insert({ company_id: context.company_id, employee_id: context.employee_id, time_entry_id: timeEntryId, requested_change: requestedChange, reason }).select().single();
  if (error) throw dataError(error, "Unable to create correction request."); return data;
}

export async function createTimeOff(token: string, input: { type: string; startDate: string; endDate: string; reason: string }) {
  const context = await resolveEmployee(token); if (!context) throw new DataAccessError("SESSION_EXPIRED", "Your employee session has expired.", 401);
  const { error } = await getAdminSupabase().from("time_off_requests").insert({ company_id: context.company_id, employee_id: context.employee_id, request_type: input.type, start_date: input.startDate, end_date: input.endDate, reason: input.reason });
  if (error) throw dataError(error, "Unable to submit time-off request."); return employeeSnapshot(token);
}

export async function cancelTimeOff(token: string, requestId: string) {
  const context = await resolveEmployee(token); if (!context) throw new DataAccessError("SESSION_EXPIRED", "Your employee session has expired.", 401);
  const { data, error } = await getAdminSupabase().from("time_off_requests").update({ status: "CANCELLED", updated_at: new Date().toISOString() })
    .eq("id", requestId).eq("company_id", context.company_id).eq("employee_id", context.employee_id).eq("status", "PENDING").select("id").maybeSingle();
  if (error || !data) throw new DataAccessError("INVALID_REQUEST", "Only your pending request can be cancelled.", 409); return employeeSnapshot(token);
}
