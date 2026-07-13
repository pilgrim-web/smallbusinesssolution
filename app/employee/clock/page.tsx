"use client";

import { useEffect, useMemo, useState } from "react";
import { Coffee, LogIn, LogOut, MapPin, Play, ShieldAlert, ShieldCheck } from "lucide-react";
import { useEmployeeData } from "@/components/use-employee-data";
import { allowedActions, formatMinutes } from "@/lib/time-clock";
import type { ClockAction, LocationCapture } from "@/lib/types";

const actions = [
  { action: "CLOCK_IN" as const, label: "Clock In", icon: LogIn, tone: "green" },
  { action: "CLOCK_OUT" as const, label: "Clock Out", icon: LogOut, tone: "navy" },
  { action: "BREAK_START" as const, label: "Start Break", icon: Coffee, tone: "amber" },
  { action: "BREAK_END" as const, label: "End Break", icon: Play, tone: "blue" },
];

export default function TimeClockPage() {
  const { data, setData, error, setError } = useEmployeeData();
  const [now, setNow] = useState(new Date()); const [busy, setBusy] = useState<ClockAction | null>(null); const [notice, setNotice] = useState("");
  useEffect(() => { const id = window.setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id); }, []);
  const timezone = data?.worksite?.timezone ?? "America/Los_Angeles";
  const liveTime = useMemo(() => new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", timeZone: timezone }).format(now), [now, timezone]);
  const valid = data ? allowedActions(data.state) : [];

  function getLocation(): Promise<LocationCapture> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) { resolve({ permissionStatus: "UNAVAILABLE" }); return; }
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracyMeters: position.coords.accuracy, clientTimestamp: new Date(position.timestamp).toISOString(), permissionStatus: "GRANTED" }),
        () => resolve({ permissionStatus: "DENIED" }),
        { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
      );
    });
  }

  async function act(action: ClockAction) {
    if (!data || busy) return; setBusy(action); setError(""); setNotice("");
    try {
      if (!data.worksite) throw new Error("No active worksite is assigned. Contact your manager.");
      const needsLocation = action === "CLOCK_IN" || action === "CLOCK_OUT" || data.worksite.captureBreakLocation;
      if (needsLocation) setNotice("Checking your location for this one-time time clock event…");
      const location = needsLocation ? await getLocation() : { permissionStatus: "NOT_REQUESTED" as const };
      const response = await fetch("/api/employee/action", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, worksiteId: data.worksite.id, location, idempotencyKey: crypto.randomUUID() }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error); setData(body); setNotice(`${actions.find((item) => item.action === action)?.label} recorded at ${liveTime}.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Action failed. Internet connection is required."); }
    finally { setBusy(null); }
  }

  if (!data) return <div className="loading-card" role="status">{error || "Loading your time clock…"}</div>;
  if (!data.worksite) return <div className="loading-card"><strong>No assigned worksite</strong><p>Ask your manager to assign an active worksite before recording time.</p></div>;
  const entry = data.openEntry; const activeBreak = entry?.breaks.find((item) => !item.endedAt);
  const activeUnpaidMinutes = activeBreak?.type === "UNPAID" ? Math.max(0, Math.floor((now.getTime() - new Date(activeBreak.startedAt).getTime()) / 60000)) : 0;
  const currentMinutes = entry ? Math.floor((now.getTime() - new Date(entry.clockInAt).getTime()) / 60000) - entry.durations.unpaidBreakMinutes - activeUnpaidMinutes : 0;
  const statusLabel = data.state === "OFF_CLOCK" ? "Off clock" : data.state === "ON_BREAK" ? "On break" : "Clocked in";

  return (
    <div className="clock-page">
      <section className="worksite-card">
        <div className="worksite-heading"><MapPin aria-hidden="true"/><div><p className="eyebrow">Current worksite</p><h1>{data.worksite.name}</h1><p>{data.worksite.address}</p></div></div>
        <span className="verification"><ShieldCheck aria-hidden="true"/> Location checked per event</span>
      </section>
      <section className="identity-block">
        <div className="avatar">{data.employee.initials}</div><p className="greeting">Hello, {data.employee.preferredName}</p>
        <time className="live-time">{liveTime}</time><span className={`status-pill ${data.state.toLowerCase()}`}>{statusLabel}</span>
      </section>
      <div className="location-disclosure"><ShieldAlert aria-hidden="true"/><p><strong>Location privacy</strong><br/>Your location is captured only when clocking in or out—not continuously.</p></div>
      {(notice || error) && <p className={`alert ${error ? "error" : "success"}`} role="status">{error || notice}</p>}
      <section className="action-grid" aria-label="Time clock actions">
        {actions.map(({ action, label, icon: Icon, tone }) => { const enabled = valid.includes(action); return <button key={action} className={`clock-action ${tone}`} disabled={!enabled || busy !== null} onClick={() => void act(action)} aria-describedby={`${action}-availability`}><Icon aria-hidden="true"/><span>{busy === action ? "Recording…" : label}</span><small id={`${action}-availability`}>{enabled ? "Available" : `Unavailable while ${statusLabel.toLowerCase()}`}</small></button>; })}
      </section>
      <section className="status-card"><h2>Today</h2><dl>
        <div><dt>Current status</dt><dd>{statusLabel}</dd></div>
        <div><dt>Last clock in</dt><dd>{entry ? new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: timezone }).format(new Date(entry.clockInAt)) : "—"}</dd></div>
        <div><dt>Current work duration</dt><dd>{entry ? formatMinutes(currentMinutes) : "0h 0m"}</dd></div>
        {activeBreak && <div><dt>Current break</dt><dd>{formatMinutes(Math.floor((now.getTime() - new Date(activeBreak.startedAt).getTime()) / 60000))}</dd></div>}
        <div className="total"><dt>This pay period</dt><dd>{formatMinutes(data.payPeriod.totalMinutes + Math.max(0, currentMinutes))}</dd></div>
      </dl></section>
    </div>
  );
}
