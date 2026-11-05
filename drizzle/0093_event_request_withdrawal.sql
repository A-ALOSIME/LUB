CREATE OR REPLACE FUNCTION lub.cancel_event_registration(target uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r lub.event_registrations; e lub.events;
BEGIN
 SELECT ee.* INTO e FROM lub.events ee JOIN lub.event_registrations rr ON rr.event_id=ee.id WHERE rr.id=target FOR UPDATE OF ee; SELECT * INTO r FROM lub.event_registrations WHERE id=target;
 IF e.id IS NULL OR r.user_id<>auth.uid() OR r.status_code<>'Registered' OR e.status_code<>'Published' OR (e.starts_at IS NULL OR statement_timestamp()>=e.starts_at) OR r.review_status_code NOT IN ('Pending','Accepted') OR NOT EXISTS(SELECT 1 FROM lub.users WHERE id=auth.uid() AND status_code='Active') THEN RAISE EXCEPTION 'Cancellation unavailable'; END IF;
 UPDATE lub.event_registrations SET status_code='Cancelled',cancelled_at=now() WHERE id=target;INSERT INTO lub.event_registration_history(event_registration_id,status_code,actor_user_id) VALUES(target,'Cancelled',auth.uid());PERFORM lub.workflow_notify(auth.uid(),'EVENT_REGISTRATION_CANCELLED','/events/'||e.id);PERFORM lub.task_audit(target,e.organization_id,'EVENT_REGISTRATION_CANCELLED');
END; $$;

--> statement-breakpoint
CREATE FUNCTION lub.reapply_event_registration(target uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e lub.events;r lub.event_registrations;
BEGIN
 SELECT ee.* INTO e FROM lub.events ee JOIN lub.event_registrations rr ON rr.event_id=ee.id WHERE rr.id=target FOR UPDATE OF ee;
 SELECT * INTO r FROM lub.event_registrations WHERE id=target FOR UPDATE;
 IF r.id IS NULL OR r.user_id IS DISTINCT FROM auth.uid() OR r.status_code<>'Cancelled' OR e.status_code<>'Published'
 OR e.starts_at IS NULL OR statement_timestamp()>=e.starts_at OR statement_timestamp()<e.registration_opens_at OR statement_timestamp()>=e.registration_closes_at
 OR NOT EXISTS(SELECT 1 FROM lub.users u JOIN lub.student_profiles p ON p.user_id=u.id WHERE u.id=auth.uid() AND u.status_code='Active' AND u.email_verified_at IS NOT NULL)
 OR NOT lub.is_student_account(auth.uid()) OR NOT EXISTS(SELECT 1 FROM lub.organizations WHERE id=e.organization_id AND status_code='Active')
 THEN RAISE EXCEPTION 'Reapplication unavailable' USING ERRCODE='42501';END IF;
 IF e.capacity IS NOT NULL AND (SELECT count(*) FROM lub.event_registrations WHERE event_id=e.id AND status_code='Registered' AND review_status_code<>'Rejected' AND lub.is_student_account(user_id))>=e.capacity THEN RAISE EXCEPTION 'Event full';END IF;
 UPDATE lub.event_registrations SET status_code='Registered',cancelled_at=NULL,review_status_code='Pending',review_note='',reviewed_at=NULL WHERE id=target;
 INSERT INTO lub.event_registration_history(event_registration_id,status_code,actor_user_id) VALUES(target,'Pending',auth.uid());
 PERFORM lub.workflow_notify(auth.uid(),'EVENT_REGISTRATION_CHANGED','/events/'||e.id);
 PERFORM lub.task_audit(target,e.organization_id,'EVENT_REGISTRATION_REAPPLIED');
END;$$;
REVOKE ALL ON FUNCTION lub.reapply_event_registration(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION lub.reapply_event_registration(uuid) TO authenticated;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.review_event_registrations(targets uuid[],status text,note text DEFAULT '') RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r lub.event_registrations; changed int:=0;
BEGIN
 IF status NOT IN ('Accepted','Rejected') OR cardinality(targets) NOT BETWEEN 1 AND 100 OR targets IS NULL OR array_position(targets,NULL) IS NOT NULL OR (SELECT count(DISTINCT x) FROM unnest(targets) x)<>cardinality(targets) OR length(coalesce(note,''))>1000 THEN RAISE EXCEPTION 'Invalid event decision';END IF;
 PERFORM e.id FROM lub.events e WHERE e.id IN (SELECT event_id FROM lub.event_registrations WHERE id=ANY(targets)) ORDER BY e.id FOR UPDATE;
 IF (SELECT count(*) FROM lub.event_registrations WHERE id=ANY(targets))<>cardinality(targets) THEN RAISE EXCEPTION 'Registration required';END IF;
 FOR r IN SELECT * FROM lub.event_registrations WHERE id=ANY(targets) ORDER BY id FOR UPDATE LOOP
  IF NOT lub.can_operate_event(r.event_id) OR r.status_code<>'Registered' OR NOT EXISTS(SELECT 1 FROM lub.events WHERE id=r.event_id AND status_code='Published') THEN RAISE EXCEPTION 'Event review permission required' USING ERRCODE='42501';END IF;
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
CREATE OR REPLACE FUNCTION lub.verify_registration_contribution(target uuid,kind text,title text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r lub.event_registrations;
BEGIN
 SELECT * INTO r FROM lub.event_registrations WHERE id=target;
 IF r.id IS NULL OR EXISTS(SELECT 1 FROM lub.event_contributions c WHERE c.event_id=r.event_id AND c.user_id=r.user_id) OR r.status_code<>'Registered' OR r.review_status_code<>'Accepted' OR NOT lub.can_operate_event(r.event_id,'EVENT_CONTRIBUTIONS_MANAGE') THEN RAISE EXCEPTION 'Contribution permission required' USING ERRCODE='42501';END IF;
 PERFORM lub.verify_event_contribution(r.event_id,r.user_id,kind,title);
END; $$;
NOTIFY pgrst,'reload schema';
