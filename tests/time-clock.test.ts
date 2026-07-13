import { describe, expect, it } from "vitest";
import { allowedActions, assertTransition, calculateDurations, deriveState, haversineMeters, validateGeofence } from "@/lib/time-clock";
import type { TimeEntry, Worksite } from "@/lib/types";

const worksite: Worksite = { id: "site", companyId: "company", name: "Site", address: "1 Main", timezone: "UTC", latitude: 37.7955, longitude: -122.2787, geofenceRadiusMeters: 150, requireLocation: true, captureBreakLocation: false, geofenceMode: "FLAG", active: true };
const baseEntry: TimeEntry = { id: "entry", companyId: "company", employeeId: "employee", worksiteId: "site", clockInAt: new Date("2026-07-13T08:00:00Z"), breaks: [], approvalStatus: "PENDING" };

describe("strict clock state machine", () => {
  it.each([
    ["OFF_CLOCK", "CLOCK_IN", "CLOCKED_IN"], ["CLOCKED_IN", "BREAK_START", "ON_BREAK"],
    ["ON_BREAK", "BREAK_END", "CLOCKED_IN"], ["CLOCKED_IN", "CLOCK_OUT", "OFF_CLOCK"],
  ] as const)("accepts %s -> %s", (state, action, next) => expect(assertTransition(state, action)).toBe(next));

  it.each([
    ["OFF_CLOCK", "CLOCK_OUT"], ["OFF_CLOCK", "BREAK_START"], ["OFF_CLOCK", "BREAK_END"],
    ["CLOCKED_IN", "CLOCK_IN"], ["CLOCKED_IN", "BREAK_END"], ["ON_BREAK", "CLOCK_IN"],
    ["ON_BREAK", "CLOCK_OUT"], ["ON_BREAK", "BREAK_START"],
  ] as const)("rejects invalid %s -> %s", (state, action) => expect(() => assertTransition(state, action)).toThrow(/not allowed/));

  it("exposes only state-valid actions", () => {
    expect(allowedActions("OFF_CLOCK")).toEqual(["CLOCK_IN"]);
    expect(allowedActions("ON_BREAK")).toEqual(["BREAK_END"]);
  });

  it("derives on-break state from an open break", () => {
    expect(deriveState({ ...baseEntry, breaks: [{ id: "b", type: "UNPAID", startedAt: new Date() }] })).toBe("ON_BREAK");
  });
});

describe("deterministic distance and time", () => {
  it("calculates a known short distance", () => expect(haversineMeters(37.7955, -122.2787, 37.7960, -122.2787)).toBe(56));
  it("marks an inside result", () => expect(validateGeofence(worksite, { latitude: 37.796, longitude: -122.2787, permissionStatus: "GRANTED" }).verification).toBe("VERIFIED"));
  it("marks an outside result for review in FLAG mode", () => expect(validateGeofence(worksite, { latitude: 37.81, longitude: -122.2787, permissionStatus: "GRANTED" })).toMatchObject({ verification: "OUTSIDE", needsReview: true, blocked: false }));
  it("blocks missing location in STRICT mode", () => expect(validateGeofence({ ...worksite, geofenceMode: "STRICT" }, { permissionStatus: "DENIED" })).toMatchObject({ verification: "MISSING", blocked: true }));
  it("flags missing location in FLAG mode", () => expect(validateGeofence(worksite, { permissionStatus: "UNAVAILABLE" })).toMatchObject({ verification: "MISSING", needsReview: true, blocked: false }));
  it("subtracts only unpaid breaks from worked minutes", () => {
    const result = calculateDurations({ ...baseEntry, clockOutAt: new Date("2026-07-13T12:00:00Z"), breaks: [
      { id: "paid", type: "PAID", startedAt: new Date("2026-07-13T09:00:00Z"), endedAt: new Date("2026-07-13T09:15:00Z") },
      { id: "unpaid", type: "UNPAID", startedAt: new Date("2026-07-13T10:00:00Z"), endedAt: new Date("2026-07-13T10:30:00Z") },
    ] });
    expect(result).toEqual({ elapsedMinutes: 240, paidBreakMinutes: 15, unpaidBreakMinutes: 30, totalBreakMinutes: 45, netWorkMinutes: 210 });
  });
});
