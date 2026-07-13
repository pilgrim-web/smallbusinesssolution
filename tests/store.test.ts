import { beforeEach, describe, expect, it } from "vitest";
import { authenticateEmployee, employeeFromToken, employeeId, performAction, resetStoreForTests, store, worksiteId } from "./helpers/memory-harness";

const location = { latitude: 37.7955, longitude: -122.2787, accuracyMeters: 8, permissionStatus: "GRANTED" as const };
const at = (minutes: number) => new Date(Date.UTC(2026, 6, 13, 8, minutes));
const act = (action: "CLOCK_IN" | "CLOCK_OUT" | "BREAK_START" | "BREAK_END", minute: number, key = crypto.randomUUID()) => performAction({ employeeId, worksiteId, action, location, idempotencyKey: key, now: at(minute) });

describe("server-authoritative clock operations", () => {
  beforeEach(resetStoreForTests);
  it("uses the supplied authoritative server timestamp", () => { act("CLOCK_IN", 3); expect(store.entries[0].clockInAt).toEqual(at(3)); expect(store.events[0].serverTimestamp).toEqual(at(3)); });
  it("rejects duplicate clock in", () => { act("CLOCK_IN", 0); expect(() => act("CLOCK_IN", 1)).toThrow(/not allowed/); });
  it("rejects break without clock in", () => expect(() => act("BREAK_START", 0)).toThrow(/not allowed/));
  it("rejects duplicate break start", () => { act("CLOCK_IN", 0); act("BREAK_START", 10); expect(() => act("BREAK_START", 11)).toThrow(/not allowed/); });
  it("rejects clock out while on break", () => { act("CLOCK_IN", 0); act("BREAK_START", 10); expect(() => act("CLOCK_OUT", 20)).toThrow(/not allowed/); });
  it("completes a full shift and calculates integer minutes", () => { act("CLOCK_IN", 0); act("BREAK_START", 10); act("BREAK_END", 20); act("CLOCK_OUT", 40); expect(store.entries[0]).toMatchObject({ totalWorkMinutes: 30, totalBreakMinutes: 10, approvalStatus: "PENDING" }); });
  it("returns an idempotent response without a duplicate event", () => { const key = crypto.randomUUID(); act("CLOCK_IN", 0, key); act("CLOCK_IN", 1, key); expect(store.events).toHaveLength(1); expect(store.entries).toHaveLength(1); });
});

describe("PIN sessions", () => {
  beforeEach(resetStoreForTests);
  it("authenticates a hashed PIN and derives employee identity from the token", () => { const { token } = authenticateEmployee("TEST", "T-1", "7531", at(0)); expect(employeeFromToken(token, at(1))?.id).toBe(employeeId); });
  it("does not accept an expired session", () => { const { token } = authenticateEmployee("TEST", "T-1", "7531", at(0)); expect(employeeFromToken(token, new Date(at(0).getTime() + 9 * 60 * 60 * 1000))).toBeNull(); });
  it("temporarily locks after repeated failures", () => { for (let index = 0; index < 5; index++) expect(() => authenticateEmployee("TEST", "T-1", "0000", at(index))).toThrow(); expect(store.employees[0].lockedUntil).toBeInstanceOf(Date); expect(() => authenticateEmployee("TEST", "T-1", "7531", at(6))).toThrow(/could not be verified/); });
  it("uses the same error for company, employee and PIN failures", () => { const failures = [() => authenticateEmployee("BAD", "T-1", "7531"), () => authenticateEmployee("TEST", "UNKNOWN", "7531"), () => authenticateEmployee("TEST", "T-1", "9999")]; for (const failure of failures) expect(failure).toThrow("The sign-in details could not be verified. Try again later."); });
});
