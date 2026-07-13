"use client";

import { useState } from "react";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { useEmployeeData } from "@/components/use-employee-data";
import { formatMinutes } from "@/lib/time-clock";

export default function HoursPage() {
  const { data, error } = useEmployeeData(); const [selected, setSelected] = useState<string | null>(null); const [sent, setSent] = useState("");
  if (!data) return <div className="loading-card">{error || "Loading your hours…"}</div>;
  const item = data.entries.find((entry) => entry.id === selected);
  async function report(form: FormData) { if (!item) return; const response = await fetch("/api/employee/corrections", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ timeEntryId: item.id, requestedChange: form.get("requestedChange"), reason: form.get("reason") }) }); setSent(response.ok ? "Your correction request was sent." : "Unable to send request."); }
  return <div className="content-page"><header className="page-title"><p className="eyebrow">Current pay period</p><h1>Time & Hours</h1><p>Completed time is shown as recorded. Request a correction if something looks wrong.</p></header>
    <section className="summary-grid"><article><span>Total completed</span><strong>{formatMinutes(data.payPeriod.totalMinutes)}</strong></article><article><span>Pending</span><strong>{formatMinutes(data.payPeriod.pendingMinutes)}</strong></article><article><span>Approved</span><strong>{formatMinutes(data.payPeriod.approvedMinutes)}</strong></article><article><span>Breaks</span><strong>{formatMinutes(data.payPeriod.breakMinutes)}</strong></article></section>
    <section className="list-card"><h2>Shift history</h2>{data.entries.length === 0 ? <div className="empty-state">No completed shifts in this pay period yet.</div> : data.entries.map((entry) => <button className="shift-row" key={entry.id} onClick={() => setSelected(entry.id)}><div><strong>{new Date(entry.clockInAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</strong><span>{data.worksite?.name ?? "Assigned worksite"}</span></div><div><strong>{formatMinutes(entry.durations.netWorkMinutes)}</strong><span>{entry.approvalStatus.replaceAll("_", " ")}</span></div><ChevronRight aria-hidden="true"/></button>)}</section>
    {item && <div className="modal-backdrop" role="presentation"><section className="detail-sheet" role="dialog" aria-modal="true" aria-labelledby="shift-title"><button className="sheet-close" onClick={() => setSelected(null)} aria-label="Close">×</button><p className="eyebrow">Shift detail</p><h2 id="shift-title">{new Date(item.clockInAt).toLocaleDateString()}</h2><dl><div><dt>Clock in</dt><dd>{new Date(item.clockInAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</dd></div><div><dt>Clock out</dt><dd>{item.clockOutAt ? new Date(item.clockOutAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "Missing"}</dd></div><div><dt>Break</dt><dd>{formatMinutes(item.durations.totalBreakMinutes)}</dd></div><div><dt>Net worked</dt><dd>{formatMinutes(item.durations.netWorkMinutes)}</dd></div></dl><form action={report} className="form-stack"><h3>Report a problem</h3><label>Requested change<textarea name="requestedChange" required /></label><label>Reason<textarea name="reason" required /></label><button className="button primary">Send correction request</button>{sent && <p className="alert success">{sent}</p>}</form></section></div>}
    <p className="info-note"><AlertTriangle aria-hidden="true"/> Hours are time records, not final payroll or overtime compliance calculations.</p>
  </div>;
}
