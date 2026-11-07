import { asc, eq, sql } from "drizzle-orm";
import { withUser } from "@/db/client";
import { organizations, organizationMemberships } from "@/db/schema";

export async function getMembershipHistory(userId: string) {
  return withUser(userId, tx => tx.select({ id: organizationMemberships.id, organizationName: organizations.nameAr, logo:organizations.logoUrl, type:organizations.typeCode, hours:sql<string>`coalesce((select sum(h.hours) from lub.hour_records h where h.organization_id=lub.organizations.id and h.organization_membership_id in (select id from lub.organization_memberships where user_id=${userId}) and h.status_code='Approved'),0)::text`, slug: organizations.slug, organizationStatus: organizations.statusCode,
    statusCode: organizationMemberships.statusCode, startDate: organizationMemberships.startDate, endDate: organizationMemberships.endDate,
    roles: sql<Array<{ code: string; startDate: string; endDate: string | null; hours?:string }>>`coalesce((select jsonb_agg(jsonb_build_object('code',r.role_code,'startDate',r.start_date,'endDate',r.end_date) order by r.start_date,r.id) from lub.role_assignments r where r.organization_membership_id=lub.organization_memberships.id),'[]'::jsonb)`,
  }).from(organizationMemberships).innerJoin(organizations, eq(organizations.id, organizationMemberships.organizationId))
    .where(eq(organizationMemberships.userId, userId)).orderBy(asc(organizations.nameAr), asc(organizationMemberships.startDate)));
}
