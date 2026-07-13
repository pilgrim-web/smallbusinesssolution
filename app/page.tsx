import Link from "next/link";

export default function Home() {
  return (
    <main className="welcome-page">
      <section className="welcome-card">
        <div className="brand-mark">H</div>
        <p className="eyebrow">Harbor Time</p>
        <h1>Work time, made clear.</h1>
        <p className="muted">Secure time tracking for teams that work on-site and in the field.</p>
        <div className="stack">
          <Link className="button primary" href="/employee/login">Employee sign in</Link>
          <Link className="button secondary" href="/admin/dashboard">Manager dashboard</Link>
        </div>
      </section>
    </main>
  );
}
