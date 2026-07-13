import { NextRequest, NextResponse } from "next/server";
import { DataAccessError } from "./data/errors";

export const EMPLOYEE_COOKIE = "harbor_employee_session";

export function employeeToken(request: NextRequest) {
  return request.cookies.get(EMPLOYEE_COOKIE)?.value;
}

export function unauthorized() {
  return NextResponse.json({ error: "Your employee session has expired. Please sign in again." }, { status: 401 });
}

export function apiError(error: unknown, fallback: string) {
  if (error instanceof DataAccessError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  return NextResponse.json({ error: fallback }, { status: 500 });
}
