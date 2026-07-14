import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCookieSupabase } from "@/lib/supabase/server";
import { getAdminSupabase } from "@/lib/supabase/admin";

const signInSchema=z.object({action:z.literal("signIn"),email:z.string().email(),password:z.string().min(12).max(200)});
const verifySchema=z.object({action:z.literal("verifyMfa"),factorId:z.string().uuid(),code:z.string().regex(/^\d{6}$/)});
const schema=z.discriminatedUnion("action",[signInSchema,verifySchema]);
const denied=()=>NextResponse.json({error:"The sign-in details could not be verified."},{status:401});

export async function POST(request:NextRequest){
  try{
    const input=schema.parse(await request.json());
    const client=await getCookieSupabase();
    if(input.action==="verifyMfa"){
      const verified=await client.auth.mfa.challengeAndVerify({factorId:input.factorId,code:input.code});
      if(verified.error)return denied();
      const assurance=await client.auth.mfa.getAuthenticatorAssuranceLevel();
      if(assurance.error||assurance.data.currentLevel!=="aal2")return denied();
      const user=await client.auth.getUser();
      if(user.error||!user.data.user)return denied();
      const platform=await getAdminSupabase().from("platform_users").select("id").eq("user_id",user.data.user.id).eq("status","ACTIVE").limit(1).maybeSingle();
      if(!platform.data){await client.auth.signOut();return denied();}
      await getAdminSupabase().from("platform_users").update({last_login_at:new Date().toISOString()}).eq("id",platform.data.id);
      await getAdminSupabase().from("platform_audit_logs").insert({actor_user_id:user.data.user.id,action:"PLATFORM_LOGIN_MFA",reason:"Successful platform administrator MFA sign-in"});
      return NextResponse.json({ok:true});
    }

    const signedIn=await client.auth.signInWithPassword({email:input.email,password:input.password});
    if(signedIn.error||!signedIn.data.user)return denied();
    const platform=await getAdminSupabase().from("platform_users").select("id").eq("user_id",signedIn.data.user.id).eq("status","ACTIVE").limit(1).maybeSingle();
    if(!platform.data){await client.auth.signOut();return denied();}
    const assurance=await client.auth.mfa.getAuthenticatorAssuranceLevel();
    if(!assurance.error&&assurance.data.currentLevel==="aal2")return NextResponse.json({ok:true});
    const factors=await client.auth.mfa.listFactors();
    if(factors.error)return denied();
    const verifiedFactor=factors.data.totp[0];
    if(verifiedFactor)return NextResponse.json({next:"verify",factorId:verifiedFactor.id});
    for(const factor of factors.data.all.filter(item=>item.factor_type==="totp"&&item.status==="unverified"))await client.auth.mfa.unenroll({factorId:factor.id});
    const enrollment=await client.auth.mfa.enroll({factorType:"totp",friendlyName:"CrewLedger Platform Admin"});
    if(enrollment.error)return denied();
    return NextResponse.json({next:"enroll",factorId:enrollment.data.id,qrCode:enrollment.data.totp.qr_code,secret:enrollment.data.totp.secret});
  }catch{return denied();}
}
