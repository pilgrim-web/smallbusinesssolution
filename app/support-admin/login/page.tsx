"use client";
import Image from "next/image";
import {FormEvent,useState} from "react";
import {useRouter} from "next/navigation";

type Step="password"|"enroll"|"verify";
type AuthReply={ok?:boolean;next?:"enroll"|"verify";factorId?:string;qrCode?:string;secret?:string;error?:string};

export default function PlatformLogin(){
  const router=useRouter();
  const[busy,setBusy]=useState(false);
  const[error,setError]=useState("");
  const[step,setStep]=useState<Step>("password");
  const[factorId,setFactorId]=useState("");
  const[qrCode,setQrCode]=useState("");
  const[secret,setSecret]=useState("");

  async function finish(body:AuthReply){
    if(body.ok){router.push("/support-admin");router.refresh();return;}
    if(body.next&&body.factorId){setFactorId(body.factorId);setStep(body.next);setQrCode(body.qrCode??"");setSecret(body.secret??"");return;}
    setError(body.error??"The sign-in details could not be verified.");
  }
  async function signIn(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setError("");
    const fields=Object.fromEntries(new FormData(event.currentTarget));
    const response=await fetch("/api/support/auth",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"signIn",...fields})});
    await finish(await response.json());setBusy(false);
  }
  async function verify(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setError("");
    const code=String(new FormData(event.currentTarget).get("code")??"");
    const response=await fetch("/api/support/auth",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"verifyMfa",factorId,code})});
    await finish(await response.json());setBusy(false);
  }

  return <div className="login-page"><section className="login-card"><p className="eyebrow">Platform operations</p><h1>Universal Support Admin</h1><p className="muted">Authorized platform staff only. Password and authenticator verification are required, and company access is time-limited and audited.</p>
    {step==="password"?<form className="form-stack" onSubmit={signIn}><label>Email<input name="email" type="email" autoComplete="username" required/></label><label>Password<input name="password" type="password" autoComplete="current-password" minLength={12} required/></label>{error&&<p className="alert error">{error}</p>}<button className="button primary" disabled={busy}>{busy?"Signing in…":"Continue securely"}</button></form>:
    <form className="form-stack" onSubmit={verify}>{step==="enroll"&&<><h2>Set up an authenticator</h2><p>Scan this QR code with an authenticator app. This setup is required before platform access is granted.</p>{qrCode&&<Image src={qrCode} width={220} height={220} alt="Authenticator enrollment QR code" unoptimized/>}<label>Manual setup key<input value={secret} readOnly aria-label="Manual authenticator setup key"/></label></>}<label>Six-digit authenticator code<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required autoFocus/></label>{error&&<p className="alert error">{error}</p>}<button className="button primary" disabled={busy}>{busy?"Verifying…":"Verify and continue"}</button></form>}
  </section></div>;
}
