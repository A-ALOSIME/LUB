CREATE OR REPLACE FUNCTION lub.has_org_permission(target_org uuid, capability text, target_committee uuid DEFAULT NULL) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT capability IN ('ORG_PROFILE_MANAGE','COMMITTEE_MANAGE','COMMITTEE_PROFILE_MANAGE','MEMBERS_VIEW','FORMS_MANAGE','REGISTRATION_ROUNDS_MANAGE','APPLICATIONS_VIEW','APPLICATIONS_REVIEW','APPLICATIONS_BULK_ACTION','PERMISSIONS_GRANT','TASKS_MANAGE','TASK_TEMPLATES_MANAGE','HOUR_RULES_MANAGE','HOURS_APPROVE','HOURS_MANUAL_ADD','RENEWALS_MANAGE','REPORTS_GENERATE','EVENTS_MANAGE','EVENT_ATTENDANCE_MANAGE','EVENT_CONTRIBUTIONS_MANAGE')
 AND EXISTS(SELECT 1 FROM lub.organizations WHERE id=target_org AND status_code='Active')
 AND (target_committee IS NULL OR EXISTS(SELECT 1 FROM lub.committees WHERE id=target_committee AND organization_id=target_org AND status_code='Active'))
 AND EXISTS(SELECT 1 FROM lub.organization_memberships m JOIN lub.users u ON u.id=m.user_id WHERE u.id=auth.uid() AND u.status_code='Active' AND m.organization_id=target_org AND m.status_code='Active' AND m.start_date<=current_date AND (m.end_date IS NULL OR m.end_date>current_date)
 AND (EXISTS(SELECT 1 FROM lub.role_assignments r WHERE r.organization_membership_id=m.id AND r.start_date<=current_date AND (r.end_date IS NULL OR r.end_date>current_date) AND (r.role_code IN ('OL','OD') OR (r.role_code IN ('CL','CD') AND r.committee_id=target_committee AND capability IN ('COMMITTEE_PROFILE_MANAGE','MEMBERS_VIEW','TASKS_MANAGE','TASK_TEMPLATES_MANAGE','HOUR_RULES_MANAGE','HOURS_APPROVE','HOURS_MANUAL_ADD'))))
 OR EXISTS(SELECT 1 FROM lub.permission_grants g WHERE g.organization_membership_id=m.id AND g.permission_code=capability AND g.start_at<=statement_timestamp() AND (g.end_at IS NULL OR g.end_at>statement_timestamp()) AND (g.committee_id IS NULL OR g.committee_id=target_committee))));
$$;
CREATE FUNCTION lub.can_operate_event(target uuid,capability text DEFAULT 'EVENTS_MANAGE') RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT capability IN ('EVENTS_MANAGE','EVENT_ATTENDANCE_MANAGE','EVENT_CONTRIBUTIONS_MANAGE') AND EXISTS(SELECT 1 FROM lub.events e WHERE e.id=target AND lub.has_org_permission(e.organization_id,capability)); $$;
CREATE FUNCTION lub.has_event_access(org uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT lub.has_org_permission(org,'EVENTS_MANAGE') OR lub.has_org_permission(org,'EVENT_ATTENDANCE_MANAGE') OR lub.has_org_permission(org,'EVENT_CONTRIBUTIONS_MANAGE'); $$;
CREATE FUNCTION lub.can_read_registration(target uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT EXISTS(SELECT 1 FROM lub.event_registrations r JOIN lub.events e ON e.id=r.event_id JOIN lub.users u ON u.id=auth.uid() WHERE r.id=target AND u.status_code='Active' AND (r.user_id=u.id OR lub.has_event_access(e.organization_id))); $$;
GRANT SELECT ON lub.events TO anon,authenticated;
GRANT SELECT ON lub.event_registrations,lub.event_attendance,lub.event_contributions,lub.event_assets TO authenticated;
CREATE FUNCTION lub.event_remaining(target uuid) RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT CASE WHEN e.capacity IS NULL THEN NULL ELSE greatest(0,e.capacity-(SELECT count(*)::int FROM lub.event_registrations r WHERE r.event_id=e.id AND r.status_code='Registered')) END FROM lub.events e WHERE e.id=target AND (e.published_at IS NOT NULL OR lub.has_event_access(e.organization_id)); $$;
CREATE FUNCTION lub.event_student_name(target uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT p.full_name_ar FROM lub.event_registrations r JOIN lub.student_profiles p ON p.user_id=r.user_id WHERE r.id=target AND lub.can_read_registration(r.id); $$;
REVOKE ALL ON FUNCTION lub.event_remaining(uuid),lub.event_student_name(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lub.event_remaining(uuid) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION lub.event_student_name(uuid) TO authenticated;
CREATE POLICY event_forms_public ON lub.form_versions FOR SELECT TO anon,authenticated USING(status_code='Published' AND EXISTS(SELECT 1 FROM lub.events e WHERE e.registration_form_template_id=form_template_id AND e.status_code='Published' AND e.published_at IS NOT NULL));
CREATE POLICY events_read ON lub.events FOR SELECT TO anon,authenticated USING(published_at IS NOT NULL OR (current_user='authenticated' AND lub.has_event_access(organization_id)));
CREATE POLICY event_registrations_read ON lub.event_registrations FOR SELECT TO authenticated USING(lub.can_read_registration(id));
CREATE POLICY event_attendance_read ON lub.event_attendance FOR SELECT TO authenticated USING(lub.can_read_registration(event_registration_id));
CREATE POLICY event_contributions_read ON lub.event_contributions FOR SELECT TO authenticated USING((user_id=auth.uid() AND EXISTS(SELECT 1 FROM lub.users WHERE id=auth.uid() AND status_code='Active')) OR lub.can_operate_event(event_id,'EVENT_CONTRIBUTIONS_MANAGE'));
CREATE POLICY event_assets_read ON lub.event_assets FOR SELECT TO authenticated USING(lub.can_operate_event(event_id));
CREATE OR REPLACE FUNCTION lub.can_read_response(target uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT EXISTS(SELECT 1 FROM lub.membership_applications a WHERE a.form_response_id=target AND lub.can_read_application(a.id)) OR EXISTS(SELECT 1 FROM lub.event_registrations r WHERE r.form_response_id=target AND lub.can_read_registration(r.id)); $$;
CREATE FUNCTION lub.event_notify(target uuid,kind text) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ INSERT INTO lub.notifications(recipient_user_id,type_code,title,body,target_url) SELECT r.user_id,kind,'تحديث على الفعالية','افتح الفعالية للاطلاع على التحديث.','/events/'||target FROM lub.event_registrations r WHERE r.event_id=target AND r.status_code='Registered'; $$;
CREATE FUNCTION lub.save_event(target uuid,org uuid,title text,description text,location_type text,location text,url text,starts timestamptz,ends timestamptz,opens timestamptz,closes timestamptz,capacity int,template uuid,hours numeric,expected int) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e lub.events; result uuid;
BEGIN
 IF NOT lub.has_org_permission(org,'EVENTS_MANAGE') OR NOT EXISTS(SELECT 1 FROM lub.student_profiles WHERE user_id=auth.uid()) THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 IF starts IS NULL OR ends IS NULL OR opens IS NULL OR closes IS NULL OR ends<=starts OR closes<=opens OR closes>starts OR hours IS NULL OR hours<0 OR hours>1000 OR hours<>round(hours,2) OR location_type NOT IN ('In_Person','Online','Hybrid') OR (url IS NOT NULL AND url!~'^https://[^[:space:]@]+$') THEN RAISE EXCEPTION 'Invalid event'; END IF;
 IF template IS NOT NULL AND NOT EXISTS(SELECT 1 FROM lub.form_templates t JOIN lub.form_versions v ON v.form_template_id=t.id WHERE t.id=template AND (t.organization_id=org OR t.is_system_template) AND v.status_code='Published') THEN RAISE EXCEPTION 'Published form required'; END IF;
 IF target IS NULL THEN
 INSERT INTO lub.events(organization_id,created_by_user_id,title,description,location_type_code,location_text,online_url,starts_at,ends_at,registration_opens_at,registration_closes_at,capacity,registration_form_template_id,attendance_hours) VALUES(org,auth.uid(),trim(title),trim(description),location_type,nullif(trim(location),''),nullif(trim(url),''),starts,ends,opens,closes,capacity,template,hours) RETURNING id INTO result;
 ELSE
 SELECT * INTO e FROM lub.events WHERE id=target FOR UPDATE;
 IF e.id IS NULL OR e.organization_id<>org OR e.revision IS DISTINCT FROM expected OR e.status_code NOT IN ('Draft','Published') THEN RAISE EXCEPTION 'Refresh event'; END IF;
 IF e.status_code='Published' AND (template IS DISTINCT FROM e.registration_form_template_id OR hours IS DISTINCT FROM e.attendance_hours) THEN RAISE EXCEPTION 'Published form and award immutable'; END IF;
 IF capacity IS NOT NULL AND capacity<(SELECT count(*) FROM lub.event_registrations WHERE event_id=target AND status_code='Registered') THEN RAISE EXCEPTION 'Capacity below registrations'; END IF;
 UPDATE lub.events SET title=trim(save_event.title),description=trim(save_event.description),location_type_code=location_type,location_text=nullif(trim(location),''),online_url=nullif(trim(url),''),starts_at=starts,ends_at=ends,registration_opens_at=opens,registration_closes_at=closes,capacity=save_event.capacity,registration_form_template_id=template,attendance_hours=hours,revision=revision+1,updated_at=now() WHERE id=target;
 result:=target; IF e.status_code='Published' THEN PERFORM lub.event_notify(target,'EVENT_CHANGED'); END IF;
 END IF;
 PERFORM lub.task_audit(result,org,'EVENT_SAVED');RETURN result;
END; $$;
CREATE FUNCTION lub.register_event(target uuid,version uuid,input jsonb,expected int) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e lub.events; r lub.event_registrations; v lub.form_versions; f lub.form_responses; cleaned jsonb; response uuid; result uuid; field jsonb;
BEGIN
 SELECT * INTO e FROM lub.events WHERE id=target FOR UPDATE;
 IF e.id IS NULL OR e.status_code<>'Published' OR statement_timestamp()<e.registration_opens_at OR statement_timestamp()>=e.registration_closes_at OR NOT EXISTS(SELECT 1 FROM lub.organizations WHERE id=e.organization_id AND status_code='Active') OR NOT EXISTS(SELECT 1 FROM lub.users u JOIN lub.student_profiles p ON p.user_id=u.id WHERE u.id=auth.uid() AND u.status_code='Active' AND u.email_verified_at IS NOT NULL) THEN RAISE EXCEPTION 'Open event and active profile required'; END IF;
 SELECT * INTO r FROM lub.event_registrations WHERE event_id=target AND user_id=auth.uid();
 IF r.status_code='Cancelled' THEN RAISE EXCEPTION 'Registration cancelled'; END IF;
 IF r.id IS NULL AND e.capacity IS NOT NULL AND (SELECT count(*) FROM lub.event_registrations WHERE event_id=target AND status_code='Registered')>=e.capacity THEN RAISE EXCEPTION 'Event full'; END IF;
 IF e.registration_form_template_id IS NOT NULL THEN
  IF r.form_response_id IS NOT NULL THEN SELECT * INTO f FROM lub.form_responses WHERE id=r.form_response_id; IF f.form_version_id IS DISTINCT FROM version OR f.revision IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Refresh response'; END IF; SELECT * INTO v FROM lub.form_versions WHERE id=f.form_version_id;
  ELSE SELECT * INTO v FROM lub.form_versions WHERE form_template_id=e.registration_form_template_id AND status_code='Published' ORDER BY version_number DESC LIMIT 1; IF v.id IS DISTINCT FROM version THEN RAISE EXCEPTION 'Refresh form'; END IF; END IF;
  cleaned:=lub.validate_form_answers(v.definition,input);
  IF f.id IS NULL THEN INSERT INTO lub.form_responses(form_version_id,respondent_user_id,answers) VALUES(v.id,auth.uid(),cleaned) RETURNING id INTO response;
  ELSE UPDATE lub.form_responses SET answers=cleaned,revision=revision+1,updated_at=now() WHERE id=f.id; response:=f.id; DELETE FROM lub.form_response_assets WHERE form_response_id=f.id; END IF;
  FOR field IN SELECT x FROM jsonb_array_elements(v.definition->'sections') s CROSS JOIN LATERAL jsonb_array_elements(s->'fields') x WHERE x->>'type'='File' LOOP IF cleaned ? (field->>'id') THEN INSERT INTO lub.form_response_assets(form_response_id,asset_id,field_id) VALUES(response,(cleaned->>(field->>'id'))::uuid,(field->>'id')::uuid); END IF; END LOOP;
 ELSE IF version IS NOT NULL OR input IS DISTINCT FROM '{}'::jsonb THEN RAISE EXCEPTION 'Unexpected answers'; END IF; END IF;
 IF r.id IS NULL THEN INSERT INTO lub.event_registrations(event_id,user_id,form_response_id) VALUES(target,auth.uid(),response) RETURNING id INTO result; ELSE result:=r.id; END IF;
 PERFORM lub.workflow_notify(auth.uid(),'EVENT_REGISTRATION_CHANGED','/events/'||target); PERFORM lub.task_audit(result,e.organization_id,'EVENT_REGISTERED');RETURN result;
END; $$;
CREATE FUNCTION lub.cancel_event_registration(target uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r lub.event_registrations; e lub.events;
BEGIN
 SELECT ee.* INTO e FROM lub.events ee JOIN lub.event_registrations rr ON rr.event_id=ee.id WHERE rr.id=target FOR UPDATE OF ee; SELECT * INTO r FROM lub.event_registrations WHERE id=target;
 IF e.id IS NULL OR r.user_id<>auth.uid() OR r.status_code<>'Registered' OR e.status_code<>'Published' OR statement_timestamp()>=e.registration_closes_at OR NOT EXISTS(SELECT 1 FROM lub.users WHERE id=auth.uid() AND status_code='Active') THEN RAISE EXCEPTION 'Cancellation unavailable'; END IF;
 UPDATE lub.event_registrations SET status_code='Cancelled',cancelled_at=now() WHERE id=target;PERFORM lub.workflow_notify(auth.uid(),'EVENT_REGISTRATION_CANCELLED','/events/'||e.id);PERFORM lub.task_audit(target,e.organization_id,'EVENT_REGISTRATION_CANCELLED');
END; $$;
CREATE FUNCTION lub.mark_event_attendance(target uuid,status text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e lub.events; r lub.event_registrations;
BEGIN
 SELECT ee.* INTO e FROM lub.events ee JOIN lub.event_registrations rr ON rr.event_id=ee.id WHERE rr.id=target FOR UPDATE OF ee;SELECT * INTO r FROM lub.event_registrations WHERE id=target;
 IF e.id IS NULL OR NOT lub.can_operate_event(e.id,'EVENT_ATTENDANCE_MANAGE') OR e.status_code<>'Published' OR r.status_code<>'Registered' OR status NOT IN ('Pending','Present','Absent','Excused') THEN RAISE EXCEPTION 'Attendance unavailable'; END IF;
 INSERT INTO lub.event_attendance(event_registration_id,status_code,checked_in_at,marked_by_user_id) VALUES(target,status,CASE WHEN status='Present' THEN now() END,auth.uid()) ON CONFLICT(event_registration_id) DO UPDATE SET status_code=excluded.status_code,checked_in_at=excluded.checked_in_at,marked_by_user_id=auth.uid();
 PERFORM lub.task_audit(target,e.organization_id,'EVENT_ATTENDANCE_CHANGED');
END; $$;
CREATE FUNCTION lub.verify_event_contribution(target uuid,student uuid,kind text,title text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e lub.events;
BEGIN
 SELECT * INTO e FROM lub.events WHERE id=target FOR UPDATE;
 IF e.id IS NULL OR e.status_code<>'Published' OR NOT lub.can_operate_event(target,'EVENT_CONTRIBUTIONS_MANAGE') OR NOT EXISTS(SELECT 1 FROM lub.event_registrations WHERE event_id=target AND user_id=student AND status_code='Registered') THEN RAISE EXCEPTION 'Contribution unavailable'; END IF;
 INSERT INTO lub.event_contributions(event_id,user_id,contribution_type_code,title,verified_by_user_id) VALUES(target,student,kind,trim(title),auth.uid()) ON CONFLICT(event_id,user_id,contribution_type_code) DO UPDATE SET title=excluded.title,verified_by_user_id=auth.uid();PERFORM lub.task_audit(target,e.organization_id,'EVENT_CONTRIBUTION_VERIFIED');
END; $$;
CREATE FUNCTION lub.change_event_status(target uuid,status text,expected int) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e lub.events; term uuid; day date;
BEGIN
 SELECT * INTO e FROM lub.events WHERE id=target FOR UPDATE;
 IF e.id IS NULL OR NOT lub.can_operate_event(target) OR e.revision IS DISTINCT FROM expected OR NOT ((e.status_code='Draft' AND status IN ('Published','Cancelled')) OR (e.status_code='Published' AND status IN ('Completed','Cancelled'))) THEN RAISE EXCEPTION 'Invalid transition'; END IF;
 IF status='Published' AND e.registration_closes_at<=statement_timestamp() THEN RAISE EXCEPTION 'Registration already closed'; END IF;
 IF status='Completed' THEN
  IF e.ends_at>statement_timestamp() OR EXISTS(SELECT 1 FROM lub.event_registrations r LEFT JOIN lub.event_attendance a ON a.event_registration_id=r.id WHERE r.event_id=target AND r.status_code='Registered' AND coalesce(a.status_code,'Pending')='Pending') THEN RAISE EXCEPTION 'Review attendance after event'; END IF;
  day:=(e.ends_at AT TIME ZONE 'Asia/Riyadh')::date; SELECT id INTO term FROM lub.academic_terms WHERE start_date<=day AND end_date>=day;
  IF e.attendance_hours>0 AND EXISTS(SELECT 1 FROM lub.event_registrations r JOIN lub.event_attendance a ON a.event_registration_id=r.id JOIN lub.organization_memberships m ON m.user_id=r.user_id AND m.organization_id=e.organization_id AND m.start_date<=day AND (m.end_date IS NULL OR m.end_date>day) WHERE r.event_id=target AND r.status_code='Registered' AND a.status_code='Present') THEN
   IF term IS NULL OR NOT lub.has_org_permission(e.organization_id,'HOURS_APPROVE') THEN RAISE EXCEPTION 'Term and hours approval required'; END IF;
   INSERT INTO lub.hour_records(organization_id,organization_membership_id,academic_term_id,source_code,event_attendance_id,hours,activity_date,description,status_code,requested_by_user_id,reviewed_by_user_id,reviewed_at,review_note)
   SELECT e.organization_id,m.id,term,'EVENT',a.id,e.attendance_hours,day,e.title,'Approved',auth.uid(),auth.uid(),now(),'إكمال الفعالية وتثبيت الحضور' FROM lub.event_registrations r JOIN lub.event_attendance a ON a.event_registration_id=r.id JOIN lub.organization_memberships m ON m.user_id=r.user_id AND m.organization_id=e.organization_id AND m.start_date<=day AND (m.end_date IS NULL OR m.end_date>day) WHERE r.event_id=target AND r.status_code='Registered' AND a.status_code='Present';
  END IF;
 END IF;
 UPDATE lub.events SET status_code=status,revision=revision+1,published_at=CASE WHEN status='Published' THEN now() ELSE published_at END,completed_at=CASE WHEN status='Completed' THEN now() END,cancelled_at=CASE WHEN status='Cancelled' THEN now() END,updated_at=now() WHERE id=target;
 PERFORM lub.event_notify(target,'EVENT_'||status);PERFORM lub.task_audit(target,e.organization_id,'EVENT_'||status);
END; $$;
CREATE FUNCTION lub.duplicate_event(target uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e lub.events; result uuid;
BEGIN
 SELECT * INTO e FROM lub.events WHERE id=target;
 IF e.id IS NULL OR NOT lub.can_operate_event(target) THEN RAISE EXCEPTION 'Permission required'; END IF;
 INSERT INTO lub.events(organization_id,created_by_user_id,duplicated_from_event_id,registration_form_template_id,title,description,location_type_code,location_text,online_url,starts_at,ends_at,registration_opens_at,registration_closes_at,capacity,attendance_hours) VALUES(e.organization_id,auth.uid(),e.id,e.registration_form_template_id,e.title,e.description,e.location_type_code,e.location_text,e.online_url,e.starts_at,e.ends_at,e.registration_opens_at,e.registration_closes_at,e.capacity,e.attendance_hours) RETURNING id INTO result;PERFORM lub.task_audit(result,e.organization_id,'EVENT_DUPLICATED');RETURN result;
END; $$;
CREATE FUNCTION lub.attach_event_asset(target uuid,asset uuid,kind text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM 1 FROM lub.events WHERE id=target FOR UPDATE;
 IF NOT lub.can_operate_event(target) OR NOT EXISTS(SELECT 1 FROM lub.application_assets WHERE id=asset AND owner_user_id=auth.uid()) THEN RAISE EXCEPTION 'Permission required'; END IF;
 INSERT INTO lub.event_assets(event_id,asset_id,asset_type_code) VALUES(target,asset,kind);PERFORM lub.task_audit(target,NULL,'EVENT_ASSET_ATTACHED');
END; $$;
CREATE OR REPLACE FUNCTION lub.can_read_asset(target text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM lub.application_assets a WHERE a.object_key=target AND EXISTS(SELECT 1 FROM lub.users WHERE id=auth.uid() AND status_code='Active') AND (a.owner_user_id=auth.uid() OR EXISTS(SELECT 1 FROM lub.form_response_assets f WHERE f.asset_id=a.id AND lub.can_read_response(f.form_response_id)) OR EXISTS(SELECT 1 FROM lub.task_submission_assets s WHERE s.asset_id=a.id AND lub.can_read_task_submission(s.task_submission_id)) OR EXISTS(SELECT 1 FROM lub.event_assets ea WHERE ea.asset_id=a.id AND lub.can_operate_event(ea.event_id))));
$$;
CREATE OR REPLACE FUNCTION lub.can_delete_application_object(target text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT split_part(target,'/',1)=auth.uid()::text AND EXISTS(SELECT 1 FROM lub.users WHERE id=auth.uid() AND status_code='Active') AND NOT EXISTS(SELECT 1 FROM lub.application_assets a WHERE a.object_key=target AND (EXISTS(SELECT 1 FROM lub.form_response_assets f WHERE f.asset_id=a.id) OR EXISTS(SELECT 1 FROM lub.task_submission_assets s WHERE s.asset_id=a.id) OR EXISTS(SELECT 1 FROM lub.event_assets e WHERE e.asset_id=a.id))); $$;
CREATE FUNCTION lub.grant_event_permission(member uuid,capability text,ends timestamptz) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE org uuid;
BEGIN
 SELECT organization_id INTO org FROM lub.organization_memberships WHERE id=member AND status_code='Active' AND start_date<=current_date AND (end_date IS NULL OR end_date>current_date);
 IF org IS NULL OR NOT lub.has_org_permission(org,'PERMISSIONS_GRANT') OR capability NOT IN ('EVENTS_MANAGE','EVENT_ATTENDANCE_MANAGE','EVENT_CONTRIBUTIONS_MANAGE') OR (ends IS NOT NULL AND ends<=statement_timestamp()) THEN RAISE EXCEPTION 'Permission required'; END IF;
 INSERT INTO lub.permission_grants(organization_membership_id,organization_id,permission_code,end_at,granted_by_user_id) VALUES(member,org,capability,ends,auth.uid());PERFORM lub.task_audit(member,org,'EVENT_PERMISSION_GRANTED');
END; $$;
CREATE FUNCTION lub.end_event_permission(target uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE org uuid;
BEGIN
 SELECT organization_id INTO org FROM lub.permission_grants WHERE id=target AND permission_code IN ('EVENTS_MANAGE','EVENT_ATTENDANCE_MANAGE','EVENT_CONTRIBUTIONS_MANAGE');IF org IS NULL OR NOT lub.has_org_permission(org,'PERMISSIONS_GRANT') THEN RAISE EXCEPTION 'Permission required';END IF;UPDATE lub.permission_grants SET end_at=clock_timestamp() WHERE id=target AND start_at<=now() AND (end_at IS NULL OR end_at>now());PERFORM lub.task_audit(target,org,'EVENT_PERMISSION_ENDED');
END; $$;
CREATE FUNCTION lub.event_grants(org uuid,skip int DEFAULT 0) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT coalesce(jsonb_agg(x),'[]') FROM(SELECT g.id,p.full_name_ar AS name,g.permission_code,g.end_at FROM lub.permission_grants g JOIN lub.organization_memberships m ON m.id=g.organization_membership_id JOIN lub.student_profiles p ON p.user_id=m.user_id WHERE g.organization_id=org AND g.permission_code IN ('EVENTS_MANAGE','EVENT_ATTENDANCE_MANAGE','EVENT_CONTRIBUTIONS_MANAGE') AND g.start_at<=statement_timestamp() AND (g.end_at IS NULL OR g.end_at>statement_timestamp()) AND lub.has_org_permission(org,'PERMISSIONS_GRANT') ORDER BY g.start_at DESC,g.id LIMIT 26 OFFSET greatest(0,least(skip,250000))) x; $$;
REVOKE ALL ON FUNCTION lub.event_grants(uuid,int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lub.event_grants(uuid,int) TO authenticated;
REVOKE ALL ON FUNCTION lub.event_notify(uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION lub.can_operate_event(uuid,text),lub.has_event_access(uuid),lub.can_read_registration(uuid),lub.save_event(uuid,uuid,text,text,text,text,text,timestamptz,timestamptz,timestamptz,timestamptz,int,uuid,numeric,int),lub.register_event(uuid,uuid,jsonb,int),lub.cancel_event_registration(uuid),lub.mark_event_attendance(uuid,text),lub.verify_event_contribution(uuid,uuid,text,text),lub.change_event_status(uuid,text,int),lub.duplicate_event(uuid),lub.attach_event_asset(uuid,uuid,text),lub.grant_event_permission(uuid,text,timestamptz),lub.end_event_permission(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lub.has_event_access(uuid) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION lub.can_operate_event(uuid,text),lub.can_read_registration(uuid),lub.save_event(uuid,uuid,text,text,text,text,text,timestamptz,timestamptz,timestamptz,timestamptz,int,uuid,numeric,int),lub.register_event(uuid,uuid,jsonb,int),lub.cancel_event_registration(uuid),lub.mark_event_attendance(uuid,text),lub.verify_event_contribution(uuid,uuid,text,text),lub.change_event_status(uuid,text,int),lub.duplicate_event(uuid),lub.attach_event_asset(uuid,uuid,text),lub.grant_event_permission(uuid,text,timestamptz),lub.end_event_permission(uuid) TO authenticated;
