import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock3, Coffee, MapPin, UserCheck } from "lucide-react";
import { store } from "@/lib/demo-store";
import { calculateDurations, deriveState, formatMinutes } from "@/lib/time-clock";

export const dynamic = "force-dynamic";

export default function AdminDashboard() {
  const now = new Date();
  const open = store.entries.filter((entry) => !entry.clockOutAt);
  const completedToday = store.entries.filter((entry) => entry.clockOutAt && entry.clockOutAt.toDateString() === now.toDateString());
  const onBreak = open.filter((entry) => deriveState(entry) === "ON_BREAK");
  const awaiting = store.entries.filter((entry) => entry.approvalStatus === "PENDING" || entry.approvalStatus === "NEEDS_REVIEW");
  const reviewEvents = store.events.filter((event) => event.verification === "OUTSIDE" || event.verification === "MISSING");
  const stats = [{ label: "Clocked in", value: open.length, icon: UserCheck }, { label: "On break", value: onBreak.length, icon: Coffee }, { label: "Completed today", value: completedToday.length, icon: CheckCircle2 }, { label: "Awaiting approval", value: awaiting.length, icon: Clock3 }];
  return <div className="admin-page"><header className="admin-title"><div><p className="eyebrow">{now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p><h1>Live workforce</h1><p>Current database status. Location is checked only at recorded events.</p></div><Link className="button secondary" href="/admin/timesheets">Review timesheets</Link></header>
    <section className="admin-stats">{stats.map(({ label, value, icon: Icon }) => <article key={label}><Icon/><span>{label}</span><strong>{value}</strong></article>)}</section>
    <section className="admin-card"><div className="card-header"><div><h2>Working now</h2><p>Refresh to retrieve the latest committed events</p></div><span className="live-indicator">Live</span></div><div className="workforce-table"><div className="table-head"><span>Employee</span><span>Status</span><span>Worksite</span><span>Clocked in</span><span>Duration</span><span>Location</span></div>{open.length === 0 ? <div className="empty-state">No employees are currently clocked in.</div> : open.map((entry) => { const employee = store.employees.find((item) => item.id === entry.employeeId)!; const worksite = store.worksites.find((item) => item.id === entry.worksiteId)!; const lastEvent = [...store.events].reverse().find((item) => item.timeEntryId === entry.id); return <div className="table-row" key={entry.id}><div className="employee-cell"><span className="mini-avatar">{employee.preferredName.slice(0,2).toUpperCase()}</span><strong>{employee.preferredName}</strong></div><span className="status-dot">{deriveState(entry) === "ON_BREAK" ? "On break" : "Clocked in"}</span><span>{worksite.name}</span><span>{entry.clockInAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span><strong>{formatMinutes(calculateDurations(entry, now).netWorkMinutes)}</strong><span className={lastEvent?.verification === "VERIFIED" ? "verified-text" : "warning-text"}><MapPin/>{lastEvent?.verification ?? "Pending"}</span></div>; })}</div></section>
    <section className="attention-card"><AlertTriangle/><div><h2>Needs attention</h2><p>{reviewEvents.length} location flags and {awaiting.length} entries awaiting approval.</p></div><Link href="/admin/timesheets">Open review queue →</Link></section>
  </div>;
}
