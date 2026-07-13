import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, employeeToken, unauthorized } from "@/lib/api";
import { performClockAction } from "@/lib/data/employee-repository";

const schema = z.object({
  action: z.enum(["CLOCK_IN", "CLOCK_OUT", "BREAK_START", "BREAK_END"]),
  worksiteId: z.string().uuid(),
  idempotencyKey: z.string().uuid(),
  location: z.object({
    latitude: z.number().min(-90).max(90).optional(), longitude: z.number().min(-180).max(180).optional(),
    accuracyMeters: z.number().nonnegative().optional(), clientTimestamp: z.string().datetime().optional(),
    permissionStatus: z.enum(["GRANTED", "DENIED", "UNAVAILABLE", "NOT_REQUESTED"]),
  }),
});

export async function POST(request: NextRequest) {
  const token = employeeToken(request); if (!token) return unauthorized();
  try {
    const input = schema.parse(await request.json());
    return NextResponse.json(await performClockAction(token, input));
  } catch (error) {
    return apiError(error, "The time clock action failed.");
  }
}
