import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CrewLedger Time",
  description: "A clear, secure time clock for small teams.",
  manifest:"/manifest.webmanifest",
  icons:{icon:"/icons/app-icon-192.png",apple:"/icons/apple-touch-icon.png"},
  appleWebApp:{capable:true,statusBarStyle:"default",title:"CrewLedger Time"},
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
