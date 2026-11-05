import "server-only";
import { sql } from "drizzle-orm";
import { withUser } from "@/db/client";
import type { Answers, FormDefinition } from "@/features/forms/definition";

export type EventRegistrant = {
  contributions?:Array<{kind:string;title:string}>;
  isTest?:boolean;
  has_contribution?:boolean;
  id: string;
  event_id: string;
  name: string;
  major: string;
  level: string;
  title: string;
  created_at: string;
  review_status_code: string;
  review_note: string;
  status_code: string;
  attendance: string;
  answers: Answers | null;
  definition: FormDefinition | null;
  canReview: boolean;
  canAttend: boolean;
  canContribute: boolean;
  attendanceOpen: boolean;
  history: Array<{ status_code: string; reason: string; created_at: string }>;
};
export async function eventRegistrants(
  user: string,
  org: string,
  event: string | null = null,
  q = "",
  status = "",
  page:number|null = 0,
  includeDetails=true,
  registration:string|null=null,
) {
  return withUser(user, async (tx) => {
    const rows = await tx.execute(
      sql`with all_rows as materialized(select r.id,r.event_id,p.full_name as name,p.major,p.level,e.title,r.registered_at as created_at,r.review_status_code,r.review_note,r.status_code,not lub.is_counted_student(r.user_id) as "isTest",exists(select 1 from lub.event_contributions contribution where contribution.event_id=e.id and contribution.user_id=r.user_id) as has_contribution,(select coalesce(jsonb_agg(jsonb_build_object('kind',c.contribution_type_code,'title',c.title) order by c.id),'[]') from lub.event_contributions c where c.event_id=e.id and c.user_id=r.user_id) as contributions,coalesce(a.status_code,'Pending') as attendance,(e.status_code='Published' and lub.can_operate_event(e.id,'EVENT_REGISTRATIONS_REVIEW')) as "canReview",lub.can_operate_event(e.id,'EVENT_ATTENDANCE_MANAGE') as "canAttend",lub.can_operate_event(e.id,'EVENT_CONTRIBUTIONS_MANAGE') as "canContribute",(e.status_code='Published' and statement_timestamp()>=e.ends_at) as "attendanceOpen",r.form_response_id from lub.event_registrations r join lub.events e on e.id=r.event_id join lub.event_registration_profiles(${org}) p on p.registration_id=r.id left join lub.event_attendance a on a.event_registration_id=r.id where e.organization_id=${org} and r.status_code='Registered' and (${registration}::uuid is null or r.id=${registration}::uuid) and (${event}::uuid is null or e.id=${event}::uuid) and position(lub.arabic_search_key(${q}) in lub.arabic_search_key(p.full_name))>0), filtered as(select * from all_rows where ${status}='' or (${status}='Recorded' and review_status_code='Accepted' and has_contribution) or (review_status_code=${status} and (${status}<>'Accepted' or not has_contribution))) select coalesce((select jsonb_agg(item) from(select f.*,${includeDetails?sql`fr.answers,v.definition,coalesce((select jsonb_agg(jsonb_build_object('status_code',h.status_code,'reason',h.reason,'created_at',h.created_at) order by h.created_at,h.id) from lub.event_registration_history h where h.event_registration_id=f.id),'[]') as history`:sql`null::jsonb as answers,null::jsonb as definition,'[]'::jsonb as history`} from filtered f ${includeDetails?sql`left join lub.form_responses fr on fr.id=f.form_response_id left join lub.form_versions v on v.id=fr.form_version_id`:sql``} order by f.created_at desc,f.id limit ${page===null?51:26} offset ${(page??0) * 25}) item),'[]') as items,(select count(*)::int from all_rows where not "isTest" and review_status_code='Pending') as pending,(select count(*)::int from all_rows where not "isTest" and review_status_code='Accepted' and not has_contribution) as accepted,(select count(*)::int from all_rows where not "isTest" and review_status_code='Rejected') as rejected,(select count(*)::int from all_rows where not "isTest" and review_status_code='Accepted' and has_contribution) as recorded,(lub.has_org_permission(${org},'REPORTS_GENERATE') or exists(select 1 from lub.committees c where c.organization_id=${org} and lub.has_org_permission(${org},'REPORTS_GENERATE',c.id))) as "canExport",coalesce((select jsonb_agg(e) from(select id,title,status_code,starts_at from lub.events where organization_id=${org} and lub.has_event_access(${org}) order by starts_at desc,id limit 200) e),'[]') as options`,
    );
    return rows[0] as unknown as {
      items: EventRegistrant[];
      pending: number;
      accepted: number;
      rejected: number;
      recorded?: number;
      canExport?:boolean;
      options: Array<{ id: string; title: string;status_code?:string;starts_at?:string }>;
    };
  });
}
