ALTER TABLE lub.events ADD COLUMN requires_approval boolean NOT NULL DEFAULT false;
ALTER TABLE lub.event_registrations ADD COLUMN review_status_code text NOT NULL DEFAULT 'Accepted' CHECK(review_status_code IN ('Pending','Accepted','Rejected')), ADD COLUMN review_note varchar(1000) NOT NULL DEFAULT '', ADD COLUMN reviewed_at timestamptz;
CREATE TABLE lub.event_registration_history(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),event_registration_id uuid NOT NULL REFERENCES lub.event_registrations(id),status_code text NOT NULL CHECK(status_code IN ('Pending','Accepted','Rejected','Cancelled')),reason varchar(1000) NOT NULL DEFAULT '',actor_user_id uuid NOT NULL REFERENCES lub.users(id),created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX event_registration_history_time_idx ON lub.event_registration_history(event_registration_id,created_at);
ALTER TABLE lub.event_registration_history ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON lub.event_registration_history TO authenticated;
CREATE POLICY event_registration_history_read ON lub.event_registration_history FOR SELECT TO authenticated USING(lub.can_read_registration(event_registration_id));
--> statement-breakpoint
CREATE FUNCTION lub.set_event_registration_policy(target uuid,approval boolean,expected int) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT lub.can_operate_event(target) THEN RAISE EXCEPTION 'Event permission required' USING ERRCODE='42501';END IF;
 UPDATE lub.events SET requires_approval=approval,revision=revision+1,updated_at=now() WHERE id=target AND revision=expected AND status_code IN ('Draft','Published');
 IF NOT FOUND THEN RAISE EXCEPTION 'Refresh event';END IF;
 PERFORM lub.task_audit(target,NULL,'EVENT_REGISTRATION_POLICY_UPDATED');
END; $$;
CREATE FUNCTION lub.remove_event_poster(target uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT lub.can_operate_event(target) THEN RAISE EXCEPTION 'Event permission required' USING ERRCODE='42501';END IF;
 DELETE FROM lub.event_assets WHERE event_id=target AND asset_type_code='Poster';
 PERFORM lub.task_audit(target,NULL,'EVENT_POSTER_REMOVED');
END; $$;
CREATE FUNCTION lub.review_event_registrations(targets uuid[],status text,note text DEFAULT '') RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r lub.event_registrations; changed int:=0;
BEGIN
 IF status NOT IN ('Accepted','Rejected') OR cardinality(targets) NOT BETWEEN 1 AND 100 OR targets IS NULL OR array_position(targets,NULL) IS NOT NULL OR (SELECT count(DISTINCT x) FROM unnest(targets) x)<>cardinality(targets) OR length(coalesce(note,''))>1000 THEN RAISE EXCEPTION 'Invalid event decision';END IF;
 PERFORM e.id FROM lub.events e WHERE e.id IN (SELECT event_id FROM lub.event_registrations WHERE id=ANY(targets)) ORDER BY e.id FOR UPDATE;
 IF (SELECT count(*) FROM lub.event_registrations WHERE id=ANY(targets))<>cardinality(targets) THEN RAISE EXCEPTION 'Registration required';END IF;
 FOR r IN SELECT * FROM lub.event_registrations WHERE id=ANY(targets) ORDER BY id FOR UPDATE LOOP
  IF NOT lub.can_operate_event(r.event_id) OR r.status_code<>'Registered' OR NOT EXISTS(SELECT 1 FROM lub.events WHERE id=r.event_id AND status_code='Published') THEN RAISE EXCEPTION 'Event review permission required' USING ERRCODE='42501';END IF;
  IF r.review_status_code=status THEN CONTINUE;END IF;
  UPDATE lub.event_registrations SET review_status_code=status,review_note=coalesce(note,''),reviewed_at=now() WHERE id=r.id;
  INSERT INTO lub.event_registration_history(event_registration_id,status_code,reason,actor_user_id) VALUES(r.id,status,coalesce(note,''),auth.uid());
  IF status='Rejected' THEN INSERT INTO lub.event_attendance(event_registration_id,status_code,marked_by_user_id) VALUES(r.id,'Excused',auth.uid()) ON CONFLICT(event_registration_id) DO UPDATE SET status_code='Excused',checked_in_at=NULL,marked_by_user_id=auth.uid();END IF;
  PERFORM lub.workflow_notify(r.user_id,'EVENT_REGISTRATION_DECIDED','/events/'||r.event_id);
  PERFORM lub.task_audit(r.id,NULL,'EVENT_REGISTRATION_DECIDED');changed:=changed+1;
 END LOOP;
 RETURN changed;
END; $$;
REVOKE ALL ON FUNCTION lub.set_event_registration_policy(uuid,boolean,int),lub.remove_event_poster(uuid),lub.review_event_registrations(uuid[],text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION lub.set_event_registration_policy(uuid,boolean,int),lub.remove_event_poster(uuid),lub.review_event_registrations(uuid[],text,text) TO authenticated;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.event_remaining(target uuid) RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT CASE WHEN e.capacity IS NULL THEN NULL ELSE greatest(0,e.capacity-(SELECT count(*)::int FROM lub.event_registrations r WHERE r.event_id=e.id AND r.status_code='Registered' AND r.review_status_code<>'Rejected')) END FROM lub.events e WHERE e.id=target AND (e.published_at IS NOT NULL OR lub.has_event_access(e.organization_id)); $$;
CREATE OR REPLACE FUNCTION lub.register_event(target uuid,version uuid,input jsonb,expected int) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e lub.events; r lub.event_registrations; v lub.form_versions; f lub.form_responses; cleaned jsonb; response uuid; result uuid; field jsonb;
BEGIN
 SELECT * INTO e FROM lub.events WHERE id=target FOR UPDATE;
 IF EXISTS(SELECT 1 FROM lub.global_role_assignments g WHERE g.user_id=auth.uid() AND g.role_code='SA' AND g.start_at<=now() AND (g.end_at IS NULL OR g.end_at>now())) OR e.id IS NULL OR e.status_code<>'Published' OR statement_timestamp()<e.registration_opens_at OR statement_timestamp()>=e.registration_closes_at OR NOT EXISTS(SELECT 1 FROM lub.organizations WHERE id=e.organization_id AND status_code='Active') OR NOT EXISTS(SELECT 1 FROM lub.users u JOIN lub.student_profiles p ON p.user_id=u.id WHERE u.id=auth.uid() AND u.status_code='Active' AND u.email_verified_at IS NOT NULL) THEN RAISE EXCEPTION 'Open event and active profile required'; END IF;
 SELECT * INTO r FROM lub.event_registrations WHERE event_id=target AND user_id=auth.uid();
 IF r.status_code='Cancelled' OR r.review_status_code='Rejected' THEN RAISE EXCEPTION 'Registration cancelled'; END IF;
 IF r.id IS NULL AND e.capacity IS NOT NULL AND (SELECT count(*) FROM lub.event_registrations WHERE event_id=target AND status_code='Registered' AND review_status_code<>'Rejected')>=e.capacity THEN RAISE EXCEPTION 'Event full'; END IF;
 IF e.registration_form_template_id IS NOT NULL THEN
  IF r.form_response_id IS NOT NULL THEN SELECT * INTO f FROM lub.form_responses WHERE id=r.form_response_id; IF f.form_version_id IS DISTINCT FROM version OR f.revision IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Refresh response'; END IF; SELECT * INTO v FROM lub.form_versions WHERE id=f.form_version_id;
  ELSE SELECT * INTO v FROM lub.form_versions WHERE form_template_id=e.registration_form_template_id AND status_code='Published' ORDER BY version_number DESC LIMIT 1; IF v.id IS DISTINCT FROM version THEN RAISE EXCEPTION 'Refresh form'; END IF; END IF;
  cleaned:=lub.validate_form_answers(v.definition,input);
  IF f.id IS NULL THEN INSERT INTO lub.form_responses(form_version_id,respondent_user_id,answers) VALUES(v.id,auth.uid(),cleaned) RETURNING id INTO response;
  ELSE UPDATE lub.form_responses SET answers=cleaned,revision=revision+1,updated_at=now() WHERE id=f.id; response:=f.id; DELETE FROM lub.form_response_assets WHERE form_response_id=f.id; END IF;
  FOR field IN SELECT x FROM jsonb_array_elements(v.definition->'sections') s CROSS JOIN LATERAL jsonb_array_elements(s->'fields') x WHERE x->>'type'='File' LOOP IF cleaned ? (field->>'id') THEN INSERT INTO lub.form_response_assets(form_response_id,asset_id,field_id) VALUES(response,(cleaned->>(field->>'id'))::uuid,(field->>'id')::uuid); END IF; END LOOP;
 ELSE IF version IS NOT NULL OR input IS DISTINCT FROM '{}'::jsonb THEN RAISE EXCEPTION 'Unexpected answers'; END IF; END IF;
 IF r.id IS NULL THEN INSERT INTO lub.event_registrations(event_id,user_id,form_response_id,review_status_code) VALUES(target,auth.uid(),response,CASE WHEN e.requires_approval THEN 'Pending' ELSE 'Accepted' END) RETURNING id INTO result; INSERT INTO lub.event_registration_history(event_registration_id,status_code,actor_user_id) SELECT id,review_status_code,auth.uid() FROM lub.event_registrations WHERE id=result; ELSE result:=r.id; END IF;
 PERFORM lub.workflow_notify(auth.uid(),'EVENT_REGISTRATION_CHANGED','/events/'||target); PERFORM lub.task_audit(result,e.organization_id,'EVENT_REGISTERED');RETURN result;
END; $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.mark_event_attendance(target uuid,status text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e lub.events; r lub.event_registrations;
BEGIN
 SELECT ee.* INTO e FROM lub.events ee JOIN lub.event_registrations rr ON rr.event_id=ee.id WHERE rr.id=target FOR UPDATE OF ee;SELECT * INTO r FROM lub.event_registrations WHERE id=target;
 IF e.id IS NULL OR NOT lub.can_operate_event(e.id,'EVENT_ATTENDANCE_MANAGE') OR e.status_code<>'Published' OR e.ends_at>statement_timestamp() OR r.status_code<>'Registered' OR r.review_status_code<>'Accepted' OR status NOT IN ('Pending','Present','Absent','Excused') THEN RAISE EXCEPTION 'Attendance unavailable'; END IF;
 INSERT INTO lub.event_attendance(event_registration_id,status_code,checked_in_at,marked_by_user_id) VALUES(target,status,CASE WHEN status='Present' THEN now() END,auth.uid()) ON CONFLICT(event_registration_id) DO UPDATE SET status_code=excluded.status_code,checked_in_at=excluded.checked_in_at,marked_by_user_id=auth.uid();
 PERFORM lub.task_audit(target,e.organization_id,'EVENT_ATTENDANCE_CHANGED');
END; $$;
--> statement-breakpoint
-- Clients can create default settings during onboarding, but public slugs are generated only by PostgreSQL.
REVOKE INSERT ON lub.profile_settings FROM authenticated;
GRANT INSERT(user_id,public_profile_enabled,updated_at) ON lub.profile_settings TO authenticated;

--> statement-breakpoint
CREATE FUNCTION lub.event_registration_profiles(org uuid) RETURNS TABLE(registration_id uuid,full_name text,major text,level text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT r.id,p.full_name_ar::text,p.major_name::text,p.academic_level::text FROM lub.event_registrations r JOIN lub.events e ON e.id=r.event_id JOIN lub.student_profiles p ON p.user_id=r.user_id WHERE e.organization_id=org AND lub.has_event_access(org) AND NOT EXISTS(SELECT 1 FROM lub.global_role_assignments g WHERE g.user_id=r.user_id AND g.role_code='SA' AND g.start_at<=now() AND (g.end_at IS NULL OR g.end_at>now()));
$$;
REVOKE ALL ON FUNCTION lub.event_registration_profiles(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION lub.event_registration_profiles(uuid) TO authenticated;

--> statement-breakpoint
ALTER TABLE lub.application_status_history ALTER COLUMN reason TYPE varchar(1000);
CREATE OR REPLACE FUNCTION lub.apply_decision(target uuid,status text,message text,bulk uuid DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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
  INSERT INTO lub.organization_memberships(organization_id,user_id,source_application_id) VALUES(r.organization_id,a.applicant_user_id,target) RETURNING id INTO member;
  IF a.requested_committee_id IS NOT NULL THEN INSERT INTO lub.committee_memberships(organization_id,organization_membership_id,committee_id) VALUES(r.organization_id,member,a.requested_committee_id); END IF;
 END IF;
 UPDATE lub.membership_applications SET status_code=status,status_revision=status_revision+1,accepted_membership_id=member,decided_at=CASE WHEN status IN ('Accepted','Rejected') THEN now() ELSE NULL END,decided_by_user_id=CASE WHEN status IN ('Accepted','Rejected') THEN auth.uid() ELSE NULL END WHERE id=target;
 INSERT INTO lub.application_status_history(application_id,from_status_code,to_status_code,changed_by_user_id,bulk_action_id,reason) VALUES(target,a.status_code,status,auth.uid(),bulk,CASE WHEN status='Rejected' THEN nullif(trim(message),'') END);
 PERFORM lub.application_audit(target,r.organization_id,'APPLICATION_'||upper(status)); RETURN member;
END; $$;

--> statement-breakpoint
CREATE FUNCTION lub.verify_registration_contribution(target uuid,kind text,title text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r lub.event_registrations;
BEGIN
 SELECT * INTO r FROM lub.event_registrations WHERE id=target;
 IF r.id IS NULL OR r.status_code<>'Registered' OR r.review_status_code<>'Accepted' OR NOT lub.can_operate_event(r.event_id,'EVENT_CONTRIBUTIONS_MANAGE') THEN RAISE EXCEPTION 'Contribution permission required' USING ERRCODE='42501';END IF;
 PERFORM lub.verify_event_contribution(r.event_id,r.user_id,kind,title);
END; $$;
REVOKE ALL ON FUNCTION lub.verify_registration_contribution(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION lub.verify_registration_contribution(uuid,text,text) TO authenticated;

--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.save_event(target uuid,org uuid,title text,description text,location_type text,location text,url text,starts timestamptz,ends timestamptz,opens timestamptz,closes timestamptz,capacity int,template uuid,hours numeric,expected int) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e lub.events; result uuid;
BEGIN
 IF NOT lub.has_org_permission(org,'EVENTS_MANAGE') OR NOT EXISTS(SELECT 1 FROM lub.student_profiles WHERE user_id=auth.uid()) THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 IF (starts IS NOT NULL AND ends IS NOT NULL AND ends<=starts) OR (opens IS NOT NULL AND closes IS NOT NULL AND closes<=opens) OR (closes IS NOT NULL AND starts IS NOT NULL AND closes>starts) OR hours IS NULL OR hours<0 OR hours>1000 OR hours<>round(hours,2) OR location_type NOT IN ('In_Person','Online','Hybrid') OR (url IS NOT NULL AND url!~'^https://[^[:space:]@]+$') THEN RAISE EXCEPTION 'Invalid event'; END IF;
 IF template IS NOT NULL AND NOT EXISTS(SELECT 1 FROM lub.form_templates t JOIN lub.form_versions v ON v.form_template_id=t.id WHERE t.id=template AND (t.organization_id=org OR t.is_system_template) AND v.status_code='Published') THEN RAISE EXCEPTION 'Published form required'; END IF;
 IF target IS NULL THEN
 INSERT INTO lub.events(organization_id,created_by_user_id,title,description,location_type_code,location_text,online_url,starts_at,ends_at,registration_opens_at,registration_closes_at,capacity,registration_form_template_id,attendance_hours) VALUES(org,auth.uid(),trim(title),trim(description),location_type,nullif(trim(location),''),nullif(trim(url),''),starts,ends,opens,closes,capacity,template,hours) RETURNING id INTO result;
 ELSE
 SELECT * INTO e FROM lub.events WHERE id=target FOR UPDATE;
 IF e.id IS NULL OR e.organization_id<>org OR e.revision IS DISTINCT FROM expected OR e.status_code NOT IN ('Draft','Published') THEN RAISE EXCEPTION 'Refresh event'; END IF;
 IF e.published_at IS NOT NULL AND (template IS DISTINCT FROM e.registration_form_template_id OR hours IS DISTINCT FROM e.attendance_hours) THEN RAISE EXCEPTION 'Published form and award immutable'; END IF;
 IF capacity IS NOT NULL AND capacity<(SELECT count(*) FROM lub.event_registrations WHERE event_id=target AND status_code='Registered' AND review_status_code<>'Rejected') THEN RAISE EXCEPTION 'Capacity below registrations'; END IF;
 UPDATE lub.events SET title=trim(save_event.title),description=trim(save_event.description),location_type_code=location_type,location_text=nullif(trim(location),''),online_url=nullif(trim(url),''),starts_at=starts,ends_at=ends,registration_opens_at=opens,registration_closes_at=closes,capacity=save_event.capacity,registration_form_template_id=template,attendance_hours=hours,revision=revision+1,updated_at=now() WHERE id=target;
 result:=target; IF e.status_code='Published' THEN PERFORM lub.event_notify(target,'EVENT_CHANGED'); END IF;
 END IF;
 PERFORM lub.task_audit(result,org,'EVENT_SAVED');RETURN result;
END; $$;

--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.duplicate_event(target uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e lub.events; result uuid;
BEGIN
 SELECT * INTO e FROM lub.events WHERE id=target;
 IF e.id IS NULL OR NOT lub.can_operate_event(target) THEN RAISE EXCEPTION 'Permission required'; END IF;
 INSERT INTO lub.events(organization_id,created_by_user_id,duplicated_from_event_id,registration_form_template_id,title,description,location_type_code,location_text,online_url,starts_at,ends_at,registration_opens_at,registration_closes_at,capacity,attendance_hours,requires_approval) VALUES(e.organization_id,auth.uid(),e.id,e.registration_form_template_id,e.title,e.description,e.location_type_code,e.location_text,e.online_url,e.starts_at,e.ends_at,e.registration_opens_at,e.registration_closes_at,e.capacity,e.attendance_hours,e.requires_approval) RETURNING id INTO result;PERFORM lub.task_audit(result,e.organization_id,'EVENT_DUPLICATED');RETURN result;
END; $$;

--> statement-breakpoint
CREATE FUNCTION lub.remove_event_registration(target uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r lub.event_registrations;
BEGIN
 SELECT rr.* INTO r FROM lub.event_registrations rr JOIN lub.events e ON e.id=rr.event_id WHERE rr.id=target AND e.status_code='Published' FOR UPDATE OF e,rr;
 IF r.id IS NULL OR r.status_code<>'Registered' OR NOT lub.can_operate_event(r.event_id) THEN RAISE EXCEPTION 'Removal permission required' USING ERRCODE='42501';END IF;
 UPDATE lub.event_registrations SET status_code='Cancelled',cancelled_at=now() WHERE id=target;
 INSERT INTO lub.event_registration_history(event_registration_id,status_code,actor_user_id) VALUES(target,'Cancelled',auth.uid());
 PERFORM lub.workflow_notify(r.user_id,'EVENT_REGISTRATION_REMOVED','/events/'||r.event_id);
 PERFORM lub.task_audit(target,NULL,'EVENT_REGISTRATION_REMOVED');
END; $$;
REVOKE ALL ON FUNCTION lub.remove_event_registration(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION lub.remove_event_registration(uuid) TO authenticated;
