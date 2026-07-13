import { NextRequest, NextResponse } from "next/server";
import { employeeFromToken } from "./demo-store";

export const EMPLOYEE_COOKIE = "harbor_employee_session";

export function requireEmployee(request: NextRequest) {
  return employeeFromToken(request.cookies.get(EMPLOYEE_COOKIE)?.value);
}

export function unauthorized() {
  return NextResponse.json({ error: "Your employee session has expired. Please sign in again." }, { status: 401 });
}
