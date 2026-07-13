"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { EmployeeData } from "@/lib/client-types";

export function useEmployeeData() {
  const router = useRouter(); const [data, setData] = useState<EmployeeData | null>(null); const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try { const response = await fetch("/api/employee/state", { cache: "no-store" }); if (response.status === 401) { router.push("/employee/login"); return; } const body = await response.json(); if (!response.ok) throw new Error(body.error); setData(body); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Internet connection is required."); }
  }, [router]);
  useEffect(() => { void refresh(); }, [refresh]);
  return { data, setData, error, setError, refresh };
}
