import "server-only";
import type {OrganizationMemberWorkspace,EncryptedMemberWorkspace,MemberFilters} from "./member-types";
import {initialMemberFilters} from "./member-types";
import {decodeMemberWorkspace} from "./member-identifiers";
import { cache } from "react";
import { asc, eq, sql } from "drizzle-orm";
import { withUser, type Transaction } from "@/db/client";
import { users, organizations } from "@/db/schema";
import { normalizeOrganizationContact, storedLinksToContactChannels } from "./contact-channels";
import { normalizePublicTags } from "./public-repository";
import {announcementSchema} from "./validation";
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

async function readManagementOverview(userId:string):Promise<ManagementOverview>{
 return withUser(userId,async tx=>{
  const [row]=await tx.execute<{data:ManagementOverview}>(sql`select lub.management_overview() as data`);
  return {...row.data,readiness:{...row.data.readiness,status:row.data.readiness.status??undefined}};
 });
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
export const getAdminAccountProfile=cache(async(userId:string)=>withUser(userId,async tx=>{
 const [profile]=await tx.execute<{email:string;fullName:string|null}>(sql`
  select email,full_name_ar as "fullName" from lub.users where id=auth.uid() and lub.is_super_admin()
 `);
 if(!profile?.fullName)throw new Error("FORBIDDEN");
 return {email:profile.email,fullName:profile.fullName};
}));

export async function updateAdminAccountName(userId:string,fullName:string){
 await withUser(userId,async tx=>{
  const [access]=await tx.execute<{allowed:boolean}>(sql`select lub.is_super_admin() as allowed`);
  if(!access?.allowed)throw new Error("FORBIDDEN");
  await tx.execute(sql`select lub.update_admin_display_name(${fullName})`);
 });
}
export async function getSuperAdmins(userId:string){return withUser(userId,async tx=>{
 const [row]=await tx.execute(sql`select case when lub.is_super_admin() then (select coalesce(jsonb_agg(a),'[]'::jsonb) from lub.admin_account_directory() a) end as data`);
 if(!row?.data)throw new Error("FORBIDDEN");
 return row.data as Array<{userId:string;fullName:string;email:string}>;
});}
export async function getAssignedManagementOrganizations(userId: string) {
  return withUser(userId, tx => tx.select(manageFields).from(organizations).where(hasScopedAccess).orderBy(asc(organizations.nameAr)));
}
type ManagedOrganization = Pick<typeof organizations.$inferSelect, "id" | "slug" | "nameAr" | "typeCode" | "statusCode"
  | "summary" | "mission" | "publicProfileContent" | "logoUrl" | "linksCustomized" | "showLeadershipPublicly"> & {
  canEdit: boolean; canManageCommittees: boolean; canEvents: boolean; canReports: boolean; canHours: boolean;
  canRenewals: boolean; canTasks: boolean; canApplications: boolean; canMembers: boolean; canGrant: boolean;
  adminIdentity: { slug: string; typeCode: string; statusCode: string; leaderName: string | null } | null;
};
type ManagedCommittee = {
  id: string; name: string; description: string; isPublic: boolean; statusCode: string;
  copiedFromCommitteeId: string | null; parentCommitteeId: string | null; canEdit: boolean; memberCount: number | null; leaderName: string | null;
};
export async function getManagementOrganization(userId: string, organizationId: string, administrative = false) {
  return withUser(userId, async tx => {
    const [row] = await tx.execute<ManagedOrganization & {
      interests: string[]; links: Array<{ kind: string; value: string }>; committees: ManagedCommittee[];
    }>(sql`
      select o.id,o.slug,o.name_ar as "nameAr",o.type_code as "typeCode",o.status_code as "statusCode",
        o.summary,o.mission,o.public_profile_content as "publicProfileContent",o.logo_url as "logoUrl",
        o.links_customized as "linksCustomized",o.show_leadership_publicly as "showLeadershipPublicly",o.interests,o.links,
        lub.has_org_permission(o.id,'ORG_PROFILE_MANAGE') or (${administrative} and lub.is_super_admin()) as "canEdit",
        case when ${administrative} and lub.is_super_admin() then lub.admin_organization_identity(o.id) end as "adminIdentity",
        lub.has_org_permission(o.id,'COMMITTEE_MANAGE') as "canManageCommittees",
        lub.has_event_access(o.id) as "canEvents",lub.has_reports_access(o.id) as "canReports",lub.has_hours_access(o.id) as "canHours",
        lub.has_org_permission(o.id,'RENEWALS_MANAGE') as "canRenewals",lub.has_task_access(o.id) as "canTasks",
        lub.has_application_access(o.id) as "canApplications",lub.has_scoped_capability(o.id,'MEMBERS_VIEW') as "canMembers",
        lub.has_org_permission(o.id,'PERMISSIONS_GRANT') as "canGrant",lub.organization_committee_editor(o.id) as committees
      from lub.organizations o where o.id=${organizationId} and (lub.has_management_access(o.id) or (${administrative} and lub.is_super_admin()))`);
    if (!row) return undefined;
    const { interests, links, committees, ...organization } = row;
    const contacts = links.flatMap(link => {
      const channel = normalizeOrganizationContact(link);
      return channel ? [{ linkType: channel.kind, url: channel.url }] : [];
    });
    return { organization, committees, tagNames: normalizePublicTags(interests), contacts };
  });
}

export type {OrganizationMemberWorkspace} from "./member-types";


export async function getOrganizationMemberDirectory(userId: string, organizationId: string, filters:MemberFilters=initialMemberFilters):Promise<OrganizationMemberWorkspace|undefined> {
  return withUser(userId, async tx => {
    const rows = await tx.execute(sql`select lub.organization_member_directory(${organizationId},${filters.q},${filters.status},${filters.committee},${(filters.page??0)*25},${filters.sort??"name:asc"},${filters.term??null}) as workspace from lub.organizations where id=${organizationId} and (lub.has_org_permission(${organizationId},'MEMBERS_VIEW') or lub.has_org_permission(${organizationId},'MEMBERS_MANAGE') or exists(select 1 from lub.committees c where c.organization_id=${organizationId} and lub.has_org_permission(${organizationId},'MEMBERS_VIEW',c.id)))`);
    return rows[0]?.workspace?decodeMemberWorkspace(rows[0].workspace as EncryptedMemberWorkspace):undefined;
  });
}

export async function endOrganizationMembership(userId: string, membershipId: string, reason: string) {
  return withUser(userId, tx => tx.execute(sql`select lub.end_organization_membership(${membershipId},${reason})`));
}

export type MembershipHistoryRow = {
  id: string; organizationName: string; logo: string | null; type: string; hours: string; slug: string; organizationStatus: string;
  statusCode: string; startDate: string; endDate: string | null;
  roles: Array<{ code: string; startDate: string; endDate: string | null; hours?: string }>;
};

export async function getMembershipHistory(userId: string) {
  return withUser(userId, async tx => {
    const [row] = await tx.execute<{ data: MembershipHistoryRow[] }>(sql`select lub.own_membership_history() as data`);
    return row?.data ?? [];
  });
}

export async function createOrganization(userId: string, input: CreateOrganizationInput, leaderEmail?: string) {
  return withUser(userId, async tx => {
    const [row] = await tx.execute<{ id: string }>(sql`
      select lub.admin_create_organization(
        ${input.nameAr}, ${input.typeCode}, ${input.slug}, ${input.summary}, ${input.mission}, ${leaderEmail ?? null}, ${input.nameEn ?? null}
      ) as id`);
    return { id: row.id };
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

export async function saveOrganizationProfile(userId: string, organizationId: string, input: OrganizationProfileInput) {
  const { tagNames, contacts, ...profile } = input;
  const channels = storedLinksToContactChannels(contacts);
  if (channels.length !== contacts.length) throw new Error("Invalid organization links");
  await withUser(userId, tx => tx.execute(sql`select lub.save_organization_profile(
    ${organizationId},${JSON.stringify(profile)}::jsonb,${JSON.stringify(tagNames)}::jsonb,${JSON.stringify(channels)}::jsonb)`));
}

export async function saveOrganizationLogo(userId: string, organizationId: string, logoUrl: string) {
  return withUser(userId, async tx => {
    const [row] = await tx.execute<{ data: { previousLogoUrl: string; slug: string } }>(
      sql`select lub.save_organization_logo(${organizationId},${logoUrl}) as data`);
    return row.data;
  });
}

export async function saveAnnouncement(userId: string, organizationId: string, input: AnnouncementInput, announcementId?: string) {
 const value=announcementSchema.parse(input);
 return withUser(userId,async tx=>{
  const rows=await tx.execute(sql`select lub.save_announcement(${announcementId??null}::uuid,${organizationId},${value.title},${value.body},${value.externalUrl||null},${value.published},${value.pinned},${value.imageAssetId??null}::uuid,${value.replaceImage}) as id`);
  return String(rows[0]?.id);
 });
}
export async function changeAnnouncementState(userId:string,organizationId:string,announcementId:string,operation:"pin"|"archive"|"restore"|"delete",pinned=false){
 return withUser(userId,async tx=>{
  await requirePermission(tx,organizationId,"ANNOUNCEMENTS_MANAGE");
  const rows=await tx.execute(sql`select id from lub.organization_content where id=${announcementId} and organization_id=${organizationId} and kind='Announcement'`);if(!rows.length)throw new Error("FORBIDDEN");
  await tx.execute(sql`select lub.change_announcement_state(${announcementId},${operation},${pinned})`);
 });
}
export async function archiveAnnouncement(userId:string,organizationId:string,announcementId:string){return changeAnnouncementState(userId,organizationId,announcementId,"archive");}
export async function saveCommittee(userId: string, organizationId: string, input: CommitteeInput, committeeId?: string) {
  return withUser(userId, async tx => {
    const [row] = await tx.execute<{ id: string }>(sql`select lub.save_committee(
      ${organizationId},${committeeId ?? null},${input.name},${input.description},${input.isPublic},${input.parentCommitteeId}) as id`);
    return { id: row.id };
  });
}
export async function copyCommittee(userId: string, organizationId: string, committeeId: string) {
  return withUser(userId, async tx => {
    const [row] = await tx.execute<{ id: string }>(sql`select lub.copy_committee(${organizationId},${committeeId}) as id`);
    return { id: row.id };
  });
}
export async function setCommitteeStatus(userId: string, organizationId: string, committeeId: string, status: "Active" | "Archived") {
  await withUser(userId, tx => tx.execute(sql`select lub.set_committee_status(${organizationId},${committeeId},${status})`));
}
