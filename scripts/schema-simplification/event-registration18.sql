CREATE FUNCTION lub.event_registration_open(target uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM lub.organization_content e JOIN lub.organizations o ON o.id=e.organization_id WHERE e.id=target AND e.kind='Event' AND e.status_code='Published'
 AND e.archived_at IS NULL AND e.deleted_at IS NULL AND NOT e.registration_paused AND o.status_code='Active'
 AND statement_timestamp()>=e.registration_opens_at AND statement_timestamp()<e.registration_closes_at AND statement_timestamp()<e.starts_at);
$$;
CREATE FUNCTION lub.set_event_registration_policy(target uuid,approval boolean,expected int) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e lub.organization_content;
BEGIN
 e:=lub.lock_event(target); IF NOT lub.can_operate_event(target) THEN RAISE EXCEPTION 'Event permission required' USING ERRCODE='42501'; END IF;
 IF e.revision IS DISTINCT FROM expected OR approval IS NULL OR e.status_code NOT IN ('Draft','Published') THEN RAISE EXCEPTION 'Refresh event'; END IF;
 UPDATE lub.organization_content SET requires_review=approval,revision=revision+1,updated_at=now() WHERE id=target;
END; $$;
CREATE FUNCTION lub.register_event(target uuid,version uuid,input jsonb,expected int) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e lub.organization_content; r lub.event_registrations; snapshot jsonb; cleaned jsonb:='{}'; files jsonb:='[]'; result uuid; review text;
BEGIN
 e:=lub.lock_event(target);
 PERFORM 1 FROM lub.users WHERE id=auth.uid() FOR UPDATE;
 IF NOT lub.event_registration_open(target) OR NOT lub.is_student_account(auth.uid()) THEN RAISE EXCEPTION 'Open event and active student required' USING ERRCODE='42501'; END IF;
 IF input IS NULL OR jsonb_typeof(input)<>'object' OR octet_length(input::text)>128000 THEN RAISE EXCEPTION 'Invalid answers'; END IF;
 SELECT * INTO r FROM lub.event_registrations WHERE event_id=target AND user_id=auth.uid() FOR UPDATE;
 IF r.status_code='Cancelled' OR r.review_status_code='Rejected' THEN RAISE EXCEPTION 'Registration unavailable'; END IF;
 IF r.id IS NULL AND e.capacity IS NOT NULL AND (SELECT count(*) FROM lub.event_registrations x WHERE x.event_id=target AND x.status_code='Registered' AND x.review_status_code<>'Rejected' AND lub.is_student_account(x.user_id))>=e.capacity THEN RAISE EXCEPTION 'Event full'; END IF;
 IF e.form_id IS NOT NULL THEN
  IF r.id IS NOT NULL THEN
   snapshot:=r.form_snapshot;
   IF snapshot->>'id' IS DISTINCT FROM version::text OR r.response_revision IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Refresh response'; END IF;
  ELSE
   SELECT f->'version' INTO snapshot FROM lub.organizations o CROSS JOIN LATERAL jsonb_array_elements(o.forms) f WHERE o.id=e.organization_id AND f->>'id'=e.form_id::text AND f->'version'->>'status_code'='Published';
   IF snapshot IS NULL OR version IS DISTINCT FROM e.form_id THEN RAISE EXCEPTION 'Refresh form'; END IF;
  END IF;
  cleaned:=lub.validate_form_answers(snapshot->'definition',input);
  PERFORM lub.form_committee_answer(snapshot->'definition',cleaned,e.organization_id);
  files:=lub.form_answer_attachments(snapshot->'definition',cleaned);
 ELSE
  IF version IS NOT NULL OR input<>'{}'::jsonb THEN RAISE EXCEPTION 'Unexpected answers'; END IF;
  snapshot:='{}'; IF r.id IS NOT NULL THEN RETURN r.id; END IF;
 END IF;
 IF r.id IS NULL THEN
  review:=CASE WHEN e.requires_review THEN 'Pending' ELSE 'Accepted' END;
  INSERT INTO lub.event_registrations(event_id,organization_id,user_id,review_status_code,form_snapshot,answers,attachments)
  VALUES(target,e.organization_id,auth.uid(),review,snapshot,cleaned,files) RETURNING id INTO result;
  INSERT INTO lub.history_events(organization_id,event_registration_id,event_code,to_status_code,actor_user_id) VALUES(e.organization_id,result,'EventRegistered',review,auth.uid());
 ELSE
  UPDATE lub.event_registrations SET answers=cleaned,attachments=files,response_revision=response_revision+1 WHERE id=r.id; result:=r.id;
 END IF;
 PERFORM lub.workflow_notify(auth.uid(),'EVENT_REGISTRATION_CHANGED','/events/'||target); RETURN result;
END; $$;
CREATE FUNCTION lub.cancel_event_registration(target uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e lub.organization_content; r lub.event_registrations;
BEGIN
 e:=lub.lock_event((SELECT event_id FROM lub.event_registrations WHERE id=target));
 SELECT * INTO r FROM lub.event_registrations WHERE id=target FOR UPDATE;
 IF r.user_id IS DISTINCT FROM auth.uid() OR NOT lub.is_student_account(auth.uid()) OR r.status_code<>'Registered' OR r.review_status_code NOT IN ('Pending','Accepted')
  OR e.status_code<>'Published' OR e.starts_at IS NULL OR statement_timestamp()>=e.starts_at THEN RAISE EXCEPTION 'Withdrawal unavailable' USING ERRCODE='42501'; END IF;
 UPDATE lub.event_registrations SET status_code='Cancelled',cancelled_at=now() WHERE id=target;
 INSERT INTO lub.history_events(organization_id,event_registration_id,event_code,from_status_code,to_status_code,actor_user_id) VALUES(e.organization_id,target,'EventWithdrawn',r.review_status_code,'Cancelled',auth.uid());
 PERFORM lub.workflow_notify(auth.uid(),'EVENT_REGISTRATION_CANCELLED','/events/'||e.id);
END; $$;
CREATE FUNCTION lub.reapply_event_registration(target uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e lub.organization_content; r lub.event_registrations;
BEGIN
 e:=lub.lock_event((SELECT event_id FROM lub.event_registrations WHERE id=target));
 PERFORM 1 FROM lub.users WHERE id=auth.uid() FOR UPDATE;
 SELECT * INTO r FROM lub.event_registrations WHERE id=target FOR UPDATE;
 IF r.user_id IS DISTINCT FROM auth.uid() OR r.status_code<>'Cancelled' OR NOT lub.is_student_account(auth.uid()) OR NOT lub.event_registration_open(e.id) THEN RAISE EXCEPTION 'Reapplication unavailable' USING ERRCODE='42501'; END IF;
 IF e.capacity IS NOT NULL AND (SELECT count(*) FROM lub.event_registrations x WHERE x.event_id=e.id AND x.status_code='Registered' AND x.review_status_code<>'Rejected' AND lub.is_student_account(x.user_id))>=e.capacity THEN RAISE EXCEPTION 'Event full'; END IF;
 UPDATE lub.event_registrations SET status_code='Registered',cancelled_at=NULL,review_status_code='Pending',review_note='',reviewed_at=NULL,reviewed_by_user_id=NULL,
  attendance='Pending',checked_in_at=NULL,marked_by_user_id=NULL,response_revision=response_revision+1 WHERE id=target;
 INSERT INTO lub.history_events(organization_id,event_registration_id,event_code,from_status_code,to_status_code,actor_user_id) VALUES(e.organization_id,target,'EventReapplied','Cancelled','Pending',auth.uid());
 PERFORM lub.workflow_notify(auth.uid(),'EVENT_REGISTRATION_CHANGED','/events/'||e.id);
END; $$;
CREATE FUNCTION lub.review_event_registrations(targets uuid[],status text,note text DEFAULT '') RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r lub.event_registrations; changed int:=0;
BEGIN
 IF status IS NULL OR status NOT IN ('Accepted','Rejected') OR targets IS NULL OR cardinality(targets) NOT BETWEEN 1 AND 100 OR array_position(targets,NULL) IS NOT NULL
  OR (SELECT count(DISTINCT x) FROM unnest(targets) x)<>cardinality(targets) OR length(coalesce(note,''))>1000 THEN RAISE EXCEPTION 'Invalid decision'; END IF;
 IF (SELECT count(*) FROM lub.event_registrations WHERE id=ANY(targets))<>cardinality(targets) THEN RAISE EXCEPTION 'Registration required'; END IF;
 PERFORM o.id FROM lub.organizations o WHERE o.id IN (SELECT x.organization_id FROM lub.event_registrations x WHERE x.id=ANY(targets)) ORDER BY o.id FOR UPDATE;
 PERFORM e.id FROM lub.organization_content e WHERE e.id IN (SELECT x.event_id FROM lub.event_registrations x WHERE x.id=ANY(targets)) ORDER BY e.id FOR UPDATE;
 PERFORM x.id FROM lub.event_registrations x WHERE x.id=ANY(targets) ORDER BY x.id FOR UPDATE;
 PERFORM u.id FROM lub.users u WHERE u.id IN (SELECT x.user_id FROM lub.event_registrations x WHERE x.id=ANY(targets)) ORDER BY u.id FOR UPDATE;
 FOR r IN SELECT * FROM lub.event_registrations WHERE id=ANY(targets) ORDER BY id LOOP
  IF NOT lub.can_operate_event(r.event_id,'EVENT_REGISTRATIONS_REVIEW') OR r.status_code<>'Registered' OR NOT lub.is_student_account(r.user_id)
   OR NOT EXISTS(SELECT 1 FROM lub.organization_content e WHERE e.id=r.event_id AND e.kind='Event' AND e.status_code='Published' AND e.archived_at IS NULL AND e.deleted_at IS NULL) THEN RAISE EXCEPTION 'Review permission required' USING ERRCODE='42501'; END IF;
  IF r.review_status_code=status THEN CONTINUE; END IF;
  IF r.review_status_code<>'Pending' THEN RAISE EXCEPTION 'Pending review required' USING ERRCODE='42501'; END IF;
  UPDATE lub.event_registrations SET review_status_code=status,review_note=coalesce(note,''),reviewed_at=now(),reviewed_by_user_id=auth.uid(),
   attendance=CASE WHEN status='Rejected' THEN 'Excused' ELSE 'Pending' END,checked_in_at=NULL,marked_by_user_id=CASE WHEN status='Rejected' THEN auth.uid() END WHERE id=r.id;
  INSERT INTO lub.history_events(organization_id,event_registration_id,event_code,from_status_code,to_status_code,reason,actor_user_id) VALUES(r.organization_id,r.id,'EventReviewed',r.review_status_code,status,coalesce(note,''),auth.uid());
  PERFORM lub.workflow_notify(r.user_id,'EVENT_REGISTRATION_DECIDED','/events/'||r.event_id); changed:=changed+1;
 END LOOP;
 RETURN changed;
END; $$;
CREATE FUNCTION lub.mark_event_attendance(target uuid,status text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e lub.organization_content; r lub.event_registrations;
BEGIN
 e:=lub.lock_event((SELECT event_id FROM lub.event_registrations WHERE id=target));
 SELECT * INTO r FROM lub.event_registrations WHERE id=target FOR UPDATE;
 IF NOT lub.can_operate_event(e.id,'EVENT_ATTENDANCE_MANAGE') OR e.status_code<>'Published' OR e.ends_at>statement_timestamp() OR r.status_code<>'Registered' OR r.review_status_code<>'Accepted'
  OR status IS NULL OR status NOT IN ('Pending','Present','Absent','Excused') THEN RAISE EXCEPTION 'Attendance unavailable' USING ERRCODE='42501'; END IF;
 UPDATE lub.event_registrations SET attendance=status,checked_in_at=CASE WHEN status='Present' THEN now() END,marked_by_user_id=auth.uid() WHERE id=target;
END; $$;
CREATE FUNCTION lub.guard_event_response() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE cleaned jsonb;
BEGIN
 IF TG_OP='UPDATE' AND (NEW.event_id,NEW.organization_id,NEW.user_id,NEW.registered_at,NEW.form_snapshot) IS DISTINCT FROM (OLD.event_id,OLD.organization_id,OLD.user_id,OLD.registered_at,OLD.form_snapshot) THEN RAISE EXCEPTION 'Submitted identity and question snapshot are immutable'; END IF;
 IF NEW.form_snapshot='{}'::jsonb THEN
  IF NEW.answers<>'{}'::jsonb OR NEW.attachments<>'[]'::jsonb THEN RAISE EXCEPTION 'Unexpected answers'; END IF;
 ELSE
  PERFORM lub.validate_form_definition(NEW.form_snapshot->'definition');
  cleaned:=lub.validate_form_answers(NEW.form_snapshot->'definition',NEW.answers);
  IF NEW.answers IS DISTINCT FROM cleaned OR NEW.attachments IS DISTINCT FROM lub.form_answer_attachments(NEW.form_snapshot->'definition',cleaned) THEN RAISE EXCEPTION 'Answers and attachments must match submitted questions'; END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER event_response_snapshot BEFORE INSERT OR UPDATE OF event_id,organization_id,user_id,registered_at,form_snapshot,answers,attachments ON lub.event_registrations FOR EACH ROW EXECUTE FUNCTION lub.guard_event_response();
REVOKE ALL ON FUNCTION lub.event_registration_open(uuid),lub.set_event_registration_policy(uuid,boolean,int),lub.register_event(uuid,uuid,jsonb,int),lub.cancel_event_registration(uuid),lub.reapply_event_registration(uuid),lub.review_event_registrations(uuid[],text,text),lub.mark_event_attendance(uuid,text),lub.guard_event_response() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION lub.set_event_registration_policy(uuid,boolean,int),lub.register_event(uuid,uuid,jsonb,int),lub.cancel_event_registration(uuid),lub.reapply_event_registration(uuid),lub.review_event_registrations(uuid[],text,text),lub.mark_event_attendance(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION lub.event_registration_open(uuid) TO anon,authenticated;
