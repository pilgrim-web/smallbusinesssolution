import {execFileSync} from "node:child_process";
import {randomBytes} from "node:crypto";
import {createClient} from "@supabase/supabase-js";

const projectRef="zvffacwobghakfifainv";
const projectUrl=`https://${projectRef}.supabase.co`;
const email=process.env.PLATFORM_ADMIN_EMAIL?.trim().toLowerCase();
if(!email||!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))throw new Error("Set PLATFORM_ADMIN_EMAIL to a recoverable production email address.");

const keyRows=JSON.parse(execFileSync("npx",["supabase","projects","api-keys","--project-ref",projectRef,"--reveal","--output","json"],{encoding:"utf8",stdio:["ignore","pipe","inherit"]}));
const serviceRoleKey=keyRows.find((row)=>row.name==="service_role")?.api_key;
if(!serviceRoleKey)throw new Error("Production service-role key was not found.");

const password=`CL!${randomBytes(30).toString("base64url")}9a`;
const admin=createClient(projectUrl,serviceRoleKey,{auth:{persistSession:false,autoRefreshToken:false}});
const existing=await admin.auth.admin.listUsers({page:1,perPage:1000});
if(existing.error)throw existing.error;
if(existing.data.users.some((user)=>user.email?.toLowerCase()===email))throw new Error("An Auth user already exists for this email; no changes were made.");

const created=await admin.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{crewledger_account_type:"PLATFORM_ADMIN"}});
if(created.error||!created.data.user)throw created.error??new Error("Auth user creation failed.");
try{
  const bootstrapped=await admin.rpc("bootstrap_platform_user",{
    p_user_id:created.data.user.id,
    p_role:"PLATFORM_ADMIN",
    p_created_by:created.data.user.id,
    p_reason:"Create first production CrewLedger platform administrator",
  });
  if(bootstrapped.error)throw bootstrapped.error;
  const membership=await admin.from("company_users").select("id").eq("user_id",created.data.user.id);
  if(membership.error)throw membership.error;
  if((membership.data??[]).length!==0)throw new Error("Platform administrator unexpectedly has company membership.");
  execFileSync("security",["add-generic-password","-U","-a",email,"-s","crewledger-production-platform-admin","-w",password],{stdio:"ignore"});
  console.log(JSON.stringify({ok:true,email,userId:created.data.user.id,keychainService:"crewledger-production-platform-admin",mfaEnrollmentRequired:true}));
}catch(error){
  await admin.auth.admin.deleteUser(created.data.user.id);
  throw error;
}
