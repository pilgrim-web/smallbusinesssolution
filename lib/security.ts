import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";

export const MAX_PIN_ATTEMPTS = 5;
export const LOCKOUT_MINUTES = 15;
export const SESSION_HOURS = 8;

export function hashSessionToken(token: string, pepper: string) {
  return createHash("sha256").update(`${pepper}:${token}`).digest("hex");
}

export function newSessionToken() {
  return randomBytes(32).toString("base64url");
}

export async function hashPin(pin: string) {
  return bcrypt.hash(pin, 12);
}

export async function verifyPin(pin: string, hash: string) {
  return bcrypt.compare(pin, hash);
}

export function safeTokenEquals(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function isSessionExpired(expiresAt: Date, now = new Date()) {
  return expiresAt.getTime() <= now.getTime();
}

export function lockoutUntil(failedAttempts: number, now = new Date()) {
  if (failedAttempts < MAX_PIN_ATTEMPTS) return null;
  return new Date(now.getTime() + LOCKOUT_MINUTES * 60_000);
}

export function sanitizeForLog(input: Record<string, unknown>) {
  const forbidden = /pin|token|latitude|longitude|location|hash/i;
  return Object.fromEntries(Object.entries(input).filter(([key]) => !forbidden.test(key)));
}
