-- Retain every historical ID and FK. Only one row per student/organization is canonical.
lock table lub.organization_memberships in share row exclusive mode;
lock table lub.hour_records in share mode;
create temporary table membership_hours_before on commit drop as
 select m.user_id,m.organization_id,sum(h.hours) hours from lub.hour_records h join lub.organization_memberships m on m.id=h.organization_membership_id where h.status_code='Approved' group by m.user_id,m.organization_id;
create temporary table membership_ids_before on commit drop as select id from lub.organization_memberships;
alter table lub.organization_memberships add column merged_into uuid;
alter table lub.organization_memberships add constraint membership_identity_scope_unique unique(id,organization_id,user_id);
alter table lub.organization_memberships add constraint membership_canonical_scope_fk foreign key(merged_into,organization_id,user_id) references lub.organization_memberships(id,organization_id,user_id);
alter table lub.organization_memberships add constraint membership_canonical_not_self check(merged_into is null or merged_into<>id);
with ranked as(select id,first_value(id) over(partition by user_id,organization_id order by (status_code='Active' and end_date is null) desc,start_date desc,created_at,id) canonical from lub.organization_memberships)
 update lub.organization_memberships m set merged_into=r.canonical from ranked r where m.id=r.id and m.id<>r.canonical;
create unique index membership_one_canonical_idx on lub.organization_memberships(user_id,organization_id) where merged_into is null;
alter table lub.membership_applications drop constraint membership_applications_accepted_membership_id_unique;
create index application_accepted_membership_idx on lub.membership_applications(accepted_membership_id) where accepted_membership_id is not null;
--> statement-breakpoint
create table lub.membership_events(
 id uuid primary key default gen_random_uuid(),
 membership_id uuid not null references lub.organization_memberships(id),
 source_membership_id uuid not null references lub.organization_memberships(id),
 event_code text not null check(event_code in ('Joined','Ended','Rejoined','StatusChanged')),
 occurred_at timestamptz not null,
 actor_user_id uuid references lub.users(id),
 imported boolean not null default false,
 status_code text not null check(status_code in ('Active','Inactive','Ended'))
);
create index membership_events_timeline_idx on lub.membership_events(membership_id,occurred_at desc,id);
create unique index membership_events_import_idx on lub.membership_events(source_membership_id,event_code) where imported;
alter table lub.membership_events enable row level security;
revoke all on lub.membership_events from public,anon,authenticated;
grant select on lub.membership_events to authenticated;
create policy membership_events_scoped_read on lub.membership_events for select to authenticated using(exists(
 select 1 from lub.organization_memberships m where m.id=membership_id and (
 m.user_id=auth.uid() or lub.has_org_permission(m.organization_id,'MEMBERS_VIEW') or exists(select 1 from lub.committee_memberships cm where cm.organization_membership_id in(select id from lub.organization_memberships history where history.user_id=m.user_id and history.organization_id=m.organization_id) and lub.has_org_permission(m.organization_id,'MEMBERS_VIEW',cm.committee_id))
 )));
insert into lub.membership_events(membership_id,source_membership_id,event_code,occurred_at,actor_user_id,imported,status_code)
 select coalesce(m.merged_into,m.id),m.id,'Joined',m.start_date::timestamp at time zone 'Asia/Riyadh',
 (select a.actor_user_id from lub.audit_log a where a.entity_id=m.id and a.action_code='ORGANIZATION_MEMBERSHIPS_INSERT' order by a.created_at,a.id limit 1),true,'Active' from lub.organization_memberships m;
insert into lub.membership_events(membership_id,source_membership_id,event_code,occurred_at,actor_user_id,imported,status_code)
 select coalesce(m.merged_into,m.id),m.id,'Ended',m.end_date::timestamp at time zone 'Asia/Riyadh',
 (select a.actor_user_id from lub.audit_log a where a.entity_id=m.id and a.action_code='ORGANIZATION_MEMBERSHIP_ENDED' order by a.created_at desc,a.id limit 1),true,'Ended' from lub.organization_memberships m where m.end_date is not null;
--> statement-breakpoint
create function lub.guard_canonical_membership() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' and old.merged_into is not null and new is distinct from old then raise exception 'Historical membership is immutable';end if;
 if new.merged_into is not null and not exists(select 1 from lub.organization_memberships m where m.id=new.merged_into and m.merged_into is null and m.user_id=new.user_id and m.organization_id=new.organization_id) then raise exception 'Canonical membership required';end if;
 return new;
end;$$;
create trigger canonical_membership_guard before insert or update on lub.organization_memberships for each row execute function lub.guard_canonical_membership();
create function lub.record_membership_event() returns trigger language plpgsql security definer set search_path='' as $$
declare code text;
begin
 if new.merged_into is not null then return null;end if;
 if tg_op='INSERT' then code:='Joined';
 elsif old.status_code is not distinct from new.status_code then return null;
 elsif new.status_code='Ended' then code:='Ended';
 elsif new.status_code='Active' and old.status_code='Ended' then code:='Rejoined';
 else code:='StatusChanged';end if;
 insert into lub.membership_events(membership_id,source_membership_id,event_code,occurred_at,actor_user_id,status_code) values(new.id,new.id,code,clock_timestamp(),auth.uid(),new.status_code);
 return null;
end;$$;
create trigger membership_lifecycle_event after insert or update of status_code on lub.organization_memberships for each row execute function lub.record_membership_event();
revoke all on function lub.guard_canonical_membership(),lub.record_membership_event() from public,anon,authenticated;
--> statement-breakpoint
create function lub.ensure_current_membership(target_org uuid,target_user uuid,application uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
declare member lub.organization_memberships;
begin
 perform pg_advisory_xact_lock(hashtextextended(target_org::text||':'||target_user::text,0));
 if not exists(select 1 from lub.organizations where id=target_org and status_code='Active') or not lub.is_student_account(target_user) or not exists(select 1 from lub.users where id=target_user and status_code='Active' and email_verified_at is not null) then raise exception 'Active student and organization required';end if;
 select * into member from lub.organization_memberships where organization_id=target_org and user_id=target_user and merged_into is null for update;
 if not found then
  insert into lub.organization_memberships(organization_id,user_id,source_application_id) values(target_org,target_user,application) returning * into member;
 elsif member.status_code<>'Active' or member.end_date is not null then
  update lub.organization_memberships set status_code='Active',start_date=current_date,end_date=null,ended_reason=null,source_application_id=coalesce(application,source_application_id),updated_at=statement_timestamp() where id=member.id;
 elsif member.start_date>current_date then raise exception 'Membership not started';end if;
 return member.id;
end;$$;
revoke all on function lub.ensure_current_membership(uuid,uuid,uuid) from public,anon,authenticated;
--> statement-breakpoint
do $$begin
 if exists((select user_id,organization_id,hours from membership_hours_before) except (select m.user_id,m.organization_id,sum(h.hours) from lub.hour_records h join lub.organization_memberships m on m.id=h.organization_membership_id where h.status_code='Approved' group by m.user_id,m.organization_id))
 or exists((select m.user_id,m.organization_id,sum(h.hours) from lub.hour_records h join lub.organization_memberships m on m.id=h.organization_membership_id where h.status_code='Approved' group by m.user_id,m.organization_id) except (select user_id,organization_id,hours from membership_hours_before))
 then raise exception 'Membership migration changed approved hours';end if;
 if exists(select id from membership_ids_before except select id from lub.organization_memberships) then raise exception 'Historical membership IDs must remain';end if;
end;$$;

--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.has_org_permission(target_org uuid, capability text, target_committee uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$

 SELECT lub.is_student_account(auth.uid()) AND capability IN ('ORG_PROFILE_MANAGE','COMMITTEE_MANAGE','COMMITTEE_PROFILE_MANAGE','MEMBERS_VIEW','MEMBERS_MANAGE','FORMS_MANAGE','REGISTRATION_ROUNDS_MANAGE','APPLICATIONS_VIEW','APPLICATIONS_REVIEW','APPLICATIONS_BULK_ACTION','PERMISSIONS_GRANT','TASKS_MANAGE','TASK_TEMPLATES_MANAGE','HOUR_RULES_MANAGE','HOURS_APPROVE','HOURS_MANUAL_ADD','RENEWALS_MANAGE','REPORTS_GENERATE','EVENTS_MANAGE','EVENT_ATTENDANCE_MANAGE','EVENT_CONTRIBUTIONS_MANAGE')

 AND EXISTS(SELECT 1 FROM lub.organizations WHERE id=target_org AND status_code='Active')

 AND (target_committee IS NULL OR EXISTS(SELECT 1 FROM lub.committees WHERE id=target_committee AND organization_id=target_org AND status_code='Active'))

 AND EXISTS(SELECT 1 FROM lub.organization_memberships m JOIN lub.users u ON u.id=m.user_id WHERE u.id=auth.uid() AND u.status_code='Active' AND m.organization_id=target_org AND EXISTS(SELECT 1 FROM lub.organization_memberships canonical WHERE canonical.user_id=m.user_id AND canonical.organization_id=m.organization_id AND canonical.merged_into IS NULL AND canonical.status_code='Active' AND canonical.start_date<=current_date AND (canonical.end_date IS NULL OR canonical.end_date>current_date)) AND m.status_code='Active' AND m.start_date<=current_date AND (m.end_date IS NULL OR m.end_date>current_date)

 AND (EXISTS(SELECT 1 FROM lub.role_assignments r WHERE r.organization_membership_id=m.id AND r.start_date<=current_date AND (r.end_date IS NULL OR r.end_date>current_date) AND ((r.role_code='OL' OR (r.role_code='OD' AND capability NOT IN ('MEMBERS_VIEW','MEMBERS_MANAGE','PERMISSIONS_GRANT'))) OR ((r.role_code='CL' OR (r.role_code='CD' AND capability<>'MEMBERS_VIEW')) AND r.committee_id=target_committee AND capability IN ('COMMITTEE_PROFILE_MANAGE','MEMBERS_VIEW','TASKS_MANAGE','TASK_TEMPLATES_MANAGE','HOUR_RULES_MANAGE','HOURS_APPROVE','HOURS_MANUAL_ADD'))))

 OR EXISTS(SELECT 1 FROM lub.permission_grants g WHERE capability<>'PERMISSIONS_GRANT' AND g.organization_membership_id=m.id AND g.permission_code=capability AND g.start_at<=statement_timestamp() AND (g.end_at IS NULL OR g.end_at>statement_timestamp()) AND (g.committee_id IS NULL OR g.committee_id=target_committee))));

$function$;

--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.organization_member_directory(org uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$

DECLARE result jsonb;

BEGIN

 IF NOT lub.has_org_permission(org,'MEMBERS_VIEW') AND NOT lub.has_org_permission(org,'MEMBERS_MANAGE') AND NOT EXISTS(SELECT 1 FROM lub.committees c WHERE c.organization_id=org AND lub.has_org_permission(org,'MEMBERS_VIEW',c.id)) THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;

 SELECT jsonb_build_object(

  'canManage',lub.has_org_permission(org,'MEMBERS_MANAGE'),

  'canGrant',lub.has_org_permission(org,'PERMISSIONS_GRANT'),

  'canAddHours',lub.has_org_permission(org,'HOURS_MANUAL_ADD'),

  'terms',coalesce((SELECT jsonb_agg(jsonb_build_object('id',t.id,'name',t.name_ar,'year',t.academic_year,'termCode',t.term_code,'startDate',t.start_date,'endDate',t.end_date) ORDER BY t.start_date DESC,t.id) FROM (SELECT id,name_ar,academic_year,term_code,start_date,end_date FROM lub.academic_terms ORDER BY start_date DESC,id LIMIT 30) t),'[]'::jsonb),

  'committees',coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'name',c.name) ORDER BY c.name,c.id) FROM lub.committees c WHERE c.organization_id=org AND c.status_code='Active' AND (lub.has_org_permission(org,'MEMBERS_VIEW') OR lub.has_org_permission(org,'MEMBERS_MANAGE') OR lub.has_org_permission(org,'MEMBERS_VIEW',c.id))),'[]'::jsonb),

  'members',coalesce((SELECT jsonb_agg(row_data ORDER BY member_name,member_id) FROM (

   SELECT jsonb_build_object(

    'id',m.id,'name',p.full_name_ar,'major',p.major_name,'level',p.academic_level,'status',m.status_code,'startDate',m.start_date,'endDate',m.end_date,

    'canManage',m.status_code='Active' AND lub.has_org_permission(org,'MEMBERS_MANAGE'),

    'hours',coalesce((SELECT sum(h.hours) FROM lub.hour_records h WHERE h.organization_membership_id in(select history.id from lub.organization_memberships history where history.user_id=m.user_id and history.organization_id=m.organization_id) AND h.organization_id=org AND h.status_code='Approved' AND (lub.has_org_permission(org,'MEMBERS_VIEW') OR (h.committee_id IS NOT NULL AND lub.has_org_permission(org,'MEMBERS_VIEW',h.committee_id)))),0),

    'roles',coalesce((SELECT jsonb_agg(jsonb_build_object('code',r.role_code,'committee',c.name) ORDER BY r.role_code,c.name) FROM lub.role_assignments r LEFT JOIN lub.committees c ON c.id=r.committee_id WHERE r.organization_membership_id=m.id AND r.start_date<=current_date AND (r.end_date IS NULL OR r.end_date>current_date) AND (lub.has_org_permission(org,'MEMBERS_VIEW') OR lub.has_org_permission(org,'MEMBERS_MANAGE') OR (r.committee_id IS NOT NULL AND lub.has_org_permission(org,'MEMBERS_VIEW',r.committee_id)))),'[]'::jsonb),

    'committees',coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'name',c.name) ORDER BY c.name,c.id) FROM lub.committee_memberships cm JOIN lub.committees c ON c.id=cm.committee_id WHERE cm.organization_membership_id=m.id AND cm.status_code='Active' AND cm.start_date<=current_date AND (cm.end_date IS NULL OR cm.end_date>current_date) AND (lub.has_org_permission(org,'MEMBERS_VIEW') OR lub.has_org_permission(org,'MEMBERS_VIEW',c.id))),'[]'::jsonb),

    'hourScopes',coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'name',c.name) ORDER BY c.name,c.id) FROM lub.committee_memberships cm JOIN lub.committees c ON c.id=cm.committee_id WHERE cm.organization_membership_id=m.id AND cm.status_code='Active' AND cm.start_date<=current_date AND (cm.end_date IS NULL OR cm.end_date>current_date) AND c.status_code='Active' AND lub.has_org_permission(org,'HOURS_MANUAL_ADD',c.id)),'[]'::jsonb)

   ) AS row_data,m.id AS member_id,p.full_name_ar AS member_name

   FROM lub.organization_memberships m JOIN lub.student_profiles p ON p.user_id=m.user_id JOIN lub.users u ON u.id=m.user_id

   WHERE m.merged_into IS NULL AND lub.is_student_account(m.user_id) AND m.organization_id=org AND u.status_code='Active' AND (((lub.has_org_permission(org,'MEMBERS_VIEW') OR lub.has_org_permission(org,'MEMBERS_MANAGE')) AND m.status_code IN ('Active','Ended','Inactive')) OR (m.status_code='Active' AND EXISTS(SELECT 1 FROM lub.committee_memberships cm JOIN lub.committees c ON c.id=cm.committee_id WHERE cm.organization_membership_id=m.id AND cm.status_code='Active' AND cm.start_date<=current_date AND (cm.end_date IS NULL OR cm.end_date>current_date) AND lub.has_org_permission(org,'MEMBERS_VIEW',c.id))))

   ORDER BY p.full_name_ar,m.id LIMIT 500

  ) members_page),'[]'::jsonb)

 ) INTO result;

 RETURN result;

END; $function$;

--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.set_primary_leader(target_org uuid, candidate_email text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$

DECLARE candidate uuid; membership uuid; current_leader uuid;

BEGIN

  IF NOT lub.is_super_admin() THEN RAISE EXCEPTION 'Super Admin required' USING ERRCODE = '42501'; END IF;

  PERFORM 1 FROM lub.organizations WHERE id=target_org FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Organization required'; END IF;

  SELECT u.id INTO candidate FROM lub.users u JOIN lub.student_profiles p ON p.user_id = u.id

    WHERE lub.is_student_account(u.id) AND u.email = lower(trim(candidate_email)) AND u.status_code = 'Active' AND u.email_verified_at IS NOT NULL;

  IF candidate IS NULL THEN RAISE EXCEPTION 'Verified onboarded candidate required'; END IF;

  SELECT m.user_id INTO current_leader FROM lub.role_assignments r JOIN lub.organization_memberships m ON m.id = r.organization_membership_id

    WHERE r.organization_id = target_org AND r.is_primary_leader AND r.end_date IS NULL;

  IF current_leader = candidate THEN RETURN; END IF;

  SELECT id INTO membership FROM lub.organization_memberships WHERE organization_id = target_org AND user_id = candidate AND merged_into IS NULL AND status_code = 'Active' AND end_date IS NULL;

  IF membership IS NULL THEN

    membership:=lub.ensure_current_membership(target_org,candidate,null);

  ELSE

    IF EXISTS (SELECT 1 FROM lub.organization_memberships WHERE id = membership AND start_date > current_date) THEN RAISE EXCEPTION 'Membership not started'; END IF;

  END IF;

  UPDATE lub.role_assignments SET end_date = current_date WHERE organization_id = target_org AND is_primary_leader AND end_date IS NULL;

  INSERT INTO lub.role_assignments(organization_membership_id,organization_id,role_code,is_primary_leader,assigned_by_user_id)

    VALUES(membership,target_org,'OL',true,auth.uid());

END;

$function$;

--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.apply_decision(target uuid, status text, message text, bulk uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$

DECLARE a lub.membership_applications; r lub.registration_rounds; member uuid;

BEGIN

 IF status='Rejected' AND length(coalesce(message,''))>1000 THEN RAISE EXCEPTION 'Reason too long';END IF;

 SELECT rr.* INTO r FROM lub.registration_rounds rr JOIN lub.membership_applications aa ON aa.registration_round_id=rr.id WHERE aa.id=target FOR UPDATE OF rr;

 SELECT * INTO a FROM lub.membership_applications WHERE id=target FOR UPDATE;

 IF a.id IS NULL OR a.status_code NOT IN ('Submitted','Interview') OR status NOT IN ('Accepted','Rejected','Interview') OR r.status_code='Archived' OR NOT lub.can_read_application(target,CASE WHEN bulk IS NULL THEN 'APPLICATIONS_REVIEW' ELSE 'APPLICATIONS_BULK_ACTION' END) THEN RAISE EXCEPTION 'Permission or invalid decision' USING ERRCODE='42501'; END IF;

 IF status='Interview' THEN INSERT INTO lub.application_messages(application_id,sender_user_id,body) VALUES(target,auth.uid(),trim(message)); END IF;

 IF status='Accepted' THEN

  IF a.requested_committee_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM lub.committees WHERE id=a.requested_committee_id AND organization_id=r.organization_id AND status_code='Active') THEN RAISE EXCEPTION 'Active committee required'; END IF;

  IF NOT EXISTS(SELECT 1 FROM lub.users WHERE id=a.applicant_user_id AND status_code='Active') THEN RAISE EXCEPTION 'Inactive applicant'; END IF;

  member:=lub.ensure_current_membership(r.organization_id,a.applicant_user_id,target);

  IF a.requested_committee_id IS NOT NULL THEN INSERT INTO lub.committee_memberships(organization_id,organization_membership_id,committee_id) VALUES(r.organization_id,member,a.requested_committee_id) ON CONFLICT (organization_membership_id,committee_id) WHERE status_code='Active' AND end_date IS NULL DO NOTHING; END IF;

 END IF;

 UPDATE lub.membership_applications SET status_code=status,status_revision=status_revision+1,accepted_membership_id=member,decided_at=CASE WHEN status IN ('Accepted','Rejected') THEN now() ELSE NULL END,decided_by_user_id=CASE WHEN status IN ('Accepted','Rejected') THEN auth.uid() ELSE NULL END WHERE id=target;

 INSERT INTO lub.application_status_history(application_id,from_status_code,to_status_code,changed_by_user_id,bulk_action_id,reason) VALUES(target,a.status_code,status,auth.uid(),bulk,CASE WHEN status='Rejected' THEN nullif(trim(message),'') END);

 PERFORM lub.application_audit(target,r.organization_id,'APPLICATION_'||upper(status)); RETURN member;

END; $function$;

--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.respond_renewal(target uuid,response text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE campaign uuid; c lub.renewal_campaigns; r lub.membership_renewals;
BEGIN
 SELECT renewal_campaign_id INTO campaign FROM lub.membership_renewals WHERE id=target;
 SELECT * INTO c FROM lub.renewal_campaigns WHERE id=campaign FOR UPDATE;SELECT * INTO r FROM lub.membership_renewals WHERE id=target FOR UPDATE;
 IF r.id IS NULL OR NOT lub.owns_membership(r.organization_membership_id) OR NOT lub.task_scope_member(c.organization_id,NULL) OR NOT EXISTS(SELECT 1 FROM lub.organization_memberships WHERE id=r.organization_membership_id AND status_code='Active' AND start_date<=current_date AND (end_date IS NULL OR end_date>current_date)) OR EXISTS(SELECT 1 FROM lub.membership_events e WHERE e.membership_id=r.organization_membership_id AND e.event_code='Ended' AND e.occurred_at>=c.created_at) OR c.status_code<>'Open' OR statement_timestamp()<c.opens_at OR statement_timestamp()>=c.closes_at OR r.response_code<>'Pending' OR response IS NULL OR response NOT IN ('Renewed','Declined') THEN RAISE EXCEPTION 'Response unavailable' USING ERRCODE='42501'; END IF;
 UPDATE lub.membership_renewals SET response_code=response,responded_at=now() WHERE id=target;
 PERFORM lub.task_audit(target,c.organization_id,'RENEWAL_RESPONSE');
END; $$;

--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.end_organization_membership(target uuid, reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE membership lub.organization_memberships;
BEGIN
 SELECT * INTO membership FROM lub.organization_memberships WHERE id=target FOR UPDATE;
 IF membership.id IS NULL OR membership.merged_into IS NOT NULL OR membership.status_code<>'Active' OR membership.start_date>current_date OR (membership.end_date IS NOT NULL AND membership.end_date<=current_date) OR NOT lub.has_org_permission(membership.organization_id,'MEMBERS_MANAGE') OR reason IS NULL OR length(trim(reason)) NOT BETWEEN 3 AND 500 THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM lub.role_assignments r WHERE r.organization_membership_id IN(SELECT id FROM lub.organization_memberships WHERE user_id=membership.user_id AND organization_id=membership.organization_id) AND r.role_code='OL' AND r.end_date IS NULL) THEN RAISE EXCEPTION 'Use primary leader appointment to end the active primary leader'; END IF;
 UPDATE lub.organization_memberships SET status_code='Ended',end_date=current_date,ended_reason=trim(reason),updated_at=statement_timestamp() WHERE id=target;
 UPDATE lub.committee_memberships SET status_code='Ended',end_date=current_date WHERE organization_membership_id IN(SELECT id FROM lub.organization_memberships WHERE user_id=membership.user_id AND organization_id=membership.organization_id) AND status_code='Active' AND end_date IS NULL;
 UPDATE lub.role_assignments SET end_date=current_date WHERE organization_membership_id IN(SELECT id FROM lub.organization_memberships WHERE user_id=membership.user_id AND organization_id=membership.organization_id) AND end_date IS NULL;
 UPDATE lub.permission_grants SET end_at=greatest(start_at+interval '1 microsecond',statement_timestamp()) WHERE organization_membership_id IN(SELECT id FROM lub.organization_memberships WHERE user_id=membership.user_id AND organization_id=membership.organization_id) AND (end_at IS NULL OR end_at>statement_timestamp());
 INSERT INTO lub.audit_log(actor_user_id,action_code,entity_type,entity_id,organization_id,metadata) VALUES(auth.uid(),'ORGANIZATION_MEMBERSHIP_ENDED','organization_membership',target,membership.organization_id,'{}'::jsonb);
END; $function$
;
