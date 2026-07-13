export type ClockState = "OFF_CLOCK" | "CLOCKED_IN" | "ON_BREAK";
export type ClockAction = "CLOCK_IN" | "CLOCK_OUT" | "BREAK_START" | "BREAK_END";
export type GeofenceMode = "STRICT" | "FLAG" | "OPTIONAL";
export type PermissionStatus = "GRANTED" | "DENIED" | "UNAVAILABLE" | "NOT_REQUESTED";
export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "NEEDS_REVIEW";

export interface LocationCapture {
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number;
  clientTimestamp?: string;
  permissionStatus: PermissionStatus;
}

export interface Worksite {
  id: string;
  companyId: string;
  name: string;
  address: string;
  timezone: string;
  latitude: number;
  longitude: number;
  geofenceRadiusMeters: number;
  requireLocation: boolean;
  captureBreakLocation: boolean;
  geofenceMode: GeofenceMode;
  active: boolean;
}

export interface GeofenceResult {
  distanceMeters: number | null;
  insideGeofence: boolean | null;
  verification: "VERIFIED" | "OUTSIDE" | "MISSING" | "NOT_REQUIRED";
  needsReview: boolean;
  blocked: boolean;
}

export interface BreakEntry {
  id: string;
  type: "PAID" | "UNPAID";
  startedAt: Date;
  endedAt?: Date;
}

export interface TimeEntry {
  id: string;
  companyId: string;
  employeeId: string;
  worksiteId: string;
  clockInAt: Date;
  clockOutAt?: Date;
  breaks: BreakEntry[];
  approvalStatus: ApprovalStatus;
  managerNote?: string;
  totalWorkMinutes?: number;
  totalBreakMinutes?: number;
}
