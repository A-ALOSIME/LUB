import "server-only";
import { eq,sql } from "drizzle-orm";
import { withUser } from "@/db/client";
import { users } from "@/db/schema";
import type { StudentProfile } from "@/features/profile/repository";
import type { getMembershipHistory,getManagementAccess } from "./management-repository";
// One scoped read supplies the personal dashboard. Never share-cache this data.
export async function getMyPageData(user:string) {
 return withUser(user,async tx=>{
 const [row]=await tx.select({
  status:users.statusCode,
  profile:sql<StudentProfile|null>`(select jsonb_build_object('fullName',p.full_name_ar,'major',p.major_name,'academicLevel',p.academic_level,'phone',u.phone,'publicProfileEnabled',s.public_profile_enabled,'showTotalHours',s.show_total_hours) from lub.student_profiles p join lub.users u on u.id=p.user_id join lub.profile_settings s on s.user_id=p.user_id where p.user_id=${user})`,
  superAdmin:sql<boolean>`lub.is_super_admin()`,
  organizations:sql<Awaited<ReturnType<typeof getManagementAccess>>["organizations"]>`coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'slug',o.slug,'nameAr',o.name_ar,'statusCode',o.status_code,'canEdit',lub.has_org_permission(o.id,'ORG_PROFILE_MANAGE'),'canManageCommittees',lub.has_org_permission(o.id,'COMMITTEE_MANAGE')) order by o.name_ar,o.id) from lub.organizations o where lub.has_event_access(o.id) or lub.has_reports_access(o.id) or lub.has_hours_access(o.id) or lub.has_task_access(o.id) or lub.has_application_access(o.id) or lub.has_org_permission(o.id,'ORG_PROFILE_MANAGE') or lub.has_org_permission(o.id,'COMMITTEE_MANAGE') or exists(select 1 from lub.committees c where c.organization_id=o.id and lub.has_org_permission(o.id,'COMMITTEE_PROFILE_MANAGE',c.id))),'[]')`,
  hours:sql<string>`coalesce((select sum(h.hours) from lub.hour_records h where h.status_code='Approved' and h.organization_membership_id in (select id from lub.organization_memberships where user_id=${user})),0)::text`,
  tasks:sql<Array<{id:string;title:string;status:string}>>`coalesce((select jsonb_agg(x) from (select t.id,t.title,p.status_code as status from lub.task_participants p join lub.tasks t on t.id=p.task_id where p.user_id=${user} order by p.joined_at desc,p.id limit 5) x),'[]')`,
  memberships:sql<Awaited<ReturnType<typeof getMembershipHistory>>>`coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'organizationName',o.name_ar,'slug',o.slug,'organizationStatus',o.status_code,'statusCode',m.status_code,'startDate',m.start_date,'endDate',m.end_date,'roles',coalesce((select jsonb_agg(jsonb_build_object('code',r.role_code,'startDate',r.start_date,'endDate',r.end_date) order by r.start_date,r.id) from lub.role_assignments r where r.organization_membership_id=m.id),'[]')) order by o.name_ar,m.start_date,m.id) from lub.organization_memberships m join lub.organizations o on o.id=m.organization_id where m.user_id=${user}),'[]')`,
 }).from(users).where(eq(users.id,user)).limit(1);
 return {status:row?.status,profile:row?.profile,access:{superAdmin:Boolean(row?.superAdmin),organizations:row?.organizations??[]},memberships:row?.memberships??[],tasks:row?.tasks??[],hours:row?.hours??"0"};
 });
}
