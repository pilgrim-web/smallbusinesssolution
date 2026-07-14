import { NextRequest,NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { saveTeamGroup } from "@/lib/data/manager-repository";
import { teamGroupSchema } from "@/lib/validation/employee-management";
export async function POST(request:NextRequest){try{return NextResponse.json({id:await saveTeamGroup(teamGroupSchema.parse(await request.json()))},{status:201});}catch(error){return apiError(error,"Unable to create team group.");}}
