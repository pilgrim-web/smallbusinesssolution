import Link from "next/link";
import { Clock3, UserCheck, UsersRound } from "lucide-react";
import { EmployeeManagement } from "@/components/employee-management";
import { getEmployeeManagementData } from "@/lib/data/manager-repository";
import { formatMinutes } from "@/lib/time-clock";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  let data: Awaited<ReturnType<typeof getEmployeeManagementData>> = {members:[],worksites:[],teams:[]};
  let loadError = "";
  try { data = await getEmployeeManagementData(); }
  catch (error) { loadError = error instanceof Error ? error.message : "Team records are unavailable."; }
  const team=data.members;
  const active = team.filter((member) => member.status === "ACTIVE");
  const working = team.filter((member) => member.currentState !== "OFF_CLOCK");
  const completed = team.reduce((sum, member) => sum + member.completedShifts, 0);
  const approved = team.reduce((sum, member) => sum + member.approvedMinutes, 0);
  const stats = [
    { label: "Active team", value: active.length, icon: UsersRound },
    { label: "Working now", value: working.length, icon: UserCheck },
    { label: "Completed shifts", value: completed, icon: Clock3 },
    { label: "Approved hours", value: formatMinutes(approved), icon: Clock3 },
  ];
  return <div className="admin-page"><header className="admin-title"><div><p className="eyebrow">People &amp; records</p><h1>Team</h1><p>Company employees, assigned worksites, and real timesheet totals.</p></div><Link className="button secondary" href="/admin/timesheets">Open timesheets</Link></header>
    <section className="admin-stats">{stats.map(({label,value,icon:Icon})=><article key={label}><Icon/><span>{label}</span><strong>{value}</strong></article>)}</section>
    {loadError&&<p className="alert error" role="alert">{loadError}</p>}
    <EmployeeManagement members={data.members} worksites={data.worksites} teams={data.teams}/>
  </div>;
}
