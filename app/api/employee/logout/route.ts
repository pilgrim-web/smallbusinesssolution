import { NextRequest, NextResponse } from "next/server";
import { EMPLOYEE_COOKIE } from "@/lib/api";
import { revokeToken } from "@/lib/demo-store";

export async function POST(request: NextRequest) {
  revokeToken(request.cookies.get(EMPLOYEE_COOKIE)?.value);
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(EMPLOYEE_COOKIE);
  return response;
}
