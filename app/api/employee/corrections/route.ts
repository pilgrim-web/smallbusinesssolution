import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, employeeToken, unauthorized } from "@/lib/api";
import { createCorrection } from "@/lib/data/employee-repository";

const schema = z.object({ timeEntryId: z.string().uuid(), requestedChange: z.string().min(3).max(500), reason: z.string().min(3).max(500) });
export async function POST(request: NextRequest) {
  const token = employeeToken(request); if (!token) return unauthorized();
  try { const input = schema.parse(await request.json()); return NextResponse.json(await createCorrection(token, input.timeEntryId, input.requestedChange, input.reason)); }
  catch (error) { return apiError(error, "Correction request failed."); }
}
