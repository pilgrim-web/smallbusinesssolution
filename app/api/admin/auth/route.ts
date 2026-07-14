import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getCookieSupabase } from "@/lib/supabase/server";
import { getAdminSupabase } from "@/lib/supabase/admin";

const schema=z.discriminatedUnion("method",[
  z.object({method:z.literal("code"),companyCode:z.string().trim().min(1).max(32),accessCode:z.string().regex(/^\d{4,8}$/)}),
  z.object({method:z.literal("password"),email:z.string().email(),password:z.string().min(8).max(200)}),
]);
const denied=()=>NextResponse.json({error:"The sign-in details could not be verified."},{status:401});
type Candidate={company_user_id:string;user_id:string;company_id:string;access_code_hash:string;code_locked:boolean};

async function codeSignIn(companyCode:string,accessCode:string){
  const admin=getAdminSupabase();
  const result=await admin.rpc("manager_login_candidates",{p_company_code:companyCode});
  const candidates=(result.data??[]) as Candidate[];
  if(result.error||candidates.length===0)return denied();
  const unlocked=candidates.filter((candidate)=>!candidate.code_locked);
  const comparisons=await Promise.all(unlocked.map(async(candidate)=>({candidate,matches:await bcrypt.compare(accessCode,candidate.access_code_hash)})));
  const match=comparisons.find((item)=>item.matches)?.candidate;
  if(!match){await Promise.all(unlocked.map((candidate)=>admin.rpc("record_manager_code_attempt",{p_company_user_id:candidate.company_user_id,p_success:false})));return denied();}
  await admin.rpc("record_manager_code_attempt",{p_company_user_id:match.company_user_id,p_success:true});
  const userResult=await admin.auth.admin.getUserById(match.user_id);
  const email=userResult.data.user?.email;
  if(userResult.error||!email)return denied();
  const link=await admin.auth.admin.generateLink({type:"magiclink",email});
  const tokenHash=link.data.properties?.hashed_token;
  if(link.error||!tokenHash)return denied();
  const client=await getCookieSupabase();
  const verified=await client.auth.verifyOtp({type:"magiclink",token_hash:tokenHash});
  if(verified.error||verified.data.user?.id!==match.user_id){await client.auth.signOut();return denied();}
  return NextResponse.json({ok:true});
}

export async function POST(request:NextRequest){
  try{
    const input=schema.parse(await request.json());
    if(input.method==="code")return await codeSignIn(input.companyCode,input.accessCode);
    const client=await getCookieSupabase();
    const{data,error}=await client.auth.signInWithPassword({email:input.email,password:input.password});
    if(error||!data.user)return denied();
    const membership=await getAdminSupabase().from("company_users").select("id").eq("user_id",data.user.id).eq("status","ACTIVE").in("role",["OWNER","MANAGER"]).limit(1).maybeSingle();
    if(!membership.data){await client.auth.signOut();return denied();}
    return NextResponse.json({ok:true});
  }catch{return denied();}
}
