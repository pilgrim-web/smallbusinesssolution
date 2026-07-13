import { WorksiteForm } from "@/components/worksite-form";
export default function NewWorksitePage() { return <div className="admin-page"><header className="admin-title"><div><p className="eyebrow">Worksite management</p><h1>Add worksite</h1><p>Location defaults to FLAG mode so a missing or outside result can be reviewed without blocking an employee.</p></div></header><WorksiteForm/></div>; }
