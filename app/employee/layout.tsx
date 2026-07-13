import { EmployeeShell } from "@/components/employee-shell";

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  return <EmployeeShell>{children}</EmployeeShell>;
}
