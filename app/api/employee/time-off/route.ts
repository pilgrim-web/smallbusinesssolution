import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireEmployee, unauthorized } from "@/lib/api";
import { addTimeOff, cancelTimeOff, employeeSnapshot } from "@/lib/demo-store";

const schema = z.object({ type: z.enum(["UNPAID", "VACATION", "SICK", "OTHER"]), startDate: z.string().date(), endDate: z.string().date(), reason: z.string().min(3).max(500) });

export async function POST(request: NextRequest) {
  const employee = requireEmployee(request); if (!employee) return unauthorized();
  try { addTimeOff(employee.id, schema.parse(await request.json())); return NextResponse.json(employeeSnapshot(employee.id)); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Request failed." }, { status: 400 }); }
}

export async function DELETE(request: NextRequest) {
  const employee = requireEmployee(request); if (!employee) return unauthorized();
  try { cancelTimeOff(employee.id, z.string().uuid().parse(new URL(request.url).searchParams.get("id"))); return NextResponse.json(employeeSnapshot(employee.id)); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Cancellation failed." }, { status: 400 }); }
}
