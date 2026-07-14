"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, Clock3, History, LogOut } from "lucide-react";

const links = [
  { href: "/employee/clock", label: "Time Clock", icon: Clock3 },
  { href: "/employee/hours", label: "Time & Hours", icon: History },
  { href: "/employee/time-off", label: "Time Off", icon: CalendarDays },
];

export function EmployeeShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname(); const router = useRouter();
  async function logout() { await fetch("/api/employee/logout", { method: "POST" }); router.push("/employee/login"); }
  if (pathname === "/employee/login") return <>{children}</>;
  return (
    <div className="employee-shell">
      <header className="employee-header"><Link href="/employee/clock" className="wordmark"><span>C</span> CrewLedger Time</Link><button className="icon-button" onClick={logout} aria-label="Log out"><LogOut /></button></header>
      <main className="employee-main">{children}</main>
      <nav className="bottom-nav" aria-label="Employee navigation">
        {links.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={pathname === href ? "active" : ""} aria-current={pathname === href ? "page" : undefined}><Icon aria-hidden="true"/><span>{label}</span></Link>)}
      </nav>
    </div>
  );
}
