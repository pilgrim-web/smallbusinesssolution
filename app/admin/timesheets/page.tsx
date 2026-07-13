import Link from "next/link";
import { Filter, MapPin } from "lucide-react";
import { getTimesheets } from "@/lib/data/manager-repository";
import { formatMinutes } from "@/lib/time-clock";

export const dynamic = "force-dynamic";

export default async function TimesheetsPage() {
  let entries: Awaited<ReturnType<typeof getTimesheets>> = [];
  let loadError = "";
  try { entries = await getTimesheets(); } catch (error) { loadError = error instanceof Error ? error.message : "Timesheets are unavailable."; }
  return <div className="admin-page"><header className="admin-title"><div><p className="eyebrow">Review & approve</p><h1>Timesheets</h1><p>Every correction and decision is preserved in the audit trail.</p></div></header><section className="filter-bar"><label>Employee<select><option>All employees</option></select></label><label>Worksite<select><option>All worksites</option></select></label><label>Approval<select><option>All statuses</option></select></label><label>Date<input type="date"/></label><button className="button secondary"><Filter/>Apply filters</button></section>{loadError && <p className="alert error">{loadError}</p>}<section className="admin-card"><div className="timesheet-list">{entries.length === 0 ? <div className="empty-state">No completed shifts are available for review.</div> : entries.map((entry) => { const employee=(entry.employees as unknown as {preferred_name:string})?.preferred_name??"Employee"; const site=(entry.worksites as unknown as {name:string})?.name??"Worksite"; const warning=((entry.time_events as unknown as {location_verification_result:string}[])??[]).some((event)=>["OUTSIDE","MISSING"].includes(event.location_verification_result)); return <Link href={`/admin/timesheets/${entry.id}`} className="timesheet-row" key={entry.id}><div><strong>{employee}</strong><span>{new Date(entry.clock_in_at).toLocaleDateString()} · {site}</span></div><span>{new Date(entry.clock_in_at).toLocaleTimeString([], {hour:"numeric",minute:"2-digit"})} – {entry.clock_out_at?new Date(entry.clock_out_at).toLocaleTimeString([], {hour:"numeric",minute:"2-digit"}):"Open"}</span><strong>{formatMinutes(entry.total_work_minutes??0)}</strong>{warning && <span className="warning-text"><MapPin/>Location review</span>}<span className={`approval ${entry.approval_status.toLowerCase().replace("_", "-")}`}>{entry.approval_status.replace("_"," ")}</span><span>›</span></Link>; })}</div></section></div>;
}
