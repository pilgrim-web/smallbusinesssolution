import { NextRequest,NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { resetEmployeePin,updateEmployeeAssignments,updateEmployeeProfile } from "@/lib/data/manager-repository";
import { employeeUpdateSchema } from "@/lib/validation/employee-management";
export async function PATCH(request:NextRequest,{params}:{params:Promise<{employeeId:string}>}){try{const{employeeId}=await params;const input=employeeUpdateSchema.parse(await request.json());if(input.action==="resetPin")await resetEmployeePin(employeeId,input.pin);else if(input.action==="assignments")await updateEmployeeAssignments(employeeId,input.worksiteIds,input.teamGroupIds);else await updateEmployeeProfile(employeeId,input.preferredName,input.status);return NextResponse.json({ok:true});}catch(error){return apiError(error,"Unable to update employee.");}}
