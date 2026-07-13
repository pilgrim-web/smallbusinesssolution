import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, employeeToken, unauthorized } from "@/lib/api";
import { cancelTimeOff, createTimeOff } from "@/lib/data/employee-repository";

const schema = z.object({ type: z.enum(["UNPAID", "VACATION", "SICK", "OTHER"]), startDate: z.string().date(), endDate: z.string().date(), reason: z.string().min(3).max(500) });

export async function POST(request: NextRequest) {
  const token = employeeToken(request); if (!token) return unauthorized();
  try { return NextResponse.json(await createTimeOff(token, schema.parse(await request.json()))); }
  catch (error) { return apiError(error, "Request failed."); }
}

export async function DELETE(request: NextRequest) {
  const token = employeeToken(request); if (!token) return unauthorized();
  try { return NextResponse.json(await cancelTimeOff(token, z.string().uuid().parse(new URL(request.url).searchParams.get("id")))); }
  catch (error) { return apiError(error, "Cancellation failed."); }
}
