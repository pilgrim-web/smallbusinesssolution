import { NextRequest, NextResponse } from "next/server";
import { requireEmployee, unauthorized } from "@/lib/api";
import { employeeSnapshot } from "@/lib/demo-store";

export async function GET(request: NextRequest) {
  const employee = requireEmployee(request);
  return employee ? NextResponse.json(employeeSnapshot(employee.id)) : unauthorized();
}
