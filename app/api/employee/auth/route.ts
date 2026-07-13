import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { EMPLOYEE_COOKIE } from "@/lib/api";
import { authenticateEmployee } from "@/lib/demo-store";

const schema = z.object({ companyCode: z.string().min(2).max(40), employeeNumber: z.string().min(1).max(40), pin: z.string().regex(/^\d{4,10}$/) });

export async function POST(request: NextRequest) {
  try {
    const input = schema.parse(await request.json());
    const { token } = authenticateEmployee(input.companyCode, input.employeeNumber, input.pin);
    const response = NextResponse.json({ ok: true });
    response.cookies.set(EMPLOYEE_COOKIE, token, {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 8 * 60 * 60,
    });
    return response;
  } catch {
    // Never log credentials or disclose which field failed.
    return NextResponse.json({ error: "The sign-in details could not be verified. Try again later." }, { status: 401 });
  }
}
