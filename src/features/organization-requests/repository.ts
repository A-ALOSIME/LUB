import "server-only";
import { sql } from "drizzle-orm";
import { withUser } from "@/db/client";
export type OpeningRequest = {
  id: string;
  name_ar: string;
  type_code: "Club" | "Council";
  summary: string;
  mission: string;
  interests: string[];
  status_code: "Pending" | "Accepted" | "Rejected" | "Withdrawn";
  decision_note: string;
  created_at: string;
  decided_at: string | null;
  has_logo: boolean;
  applicant_name: string | null;
  organization_slug: string | null;
};
export type OpeningWorkspace = {
  counts: { Pending: number; Accepted: number; Rejected: number };
  items: OpeningRequest[];
};
export async function openingRequests(
  user: string,
  ownOnly: boolean,
  status: string | null = null,
  page = 0,
) {
  return withUser(user, async (tx) => {
    const [row] = await tx.execute(
      sql`select lub.organization_request_workspace(${ownOnly},${status},${page * 25}) as data`,
    );
    return row.data as OpeningWorkspace;
  });
}
export async function pendingOpeningRequestCount(user: string) {
  return withUser(user, async (tx) => {
    const [row] = await tx.execute(
      sql`select count(*)::int as count from lub.organization_opening_requests where status_code='Pending' and lub.is_super_admin()`,
    );
    return Number(row.count);
  });
}
export async function ownOpeningRequest(user: string, id: string) {
  return withUser(user, async (tx) => {
    const [row] = await tx.execute(
      sql`select id,name_ar,type_code,summary,mission,interests,status_code,decision_note,created_at,decided_at,lub.organization_request_logo(id) is not null as has_logo,null::text as applicant_name,null::text as organization_slug from lub.organization_opening_requests where id=${id} and applicant_user_id=${user}`,
    );
    return row as OpeningRequest | undefined;
  });
}
