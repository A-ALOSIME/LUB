ALTER TABLE lub.events ALTER COLUMN starts_at DROP NOT NULL,ALTER COLUMN ends_at DROP NOT NULL,ALTER COLUMN registration_opens_at DROP NOT NULL,ALTER COLUMN registration_closes_at DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE lub.events DROP CONSTRAINT event_bounds_check,DROP CONSTRAINT event_location_check;
--> statement-breakpoint
ALTER TABLE lub.events ADD CONSTRAINT event_bounds_check CHECK(length(title)<=120 AND length(description)<=6000 AND (capacity IS NULL OR capacity between 1 and 10000) AND attendance_hours between 0 and 1000 AND revision>0 AND (status_code='Draft' OR (status_code='Cancelled' AND published_at IS NULL) OR (length(trim(title)) between 2 and 120 AND starts_at IS NOT NULL AND ends_at IS NOT NULL AND registration_opens_at IS NOT NULL AND registration_closes_at IS NOT NULL AND ends_at>starts_at AND registration_closes_at>registration_opens_at AND registration_closes_at<=starts_at)));
--> statement-breakpoint
ALTER TABLE lub.events ADD CONSTRAINT event_location_check CHECK(location_type_code IN ('In_Person','Online','Hybrid') AND (status_code='Draft' OR (status_code='Cancelled' AND published_at IS NULL) OR ((location_type_code='Online' OR coalesce(length(trim(location_text)),0)>0) AND (location_type_code='In_Person' OR coalesce(online_url,'')~'^https://[^[:space:]@]+$'))));
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
 IF capacity IS NOT NULL AND capacity<(SELECT count(*) FROM lub.event_registrations WHERE event_id=target AND status_code='Registered') THEN RAISE EXCEPTION 'Capacity below registrations'; END IF;
 UPDATE lub.events SET title=trim(save_event.title),description=trim(save_event.description),location_type_code=location_type,location_text=nullif(trim(location),''),online_url=nullif(trim(url),''),starts_at=starts,ends_at=ends,registration_opens_at=opens,registration_closes_at=closes,capacity=save_event.capacity,registration_form_template_id=template,attendance_hours=hours,revision=revision+1,updated_at=now() WHERE id=target;
 result:=target; IF e.status_code='Published' THEN PERFORM lub.event_notify(target,'EVENT_CHANGED'); END IF;
 END IF;
 PERFORM lub.task_audit(result,org,'EVENT_SAVED');RETURN result;
END; $$;;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.change_event_status(target uuid,status text,expected int) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e lub.events; term uuid; day date;
BEGIN
 SELECT * INTO e FROM lub.events WHERE id=target FOR UPDATE;
 IF e.id IS NULL OR NOT lub.can_operate_event(target) OR e.revision IS DISTINCT FROM expected OR NOT ((e.status_code='Draft' AND status IN ('Published','Cancelled')) OR (e.status_code='Published' AND status IN ('Draft','Completed','Cancelled'))) THEN RAISE EXCEPTION 'Invalid transition'; END IF;
 IF status='Published' AND (length(trim(e.title))<2 OR e.starts_at IS NULL OR e.ends_at IS NULL OR e.registration_opens_at IS NULL OR e.registration_closes_at IS NULL OR e.ends_at<=e.starts_at OR e.registration_closes_at<=e.registration_opens_at OR e.registration_closes_at>e.starts_at OR (e.location_type_code<>'Online' AND coalesce(length(trim(e.location_text)),0)=0) OR (e.location_type_code<>'In_Person' AND coalesce(e.online_url,'')!~'^https://[^[:space:]@]+$')) THEN RAISE EXCEPTION 'EVENT_REQUIRED_FIELDS'; END IF;
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
END; $$;;
--> statement-breakpoint
DROP POLICY events_read ON lub.events;
CREATE POLICY events_read ON lub.events FOR SELECT TO anon,authenticated USING((published_at IS NOT NULL AND status_code<>'Draft') OR (current_user='authenticated' AND lub.has_event_access(organization_id)));
--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.public_event_poster(target uuid) RETURNS TABLE(object_key text,mime_type text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT a.object_key,a.mime_type
 FROM lub.events e
 JOIN lub.event_assets ea ON ea.event_id=e.id AND ea.asset_type_code='Poster'
 JOIN lub.application_assets a ON a.id=ea.asset_id
 WHERE e.id=target AND e.published_at IS NOT NULL AND e.status_code<>'Draft' AND a.mime_type IN ('image/jpeg','image/png')
 LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION lub.can_read_published_event_poster(target text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(
  SELECT 1 FROM lub.application_assets a
  JOIN lub.event_assets ea ON ea.asset_id=a.id AND ea.asset_type_code='Poster'
  JOIN lub.events e ON e.id=ea.event_id
  WHERE a.object_key=target AND a.mime_type IN ('image/jpeg','image/png') AND e.published_at IS NOT NULL AND e.status_code<>'Draft'
 );
$$;


--> statement-breakpoint
CREATE FUNCTION lub.save_and_publish_event(target uuid,org uuid,title text,description text,location_type text,location text,url text,starts timestamptz,ends timestamptz,opens timestamptz,closes timestamptz,capacity int,template uuid,hours numeric,expected int,poster uuid,publish boolean) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result uuid; revision int; status text;
BEGIN
 result:=lub.save_event_with_poster(target,org,title,description,location_type,location,url,starts,ends,opens,closes,capacity,template,hours,expected,poster);
 IF publish THEN
  SELECT e.revision,e.status_code INTO revision,status FROM lub.events e WHERE e.id=result;
  IF status<>'Published' THEN PERFORM lub.change_event_status(result,'Published',revision); END IF;
 END IF;
 RETURN result;
END; $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION lub.save_and_publish_event(uuid,uuid,text,text,text,text,text,timestamptz,timestamptz,timestamptz,timestamptz,int,uuid,numeric,int,uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION lub.save_and_publish_event(uuid,uuid,text,text,text,text,text,timestamptz,timestamptz,timestamptz,timestamptz,int,uuid,numeric,int,uuid,boolean) TO authenticated;
