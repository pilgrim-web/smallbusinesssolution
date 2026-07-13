import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock3, Coffee, MapPin, UserCheck } from "lucide-react";
import { getTimesheets, getWorkforce } from "@/lib/data/manager-repository";
import { formatMinutes } from "@/lib/time-clock";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const now = new Date();
  let workforce: Awaited<ReturnType<typeof getWorkforce>> = [];
  let timesheets: Awaited<ReturnType<typeof getTimesheets>> = [];
  let loadError = "";
  try { [workforce, timesheets] = await Promise.all([getWorkforce(), getTimesheets()]); }
  catch (error) { loadError = error instanceof Error ? error.message : "Manager data is unavailable."; }
  const completedToday = timesheets.filter((entry) => entry.clock_out_at && new Date(entry.clock_out_at).toDateString() === now.toDateString());
  const onBreak = workforce.filter((entry) => entry.state === "ON_BREAK");
  const awaiting = timesheets.filter((entry) => entry.approval_status === "PENDING" || entry.approval_status === "NEEDS_REVIEW");
  const reviewEvents = workforce.filter((entry) => entry.location === "OUTSIDE" || entry.location === "MISSING");
  const stats = [{ label: "Clocked in", value: workforce.length, icon: UserCheck }, { label: "On break", value: onBreak.length, icon: Coffee }, { label: "Completed today", value: completedToday.length, icon: CheckCircle2 }, { label: "Awaiting approval", value: awaiting.length, icon: Clock3 }];
  return <div className="admin-page"><header className="admin-title"><div><p className="eyebrow">{now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p><h1>Live workforce</h1><p>Current database status. Location is checked only at recorded events.</p></div><Link className="button secondary" href="/admin/timesheets">Review timesheets</Link></header>
    <section className="admin-stats">{stats.map(({ label, value, icon: Icon }) => <article key={label}><Icon/><span>{label}</span><strong>{value}</strong></article>)}</section>
    {loadError && <p className="alert error" role="alert">{loadError}</p>}
    <section className="admin-card"><div className="card-header"><div><h2>Working now</h2><p>Refresh to retrieve the latest committed events</p></div><span className="live-indicator">Live</span></div><div className="workforce-table"><div className="table-head"><span>Employee</span><span>Status</span><span>Worksite</span><span>Clocked in</span><span>Duration</span><span>Location</span></div>{workforce.length === 0 ? <div className="empty-state">No employees are currently clocked in.</div> : workforce.map((entry) => { const duration=Math.max(0,Math.floor((now.getTime()-new Date(entry.clockInAt).getTime())/60000)); return <div className="table-row" key={entry.id}><div className="employee-cell"><span className="mini-avatar">{entry.employeeName.slice(0,2).toUpperCase()}</span><strong>{entry.employeeName}</strong></div><span className="status-dot">{entry.state === "ON_BREAK" ? "On break" : "Clocked in"}</span><span>{entry.worksiteName}</span><span>{new Date(entry.clockInAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span><strong>{formatMinutes(duration)}</strong><span className={entry.location === "VERIFIED" ? "verified-text" : "warning-text"}><MapPin/>{entry.location}</span></div>; })}</div></section>
    <section className="attention-card"><AlertTriangle/><div><h2>Needs attention</h2><p>{reviewEvents.length} location flags and {awaiting.length} entries awaiting approval.</p></div><Link href="/admin/timesheets">Open review queue →</Link></section>
  </div>;
}
