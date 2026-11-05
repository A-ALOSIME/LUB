-- Capabilities derive from current roles, not historic per-permission delegations.
ALTER TABLE lub.role_assignments DROP CONSTRAINT role_scope_check;
ALTER TABLE lub.role_assignments ADD CONSTRAINT role_scope_check CHECK(
 (role_code IN ('OL','OD','HRL','HRD') AND committee_id IS NULL) OR (role_code IN ('CL','CD') AND committee_id IS NOT NULL));
CREATE FUNCTION lub.is_hr_committee(target uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM lub.committees WHERE id=target AND lub.arabic_search_key(name) IN (
 lub.arabic_search_key('الموارد البشرية'),lub.arabic_search_key('لجنة الموارد البشرية'),lub.arabic_search_key('Human resources'),lub.arabic_search_key('HR')));
$$;
CREATE OR REPLACE FUNCTION lub.has_org_permission(target_org uuid,capability text,target_committee uuid DEFAULT NULL) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT lub.is_student_account(auth.uid())
 AND capability IN ('ORG_PROFILE_MANAGE','ANNOUNCEMENTS_MANAGE','COMMITTEE_MANAGE','COMMITTEE_PROFILE_MANAGE','MEMBERS_VIEW','MEMBERS_MANAGE','FORMS_MANAGE','REGISTRATION_ROUNDS_MANAGE','APPLICATIONS_VIEW','APPLICATIONS_REVIEW','APPLICATIONS_BULK_ACTION','PERMISSIONS_GRANT','TASKS_MANAGE','TASKS_REVIEW','TASK_TEMPLATES_MANAGE','HOURS_APPROVE','HOURS_MANUAL_ADD','RENEWALS_MANAGE','REPORTS_GENERATE','EVENTS_MANAGE','EVENT_REGISTRATIONS_REVIEW','EVENT_ATTENDANCE_MANAGE','EVENT_CONTRIBUTIONS_MANAGE')
 AND EXISTS(SELECT 1 FROM lub.organizations WHERE id=target_org AND status_code='Active')
 AND (target_committee IS NULL OR EXISTS(SELECT 1 FROM lub.committees WHERE id=target_committee AND organization_id=target_org AND status_code='Active'))
 AND EXISTS(SELECT 1 FROM lub.role_assignments r JOIN lub.organization_memberships m ON m.id=r.organization_membership_id JOIN lub.users u ON u.id=m.user_id
 WHERE m.organization_id=target_org AND m.user_id=auth.uid() AND u.status_code='Active' AND m.status_code='Active' AND m.merged_into IS NULL
 AND m.start_date<=current_date AND (m.end_date IS NULL OR m.end_date>current_date) AND (r.committee_id IS NULL OR EXISTS(SELECT 1 FROM lub.committees own_committee WHERE own_committee.id=r.committee_id AND own_committee.organization_id=target_org AND own_committee.status_code='Active')) AND r.start_date<=current_date AND (r.end_date IS NULL OR r.end_date>current_date)
 AND (
 r.role_code='OL'
 OR (r.role_code='OD' AND capability NOT IN ('ORG_PROFILE_MANAGE','COMMITTEE_MANAGE','COMMITTEE_PROFILE_MANAGE'))
 OR (r.role_code IN ('CL','CD','HRL','HRD') AND capability IN ('TASKS_MANAGE','TASK_TEMPLATES_MANAGE'))
 OR (r.role_code IN ('CL','CD') AND r.committee_id=target_committee AND capability IN ('MEMBERS_VIEW','TASKS_REVIEW','HOURS_MANUAL_ADD'))
 OR (r.role_code='CL' AND r.committee_id=target_committee AND capability IN ('HOURS_APPROVE','REPORTS_GENERATE'))
 OR (r.role_code IN ('HRL','HRD') AND target_committee IS NULL AND capability='TASKS_REVIEW')
 OR ((r.role_code IN ('HRL','HRD') OR (r.role_code IN ('CL','CD') AND lub.is_hr_committee(r.committee_id))) AND capability IN ('MEMBERS_VIEW','APPLICATIONS_VIEW','APPLICATIONS_REVIEW','APPLICATIONS_BULK_ACTION','HOURS_APPROVE','HOURS_MANUAL_ADD','EVENT_REGISTRATIONS_REVIEW','EVENT_ATTENDANCE_MANAGE','EVENT_CONTRIBUTIONS_MANAGE'))
 OR ((r.role_code='HRL' OR (r.role_code='CL' AND lub.is_hr_committee(r.committee_id))) AND capability IN ('EVENTS_MANAGE','RENEWALS_MANAGE','REPORTS_GENERATE'))
 ));
$$;
CREATE FUNCTION lub.can_review_task(target uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM lub.tasks WHERE id=target AND deleted_at IS NULL AND lub.has_org_permission(organization_id,'TASKS_REVIEW',committee_id));
$$;
CREATE OR REPLACE FUNCTION lub.can_read_task_submission(target uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM lub.task_submissions s JOIN lub.task_participants p ON p.id=s.task_participant_id WHERE s.id=target AND (lub.owns_task_participant(p.id) OR lub.can_review_task(p.task_id)));
$$;
REVOKE ALL ON FUNCTION lub.is_hr_committee(uuid),lub.can_review_task(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION lub.is_hr_committee(uuid),lub.can_review_task(uuid) TO authenticated;
--> statement-breakpoint
CREATE FUNCTION lub.change_member_role(target uuid,role text,committee uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE m lub.organization_memberships;org uuid;
BEGIN
 SELECT organization_id INTO org FROM lub.organization_memberships WHERE id=target;
 PERFORM 1 FROM lub.organizations WHERE id=org FOR UPDATE;
 SELECT * INTO m FROM lub.organization_memberships WHERE id=target FOR UPDATE;
 IF m.id IS NULL OR NOT lub.is_student_account(m.user_id) OR m.merged_into IS NOT NULL OR m.status_code<>'Active' OR m.start_date>current_date OR (m.end_date IS NOT NULL AND m.end_date<=current_date)
 OR NOT lub.has_org_permission(org,'PERMISSIONS_GRANT') OR role IS NULL OR role NOT IN ('Member','OD','CL','CD','HRL','HRD')
 OR m.user_id=auth.uid() OR EXISTS(SELECT 1 FROM lub.role_assignments WHERE organization_membership_id=target AND role_code='OL' AND start_date<=current_date AND (end_date IS NULL OR end_date>current_date))
 THEN RAISE EXCEPTION 'Role assignment unavailable' USING ERRCODE='42501';END IF;
 IF role IN ('CL','CD') THEN
  IF committee IS NULL OR NOT EXISTS(SELECT 1 FROM lub.committees WHERE id=committee AND organization_id=org AND status_code='Active') THEN RAISE EXCEPTION 'Active committee required';END IF;
 ELSIF committee IS NOT NULL THEN RAISE EXCEPTION 'Unexpected role scope';END IF;
 IF role IN ('HRL','HRD') AND EXISTS(SELECT 1 FROM lub.committees WHERE organization_id=org AND status_code='Active' AND lub.is_hr_committee(id)) THEN RAISE EXCEPTION 'Use the HR committee role';END IF;
 UPDATE lub.role_assignments SET end_date=greatest(start_date,current_date) WHERE organization_membership_id=target AND role_code<>'OL' AND (end_date IS NULL OR end_date>current_date);
 IF role<>'Member' THEN
  INSERT INTO lub.role_assignments(organization_membership_id,organization_id,committee_id,role_code,is_primary_leader,assigned_by_user_id) VALUES(target,org,committee,role,false,auth.uid());
 END IF;
 IF committee IS NOT NULL AND NOT EXISTS(SELECT 1 FROM lub.committee_memberships WHERE organization_membership_id=target AND committee_id=committee AND status_code='Active' AND start_date<=current_date AND (end_date IS NULL OR end_date>current_date)) THEN
  INSERT INTO lub.committee_memberships(organization_membership_id,organization_id,committee_id) VALUES(target,org,committee);
 END IF;
 PERFORM lub.task_audit(target,org,'MEMBER_ROLE_CHANGED');
END;$$;
REVOKE ALL ON FUNCTION lub.change_member_role(uuid,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION lub.change_member_role(uuid,text,uuid) TO authenticated;
-- Keep old delegation rows for audit, and remove their mutation surface.
REVOKE EXECUTE ON FUNCTION lub.grant_organization_permission(uuid,text,uuid,timestamptz),lub.grant_application_permission(uuid,text,uuid,timestamptz),lub.grant_task_permission(uuid,text,uuid,timestamptz),lub.grant_event_permission(uuid,text,timestamptz) FROM authenticated;

--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.review_task_submission_decision(target uuid, decision text, note text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE status text:=CASE WHEN decision='Approved' THEN 'Approved' ELSE 'Rejected' END;hours numeric;task uuid; t lub.tasks; p lub.task_participants; s lub.task_submissions;
BEGIN
 IF decision IS NULL OR decision NOT IN('Approved','Changes_Requested','Rejected') THEN RAISE EXCEPTION 'Invalid decision'; END IF;
 SELECT part.task_id INTO task FROM lub.task_submissions sub JOIN lub.task_participants part ON part.id=sub.task_participant_id WHERE sub.id=target;
 SELECT * INTO t FROM lub.tasks WHERE id=task FOR UPDATE;
 SELECT part.* INTO p FROM lub.task_participants part JOIN lub.task_submissions sub ON sub.task_participant_id=part.id WHERE sub.id=target FOR UPDATE OF part;
 hours:=p.approved_hours_override;
 SELECT * INTO s FROM lub.task_submissions WHERE id=target FOR UPDATE;
 IF t.id IS NULL OR t.status_code<>'Open' OR NOT lub.can_review_task(task) THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 IF p.status_code<>'Submitted' OR s.status_code<>'Submitted' OR status NOT IN ('Approved','Rejected') OR status IS NULL OR note IS NULL OR length(note)>3000 OR (status='Rejected' AND length(trim(note))=0) OR (hours IS NOT NULL AND (status<>'Approved' OR hours<0 OR hours>1000 OR hours::text IN ('NaN','Infinity','-Infinity'))) THEN RAISE EXCEPTION 'Invalid review'; END IF;
 UPDATE lub.task_submissions SET status_code=status,review_decision_code=decision,review_note=trim(note),reviewed_at=now(),reviewed_by_user_id=auth.uid() WHERE id=target;
 UPDATE lub.task_participants SET status_code=CASE WHEN status='Approved' THEN 'Approved' ELSE 'In_Progress' END,closed_at=CASE WHEN status='Approved' THEN now() END,reviewed_by_user_id=auth.uid(),approved_hours_override=CASE WHEN status='Approved' THEN hours END WHERE id=p.id;
 PERFORM lub.task_notify(task,p.user_id,'TASK_REVIEWED'); PERFORM lub.task_audit(target,t.organization_id,'TASK_REVIEWED');
END; $function$;

--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.review_task_submission(target uuid,status text,note text,hours numeric) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE task uuid; t lub.tasks; p lub.task_participants; s lub.task_submissions;
BEGIN
 SELECT part.task_id INTO task FROM lub.task_submissions sub JOIN lub.task_participants part ON part.id=sub.task_participant_id WHERE sub.id=target;
 SELECT * INTO t FROM lub.tasks WHERE id=task FOR UPDATE;
 SELECT part.* INTO p FROM lub.task_participants part JOIN lub.task_submissions sub ON sub.task_participant_id=part.id WHERE sub.id=target FOR UPDATE OF part;
 SELECT * INTO s FROM lub.task_submissions WHERE id=target FOR UPDATE;
 IF t.id IS NULL OR t.status_code<>'Open' OR NOT lub.can_review_task(task) THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 IF p.status_code<>'Submitted' OR s.status_code<>'Submitted' OR status NOT IN ('Approved','Rejected') OR status IS NULL OR note IS NULL OR length(note)>3000 OR (status='Rejected' AND length(trim(note))=0) OR (hours IS NOT NULL AND (status<>'Approved' OR hours<0 OR hours>1000 OR hours::text IN ('NaN','Infinity','-Infinity'))) THEN RAISE EXCEPTION 'Invalid review'; END IF;
 UPDATE lub.task_submissions SET status_code=status,review_note=trim(note),reviewed_at=now(),reviewed_by_user_id=auth.uid() WHERE id=target;
 UPDATE lub.task_participants SET status_code=CASE WHEN status='Approved' THEN 'Approved' ELSE 'In_Progress' END,closed_at=CASE WHEN status='Approved' THEN now() END,reviewed_by_user_id=auth.uid(),approved_hours_override=CASE WHEN status='Approved' THEN hours END WHERE id=p.id;
 PERFORM lub.task_notify(task,p.user_id,'TASK_REVIEWED'); PERFORM lub.task_audit(target,t.organization_id,'TASK_REVIEWED');
END; $$;

--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.close_task_participant(target uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE task uuid; t lub.tasks; p lub.task_participants;
BEGIN
 SELECT task_id INTO task FROM lub.task_participants WHERE id=target;SELECT * INTO t FROM lub.tasks WHERE id=task FOR UPDATE;SELECT * INTO p FROM lub.task_participants WHERE id=target FOR UPDATE;
 IF t.id IS NULL OR t.status_code<>'Open' OR NOT lub.can_review_task(task) OR p.status_code NOT IN ('Joined','In_Progress','Submitted') THEN RAISE EXCEPTION 'Participation unavailable'; END IF;
 UPDATE lub.task_participants SET status_code='Closed',closed_at=now(),withdrawn_at=NULL,reviewed_by_user_id=auth.uid() WHERE id=target;
 PERFORM lub.task_notify(task,p.user_id,'TASK_PARTICIPATION_CLOSED');PERFORM lub.task_audit(target,t.organization_id,'TASK_PARTICIPATION_CLOSED');
END; $function$;

--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.task_submission_page(target uuid,person uuid,skip int,management boolean) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE manage boolean:=management AND lub.can_review_task(target);result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM lub.users WHERE id=auth.uid() AND status_code='Active') THEN RETURN '[]'::jsonb; END IF;
 SELECT coalesce(jsonb_agg(row ORDER BY row.submitted_at DESC,row.id),'[]'::jsonb) INTO result FROM (
  SELECT s.*,CASE WHEN s.withdrawn_at IS NOT NULL THEN 'Withdrawn' WHEN s.review_decision_code='Changes_Requested' THEN 'Changes_Requested' ELSE s.status_code END AS "displayStatus",
   profile.full_name_ar AS name,profile.major_name AS major,profile.academic_level AS level,
   r.revision_number AS task_revision_number,r.snapshot_json AS task_snapshot,
   coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.id,'name',a.file_name) ORDER BY a.id) FROM lub.task_submission_assets sa JOIN lub.application_assets a ON a.id=sa.asset_id WHERE sa.task_submission_id=s.id),'[]'::jsonb) AS assets
  FROM lub.task_submissions s JOIN lub.task_participants p ON p.id=s.task_participant_id JOIN lub.student_profiles profile ON profile.user_id=p.user_id JOIN lub.task_revisions r ON r.id=s.task_revision_id
  WHERE p.task_id=target AND (manage OR (p.user_id=auth.uid() AND lub.can_read_task_submission(s.id))) AND (person IS NULL OR (manage AND p.id=person))
  ORDER BY s.submitted_at DESC,s.id LIMIT 21 OFFSET greatest(0,least(skip,200000))
 ) row;
 RETURN result;
END; $$;

NOTIFY pgrst,'reload schema';

--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.review_event_registrations(targets uuid[],status text,note text DEFAULT '') RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r lub.event_registrations; changed int:=0;
BEGIN
 IF status NOT IN ('Accepted','Rejected') OR cardinality(targets) NOT BETWEEN 1 AND 100 OR targets IS NULL OR array_position(targets,NULL) IS NOT NULL OR (SELECT count(DISTINCT x) FROM unnest(targets) x)<>cardinality(targets) OR length(coalesce(note,''))>1000 THEN RAISE EXCEPTION 'Invalid event decision';END IF;
 PERFORM e.id FROM lub.events e WHERE e.id IN (SELECT event_id FROM lub.event_registrations WHERE id=ANY(targets)) ORDER BY e.id FOR UPDATE;
 IF (SELECT count(*) FROM lub.event_registrations WHERE id=ANY(targets))<>cardinality(targets) THEN RAISE EXCEPTION 'Registration required';END IF;
 FOR r IN SELECT * FROM lub.event_registrations WHERE id=ANY(targets) ORDER BY id FOR UPDATE LOOP
  IF NOT lub.can_operate_event(r.event_id,'EVENT_REGISTRATIONS_REVIEW') OR r.status_code<>'Registered' OR NOT EXISTS(SELECT 1 FROM lub.events WHERE id=r.event_id AND status_code='Published') THEN RAISE EXCEPTION 'Event review permission required' USING ERRCODE='42501';END IF;
  IF r.review_status_code=status THEN CONTINUE;END IF;
  IF r.review_status_code<>'Pending' THEN RAISE EXCEPTION 'Pending review required' USING ERRCODE='42501';END IF;
  UPDATE lub.event_registrations SET review_status_code=status,review_note=coalesce(note,''),reviewed_at=now() WHERE id=r.id;
  INSERT INTO lub.event_registration_history(event_registration_id,status_code,reason,actor_user_id) VALUES(r.id,status,coalesce(note,''),auth.uid());
  IF status='Rejected' THEN INSERT INTO lub.event_attendance(event_registration_id,status_code,marked_by_user_id) VALUES(r.id,'Excused',auth.uid()) ON CONFLICT(event_registration_id) DO UPDATE SET status_code='Excused',checked_in_at=NULL,marked_by_user_id=auth.uid();END IF;
  PERFORM lub.workflow_notify(r.user_id,'EVENT_REGISTRATION_DECIDED','/events/'||r.event_id);
  PERFORM lub.task_audit(r.id,NULL,'EVENT_REGISTRATION_DECIDED');changed:=changed+1;
 END LOOP;
 RETURN changed;
END; $$;

--> statement-breakpoint
create or replace function public.prepare_member_export(org uuid,q text,state text,committee uuid,term uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare directory jsonb;ticket lub.member_exports;scopes uuid[];
begin
 if auth.uid() is null or q is null or length(q)>120 or state is null or state not in ('all','Active','Ended','Inactive') then raise exception 'Export unavailable' using errcode='42501';end if;
 -- This scoped directory call validates organization, committee and actual current grants.
 IF committee IS NULL AND NOT lub.has_org_permission(org,'REPORTS_GENERATE') THEN
  SELECT array_agg(c.id) INTO scopes FROM lub.committees c WHERE c.organization_id=org AND c.status_code='Active' AND lub.has_org_permission(org,'REPORTS_GENERATE',c.id);
  IF coalesce(cardinality(scopes),0)<>1 THEN RAISE EXCEPTION 'Choose an authorized committee' USING ERRCODE='42501';END IF;
  committee:=scopes[1];
 END IF;
 IF NOT lub.has_org_permission(org,'REPORTS_GENERATE',committee) THEN RAISE EXCEPTION 'Export permission required' USING ERRCODE='42501';END IF;
 directory:=lub.organization_member_directory(org,q,state,committee,0,'name:asc',term);
 if (directory->>'rowTotal')::int>500 then raise exception 'Refine filters before exporting' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('member-export:'||auth.uid()::text,0));
 if (select count(*) from lub.member_exports where owner_user_id=auth.uid() and created_at>clock_timestamp()-interval '1 hour')>=6 then raise exception 'Export rate limit' using errcode='54000';end if;
 insert into lub.member_exports(owner_user_id,organization_id,query,status,committee_id,academic_term_id) values(auth.uid(),org,trim(q),state,committee,term) returning * into ticket;
 return jsonb_build_object('ticket',ticket.id,'expires_at',ticket.expires_at);
end;$$;

--> statement-breakpoint
create or replace function public.consume_member_export(target uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare ticket lub.member_exports;directory jsonb;records jsonb;slug text;page_data jsonb;all_members jsonb:='[]'::jsonb;page_offset integer:=0;
begin
 select * into ticket from lub.member_exports where id=target and owner_user_id=auth.uid() for update;
 if ticket.id is null or ticket.used_at is not null or ticket.expires_at<=clock_timestamp() then raise exception 'Export expired or unavailable' using errcode='42501';end if;
 IF NOT lub.has_org_permission(ticket.organization_id,'REPORTS_GENERATE',ticket.committee_id) THEN RAISE EXCEPTION 'Export permission required' USING ERRCODE='42501';END IF;
 loop
  page_data:=lub.organization_member_directory(ticket.organization_id,ticket.query,ticket.status,ticket.committee_id,page_offset,'name:asc',ticket.academic_term_id);
  if (page_data->>'rowTotal')::int>500 then raise exception 'Refine filters before exporting' using errcode='22023';end if;
  all_members:=all_members||(page_data->'members');
  exit when jsonb_array_length(page_data->'members')<25;
  page_offset:=page_offset+25;
 end loop;
 directory:=jsonb_build_object('members',all_members);
 select coalesce(jsonb_agg(
 jsonb_build_object('isTest',u.is_test,'userId',m.user_id,'name',p.full_name_ar,'major',p.major_name,'level',p.academic_level,'status',m.status_code,'universityCiphertext',p.university_id_ciphertext,'nationalCiphertext',n.national_id_ciphertext,'email',u.email,'phone',u.phone,
 'startDate',coalesce((select min(e.occurred_at at time zone 'Asia/Riyadh')::date from lub.membership_events e where e.membership_id=m.id and e.event_code in ('Joined','Rejoined')),(select min(history.start_date) from lub.organization_memberships history where history.user_id=m.user_id and history.organization_id=m.organization_id)),
 'hours',coalesce((select sum(h.hours) from lub.hour_records h join lub.organization_memberships history on history.id=h.organization_membership_id where history.user_id=m.user_id and history.organization_id=m.organization_id and h.status_code='Approved' and (ticket.academic_term_id is null or h.academic_term_id=ticket.academic_term_id)),0),
 'roles',coalesce((select jsonb_agg(jsonb_build_object('code',r.role_code)) from lub.role_assignments r join lub.organization_memberships history on history.id=r.organization_membership_id where history.user_id=m.user_id and history.organization_id=m.organization_id and r.start_date<=current_date and (r.end_date is null or r.end_date>current_date)),'[]'::jsonb),
 'committees',coalesce((select jsonb_agg(jsonb_build_object('name',c.name) order by c.name) from lub.committees c where c.organization_id=m.organization_id and exists(select 1 from lub.committee_memberships cm join lub.organization_memberships history on history.id=cm.organization_membership_id where history.user_id=m.user_id and history.organization_id=m.organization_id and cm.committee_id=c.id)),'[]'::jsonb)
 ) order by p.full_name_ar,m.id),'[]'::jsonb) into records
 from jsonb_array_elements(directory->'members') member join lub.organization_memberships m on m.id=(member->>'id')::uuid join lub.users u on u.id=m.user_id and not u.is_test join lub.student_profiles p on p.user_id=m.user_id left join lub.private_student_identifiers n on n.user_id=m.user_id;
 select o.slug into slug from lub.organizations o where o.id=ticket.organization_id;
 update lub.member_exports set used_at=clock_timestamp(),row_count=jsonb_array_length(records) where id=target;
 return jsonb_build_object('records',records,'slug',slug,'filter',lower(ticket.status)||case when ticket.committee_id is not null then '-committee' else '' end||case when ticket.query<>'' then '-search' else '' end||case when ticket.academic_term_id is not null then '-term' else '' end);
end;$$;

--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.task_team_details(target uuid,skip int DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE org uuid;result jsonb;
BEGIN
 IF NOT lub.can_read_task(target) THEN RETURN '[]'::jsonb; END IF;
 SELECT organization_id INTO org FROM lub.tasks WHERE id=target;
 SELECT coalesce(jsonb_agg(row ORDER BY row."joinedAt" DESC,row.id),'[]'::jsonb) INTO result FROM (
  SELECT p.id,profile.full_name_ar AS name,p.status_code AS status,p.joined_at AS "joinedAt",
   EXISTS(SELECT 1 FROM lub.role_assignments r JOIN lub.organization_memberships m ON m.id=r.organization_membership_id WHERE m.organization_id=org AND m.user_id=p.user_id AND m.status_code='Active' AND r.role_code='OL' AND r.start_date<=current_date AND (r.end_date IS NULL OR r.end_date>current_date)) AS "isLeader",
   (SELECT string_agg(DISTINCT c.name,'، ' ORDER BY c.name) FROM lub.committee_memberships cm JOIN lub.organization_memberships m ON m.id=cm.organization_membership_id JOIN lub.committees c ON c.id=cm.committee_id WHERE m.user_id=p.user_id AND m.organization_id=org AND c.organization_id=org AND m.status_code='Active' AND m.start_date<=current_date AND (m.end_date IS NULL OR m.end_date>current_date) AND c.status_code='Active' AND cm.status_code='Active' AND cm.start_date<=current_date AND (cm.end_date IS NULL OR cm.end_date>current_date)) AS committee
  FROM lub.task_participants p JOIN lub.student_profiles profile ON profile.user_id=p.user_id WHERE p.task_id=target
  ORDER BY p.joined_at DESC,p.id LIMIT 26 OFFSET greatest(0,least(skip,250000))
 ) row;
 RETURN result;
END; $$;

--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.can_operate_event(target uuid,capability text DEFAULT 'EVENTS_MANAGE') RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT capability IN ('EVENTS_MANAGE','EVENT_REGISTRATIONS_REVIEW','EVENT_ATTENDANCE_MANAGE','EVENT_CONTRIBUTIONS_MANAGE') AND EXISTS(SELECT 1 FROM lub.events e WHERE e.id=target AND lub.has_org_permission(e.organization_id,capability));
$$;

--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.prepare_member_export(org uuid,q text DEFAULT '',state text DEFAULT 'all',committee uuid DEFAULT NULL) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT public.prepare_member_export(org,q,state,committee,NULL::uuid);
$$;

--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.task_people(target uuid,skip int DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE t lub.tasks;adjust boolean;result jsonb;
BEGIN
 SELECT * INTO t FROM lub.tasks WHERE id=target;
 IF t.id IS NULL OR NOT lub.can_manage_task(target) THEN RETURN '[]'::jsonb; END IF;
 adjust:=lub.can_approve_hours(t.organization_id,t.committee_id);
 SELECT coalesce(jsonb_agg(row ORDER BY row."joinedAt" DESC,row.id),'[]'::jsonb) INTO result FROM (
  SELECT p.id,profile.full_name_ar AS name,profile.major_name AS major,profile.academic_level AS level,p.status_code AS status,p.joined_at AS "joinedAt",
   EXISTS(SELECT 1 FROM lub.role_assignments r JOIN lub.organization_memberships member ON member.id=r.organization_membership_id WHERE member.organization_id=t.organization_id AND member.user_id=p.user_id AND member.status_code='Active' AND member.start_date<=current_date AND (member.end_date IS NULL OR member.end_date>current_date) AND r.role_code='OL' AND r.start_date<=current_date AND (r.end_date IS NULL OR r.end_date>current_date)) AS "isLeader",
   (SELECT string_agg(DISTINCT c.name,'، ' ORDER BY c.name) FROM lub.committee_memberships cm JOIN lub.organization_memberships m ON m.id=cm.organization_membership_id JOIN lub.committees c ON c.id=cm.committee_id WHERE m.user_id=p.user_id AND m.organization_id=t.organization_id AND c.organization_id=t.organization_id AND m.status_code='Active' AND m.start_date<=current_date AND (m.end_date IS NULL OR m.end_date>current_date) AND c.status_code='Active' AND cm.status_code='Active' AND cm.start_date<=current_date AND (cm.end_date IS NULL OR cm.end_date>current_date)) AS committee,
   (SELECT jsonb_build_object('id',h.id,'hours',h.hours::text,'canAdjust',adjust AND h.status_code='Approved') FROM lub.hour_records h WHERE h.task_participant_id=p.id AND h.organization_id=t.organization_id LIMIT 1) AS "hourRecord"
  FROM lub.task_participants p JOIN lub.student_profiles profile ON profile.user_id=p.user_id WHERE p.task_id=target
  ORDER BY p.joined_at DESC,p.id LIMIT 26 OFFSET greatest(0,least(skip,250000))
 ) row;
 RETURN result;
END; $$;
