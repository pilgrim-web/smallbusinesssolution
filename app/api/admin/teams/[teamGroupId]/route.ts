import { NextRequest,NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { saveTeamGroup } from "@/lib/data/manager-repository";
import { teamGroupSchema } from "@/lib/validation/employee-management";
export async function PATCH(request:NextRequest,{params}:{params:Promise<{teamGroupId:string}>}){try{const{teamGroupId}=await params;return NextResponse.json({id:await saveTeamGroup(teamGroupSchema.parse(await request.json()),teamGroupId)});}catch(error){return apiError(error,"Unable to update team group.");}}
