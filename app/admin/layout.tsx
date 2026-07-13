import Link from "next/link";
import { Building2, Clock3, LayoutDashboard, UsersRound } from "lucide-react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="admin-shell"><aside className="admin-sidebar"><Link href="/admin/dashboard" className="wordmark"><span>H</span> Harbor Time</Link><nav><Link href="/admin/dashboard"><LayoutDashboard/>Dashboard</Link><Link href="/admin/timesheets"><Clock3/>Timesheets</Link><Link href="/admin/worksites"><Building2/>Worksites</Link><Link href="/admin/dashboard"><UsersRound/>Team</Link></nav><small>Manager workspace</small></aside><main className="admin-main">{children}</main></div>;
}
