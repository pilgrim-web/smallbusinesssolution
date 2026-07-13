import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireEmployee, unauthorized } from "@/lib/api";
import { performAction } from "@/lib/demo-store";

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
  const employee = requireEmployee(request);
  if (!employee) return unauthorized();
  try {
    const input = schema.parse(await request.json());
    return NextResponse.json(performAction({ ...input, employeeId: employee.id }));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "The time clock action failed." }, { status: 409 });
  }
}
