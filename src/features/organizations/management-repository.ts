import "server-only";
import { cache } from "react";
import { and, asc, eq, sql } from "drizzle-orm";
import { getDb, withUser, type Transaction } from "@/db/client";
import { users, organizations, committees, tags, organizationTags, organizationLinks, organizationMemberships, announcements, studentProfiles, auditLog } from "@/db/schema";
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
  id: organizations.id, slug: organizations.slug, nameAr: organizations.nameAr, typeCode: organizations.typeCode, statusCode: organizations.statusCode,
  canEdit: sql<boolean>`lub.has_org_permission(${organizations.id},'ORG_PROFILE_MANAGE')`,
  canManageCommittees: sql<boolean>`lub.has_org_permission(${organizations.id},'COMMITTEE_MANAGE')`,
};
const hasScopedAccess = sql`(lub.has_event_access(${organizations.id}) or lub.has_reports_access(${organizations.id}) or lub.has_hours_access(${organizations.id}) or lub.has_task_access(${organizations.id}) or lub.has_application_access(${organizations.id}) or lub.has_org_permission(${organizations.id},'MEMBERS_VIEW') or lub.has_org_permission(${organizations.id},'MEMBERS_MANAGE') or lub.has_org_permission(${organizations.id},'PERMISSIONS_GRANT') or lub.has_org_permission(${organizations.id},'RENEWALS_MANAGE') or lub.has_org_permission(${organizations.id},'ORG_PROFILE_MANAGE') or lub.has_org_permission(${organizations.id},'COMMITTEE_MANAGE') or exists(select 1 from lub.committees c where c.organization_id=${organizations.id} and (lub.has_org_permission(${organizations.id},'COMMITTEE_PROFILE_MANAGE',c.id) or lub.has_org_permission(${organizations.id},'MEMBERS_VIEW',c.id))))`;

export async function getManagementAccess(userId: string) {
  return withUser(userId, tx => readManagementAccess(tx, userId));
}
export async function canManageOrganizationSettings(userId: string, organizationId: string) {
  return withUser(userId, async tx => {
    const [row] = await tx.select({
      allowed: sql<boolean>`lub.is_super_admin() or lub.has_org_permission(${organizationId},'ORG_PROFILE_MANAGE') or lub.has_org_permission(${organizationId},'COMMITTEE_MANAGE') or exists(select 1 from lub.committees c where c.organization_id=${organizationId} and lub.has_org_permission(${organizationId},'COMMITTEE_PROFILE_MANAGE',c.id))`,
    }).from(organizations).where(eq(organizations.id, organizationId)).limit(1);
    return Boolean(row?.allowed);
  });
}
async function readManagementAccess(tx: Transaction, userId: string) {
    const [account] = await tx.select({ superAdmin: sql<boolean>`lub.is_super_admin()`, status: users.statusCode }).from(users).where(eq(users.id, userId)).limit(1);
    if (!account || account.status !== "Active") return { superAdmin: false, organizations: [] };
    const accessible = await tx.select(manageFields).from(organizations).where(hasScopedAccess).orderBy(asc(organizations.nameAr));
    return { superAdmin: account.superAdmin, organizations: accessible };
}

type ManagementOverview = {
  readiness: { status: string | undefined; onboarded: boolean };
  displayName: string | null;
  access: { superAdmin: boolean; organizations: Array<{ id: string; slug: string; nameAr: string; statusCode: string; pendingApplications: number; canEdit: boolean; canManageCommittees: boolean; canApplications: boolean; canEvents: boolean; canReports: boolean; canHours: boolean; canRenewals: boolean; canTasks: boolean; canMembers: boolean; canGrant: boolean }> };
  summary: { activeOrganizations: number; archivedOrganizations: number; administrators: number };
};
const managementOverviewRequests = new Map<string, { expiresAt: number; result: Promise<ManagementOverview> }>();

export function getManagementOverview(userId: string, requestNonce?: string): Promise<ManagementOverview> {
  if (!requestNonce) return readManagementOverview(userId);
  const now = Date.now();
  for (const [key, entry] of managementOverviewRequests) if (entry.expiresAt <= now) managementOverviewRequests.delete(key);
  const key = `${requestNonce}:${userId}`;
  const existing = managementOverviewRequests.get(key);
  if (existing) return existing.result;
  if (managementOverviewRequests.size >= 128) {
    const oldest = managementOverviewRequests.keys().next().value;
    if (oldest) managementOverviewRequests.delete(oldest);
  }
  const entry = { expiresAt: now + 10_000, result: readManagementOverview(userId) };
  managementOverviewRequests.set(key, entry);
  void entry.result.catch(() => { if (managementOverviewRequests.get(key) === entry) managementOverviewRequests.delete(key); });
  return entry.result;
}

async function readManagementOverview(userId: string): Promise<ManagementOverview> {
  const [row] = await getDb().execute<{
    status: string | null;
    onboarded: boolean;
    superAdmin: boolean;
    displayName: string | null;
    managed: ManagementOverview["access"]["organizations"];
    activeOrganizations: number;
    archivedOrganizations: number;
    administrators: number;
  }>(sql`
    with prior_scope as materialized (
      select current_setting('request.jwt.claim.sub', true) as previous_subject,
        current_setting('role', true) as previous_role
    ), verified_subject as materialized (
      select set_config('request.jwt.claim.sub', ${userId}, true),
        set_config('role', 'authenticated', true), previous_subject, previous_role
      from prior_scope
    ), account as materialized (
      select u.status_code as status,
        exists(select 1 from lub.student_profiles p where p.user_id = u.id) as onboarded,
        lub.is_super_admin() as super_admin,
        (select p.full_name_ar from lub.student_profiles p where p.user_id=u.id) as display_name
      from verified_subject, lub.users u
      where u.id = ${userId}::uuid
    ), overview as materialized (
      select status, onboarded, super_admin as "superAdmin", display_name as "displayName",
      case when super_admin then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object('id',o.id,'slug',o.slug,'nameAr',o.name_ar,'statusCode',o.status_code,'pendingApplications',case when lub.has_application_access(o.id) then (select count(*)::int from lub.membership_applications a join lub.registration_rounds r on r.id=a.registration_round_id where r.organization_id=o.id and a.status_code in ('Submitted','Interview') and lub.can_read_application(a.id,'APPLICATIONS_VIEW')) else 0 end,'canEdit',lub.has_org_permission(o.id,'ORG_PROFILE_MANAGE'),'canManageCommittees',lub.has_org_permission(o.id,'COMMITTEE_MANAGE') or exists(select 1 from lub.committees c where c.organization_id=o.id and lub.has_org_permission(o.id,'COMMITTEE_PROFILE_MANAGE',c.id)),'canApplications',lub.has_application_access(o.id),'canEvents',lub.has_event_access(o.id),'canReports',lub.has_reports_access(o.id),'canHours',lub.has_hours_access(o.id),'canRenewals',lub.has_org_permission(o.id,'RENEWALS_MANAGE'),'canTasks',lub.has_task_access(o.id),'canMembers',lub.has_org_permission(o.id,'MEMBERS_VIEW') or lub.has_org_permission(o.id,'MEMBERS_MANAGE') or exists(select 1 from lub.committees c where c.organization_id=o.id and lub.has_org_permission(o.id,'MEMBERS_VIEW',c.id)),'canGrant',lub.has_org_permission(o.id,'PERMISSIONS_GRANT')) order by o.name_ar,o.id)
        from lub.organizations o
        where lub.has_event_access(o.id) or lub.has_reports_access(o.id) or lub.has_hours_access(o.id) or lub.has_task_access(o.id) or lub.has_application_access(o.id) or lub.has_org_permission(o.id,'MEMBERS_VIEW') or lub.has_org_permission(o.id,'MEMBERS_MANAGE') or lub.has_org_permission(o.id,'PERMISSIONS_GRANT') or lub.has_org_permission(o.id,'RENEWALS_MANAGE') or lub.has_org_permission(o.id,'ORG_PROFILE_MANAGE') or lub.has_org_permission(o.id,'COMMITTEE_MANAGE') or exists(select 1 from lub.committees c where c.organization_id=o.id and (lub.has_org_permission(o.id,'COMMITTEE_PROFILE_MANAGE',c.id) or lub.has_org_permission(o.id,'MEMBERS_VIEW',c.id)))
      ),'[]'::jsonb) end as managed,
      case when super_admin then (select count(*)::int from lub.organizations where status_code='Active') else 0 end as "activeOrganizations",
      case when super_admin then (select count(*)::int from lub.organizations where status_code='Archived') else 0 end as "archivedOrganizations",
      case when super_admin then (select count(*)::int from lub.list_super_admins()) else 0 end as administrators
      from account
    ), restored_scope as materialized (
      select set_config('request.jwt.claim.sub', coalesce(previous_subject, ''), true),
        set_config('role', coalesce(previous_role, 'none'), true)
      from prior_scope cross join overview
    )
    select overview.* from overview cross join restored_scope
  `);
  return {
    readiness: { status: row?.status ?? undefined, onboarded: Boolean(row?.onboarded) },
    displayName: row?.displayName ?? null,
    access: { superAdmin: Boolean(row?.superAdmin), organizations: row?.managed ?? [] },
    summary: {
      activeOrganizations: row?.activeOrganizations ?? 0,
      archivedOrganizations: row?.archivedOrganizations ?? 0,
      administrators: row?.administrators ?? 0,
    },
  };
}
export type AdminOrganizationRow={id:string;slug:string;nameAr:string;typeCode:string;statusCode:string;logoUrl:string;leaderName:string|null;memberCount:number};
export type AdminOrganizationIdentity=Pick<AdminOrganizationRow,"id"|"slug"|"nameAr"|"typeCode"|"statusCode"|"leaderName">;
export type AdminDirectoryFilters={q:string;type:string;status:string;page:number};
export const getAdminOrganizations=cache(async(userId:string,filters:AdminDirectoryFilters={q:"",type:"",status:"",page:0})=>withUser(userId,async tx=>{
 const [row]=await tx.execute(sql`select case when lub.is_super_admin() then lub.admin_organization_directory(${filters.q},${filters.type},${filters.status},${filters.page*25}) end as data`);
 const data=row?.data as {organizations:AdminOrganizationRow[];total:number}|null;
 return data?{allowed:true,organizations:data.organizations,total:data.total}:{allowed:false,organizations:[] as AdminOrganizationRow[]};
}));

// The management layout and account page reuse this RLS-checked read only
// within the current server render; no account or permission data is shared across requests.
export const getAdminAccountProfile = cache(async (userId: string) => {
  const [profile] = await getDb().execute<{ allowed: boolean; email: string; fullName: string | null }>(sql`
    with verified_subject as materialized (
      select set_config('request.jwt.claim.sub', ${userId}, true), set_config('role', 'authenticated', true)
    )
    select lub.is_super_admin() as allowed, account.email, profile.full_name_ar as "fullName"
    from verified_subject
    cross join lub.users account
    left join lub.student_profiles profile on profile.user_id = account.id
    where account.id = ${userId}
  `);
  if (!profile?.allowed || !profile.fullName) throw new Error("FORBIDDEN");
  return { email: profile.email, fullName: profile.fullName };
});

export async function updateAdminAccountName(userId: string, fullName: string) {
  return withUser(userId, async tx => {
    const [access] = await tx.select({ allowed: sql<boolean>`lub.is_super_admin()` }).from(users).where(eq(users.id, userId)).limit(1);
    if (!access?.allowed) throw new Error("FORBIDDEN");
    const changed = await tx.update(studentProfiles).set({ fullNameAr: fullName, updatedAt: new Date() })
      .where(eq(studentProfiles.userId, userId)).returning({ userId: studentProfiles.userId });
    if (!changed.length) throw new Error("FORBIDDEN");
    await tx.insert(auditLog).values({
      actorUserId: userId,
      actionCode: "ADMIN_NAME_UPDATED",
      entityType: "system_administrator_profile",
      entityId: userId,
      metadata: {},
    });
  });
}
export async function getSuperAdmins(userId: string) {
  return withUser(userId, async tx => {
    const [result] = await tx.select({
      allowed: sql<boolean>`lub.is_super_admin()`,
      administrators: sql<Array<{ userId: string; fullName: string }>>`case when lub.is_super_admin() then coalesce((select jsonb_agg(jsonb_build_object('userId',a.user_id,'fullName',a.full_name) order by a.full_name) from lub.list_super_admins() a),'[]'::jsonb) else '[]'::jsonb end`,
    }).from(users).where(eq(users.id, userId)).limit(1);
    if (!result?.allowed) throw new Error("FORBIDDEN");
    return result.administrators;
  });
}
export async function getAssignedManagementOrganizations(userId: string) {
  return withUser(userId, tx => tx.select(manageFields).from(organizations).where(hasScopedAccess).orderBy(asc(organizations.nameAr)));
}
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

export type OrganizationMemberWorkspace = {
  canManage: boolean;
  canGrant: boolean;
  canAddHours: boolean;
  terms: Array<{ id: string; name: string; year: string; termCode: string; startDate: string; endDate: string }>;
  committees: Array<{ id: string; name: string }>;
  members: Array<{
    id: string; name: string; major: string; level: string; status: string; startDate: string; endDate: string | null;
    canManage: boolean; hours: number; roles: Array<{ code: string; committee: string | null }>;
    committees: Array<{ id: string; name: string }>; hourScopes: Array<{ id: string; name: string }>;
  }>;
};

export type OrganizationPermissionWorkspace = {
  members: Array<{ id: string; name: string }>;
  committees: Array<{ id: string; name: string }>;
  grants: Array<{ id: string; membership: string; member: string; code: string; committee: string | null; ends: string | null }>;
};

export async function getOrganizationMemberDirectory(userId: string, organizationId: string) {
  return withUser(userId, async tx => {
    const rows = await tx.execute(sql`select lub.organization_member_directory(${organizationId}) as workspace from lub.organizations where id=${organizationId} and (lub.has_org_permission(${organizationId},'MEMBERS_VIEW') or lub.has_org_permission(${organizationId},'MEMBERS_MANAGE') or exists(select 1 from lub.committees c where c.organization_id=${organizationId} and lub.has_org_permission(${organizationId},'MEMBERS_VIEW',c.id)))`);
    return rows[0]?.workspace as OrganizationMemberWorkspace | undefined;
  });
}

export async function getOrganizationPermissionWorkspace(userId: string, organizationId: string) {
  return withUser(userId, async tx => {
    const rows = await tx.execute<{ workspace: Omit<OrganizationPermissionWorkspace, "grants">; grants: OrganizationPermissionWorkspace["grants"] }>(sql`select lub.organization_permission_workspace(o.id) as workspace,
      coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'membership',g.organization_membership_id,'member',p.full_name_ar,'code',g.permission_code,'committee',c.name,'ends',g.end_at) order by p.full_name_ar,g.permission_code,g.id)
        from lub.permission_grants g join lub.organization_memberships m on m.id=g.organization_membership_id and m.organization_id=g.organization_id join lub.student_profiles p on p.user_id=m.user_id left join lub.committees c on c.id=g.committee_id
        where g.organization_id=o.id and g.permission_code<>'PERMISSIONS_GRANT' and g.start_at<=statement_timestamp() and (g.end_at is null or g.end_at>statement_timestamp())), '[]'::jsonb) as grants
      from lub.organizations o where o.id=${organizationId} and lub.has_org_permission(o.id,'PERMISSIONS_GRANT')`);
    const row = rows[0];
    return row ? { ...row.workspace, grants: row.grants } as OrganizationPermissionWorkspace : undefined;
  });
}

export async function grantOrganizationPermission(userId: string, memberId: string, capability: string, committeeId: string | null, ends: string | null) {
  return withUser(userId, tx => tx.execute(sql`select lub.grant_organization_permission(${memberId},${capability},${committeeId},${ends}::timestamptz)`));
}

export async function endOrganizationPermission(userId: string, grantId: string) {
  return withUser(userId, tx => tx.execute(sql`select lub.end_organization_permission(${grantId})`));
}

export async function endOrganizationMembership(userId: string, membershipId: string, reason: string) {
  return withUser(userId, tx => tx.execute(sql`select lub.end_organization_membership(${membershipId},${reason})`));
}

export async function getMembershipHistory(userId: string) {
  return withUser(userId, tx => tx.select({ id: organizationMemberships.id, organizationName: organizations.nameAr, slug: organizations.slug, organizationStatus: organizations.statusCode,
    statusCode: organizationMemberships.statusCode, startDate: organizationMemberships.startDate, endDate: organizationMemberships.endDate,
    roles: sql<Array<{ code: string; startDate: string; endDate: string | null }>>`coalesce((select jsonb_agg(jsonb_build_object('code',r.role_code,'startDate',r.start_date,'endDate',r.end_date) order by r.start_date,r.id) from lub.role_assignments r where r.organization_membership_id=lub.organization_memberships.id),'[]'::jsonb)`,
  }).from(organizationMemberships).innerJoin(organizations, eq(organizations.id, organizationMemberships.organizationId))
    .where(eq(organizationMemberships.userId, userId)).orderBy(asc(organizations.nameAr), asc(organizationMemberships.startDate)));
}

export async function createOrganization(userId: string, input: CreateOrganizationInput, leaderEmail?:string) {
  return withUser(userId, async tx => {
    await requireSuperAdmin(tx);
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(lub.arabic_search_key(${input.nameAr}),0))`);
    const [existing]=await tx.select({id:organizations.id}).from(organizations).where(sql`lub.arabic_search_key(${organizations.nameAr})=lub.arabic_search_key(${input.nameAr})`).limit(1);if(existing)throw new Error("ORGANIZATION_NAME_EXISTS");
    const [created]=await tx.insert(organizations).values(input).returning({id:organizations.id});
    if(leaderEmail)await tx.execute(sql`select lub.set_primary_leader(${created.id},${leaderEmail})`);
    return created;
  });
}
export async function appointPrimaryLeader(userId: string, organizationId: string, email: string) {
  return withUser(userId, async tx => { await requireSuperAdmin(tx); await tx.execute(sql`select lub.set_primary_leader(${organizationId},${email})`); });
}
export async function removePrimaryLeader(userId: string, organizationId: string) {
  return withUser(userId, async tx => { await requireSuperAdmin(tx); await tx.execute(sql`select lub.remove_primary_leader(${organizationId})`); });
}
export async function setOrganizationStatus(userId: string, organizationId: string, status: "Active" | "Inactive" | "Archived") {
  return withUser(userId, async tx => { await requireSuperAdmin(tx); await tx.execute(sql`select lub.set_organization_status(${organizationId},${status})`); });
}
export async function grantSuperAdmin(userId: string, email: string) {
  return withUser(userId, async tx => { await requireSuperAdmin(tx); await tx.execute(sql`select lub.grant_super_admin(${email})`); });
}
export async function endSuperAdmin(userId: string, targetUserId: string) {
  return withUser(userId, async tx => { await requireSuperAdmin(tx); if(userId === targetUserId) throw new Error("Cannot end own Super Admin permission"); await tx.execute(sql`select lub.end_super_admin(${targetUserId})`); });
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
