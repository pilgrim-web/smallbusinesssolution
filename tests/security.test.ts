import { describe, expect, it } from "vitest";
import { hashSessionToken, isSessionExpired, sanitizeForLog } from "@/lib/security";

describe("security boundaries", () => {
  it("hashes raw session tokens deterministically without storing the raw value", () => { const hash = hashSessionToken("secret", "pepper"); expect(hash).toMatch(/^[a-f0-9]{64}$/); expect(hash).not.toContain("secret"); });
  it("treats the expiration instant as expired", () => expect(isSessionExpired(new Date("2026-01-01T00:00:00Z"), new Date("2026-01-01T00:00:00Z"))).toBe(true));
  it("removes PIN, token, hash and location data from structured logs", () => expect(sanitizeForLog({ action: "login", pin: "2468", token: "secret", latitude: 1, longitude: 2, employeeId: "e" })).toEqual({ action: "login", employeeId: "e" }));
});
