import Link from "next/link";
import { Clock3, UserCheck, UsersRound } from "lucide-react";
import { getTeamRecords } from "@/lib/data/manager-repository";
import { formatMinutes } from "@/lib/time-clock";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  let team: Awaited<ReturnType<typeof getTeamRecords>> = [];
  let loadError = "";
  try { team = await getTeamRecords(); }
  catch (error) { loadError = error instanceof Error ? error.message : "Team records are unavailable."; }
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
    <section className="admin-card"><div className="card-header"><div><h2>Team records</h2><p>PINs and manager access codes are never displayed.</p></div><span>{team.length} members</span></div><div className="team-table"><div className="team-head"><span>Employee</span><span>Status</span><span>Worksites</span><span>Shifts</span><span>Approved</span><span>Last shift</span></div>{team.length===0?<div className="empty-state">No employees are registered for this company.</div>:team.map((member)=><div className="team-row" key={member.id}><div className="employee-cell"><span className="mini-avatar">{member.preferred_name.slice(0,2).toUpperCase()}</span><div><strong>{member.preferred_name}</strong><small>{member.employee_number}</small></div></div><span className={`team-state ${member.currentState.toLowerCase()}`}>{member.currentState.replace("_"," ")}</span><span>{member.worksites.join(", ")||"Not assigned"}</span><strong>{member.completedShifts}</strong><span>{formatMinutes(member.approvedMinutes)}</span><span>{member.lastShiftAt?new Date(member.lastShiftAt).toLocaleString([], {month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}):"—"}</span></div>)}</div></section>
  </div>;
}
