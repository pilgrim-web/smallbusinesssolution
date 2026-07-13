import { NextRequest, NextResponse } from "next/server";
import { EMPLOYEE_COOKIE } from "@/lib/api";
import { revokeEmployeeSession } from "@/lib/data/employee-repository";

export async function POST(request: NextRequest) {
  await revokeEmployeeSession(request.cookies.get(EMPLOYEE_COOKIE)?.value);
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(EMPLOYEE_COOKIE);
  return response;
}
