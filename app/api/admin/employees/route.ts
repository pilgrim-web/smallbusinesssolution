import { NextRequest,NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { createEmployee } from "@/lib/data/manager-repository";
import { employeeCreateSchema } from "@/lib/validation/employee-management";
export async function POST(request:NextRequest){try{const input=employeeCreateSchema.parse(await request.json());return NextResponse.json({id:await createEmployee(input)},{status:201});}catch(error){return apiError(error,"Unable to create employee.");}}
