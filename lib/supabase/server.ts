import "server-only";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { isSupabaseConfigured } from "./admin";

export async function getAuthenticatedUser() {
  if (!isSupabaseConfigured() || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return null;
  const cookieStore = await cookies();
  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (values: { name: string; value: string; options: CookieOptions }[]) => {
          try {
            values.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Server Components cannot write cookies. Middleware/auth routes refresh them.
          }
        },
      },
    },
  );
  const { data, error } = await client.auth.getUser();
  return error ? null : data.user;
}

export async function getCookieSupabase() {
  if (!isSupabaseConfigured() || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) throw new Error("SUPABASE_NOT_CONFIGURED");
  const cookieStore = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{
    cookies:{getAll:()=>cookieStore.getAll(),setAll:(values:{name:string;value:string;options:CookieOptions}[])=>values.forEach(({name,value,options})=>cookieStore.set(name,value,options))},
  });
}
