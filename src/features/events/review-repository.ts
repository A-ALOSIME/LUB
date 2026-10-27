import "server-only";
import { sql } from "drizzle-orm";
import { withUser } from "@/db/client";
import type { Answers, FormDefinition } from "@/features/forms/definition";

export type EventRegistrant = {
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
  page = 0,
) {
  return withUser(user, async (tx) => {
    const rows = await tx.execute(
      sql`with all_rows as materialized(select r.id,r.event_id,p.full_name as name,p.major,p.level,e.title,r.registered_at as created_at,r.review_status_code,r.review_note,r.status_code,coalesce(a.status_code,'Pending') as attendance,(e.status_code='Published' and lub.can_operate_event(e.id)) as "canReview",lub.can_operate_event(e.id,'EVENT_ATTENDANCE_MANAGE') as "canAttend",lub.can_operate_event(e.id,'EVENT_CONTRIBUTIONS_MANAGE') as "canContribute",(e.status_code='Published' and statement_timestamp()>=e.ends_at) as "attendanceOpen",r.form_response_id from lub.event_registrations r join lub.events e on e.id=r.event_id join lub.event_registration_profiles(${org}) p on p.registration_id=r.id left join lub.event_attendance a on a.event_registration_id=r.id where e.organization_id=${org} and r.status_code='Registered' and (${event}::uuid is null or e.id=${event}::uuid) and position(lub.arabic_search_key(${q}) in lub.arabic_search_key(p.full_name))>0), filtered as(select * from all_rows where ${status}='' or review_status_code=${status}) select coalesce((select jsonb_agg(item) from(select f.*,fr.answers,v.definition,coalesce((select jsonb_agg(jsonb_build_object('status_code',h.status_code,'reason',h.reason,'created_at',h.created_at) order by h.created_at,h.id) from lub.event_registration_history h where h.event_registration_id=f.id),'[]') as history from filtered f left join lub.form_responses fr on fr.id=f.form_response_id left join lub.form_versions v on v.id=fr.form_version_id order by f.created_at desc,f.id limit 26 offset ${page * 25}) item),'[]') as items,(select count(*)::int from all_rows where review_status_code='Pending') as pending,(select count(*)::int from all_rows where review_status_code='Accepted') as accepted,(select count(*)::int from all_rows where review_status_code='Rejected') as rejected,coalesce((select jsonb_agg(e) from(select id,title from lub.events where organization_id=${org} and lub.has_event_access(${org}) order by starts_at desc,id limit 200) e),'[]') as options`,
    );
    return rows[0] as unknown as {
      items: EventRegistrant[];
      pending: number;
      accepted: number;
      rejected: number;
      options: Array<{ id: string; title: string }>;
    };
  });
}
