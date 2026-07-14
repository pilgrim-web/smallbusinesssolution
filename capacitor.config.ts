import type { CapacitorConfig } from "@capacitor/cli";

const config:CapacitorConfig={
  appId:"com.pilgrimweb.harbortime",
  appName:"Harbor Time",
  webDir:"public",
  server:{url:"https://smallbusinesssolution-git-phase-3-production-pilgrim-web.vercel.app",cleartext:false},
  ios:{contentInset:"automatic",allowsLinkPreview:false},
};
export default config;
