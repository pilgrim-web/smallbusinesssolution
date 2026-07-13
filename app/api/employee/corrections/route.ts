import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireEmployee, unauthorized } from "@/lib/api";
import { addCorrection } from "@/lib/demo-store";

const schema = z.object({ timeEntryId: z.string().uuid(), requestedChange: z.string().min(3).max(500), reason: z.string().min(3).max(500) });
export async function POST(request: NextRequest) {
  const employee = requireEmployee(request); if (!employee) return unauthorized();
  try { const input = schema.parse(await request.json()); return NextResponse.json(addCorrection(employee.id, input.timeEntryId, input.requestedChange, input.reason)); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Correction request failed." }, { status: 400 }); }
}
