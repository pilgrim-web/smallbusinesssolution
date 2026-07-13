import { NextResponse } from "next/server";
import { getCookieSupabase } from "@/lib/supabase/server";
export async function POST(){try{const client=await getCookieSupabase();await client.auth.signOut();}catch{}return NextResponse.json({ok:true});}
