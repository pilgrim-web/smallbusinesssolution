import { createHash,randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { createClient,type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll,describe,expect,it } from "vitest";

const url=process.env.SUPABASE_TEST_URL;const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;const anonKey=process.env.SUPABASE_TEST_ANON_KEY;
describe.skipIf(!(url&&serviceKey&&anonKey))("employee management transactions",()=>{
  let admin:SupabaseClient;let actorId:string;let companyId:string;let worksiteId:string;let teamId:string;let employeeId:string;
  beforeAll(async()=>{
    admin=createClient(url!,serviceKey!,{auth:{persistSession:false}});companyId=randomUUID();worksiteId=randomUUID();
    expect((await admin.from("companies").insert({id:companyId,name:"Management Test",code:`MGMT-${randomUUID()}`})).error).toBeNull();
    const actor=await admin.auth.admin.createUser({email:`management-${randomUUID()}@example.test`,password:`T!${randomUUID()}a9`,email_confirm:true});expect(actor.error).toBeNull();actorId=actor.data.user!.id;
    expect((await admin.from("company_users").insert({company_id:companyId,user_id:actorId,role:"MANAGER"})).error).toBeNull();
    expect((await admin.from("worksites").insert({id:worksiteId,company_id:companyId,name:"Management Site",address_line_1:"1 Test Way",city:"Oakland",state:"CA",postal_code:"94607",timezone:"America/Los_Angeles"})).error).toBeNull();
    const team=await admin.rpc("manager_save_team_group",{p_actor_user_id:actorId,p_company_id:companyId,p_name:"Field Crew",p_description:"Test",p_status:"ACTIVE",p_team_group_id:null});expect(team.error).toBeNull();teamId=team.data;
  },30000);
  it("creates an assigned employee with a hash and no secret in audit logs",async()=>{
    const hash=await bcrypt.hash("4826",10);const created=await admin.rpc("manager_create_employee",{p_actor_user_id:actorId,p_company_id:companyId,p_employee_number:"M100",p_preferred_name:"Managed Employee",p_pin_hash:hash,p_worksite_ids:[worksiteId],p_team_group_ids:[teamId]});expect(created.error).toBeNull();employeeId=created.data;
    const employee=await admin.from("employees").select("pin_hash").eq("id",employeeId).single();expect(employee.data!.pin_hash).not.toBe("4826");expect(await bcrypt.compare("4826",employee.data!.pin_hash)).toBe(true);
    expect((await admin.from("employee_worksites").select("id").eq("employee_id",employeeId).eq("status","ACTIVE")).data).toHaveLength(1);
    expect((await admin.from("employee_team_memberships").select("id").eq("employee_id",employeeId).eq("status","ACTIVE")).data).toHaveLength(1);
    const audits=await admin.from("audit_logs").select("new_values").eq("entity_id",employeeId);expect(JSON.stringify(audits.data)).not.toContain(hash);expect(JSON.stringify(audits.data)).not.toContain("4826");
  });
  it("blocks cross-company assignments and revokes sessions on PIN reset",async()=>{
    const otherCompany=randomUUID(),otherWorksite=randomUUID();expect((await admin.from("companies").insert({id:otherCompany,name:"Other",code:`OTHER-${randomUUID()}`})).error).toBeNull();expect((await admin.from("worksites").insert({id:otherWorksite,company_id:otherCompany,name:"Other Site",address_line_1:"2 Test Way",city:"Oakland",state:"CA",postal_code:"94607",timezone:"America/Los_Angeles"})).error).toBeNull();
    expect((await admin.rpc("manager_set_employee_assignments",{p_actor_user_id:actorId,p_company_id:companyId,p_employee_id:employeeId,p_worksite_ids:[otherWorksite],p_team_group_ids:[]})).error).not.toBeNull();
    const tokenHash=createHash("sha256").update(randomUUID()).digest("hex");expect((await admin.rpc("create_employee_session",{p_employee_id:employeeId,p_token_hash:tokenHash,p_expires_at:new Date(Date.now()+3600000).toISOString()})).error).toBeNull();
    const reset=await admin.rpc("manager_reset_employee_pin",{p_actor_user_id:actorId,p_company_id:companyId,p_employee_id:employeeId,p_pin_hash:await bcrypt.hash("5937",10)});expect(reset.error).toBeNull();expect((await admin.rpc("resolve_employee_session",{p_token_hash:tokenHash})).data).toHaveLength(0);
    const anonymous=createClient(url!,anonKey!,{auth:{persistSession:false}});expect((await anonymous.rpc("manager_reset_employee_pin",{p_actor_user_id:actorId,p_company_id:companyId,p_employee_id:employeeId,p_pin_hash:"blocked"})).error).not.toBeNull();
  });
});
