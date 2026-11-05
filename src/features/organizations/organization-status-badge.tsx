import { Badge } from "@/components/ui/badge";

export type OrganizationStatus = "active" | "public" | "accepted" | "published" | "open" | "review" | "interview" | "working" | "draft" | "rejected" | "hidden" | "ended" | "inactive" | "closed" | "archived" | "cancelled";

const positive = new Set<OrganizationStatus>(["active", "public", "accepted", "published"]);
const warning = new Set<OrganizationStatus>(["review", "draft"]);
const negative = new Set<OrganizationStatus>(["rejected","cancelled"]);

export function OrganizationStatusBadge({ status, children }: { status: OrganizationStatus; children: string }) {
  const tone = (status==="open"||status==="interview"||status==="working")?"info":positive.has(status) ? "positive" : warning.has(status) ? "warning" : negative.has(status) ? "negative" : "neutral";
  return <Badge variant="outline" data-status={status} className={`organization-status-badge organization-status-badge--${tone}`}>{children}</Badge>;
}

export function statusTone(code:string):OrganizationStatus {
 if(["Active","Published","Registered","Present","Completed","Approved","Accepted","Recorded","Renewed"].includes(code))return "accepted";
 if(["Rejected","Cancelled","Voided","Declined"].includes(code))return "rejected";
 if(["Pending","Submitted","Draft","Changes_Requested","Scheduled"].includes(code))return "review";
 if(["Open","Upcoming","In_Progress"].includes(code))return "open";
 return "inactive";
}
