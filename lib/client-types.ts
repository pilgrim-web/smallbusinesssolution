import type { ClockState, Worksite } from "./types";

export interface SerializedEntry {
  id: string; worksiteId: string; clockInAt: string; clockOutAt?: string;
  approvalStatus: string;
  breaks: { id: string; type: string; startedAt: string; endedAt?: string }[];
  durations: { elapsedMinutes: number; paidBreakMinutes: number; unpaidBreakMinutes: number; totalBreakMinutes: number; netWorkMinutes: number };
}
export interface EmployeeData {
  employee: { preferredName: string; initials: string };
  state: ClockState; worksite: Worksite; openEntry: SerializedEntry | null; entries: SerializedEntry[];
  payPeriod: { regularMinutes: number; breakMinutes: number; pendingMinutes: number; approvedMinutes: number; totalMinutes: number };
  timeOff: { id: string; type: string; startDate: string; endDate: string; reason: string; status: string; createdAt: string }[];
}
