import type { CapacitorConfig } from "@capacitor/cli";

const config:CapacitorConfig={
  appId:"com.pilgrimweb.harbortime",
  appName:"CrewLedger Time",
  webDir:"public",
  server:{url:"https://smallbusinesssolution.vercel.app",cleartext:false},
  ios:{contentInset:"automatic",allowsLinkPreview:false},
};
export default config;
