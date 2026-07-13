import type {
  BreakEntry,
  ClockAction,
  ClockState,
  GeofenceResult,
  LocationCapture,
  TimeEntry,
  Worksite,
} from "./types";

const EARTH_RADIUS_METERS = 6_371_000;

export class TimeClockError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 409,
  ) {
    super(message);
  }
}

export function allowedActions(state: ClockState): ClockAction[] {
  if (state === "OFF_CLOCK") return ["CLOCK_IN"];
  if (state === "CLOCKED_IN") return ["BREAK_START", "CLOCK_OUT"];
  return ["BREAK_END"];
}

export function assertTransition(state: ClockState, action: ClockAction): ClockState {
  if (!allowedActions(state).includes(action)) {
    throw new TimeClockError("INVALID_TRANSITION", `${action} is not allowed while ${state}.`);
  }
  if (action === "CLOCK_IN" || action === "BREAK_END") return "CLOCKED_IN";
  if (action === "BREAK_START") return "ON_BREAK";
  return "OFF_CLOCK";
}

export function deriveState(entry?: TimeEntry): ClockState {
  if (!entry || entry.clockOutAt) return "OFF_CLOCK";
  return entry.breaks.some((item) => !item.endedAt) ? "ON_BREAK" : "CLOCKED_IN";
}

function radians(value: number) {
  return (value * Math.PI) / 180;
}

export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const latitude = radians(lat2 - lat1);
  const longitude = radians(lon2 - lon1);
  const a =
    Math.sin(latitude / 2) ** 2 +
    Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(longitude / 2) ** 2;
  return Math.round(EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export function validateGeofence(worksite: Worksite, capture: LocationCapture): GeofenceResult {
  if (!worksite.requireLocation || worksite.geofenceMode === "OPTIONAL") {
    return {
      distanceMeters: null,
      insideGeofence: null,
      verification: "NOT_REQUIRED",
      needsReview: false,
      blocked: false,
    };
  }

  const latitude = capture.latitude;
  const longitude = capture.longitude;
  const missing =
    capture.permissionStatus !== "GRANTED" ||
    latitude === undefined ||
    longitude === undefined;
  if (missing) {
    return {
      distanceMeters: null,
      insideGeofence: null,
      verification: "MISSING",
      needsReview: worksite.geofenceMode === "FLAG",
      blocked: worksite.geofenceMode === "STRICT",
    };
  }

  const distanceMeters = haversineMeters(
    latitude as number,
    longitude as number,
    worksite.latitude,
    worksite.longitude,
  );
  const insideGeofence = distanceMeters <= worksite.geofenceRadiusMeters;
  return {
    distanceMeters,
    insideGeofence,
    verification: insideGeofence ? "VERIFIED" : "OUTSIDE",
    needsReview: !insideGeofence && worksite.geofenceMode === "FLAG",
    blocked: !insideGeofence && worksite.geofenceMode === "STRICT",
  };
}

export function calculateDurations(entry: TimeEntry, now = new Date()) {
  const end = entry.clockOutAt ?? now;
  const elapsedMinutes = Math.max(0, Math.floor((end.getTime() - entry.clockInAt.getTime()) / 60_000));
  let paidBreakMinutes = 0;
  let unpaidBreakMinutes = 0;

  for (const item of entry.breaks) {
    const breakEnd = item.endedAt ?? end;
    const minutes = Math.max(0, Math.floor((breakEnd.getTime() - item.startedAt.getTime()) / 60_000));
    if (item.type === "PAID") paidBreakMinutes += minutes;
    else unpaidBreakMinutes += minutes;
  }

  return {
    elapsedMinutes,
    paidBreakMinutes,
    unpaidBreakMinutes,
    totalBreakMinutes: paidBreakMinutes + unpaidBreakMinutes,
    netWorkMinutes: Math.max(0, elapsedMinutes - unpaidBreakMinutes),
  };
}

export function formatMinutes(minutes: number) {
  const safe = Math.max(0, Math.floor(minutes));
  return `${Math.floor(safe / 60)}h ${safe % 60}m`;
}

export function openBreak(entry: TimeEntry): BreakEntry | undefined {
  return entry.breaks.find((item) => !item.endedAt);
}
