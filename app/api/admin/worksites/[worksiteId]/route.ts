import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { saveWorksite } from "@/lib/data/manager-repository";
import { worksiteSchema } from "@/lib/validation/worksite";
export async function PUT(request: NextRequest, { params }: { params: Promise<{ worksiteId: string }> }) { try { const { worksiteId } = await params; return NextResponse.json(await saveWorksite(worksiteSchema.parse(await request.json()), worksiteId)); } catch (error) { return apiError(error, "Unable to update worksite."); } }
