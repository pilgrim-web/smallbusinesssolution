import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request:NextRequest){const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;if(!url||!anon)return NextResponse.next({request});let response=NextResponse.next({request});const supabase=createServerClient(url,anon,{cookies:{getAll:()=>request.cookies.getAll(),setAll:(values:{name:string;value:string;options:CookieOptions}[])=>{values.forEach(({name,value})=>request.cookies.set(name,value));response=NextResponse.next({request});values.forEach(({name,value,options})=>response.cookies.set(name,value,options));}}});await supabase.auth.getUser();return response;}
export const config={matcher:["/admin/:path*","/api/admin/:path*"]};
