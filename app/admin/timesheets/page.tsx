import Link from "next/link";
import { Filter, MapPin } from "lucide-react";
import { store } from "@/lib/demo-store";
import { calculateDurations, formatMinutes } from "@/lib/time-clock";

export const dynamic = "force-dynamic";

export default function TimesheetsPage() {
  const entries = [...store.entries].filter((entry) => entry.clockOutAt).reverse();
  return <div className="admin-page"><header className="admin-title"><div><p className="eyebrow">Review & approve</p><h1>Timesheets</h1><p>Every correction and decision is preserved in the audit trail.</p></div></header><section className="filter-bar"><label>Employee<select><option>All employees</option></select></label><label>Worksite<select><option>All worksites</option></select></label><label>Approval<select><option>All statuses</option></select></label><label>Date<input type="date"/></label><button className="button secondary"><Filter/>Apply filters</button></section><section className="admin-card"><div className="timesheet-list">{entries.length === 0 ? <div className="empty-state">No completed shifts are available for review.</div> : entries.map((entry) => { const employee=store.employees.find((item)=>item.id===entry.employeeId)!; const site=store.worksites.find((item)=>item.id===entry.worksiteId)!; const warning=store.events.some((event)=>event.timeEntryId===entry.id && ["OUTSIDE","MISSING"].includes(event.verification)); return <Link href={`/admin/timesheets/${entry.id}`} className="timesheet-row" key={entry.id}><div><strong>{employee.preferredName}</strong><span>{entry.clockInAt.toLocaleDateString()} · {site.name}</span></div><span>{entry.clockInAt.toLocaleTimeString([], {hour:"numeric",minute:"2-digit"})} – {entry.clockOutAt!.toLocaleTimeString([], {hour:"numeric",minute:"2-digit"})}</span><strong>{formatMinutes(calculateDurations(entry).netWorkMinutes)}</strong>{warning && <span className="warning-text"><MapPin/>Location review</span>}<span className={`approval ${entry.approvalStatus.toLowerCase().replace("_", "-")}`}>{entry.approvalStatus.replace("_"," ")}</span><span>›</span></Link>; })}</div></section></div>;
}
