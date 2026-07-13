"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole, ShieldCheck } from "lucide-react";

export default function EmployeeLogin() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/employee/auth", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.fromEntries(data)) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      router.push("/employee/clock"); router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Sign in failed."); }
    finally { setBusy(false); }
  }

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <div className="brand-mark"><LockKeyhole aria-hidden="true" /></div>
        <p className="eyebrow">Harbor Time</p>
        <h1 id="login-title">Employee sign in</h1>
        <p className="muted">Use the details provided by your manager.</p>
        <form onSubmit={submit} className="form-stack">
          <label>Company code<input name="companyCode" autoComplete="organization" required /></label>
          <label>Employee number<input name="employeeNumber" inputMode="numeric" autoComplete="username" required /></label>
          <label>PIN<input name="pin" type="password" inputMode="numeric" autoComplete="current-password" minLength={4} maxLength={10} required /></label>
          {error && <p className="alert error" role="alert">{error}</p>}
          <button className="button primary" disabled={busy}>{busy ? "Verifying…" : "Sign in securely"}</button>
        </form>
        <p className="privacy-note"><ShieldCheck aria-hidden="true" /> Your PIN is encrypted and never displayed to managers.</p>
      </section>
    </main>
  );
}
