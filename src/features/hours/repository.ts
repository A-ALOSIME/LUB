import "server-only";
import { sql } from "drizzle-orm";
import { withUser } from "@/db/client";

export type AccountReadiness = { status: string | null; onboarded: boolean };
export type Term = { id: string; name_ar: string; academic_year: string; term_code: string; start_date: string; end_date: string };
export type HourRecord = {
  id: string; organization_id: string; organization_membership_id: string;
  committee_id: string | null; academic_term_id: string; hours: string;
  activity_date: string; description: string; status_code: string; source_code: string;
  created_at: string; updated_at?: string; owner: string | null; org_name: string; term_name: string;
  committee_name?: string | null; reviewer?: string | null; review_note?: string; reviewed_at?: string | null;
  canReview: boolean; canWithdraw?: boolean;
};
export type HoursStatusTotals = { approved: string; pending: string; rejected: string; approvedCount?: number; pendingCount?: number; rejectedCount?: number };
export type HoursData = {
  isTest?: boolean; account: AccountReadiness; terms: Term[]; records: HourRecord[];
  total: string; hoursByStatus: HoursStatusTotals; byOrg: Array<{ name: string; total: string }>;
  memberships: Array<{ id: string; org: string; name: string; self: boolean; committees: Array<{ id: string; name: string }> }>;
};
export type HoursWorkspace = { selfEnabled: boolean; canPolicy: boolean; records: HourRecord[] };

export async function myHours(user: string, term: string | null, page: number | null, status: string | null = null, q = "") {
  return withUser(user, async tx => {
    const [row] = await tx.execute<{ data: HoursData | null }>(sql`select lub.my_hours(${term}::uuid,${page}::int,${status}::text,${q}) as data`);
    return row?.data ?? undefined;
  });
}

export async function hoursWorkspace(user: string, org: string) {
  return withUser(user, async tx => {
    const [row] = await tx.execute<{ data: HoursWorkspace | null }>(sql`select lub.hours_review_workspace(${org}::uuid) as data`);
    return row?.data ?? undefined;
  });
}

export async function termWorkspace(user: string) {
  return withUser(user, async tx => {
    const [row] = await tx.execute<{ account: AccountReadiness; canManage: boolean; terms: Term[] }>(sql`
      select jsonb_build_object('status',u.status_code,'onboarded',u.onboarded_at is not null) as account,
        lub.is_super_admin() as "canManage",
        coalesce((select jsonb_agg(t order by t.start_date desc)
          from (select * from lub.academic_terms order by start_date desc limit 100) t),'[]') as terms
      from lub.users u where u.id=${user}`);
    return row;
  });
}

export async function getHourRecord(user: string, id: string) {
  return withUser(user, async tx => {
    const [row] = await tx.execute<{ data: HourRecord | null }>(sql`select lub.hour_details(${id}::uuid) as data`);
    return row?.data ?? undefined;
  });
}
