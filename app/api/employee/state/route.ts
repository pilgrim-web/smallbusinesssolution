import { NextRequest, NextResponse } from "next/server";
import { apiError, employeeToken, unauthorized } from "@/lib/api";
import { employeeSnapshot } from "@/lib/data/employee-repository";

export async function GET(request: NextRequest) {
  const token = employeeToken(request); if (!token) return unauthorized();
  try { return NextResponse.json(await employeeSnapshot(token)); }
  catch (error) { return apiError(error, "Unable to load employee time records."); }
}
