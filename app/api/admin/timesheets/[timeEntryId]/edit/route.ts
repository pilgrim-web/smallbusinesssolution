import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { editTimesheet } from "@/lib/data/manager-repository";

const schema = z.object({ clockInAt: z.string().datetime().optional(), clockOutAt: z.string().datetime().optional(), breaks: z.array(z.object({ type: z.enum(["PAID", "UNPAID"]), startedAt: z.string().datetime(), endedAt: z.string().datetime() })).optional(), reason: z.string().min(3).max(1000) });
export async function POST(request: NextRequest, { params }: { params: Promise<{ timeEntryId: string }> }) {
  try { const { timeEntryId } = await params; return NextResponse.json(await editTimesheet(timeEntryId, schema.parse(await request.json()))); }
  catch (error) { return apiError(error, "Unable to correct timesheet."); }
}
