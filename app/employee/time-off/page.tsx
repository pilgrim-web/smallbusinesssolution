"use client";

import { FormEvent, useState } from "react";
import { CalendarPlus } from "lucide-react";
import { useEmployeeData } from "@/components/use-employee-data";

export default function TimeOffPage() {
  const { data, setData, error } = useEmployeeData(); const [open, setOpen] = useState(false); const [message, setMessage] = useState("");
  if (!data) return <div className="loading-card">{error || "Loading time off…"}</div>;
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); const response = await fetch("/api/employee/time-off", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.fromEntries(form)) }); const body = await response.json(); if (response.ok) { setData(body); setOpen(false); setMessage("Request submitted for manager review."); } else setMessage(body.error); }
  async function cancel(id: string) { const response = await fetch(`/api/employee/time-off?id=${id}`, { method: "DELETE" }); const body = await response.json(); if (response.ok) setData(body); else setMessage(body.error); }
  return <div className="content-page"><header className="page-title"><p className="eyebrow">Plan ahead</p><h1>Time Off</h1><p>Submit and track basic time-off requests.</p></header>
    <div className="balance-unavailable"><strong>Leave balance unavailable</strong><span>Accrual balances are not calculated in this version.</span></div>
    <button className="button primary full" onClick={() => setOpen(!open)}><CalendarPlus aria-hidden="true"/> New request</button>{message && <p className="alert success">{message}</p>}
    {open && <form className="form-card" onSubmit={submit}><label>Request type<select name="type"><option>VACATION</option><option>SICK</option><option>UNPAID</option><option>OTHER</option></select></label><div className="two-columns"><label>Start date<input name="startDate" type="date" required /></label><label>End date<input name="endDate" type="date" required /></label></div><label>Reason<textarea name="reason" minLength={3} required /></label><button className="button primary">Submit request</button></form>}
    <section className="list-card"><h2>Your requests</h2>{data.timeOff.length === 0 ? <div className="empty-state">No time-off requests yet.</div> : data.timeOff.map((request) => <article className="request-row" key={request.id}><div><strong>{request.type}</strong><span>{request.startDate} – {request.endDate}</span><small>{request.reason}</small></div><div><span className={`approval ${request.status.toLowerCase()}`}>{request.status}</span>{request.status === "PENDING" && <button onClick={() => void cancel(request.id)}>Cancel</button>}</div></article>)}</section>
  </div>;
}
