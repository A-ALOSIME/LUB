import { and, eq, sql } from "drizzle-orm";
import { withUser, type Transaction } from "@/db/client";
import { organizations, committees, tags, organizationTags, organizationLinks } from "@/db/schema";
import type { OrganizationProfileInput, CommitteeInput } from "@/features/organizations/validation";

// These operations belong to the frozen pre-simplification integration fixture.
async function requirePermission(tx: Transaction, organizationId: string, permission: string, committeeId: string | null = null) {
  const [access] = await tx.select({ allowed: sql<boolean>`lub.has_org_permission(${organizationId},${permission},${committeeId})` })
    .from(organizations).where(eq(organizations.id, organizationId)).limit(1);
  if (!access?.allowed) throw new Error("FORBIDDEN");
}
const manageFields = {
  id: organizations.id, slug: organizations.slug, nameAr: organizations.nameAr, typeCode: organizations.typeCode, statusCode: organizations.statusCode,
  canEdit: sql<boolean>`lub.has_org_permission(${organizations.id},'ORG_PROFILE_MANAGE')`,
  canManageCommittees: sql<boolean>`lub.has_org_permission(${organizations.id},'COMMITTEE_MANAGE')`,
};
const hasScopedAccess = sql`(lub.has_event_access(${organizations.id}) or lub.has_reports_access(${organizations.id}) or lub.has_hours_access(${organizations.id}) or lub.has_task_access(${organizations.id}) or lub.has_application_access(${organizations.id}) or lub.has_org_permission(${organizations.id},'MEMBERS_VIEW') or lub.has_org_permission(${organizations.id},'MEMBERS_MANAGE') or lub.has_org_permission(${organizations.id},'PERMISSIONS_GRANT') or lub.has_org_permission(${organizations.id},'RENEWALS_MANAGE') or lub.has_org_permission(${organizations.id},'ORG_PROFILE_MANAGE') or lub.has_org_permission(${organizations.id},'COMMITTEE_MANAGE') or exists(select 1 from lub.committees c where c.organization_id=${organizations.id} and (lub.has_org_permission(${organizations.id},'COMMITTEE_PROFILE_MANAGE',c.id) or lub.has_org_permission(${organizations.id},'MEMBERS_VIEW',c.id))))`;

export async function getManagementOrganization(userId: string, organizationId: string, administrative=false) {
  return withUser(userId, async tx => {
    const [row] = await tx.select({ ...manageFields,canEdit:sql<boolean>`lub.has_org_permission(${organizations.id},'ORG_PROFILE_MANAGE') or (${administrative} and lub.is_super_admin())`,adminIdentity:sql<{slug:string;typeCode:string;statusCode:string;leaderName:string|null}|null>`case when ${administrative} and lub.is_super_admin() then lub.admin_organization_identity(${organizations.id}) end`, canEvents: sql<boolean>`lub.has_event_access(${organizations.id})`, canReports: sql<boolean>`lub.has_reports_access(${organizations.id})`, canHours: sql<boolean>`lub.has_hours_access(${organizations.id})`, canRenewals: sql<boolean>`lub.has_org_permission(${organizations.id},'RENEWALS_MANAGE')`, canTasks: sql<boolean>`lub.has_task_access(${organizations.id})`, canApplications: sql<boolean>`lub.has_application_access(${organizations.id})`, canMembers: sql<boolean>`lub.has_org_permission(${organizations.id},'MEMBERS_VIEW') or lub.has_org_permission(${organizations.id},'MEMBERS_MANAGE') or exists(select 1 from lub.committees c where c.organization_id=${organizations.id} and lub.has_org_permission(${organizations.id},'MEMBERS_VIEW',c.id))`, canGrant: sql<boolean>`lub.has_org_permission(${organizations.id},'PERMISSIONS_GRANT')`, summary: organizations.summary, mission: organizations.mission, publicProfileContent: organizations.publicProfileContent, logoUrl: organizations.logoUrl, linksCustomized: organizations.linksCustomized, showLeadershipPublicly: organizations.showLeadershipPublicly,
      tagNames: sql<string[]>`coalesce((select jsonb_agg(t.name_ar order by t.name_ar) from lub.organization_tags ot inner join lub.tags t on t.id=ot.tag_id where ot.organization_id=lub.organizations.id), '[]'::jsonb)`,
      contacts: sql<Array<{ linkType: string; url: string }>>`coalesce((select jsonb_agg(jsonb_build_object('linkType',link.link_type,'url',link.url) order by link.sort_order,link.id) from lub.organization_links link where link.organization_id=lub.organizations.id), '[]'::jsonb)`,
      committees: sql<Array<{ id: string; name: string; description: string; isPublic: boolean; statusCode: string; copiedFromCommitteeId: string | null; parentCommitteeId: string | null; canEdit: boolean; memberCount: number | null; leaderName: string | null }>>`coalesce((select jsonb_agg(jsonb_build_object('id',committee.id,'name',committee.name,'description',committee.description,'isPublic',committee.is_public,'statusCode',committee.status_code,'copiedFromCommitteeId',committee.copied_from_committee_id,'parentCommitteeId',committee.parent_committee_id,'canEdit',lub.has_org_permission(lub.organizations.id,'COMMITTEE_MANAGE') or lub.has_org_permission(lub.organizations.id,'COMMITTEE_PROFILE_MANAGE',committee.id),'memberCount',case when lub.has_org_permission(lub.organizations.id,'MEMBERS_VIEW') or lub.has_org_permission(lub.organizations.id,'MEMBERS_VIEW',committee.id) then (select count(*)::int from lub.committee_memberships cm inner join lub.organization_memberships membership on membership.id=cm.organization_membership_id and membership.organization_id=cm.organization_id where cm.committee_id=committee.id and cm.organization_id=committee.organization_id and cm.status_code='Active' and cm.end_date is null and membership.status_code='Active' and membership.end_date is null) else null end,'leaderName',case when lub.has_org_permission(lub.organizations.id,'MEMBERS_VIEW') or lub.has_org_permission(lub.organizations.id,'MEMBERS_VIEW',committee.id) then (select profile.full_name_ar from lub.role_assignments role inner join lub.organization_memberships membership on membership.id=role.organization_membership_id and membership.organization_id=role.organization_id inner join lub.student_profiles profile on profile.user_id=membership.user_id where role.committee_id=committee.id and role.organization_id=committee.organization_id and role.role_code='CL' and role.end_date is null and membership.status_code='Active' and membership.end_date is null order by role.start_date desc,role.id desc limit 1) else null end) order by committee.name,committee.id) from lub.committees committee where committee.organization_id=lub.organizations.id and (lub.has_org_permission(lub.organizations.id,'COMMITTEE_MANAGE') or lub.has_org_permission(lub.organizations.id,'COMMITTEE_PROFILE_MANAGE',committee.id))), '[]'::jsonb)`,
    })
      .from(organizations).where(and(eq(organizations.id, organizationId), sql`(${hasScopedAccess} or (${administrative} and lub.is_super_admin()))`)).limit(1);
    if (!row) return undefined;
    const { tagNames, contacts, committees: scopedCommittees, ...organization } = row;
    return { organization, committees: scopedCommittees, tagNames, contacts };
  });
}

async function requireProfileEditor(tx:Transaction,organizationId:string){
 const [row]=await tx.execute(sql`select lub.can_edit_organization_profile(${organizationId}) as allowed`);if(!row?.allowed)throw new Error("FORBIDDEN");
}
export async function saveOrganizationProfile(userId: string, organizationId: string, input: OrganizationProfileInput) {
  return withUser(userId, async tx => {
    await requireProfileEditor(tx,organizationId);
    await tx.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, organizationId)).for("update");
    const { tagNames, contacts, ...profile } = input;
    const changed = await tx.update(organizations).set({ ...profile, linksCustomized: true, updatedAt: new Date() }).where(eq(organizations.id, organizationId)).returning({ id: organizations.id });
    if (!changed.length) throw new Error("FORBIDDEN");
    await tx.delete(organizationTags).where(eq(organizationTags.organizationId, organizationId));
    for (const name of tagNames) {
      await tx.insert(tags).values({ nameAr: name }).onConflictDoNothing();
      const [tag] = await tx.select({ id: tags.id }).from(tags).where(eq(tags.nameAr, name)).limit(1);
      if (!tag) throw new Error("Interest unavailable.");
      await tx.insert(organizationTags).values({ organizationId, tagId: tag.id });
    }
    await tx.delete(organizationLinks).where(eq(organizationLinks.organizationId, organizationId));
    if (contacts.length) await tx.insert(organizationLinks).values(contacts.map((contact, sortOrder) => ({ organizationId, linkType: contact.linkType, url: contact.url, sortOrder })));
  });
}

export async function saveOrganizationLogo(userId: string, organizationId: string, logoUrl: string) {
  return withUser(userId, async tx => {
    await requireProfileEditor(tx,organizationId);
    const [organization] = await tx.select({ id: organizations.id, slug: organizations.slug, logoUrl: organizations.logoUrl })
      .from(organizations).where(eq(organizations.id, organizationId)).for("update").limit(1);
    if (!organization) throw new Error("FORBIDDEN");
    await tx.update(organizations).set({ logoUrl, updatedAt: new Date() }).where(eq(organizations.id, organizationId));
    return { previousLogoUrl: organization.logoUrl, slug: organization.slug };
  });
}
export async function saveCommittee(userId: string, organizationId: string, input: CommitteeInput, committeeId?: string) {
  return withUser(userId, async tx => {
    await requirePermission(tx, organizationId, committeeId ? "COMMITTEE_PROFILE_MANAGE" : "COMMITTEE_MANAGE", committeeId ?? null);
    if (input.parentCommitteeId) {
      if (input.parentCommitteeId === committeeId) throw new Error("FORBIDDEN");
      await requirePermission(tx, organizationId, "COMMITTEE_PROFILE_MANAGE", input.parentCommitteeId);
      const [parent] = await tx.select({ id: committees.id }).from(committees).where(and(eq(committees.id, input.parentCommitteeId), eq(committees.organizationId, organizationId))).limit(1);
      if (!parent) throw new Error("FORBIDDEN");
    }
    const rows = committeeId
      ? await tx.update(committees).set({ ...input, updatedAt: new Date() }).where(and(eq(committees.id, committeeId), eq(committees.organizationId, organizationId))).returning({ id: committees.id })
      : await tx.insert(committees).values({ organizationId, ...input }).returning({ id: committees.id });
    if (!rows[0]) throw new Error("FORBIDDEN");
    return rows[0];
  });
}
export async function copyCommittee(userId: string, organizationId: string, committeeId: string) {
  return withUser(userId, async tx => {
    await requirePermission(tx, organizationId, "COMMITTEE_MANAGE");
    const [source] = await tx.select().from(committees).where(and(eq(committees.id, committeeId), eq(committees.organizationId, organizationId))).limit(1);
    if (!source) throw new Error("FORBIDDEN");
    const [copied] = await tx.insert(committees).values({ organizationId, copiedFromCommitteeId: source.id, parentCommitteeId: source.parentCommitteeId, name: `${source.name.slice(0, 110)} (نسخة)`, description: source.description, isPublic: source.isPublic }).returning({ id: committees.id });
    return copied;
  });
}
export async function setCommitteeStatus(userId: string, organizationId: string, committeeId: string, status: "Active" | "Archived") {
  return withUser(userId, async tx => {
    await requirePermission(tx, organizationId, "COMMITTEE_MANAGE");
    const changed = await tx.update(committees).set({ statusCode: status, archivedAt: status === "Archived" ? new Date() : null, updatedAt: new Date() })
      .where(and(eq(committees.id, committeeId), eq(committees.organizationId, organizationId))).returning({ id: committees.id });
    if (!changed.length) throw new Error("FORBIDDEN");
  });
}
