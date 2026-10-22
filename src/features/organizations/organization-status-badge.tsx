import { Badge } from "@/components/ui/badge";

export type OrganizationStatus = "active" | "public" | "accepted" | "published" | "open" | "review" | "draft" | "rejected" | "hidden" | "ended" | "inactive" | "closed" | "archived";

const positive = new Set<OrganizationStatus>(["active", "public", "accepted", "published", "open"]);
const warning = new Set<OrganizationStatus>(["review", "draft"]);
const negative = new Set<OrganizationStatus>(["rejected"]);

export function OrganizationStatusBadge({ status, children }: { status: OrganizationStatus; children: string }) {
  const tone = positive.has(status) ? "positive" : warning.has(status) ? "warning" : negative.has(status) ? "negative" : "neutral";
  return <Badge variant="outline" data-status={status} className={`organization-status-badge organization-status-badge--${tone}`}>{children}</Badge>;
}
