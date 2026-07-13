import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { reviewTimesheet } from "@/lib/data/manager-repository";

const schema = z.object({ decision: z.enum(["APPROVED", "REJECTED"]), note: z.string().max(1000).nullable().optional() });
export async function POST(request: NextRequest, { params }: { params: Promise<{ timeEntryId: string }> }) {
  try { const { timeEntryId } = await params; const input = schema.parse(await request.json()); return NextResponse.json(await reviewTimesheet(timeEntryId, input.decision, input.note ?? null)); }
  catch (error) { return apiError(error, "Unable to review timesheet."); }
}
