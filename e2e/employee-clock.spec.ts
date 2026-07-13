import { expect, test } from "@playwright/test";

test("employee signs in and completes a shift with a break", async ({ page }) => {
  const worksite={id:"33333333-3333-4333-8333-333333333333",companyId:"11111111-1111-4111-8111-111111111111",name:"Harbor Street Kitchen",address:"412 Harbor Street, Oakland, CA",timezone:"America/Los_Angeles",latitude:37.7955,longitude:-122.2787,geofenceRadiusMeters:150,requireLocation:true,captureBreakLocation:false,geofenceMode:"FLAG",active:true};
  let state="OFF_CLOCK"; let openEntry:Record<string,unknown>|null=null; const entries:Record<string,unknown>[]=[];
  const snapshot=()=>({employee:{preferredName:"Jordan",initials:"JR"},state,worksite,openEntry,entries,payPeriod:{regularMinutes:0,breakMinutes:0,pendingMinutes:0,approvedMinutes:0,totalMinutes:0},timeOff:[]});
  await page.route("**/api/employee/auth",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({ok:true}),headers:{"set-cookie":"harbor_employee_session=e2e; Path=/; HttpOnly; SameSite=Strict"}}));
  await page.route("**/api/employee/state",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(snapshot())}));
  await page.route("**/api/employee/action",async route=>{const body=route.request().postDataJSON();const now=new Date().toISOString();if(body.action==="CLOCK_IN"){state="CLOCKED_IN";openEntry={id:"entry",worksiteId:worksite.id,clockInAt:now,approvalStatus:"PENDING",breaks:[],durations:{elapsedMinutes:0,paidBreakMinutes:0,unpaidBreakMinutes:0,totalBreakMinutes:0,netWorkMinutes:0}};}else if(body.action==="BREAK_START"){state="ON_BREAK";(openEntry!.breaks as unknown[]).push({id:"break",type:"UNPAID",startedAt:now});}else if(body.action==="BREAK_END"){state="CLOCKED_IN";((openEntry!.breaks as {endedAt?:string}[])[0]).endedAt=now;}else{state="OFF_CLOCK";const completed={...openEntry,clockOutAt:now};entries.push(completed);openEntry=null;}await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(snapshot())});});
  await page.goto("/employee/login");
  await page.getByLabel("Company code").fill("TEST");
  await page.getByLabel("Employee number").fill("T-1");
  await page.getByLabel("PIN").fill("7531");
  await page.getByRole("button",{name:"Sign in securely"}).click();
  await expect(page).toHaveURL(/employee\/clock/);
  await expect(page.getByText("Off clock",{exact:true}).first()).toBeVisible();
  await page.getByRole("button",{name:/Clock In/}).click();
  await expect(page.getByText("Clocked in",{exact:true}).first()).toBeVisible();
  await page.getByRole("button",{name:/Start Break/}).click();
  await expect(page.getByText("On break",{exact:true}).first()).toBeVisible();
  await page.getByRole("button",{name:/End Break/}).click();
  await page.getByRole("button",{name:/Clock Out/}).click();
  await expect(page.getByText("Off clock",{exact:true}).first()).toBeVisible();
});
