import Link from "next/link";
import { History, MapPin } from "lucide-react";
import { getTimesheet } from "@/lib/data/manager-repository";
import { formatMinutes } from "@/lib/time-clock";
import { TimesheetReviewPanel } from "@/components/timesheet-review-panel";

export const dynamic="force-dynamic";
export default async function TimesheetDetail({params}:{params:Promise<{timeEntryId:string}>}) {
  const {timeEntryId}=await params; let entry:Awaited<ReturnType<typeof getTimesheet>>|null=null; let error="";
  try { entry=await getTimesheet(timeEntryId); } catch(reason) { error=reason instanceof Error?reason.message:"Timesheet is unavailable."; }
  if(!entry) return <div className="admin-page"><Link href="/admin/timesheets" className="back-link">← Back to timesheets</Link><p className="alert error">{error}</p></div>;
  const employee=(entry.employees as unknown as {preferred_name:string})?.preferred_name??"Employee"; const site=(entry.worksites as unknown as {name:string})?.name??"Worksite";
  const events=(entry.time_events as unknown as {id:string;event_type:string;server_timestamp:string;location_verification_result:string;distance_from_worksite_meters:number|null}[])??[];
  const corrections=(entry.time_correction_requests as unknown as {id:string;requested_change:string;reason:string;status:string;created_at:string}[])??[];
  return <div className="admin-page"><Link href="/admin/timesheets" className="back-link">← Back to timesheets</Link><header className="admin-title"><div><p className="eyebrow">Shift {entry.id}</p><h1>{employee} · {new Date(entry.clock_in_at).toLocaleDateString()}</h1><p>{site}</p></div><span className={`approval ${entry.approval_status.toLowerCase().replace("_","-")}`}>{entry.approval_status.replace("_"," ")}</span></header>{corrections.length>0&&<section className="attention-card"><div><h2>Employee correction requests</h2><p>{corrections.map(item=>`${item.requested_change} — ${item.reason} (${item.status})`).join(" | ")}</p></div></section>}<div className="detail-columns"><section className="admin-card detail-card"><h2>Recorded shift</h2><dl><div><dt>Clock in</dt><dd>{new Date(entry.clock_in_at).toLocaleString()}</dd></div><div><dt>Clock out</dt><dd>{entry.clock_out_at?new Date(entry.clock_out_at).toLocaleString():"Open"}</dd></div><div><dt>Break</dt><dd>{formatMinutes(entry.total_break_minutes??0)}</dd></div><div><dt>Net worked</dt><dd>{formatMinutes(entry.total_work_minutes??0)}</dd></div></dl><div className="location-detail"><MapPin/><div><strong>Event-based location</strong><span>{events.filter(event=>["CLOCK_IN","CLOCK_OUT"].includes(event.event_type)).map(event=>`${event.event_type}: ${event.location_verification_result}`).join(" · ")||"No location event"}</span></div></div></section><TimesheetReviewPanel entryId={entry.id} clockInAt={entry.clock_in_at} clockOutAt={entry.clock_out_at}/></div><section className="admin-card audit-card"><History/><div><h2>Immutable event history</h2><p>{events.map(event=>`${event.event_type} · ${new Date(event.server_timestamp).toLocaleString()}`).join(" | ")||"No events"}</p></div></section></div>;
}
