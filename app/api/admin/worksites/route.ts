import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { saveWorksite } from "@/lib/data/manager-repository";
import { worksiteSchema } from "@/lib/validation/worksite";

export async function POST(request: NextRequest) { try { return NextResponse.json(await saveWorksite(worksiteSchema.parse(await request.json()))); } catch (error) { return apiError(error, "Unable to create worksite."); } }
