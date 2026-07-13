import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCookieSupabase } from "@/lib/supabase/server";
import { getAdminSupabase } from "@/lib/supabase/admin";

const schema=z.object({email:z.string().email(),password:z.string().min(8).max(200)});
export async function POST(request:NextRequest){try{const input=schema.parse(await request.json());const client=await getCookieSupabase();const{data,error}=await client.auth.signInWithPassword(input);if(error||!data.user)return NextResponse.json({error:"The sign-in details could not be verified."},{status:401});const membership=await getAdminSupabase().from("company_users").select("id").eq("user_id",data.user.id).eq("status","ACTIVE").in("role",["OWNER","MANAGER"]).limit(1).maybeSingle();if(!membership.data){await client.auth.signOut();return NextResponse.json({error:"Manager access is required."},{status:403});}return NextResponse.json({ok:true});}catch{return NextResponse.json({error:"The sign-in details could not be verified."},{status:401});}}
