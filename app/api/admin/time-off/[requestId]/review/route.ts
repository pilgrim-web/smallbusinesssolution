import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { reviewTimeOff } from "@/lib/data/manager-repository";
const schema = z.object({ decision: z.enum(["APPROVED", "DENIED"]), note: z.string().max(1000).nullable().optional() });
export async function POST(request: NextRequest, { params }: { params: Promise<{ requestId: string }> }) { try { const { requestId } = await params; const input = schema.parse(await request.json()); return NextResponse.json(await reviewTimeOff(requestId, input.decision, input.note ?? null)); } catch (error) { return apiError(error, "Unable to review time-off request."); } }
