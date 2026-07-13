import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import type { ClockAction, LocationCapture, TimeEntry, Worksite } from "./types";
import { assertTransition, calculateDurations, deriveState, openBreak, validateGeofence } from "./time-clock";
import { hashSessionToken, isSessionExpired, lockoutUntil, newSessionToken, SESSION_HOURS } from "./security";

interface Employee {
  id: string;
  companyId: string;
  employeeNumber: string;
  preferredName: string;
  pinHash: string;
  failedAttempts: number;
  lockedUntil: Date | null;
}

interface Session {
  employeeId: string;
  companyId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt?: Date;
  lastActivityAt: Date;
}

interface TimeEvent {
  id: string;
  type: ClockAction;
  serverTimestamp: Date;
  timeEntryId: string;
  verification: string;
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number;
  distanceMeters: number | null;
  insideGeofence: boolean | null;
  permissionStatus: string;
  clientTimestamp?: string;
  idempotencyKey: string;
}

interface TimeOffRequest {
  id: string;
  employeeId: string;
  type: "UNPAID" | "VACATION" | "SICK" | "OTHER";
  startDate: string;
  endDate: string;
  reason: string;
  status: "PENDING" | "APPROVED" | "DENIED" | "CANCELLED";
  createdAt: Date;
}

interface CorrectionRequest {
  id: string;
  employeeId: string;
  timeEntryId: string;
  requestedChange: string;
  reason: string;
  status: "PENDING" | "RESOLVED";
  createdAt: Date;
}

interface Store {
  employees: Employee[];
  sessions: Session[];
  worksites: Worksite[];
  entries: TimeEntry[];
  events: TimeEvent[];
  timeOff: TimeOffRequest[];
  corrections: CorrectionRequest[];
}

const demoCompanyId = "11111111-1111-4111-8111-111111111111";
const demoEmployeeId = "22222222-2222-4222-8222-222222222222";

function initialStore(): Store {
  return {
    employees: [
      {
        id: demoEmployeeId,
        companyId: demoCompanyId,
        employeeNumber: "1042",
        preferredName: "Jordan",
        pinHash: bcrypt.hashSync("2468", 10),
        failedAttempts: 0,
        lockedUntil: null,
      },
    ],
    sessions: [],
    worksites: [
      {
        id: "33333333-3333-4333-8333-333333333333",
        companyId: demoCompanyId,
        name: "Harbor Street Kitchen",
        address: "412 Harbor Street, Oakland, CA",
        timezone: "America/Los_Angeles",
        latitude: 37.7955,
        longitude: -122.2787,
        geofenceRadiusMeters: 150,
        requireLocation: true,
        captureBreakLocation: false,
        geofenceMode: "FLAG",
        active: true,
      },
    ],
    entries: [],
    events: [],
    timeOff: [],
    corrections: [],
  };
}

const globalStore = globalThis as unknown as { harborStore?: Store };
export const store = globalStore.harborStore ?? initialStore();
globalStore.harborStore = store;

const pepper = process.env.EMPLOYEE_SESSION_PEPPER ?? "development-only-pepper-change-before-production";

export function authenticateEmployee(companyCode: string, employeeNumber: string, pin: string, now = new Date()) {
  // One generic lookup/error path avoids disclosing which credential was wrong.
  const employee =
    companyCode.toUpperCase() === "HARBOR" ? store.employees.find((item) => item.employeeNumber === employeeNumber) : undefined;
  if (!employee || (employee.lockedUntil && employee.lockedUntil > now) || !bcrypt.compareSync(pin, employee.pinHash)) {
    if (employee) {
      employee.failedAttempts += 1;
      employee.lockedUntil = lockoutUntil(employee.failedAttempts, now);
    }
    throw new Error("The sign-in details could not be verified. Try again later.");
  }

  employee.failedAttempts = 0;
  employee.lockedUntil = null;
  const token = newSessionToken();
  store.sessions.push({
    employeeId: employee.id,
    companyId: employee.companyId,
    tokenHash: hashSessionToken(token, pepper),
    expiresAt: new Date(now.getTime() + SESSION_HOURS * 3_600_000),
    lastActivityAt: now,
  });
  return { token, employee };
}

export function employeeFromToken(token: string | undefined, now = new Date()) {
  if (!token) return null;
  const tokenHash = hashSessionToken(token, pepper);
  const session = store.sessions.find((item) => item.tokenHash === tokenHash && !item.revokedAt);
  if (!session || isSessionExpired(session.expiresAt, now)) return null;
  session.lastActivityAt = now;
  return store.employees.find((item) => item.id === session.employeeId) ?? null;
}

export function revokeToken(token: string | undefined) {
  if (!token) return;
  const tokenHash = hashSessionToken(token, pepper);
  const session = store.sessions.find((item) => item.tokenHash === tokenHash);
  if (session) session.revokedAt = new Date();
}

export function employeeSnapshot(employeeId: string, now = new Date()) {
  const employee = store.employees.find((item) => item.id === employeeId)!;
  const entry = store.entries.find((item) => item.employeeId === employeeId && !item.clockOutAt);
  const worksite = store.worksites[0];
  const completed = store.entries.filter((item) => item.employeeId === employeeId && item.clockOutAt);
  const totalMinutes = completed.reduce((sum, item) => sum + calculateDurations(item).netWorkMinutes, 0);
  return {
    employee: { preferredName: employee.preferredName, initials: "JR" },
    state: deriveState(entry),
    worksite,
    openEntry: entry ? serializeEntry(entry, now) : null,
    entries: [...completed].reverse().map((item) => serializeEntry(item, now)),
    payPeriod: {
      regularMinutes: totalMinutes,
      breakMinutes: completed.reduce((sum, item) => sum + calculateDurations(item).totalBreakMinutes, 0),
      pendingMinutes: completed.filter((item) => item.approvalStatus === "PENDING").reduce((sum, item) => sum + calculateDurations(item).netWorkMinutes, 0),
      approvedMinutes: completed.filter((item) => item.approvalStatus === "APPROVED").reduce((sum, item) => sum + calculateDurations(item).netWorkMinutes, 0),
      totalMinutes,
    },
    timeOff: store.timeOff.filter((item) => item.employeeId === employeeId),
  };
}

function serializeEntry(entry: TimeEntry, now: Date) {
  return {
    ...entry,
    clockInAt: entry.clockInAt.toISOString(),
    clockOutAt: entry.clockOutAt?.toISOString(),
    breaks: entry.breaks.map((item) => ({
      ...item,
      startedAt: item.startedAt.toISOString(),
      endedAt: item.endedAt?.toISOString(),
    })),
    durations: calculateDurations(entry, now),
  };
}

export function performAction(params: {
  employeeId: string;
  action: ClockAction;
  worksiteId: string;
  location: LocationCapture;
  idempotencyKey: string;
  now?: Date;
}) {
  const now = params.now ?? new Date(); // authoritative server time
  const duplicate = store.events.find((item) => item.idempotencyKey === params.idempotencyKey);
  if (duplicate) return employeeSnapshot(params.employeeId, now);

  const currentEntry = store.entries.find((item) => item.employeeId === params.employeeId && !item.clockOutAt);
  const currentState = deriveState(currentEntry);
  assertTransition(currentState, params.action);

  const worksite = store.worksites.find((item) => item.id === params.worksiteId && item.active);
  if (!worksite || worksite.companyId !== demoCompanyId) throw new Error("Worksite is not available.");
  const checkLocation = params.action === "CLOCK_IN" || params.action === "CLOCK_OUT" || worksite.captureBreakLocation;
  const geofence = validateGeofence(checkLocation ? worksite : { ...worksite, requireLocation: false }, params.location);
  if (geofence.blocked) throw new Error("Location verification is required at this worksite.");

  let entry = currentEntry;
  if (params.action === "CLOCK_IN") {
    entry = {
      id: randomUUID(),
      companyId: demoCompanyId,
      employeeId: params.employeeId,
      worksiteId: worksite.id,
      clockInAt: now,
      breaks: [],
      approvalStatus: geofence.needsReview ? "NEEDS_REVIEW" : "PENDING",
    };
    store.entries.push(entry);
  } else if (!entry) {
    throw new Error("No open time entry was found.");
  } else if (params.action === "BREAK_START") {
    if (openBreak(entry)) throw new Error("A break is already active.");
    entry.breaks.push({ id: randomUUID(), type: "UNPAID", startedAt: now });
  } else if (params.action === "BREAK_END") {
    const activeBreak = openBreak(entry);
    if (!activeBreak) throw new Error("No active break was found.");
    activeBreak.endedAt = now;
  } else {
    if (openBreak(entry)) throw new Error("End the break before clocking out.");
    entry.clockOutAt = now;
    const durations = calculateDurations(entry, now);
    entry.totalWorkMinutes = durations.netWorkMinutes;
    entry.totalBreakMinutes = durations.totalBreakMinutes;
    if (geofence.needsReview) entry.approvalStatus = "NEEDS_REVIEW";
  }

  store.events.push({
    id: randomUUID(),
    type: params.action,
    serverTimestamp: now,
    timeEntryId: entry.id,
    verification: geofence.verification,
    latitude: params.location.latitude,
    longitude: params.location.longitude,
    accuracyMeters: params.location.accuracyMeters,
    distanceMeters: geofence.distanceMeters,
    insideGeofence: geofence.insideGeofence,
    permissionStatus: params.location.permissionStatus,
    clientTimestamp: params.location.clientTimestamp,
    idempotencyKey: params.idempotencyKey,
  });
  return employeeSnapshot(params.employeeId, now);
}

export function addTimeOff(employeeId: string, data: Omit<TimeOffRequest, "id" | "employeeId" | "status" | "createdAt">) {
  const request: TimeOffRequest = { ...data, id: randomUUID(), employeeId, status: "PENDING", createdAt: new Date() };
  store.timeOff.push(request);
  return request;
}

export function cancelTimeOff(employeeId: string, id: string) {
  const request = store.timeOff.find((item) => item.id === id && item.employeeId === employeeId);
  if (!request || request.status !== "PENDING") throw new Error("Only your pending request can be cancelled.");
  request.status = "CANCELLED";
}

export function addCorrection(employeeId: string, timeEntryId: string, requestedChange: string, reason: string) {
  const entry = store.entries.find((item) => item.id === timeEntryId && item.employeeId === employeeId);
  if (!entry) throw new Error("Time entry was not found.");
  const request: CorrectionRequest = {
    id: randomUUID(), employeeId, timeEntryId, requestedChange, reason, status: "PENDING", createdAt: new Date(),
  };
  store.corrections.push(request);
  return request;
}

export function resetStoreForTests() {
  const fresh = initialStore();
  Object.assign(store, fresh);
}
