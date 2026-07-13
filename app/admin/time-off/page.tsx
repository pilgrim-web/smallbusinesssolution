import { getTimeOffRequests } from "@/lib/data/manager-repository";
import { TimeOffReviewList } from "@/components/time-off-review-list";
export const dynamic="force-dynamic";
export default async function AdminTimeOffPage(){let requests:Awaited<ReturnType<typeof getTimeOffRequests>>=[];let error="";try{requests=await getTimeOffRequests();}catch(reason){error=reason instanceof Error?reason.message:"Requests are unavailable.";}return <div className="admin-page"><header className="admin-title"><div><p className="eyebrow">Employee requests</p><h1>Time off</h1><p>Approve or deny requests with an immutable audit record.</p></div></header>{error&&<p className="alert error">{error}</p>}<TimeOffReviewList requests={requests}/></div>}
