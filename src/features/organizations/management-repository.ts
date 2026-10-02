import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { withUser, type Transaction } from "@/db/client";
import { users, organizations, committees, tags, organizationTags, organizationLinks, organizationMemberships, announcements } from "@/db/schema";
import type { CreateOrganizationInput, OrganizationProfileInput, CommitteeInput, AnnouncementInput } from "./validation";

async function requireSuperAdmin(tx: Transaction) {
  const [access] = await tx.select({ allowed: sql<boolean>`lub.is_super_admin()` }).from(users).limit(1);
  if (!access?.allowed) throw new Error("FORBIDDEN");
}
async function requirePermission(tx: Transaction, organizationId: string, permission: string, committeeId: string | null = null) {
  const [access] = await tx.select({ allowed: sql<boolean>`lub.has_org_permission(${organizationId},${permission},${committeeId})` })
    .from(organizations).where(eq(organizations.id, organizationId)).limit(1);
  if (!access?.allowed) throw new Error("FORBIDDEN");
}
const manageFields = {
  id: organizations.id, slug: organizations.slug, nameAr: organizations.nameAr, statusCode: organizations.statusCode,
  canEdit: sql<boolean>`lub.has_org_permission(${organizations.id},'ORG_PROFILE_MANAGE')`,
  canManageCommittees: sql<boolean>`lub.has_org_permission(${organizations.id},'COMMITTEE_MANAGE')`,
};
const hasScopedAccess = sql`lub.has_event_access(${organizations.id}) or lub.has_reports_access(${organizations.id}) or lub.has_hours_access(${organizations.id}) or lub.has_task_access(${organizations.id}) or lub.has_application_access(${organizations.id}) or lub.has_org_permission(${organizations.id},'ORG_PROFILE_MANAGE') or lub.has_org_permission(${organizations.id},'COMMITTEE_MANAGE') or exists(select 1 from lub.committees c where c.organization_id=${organizations.id} and lub.has_org_permission(${organizations.id},'COMMITTEE_PROFILE_MANAGE',c.id))`;

export async function getManagementAccess(userId: string) {
  return withUser(userId, tx => readManagementAccess(tx, userId));
}
async function readManagementAccess(tx: Transaction, userId: string) {
    const [account] = await tx.select({ superAdmin: sql<boolean>`lub.is_super_admin()`, status: users.statusCode }).from(users).where(eq(users.id, userId)).limit(1);
    if (!account || account.status !== "Active") return { superAdmin: false, organizations: [] };
    const accessible = await tx.select(manageFields).from(organizations).where(hasScopedAccess).orderBy(asc(organizations.nameAr));
    return { superAdmin: account.superAdmin, organizations: accessible };
}

export async function getManagementDashboard(userId: string) {
  return withUser(userId, async tx => {
    const [row] = await tx.select({
      status: users.statusCode,
      onboarded: sql<boolean>`exists(select 1 from lub.student_profiles p where p.user_id=lub.users.id)`,
      superAdmin: sql<boolean>`lub.is_super_admin()`,
      managed: sql<Array<{ id: string; slug: string; nameAr: string; statusCode: string; canEdit: boolean; canManageCommittees: boolean }>>`coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'slug',o.slug,'nameAr',o.name_ar,'statusCode',o.status_code,'canEdit',lub.has_org_permission(o.id,'ORG_PROFILE_MANAGE'),'canManageCommittees',lub.has_org_permission(o.id,'COMMITTEE_MANAGE')) order by o.name_ar,o.id) from lub.organizations o where lub.has_reports_access(o.id) or lub.has_hours_access(o.id) or lub.has_task_access(o.id) or lub.has_application_access(o.id) or lub.has_org_permission(o.id,'ORG_PROFILE_MANAGE') or lub.has_org_permission(o.id,'COMMITTEE_MANAGE') or exists(select 1 from lub.committees c where c.organization_id=o.id and lub.has_org_permission(o.id,'COMMITTEE_PROFILE_MANAGE',c.id))),'[]'::jsonb)`,
      roster: sql<Array<{ id: string; slug: string; nameAr: string; typeCode: string; statusCode: string }>>`case when lub.is_super_admin() then coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'slug',o.slug,'nameAr',o.name_ar,'typeCode',o.type_code,'statusCode',o.status_code) order by o.name_ar,o.id) from (select id,slug,name_ar,type_code,status_code from lub.organizations order by name_ar,id limit 200) o),'[]'::jsonb) else '[]'::jsonb end`,
      admins: sql<Array<{ userId: string; fullName: string }>>`case when lub.is_super_admin() then coalesce((select jsonb_agg(jsonb_build_object('userId',a.user_id,'fullName',a.full_name)) from lub.list_super_admins() a),'[]'::jsonb) else '[]'::jsonb end`,
    }).from(users).where(eq(users.id, userId)).limit(1);
    return { readiness: { status: row?.status, onboarded: Boolean(row?.onboarded) }, access: { superAdmin: Boolean(row?.superAdmin), organizations: row?.managed ?? [] }, roster: row?.roster ?? [], admins: row?.admins ?? [] };
  });
}
export async function getAdminOrganizations(userId: string) {
  return withUser(userId, async tx => {
    await requireSuperAdmin(tx);
    return tx.select({ id: organizations.id, slug: organizations.slug, nameAr: organizations.nameAr, typeCode: organizations.typeCode, statusCode: organizations.statusCode })
      .from(organizations).orderBy(asc(organizations.nameAr)).limit(200);
  });
}
export async function getSuperAdmins(userId: string) {
  return withUser(userId, async tx => {
    await requireSuperAdmin(tx);
    return tx.select({ userId: sql<string>`user_id`, fullName: sql<string>`full_name` }).from(sql`lub.list_super_admins()`);
  });
}
export async function getManagementOrganization(userId: string, organizationId: string) {
  return withUser(userId, async tx => {
    const [organization] = await tx.select({ ...manageFields, canEvents: sql<boolean>`lub.has_event_access(${organizations.id})`, canReports: sql<boolean>`lub.has_reports_access(${organizations.id})`, canHours: sql<boolean>`lub.has_hours_access(${organizations.id})`, canRenewals: sql<boolean>`lub.has_org_permission(${organizations.id},'RENEWALS_MANAGE')`, canTasks: sql<boolean>`lub.has_task_access(${organizations.id})`, canApplications: sql<boolean>`lub.has_application_access(${organizations.id})`, summary: organizations.summary, mission: organizations.mission, logoUrl: organizations.logoUrl, showLeadershipPublicly: organizations.showLeadershipPublicly,
      announcements:sql<Array<{id:string;title:string;body:string;published:boolean;pinned:boolean}>>`case when lub.has_org_permission(${organizations.id},'ORG_PROFILE_MANAGE') then coalesce((select jsonb_agg(a) from(select a.id,a.title,a.body,a.published_at is not null as published,a.pinned_at is not null as pinned from lub.announcements a where a.organization_id=lub.organizations.id and a.archived_at is null order by a.pinned_at desc nulls last,a.created_at desc,a.id limit 30) a),'[]'::jsonb) else '[]'::jsonb end`,
    })
      .from(organizations).where(and(eq(organizations.id, organizationId), hasScopedAccess)).limit(1);
    if (!organization) return undefined;
    const interests = await tx.select({ name: tags.nameAr }).from(organizationTags).innerJoin(tags, eq(tags.id, organizationTags.tagId))
      .where(eq(organizationTags.organizationId, organizationId)).orderBy(asc(tags.nameAr));
    const [contact] = await tx.select({ url: organizationLinks.url }).from(organizationLinks).where(eq(organizationLinks.organizationId, organizationId)).orderBy(asc(organizationLinks.sortOrder)).limit(1);
    const scopedCommittees = await tx.select({ id: committees.id, name: committees.name, description: committees.description, isPublic: committees.isPublic, statusCode: committees.statusCode, copiedFromCommitteeId: committees.copiedFromCommitteeId,
      canEdit: sql<boolean>`lub.has_org_permission(${organizationId},'COMMITTEE_MANAGE') or lub.has_org_permission(${organizationId},'COMMITTEE_PROFILE_MANAGE',${committees.id})`,
    }).from(committees).where(and(eq(committees.organizationId, organizationId), sql`lub.has_org_permission(${organizationId},'COMMITTEE_MANAGE') or lub.has_org_permission(${organizationId},'COMMITTEE_PROFILE_MANAGE',${committees.id})`)).orderBy(asc(committees.name));
    return { organization, committees: scopedCommittees, tagNames: interests.map(x => x.name).join("، "), websiteUrl: contact?.url ?? "" };
  });
}
export async function getMembershipHistory(userId: string) {
  return withUser(userId, tx => tx.select({ id: organizationMemberships.id, organizationName: organizations.nameAr, slug: organizations.slug, organizationStatus: organizations.statusCode,
    statusCode: organizationMemberships.statusCode, startDate: organizationMemberships.startDate, endDate: organizationMemberships.endDate,
    roles: sql<Array<{ code: string; startDate: string; endDate: string | null }>>`coalesce((select jsonb_agg(jsonb_build_object('code',r.role_code,'startDate',r.start_date,'endDate',r.end_date) order by r.start_date,r.id) from lub.role_assignments r where r.organization_membership_id=lub.organization_memberships.id),'[]'::jsonb)`,
  }).from(organizationMemberships).innerJoin(organizations, eq(organizations.id, organizationMemberships.organizationId))
    .where(eq(organizationMemberships.userId, userId)).orderBy(asc(organizations.nameAr), asc(organizationMemberships.startDate)));
}

export async function createOrganization(userId: string, input: CreateOrganizationInput) {
  return withUser(userId, async tx => { await requireSuperAdmin(tx); const [created] = await tx.insert(organizations).values(input).returning({ id: organizations.id }); return created; });
}
export async function appointPrimaryLeader(userId: string, organizationId: string, email: string) {
  return withUser(userId, async tx => { await requireSuperAdmin(tx); await tx.execute(sql`select lub.set_primary_leader(${organizationId},${email})`); });
}
export async function setOrganizationStatus(userId: string, organizationId: string, status: "Active" | "Inactive" | "Archived") {
  return withUser(userId, async tx => { await requireSuperAdmin(tx); await tx.execute(sql`select lub.set_organization_status(${organizationId},${status})`); });
}
export async function grantSuperAdmin(userId: string, email: string) {
  return withUser(userId, async tx => { await requireSuperAdmin(tx); await tx.execute(sql`select lub.grant_super_admin(${email})`); });
}
export async function endSuperAdmin(userId: string, targetUserId: string) {
  return withUser(userId, async tx => { await requireSuperAdmin(tx); await tx.execute(sql`select lub.end_super_admin(${targetUserId})`); });
}

export async function saveOrganizationProfile(userId: string, organizationId: string, input: OrganizationProfileInput) {
  return withUser(userId, async tx => {
    await requirePermission(tx, organizationId, "ORG_PROFILE_MANAGE");
    await tx.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, organizationId)).for("update");
    const { tagNames, websiteUrl, ...profile } = input;
    const changed = await tx.update(organizations).set({ ...profile, updatedAt: new Date() }).where(eq(organizations.id, organizationId)).returning({ id: organizations.id });
    if (!changed.length) throw new Error("FORBIDDEN");
    await tx.delete(organizationTags).where(eq(organizationTags.organizationId, organizationId));
    for (const name of tagNames) {
      await tx.insert(tags).values({ nameAr: name }).onConflictDoNothing();
      const [tag] = await tx.select({ id: tags.id }).from(tags).where(eq(tags.nameAr, name)).limit(1);
      if (!tag) throw new Error("Interest unavailable.");
      await tx.insert(organizationTags).values({ organizationId, tagId: tag.id });
    }
    await tx.delete(organizationLinks).where(eq(organizationLinks.organizationId, organizationId));
    if (websiteUrl) await tx.insert(organizationLinks).values({ organizationId, linkType: "الموقع أو التواصل", url: websiteUrl });
  });
}
export async function saveAnnouncement(userId: string, organizationId: string, input: AnnouncementInput, announcementId?: string) {
  return withUser(userId, async tx => {
    await requirePermission(tx, organizationId, "ORG_PROFILE_MANAGE");
    await tx.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, organizationId)).for("update");
    const existing = announcementId ? (await tx.select({ id: announcements.id, publishedAt: announcements.publishedAt }).from(announcements)
      .where(and(eq(announcements.id, announcementId), eq(announcements.organizationId, organizationId), sql`${announcements.archivedAt} is null`)).for("update").limit(1))[0] : undefined;
    if (announcementId && !existing) throw new Error("FORBIDDEN");
    if (input.pinned) await tx.update(announcements).set({ pinnedAt: null }).where(and(eq(announcements.organizationId, organizationId), sql`${announcements.pinnedAt} is not null`));
    const values = { title: input.title, body: input.body, publishedAt: input.published ? existing?.publishedAt ?? new Date() : null, pinnedAt: input.pinned ? new Date() : null, updatedAt: new Date() };
    const [saved] = existing ? await tx.update(announcements).set(values).where(eq(announcements.id, existing.id)).returning({ id: announcements.id })
      : await tx.insert(announcements).values({ organizationId, ...values }).returning({ id: announcements.id });
    return saved.id;
  });
}
export async function archiveAnnouncement(userId: string, organizationId: string, announcementId: string) {
  return withUser(userId, async tx => {
    await requirePermission(tx, organizationId, "ORG_PROFILE_MANAGE");
    const [saved] = await tx.update(announcements).set({ archivedAt: new Date(), pinnedAt: null, updatedAt: new Date() })
      .where(and(eq(announcements.id, announcementId), eq(announcements.organizationId, organizationId), sql`${announcements.archivedAt} is null`)).returning({ id: announcements.id });
    if (!saved) throw new Error("FORBIDDEN");
  });
}
export async function saveCommittee(userId: string, organizationId: string, input: CommitteeInput, committeeId?: string) {
  return withUser(userId, async tx => {
    await requirePermission(tx, organizationId, committeeId ? "COMMITTEE_PROFILE_MANAGE" : "COMMITTEE_MANAGE", committeeId ?? null);
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
    const [copied] = await tx.insert(committees).values({ organizationId, copiedFromCommitteeId: source.id, name: `${source.name.slice(0, 110)} (نسخة)`, description: source.description, isPublic: source.isPublic }).returning({ id: committees.id });
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
