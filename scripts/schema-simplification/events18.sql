CREATE FUNCTION lub.can_operate_event(target uuid,capability text DEFAULT 'EVENTS_MANAGE') RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT capability IN ('EVENTS_MANAGE','EVENT_REGISTRATIONS_REVIEW','EVENT_ATTENDANCE_MANAGE') AND EXISTS(SELECT 1 FROM lub.organization_content e WHERE e.id=target AND e.kind='Event' AND e.deleted_at IS NULL AND lub.has_org_permission(e.organization_id,capability));
$$;
CREATE OR REPLACE FUNCTION lub.content_is_public(target uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM lub.organization_content c JOIN lub.organizations o ON o.id=c.organization_id WHERE c.id=target AND o.status_code='Active' AND c.published_at<=statement_timestamp()
 AND c.archived_at IS NULL AND c.deleted_at IS NULL AND (c.status_code IN ('Published','Completed') OR (c.kind='Event' AND c.status_code IN ('Archived','Cancelled'))));
$$;
CREATE FUNCTION lub.can_read_event(target uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM lub.organization_content WHERE id=target AND kind='Event') AND (lub.content_is_public(target) OR lub.can_operate_event(target) OR lub.can_operate_event(target,'EVENT_REGISTRATIONS_REVIEW') OR lub.can_operate_event(target,'EVENT_ATTENDANCE_MANAGE')
 OR (EXISTS(SELECT 1 FROM lub.users WHERE id=auth.uid() AND status_code='Active') AND EXISTS(SELECT 1 FROM lub.event_registrations r WHERE r.event_id=target AND r.user_id=auth.uid())));
$$;
CREATE FUNCTION lub.lock_event(target uuid) RETURNS lub.organization_content LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result lub.organization_content; org uuid;
BEGIN
 SELECT organization_id INTO org FROM lub.organization_content WHERE id=target AND kind='Event';
 PERFORM 1 FROM lub.organizations WHERE id=org FOR UPDATE;
 SELECT * INTO result FROM lub.organization_content WHERE id=target AND kind='Event' AND deleted_at IS NULL FOR UPDATE;
 IF result.id IS NULL THEN RAISE EXCEPTION 'Event required'; END IF; RETURN result;
END; $$;
CREATE FUNCTION lub.validate_event_ready(target uuid,new_publication boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e lub.organization_content;
BEGIN
 SELECT * INTO e FROM lub.organization_content WHERE id=target AND kind='Event';
 IF e.id IS NULL OR length(trim(e.title))<2 OR e.starts_at IS NULL OR e.ends_at IS NULL OR e.registration_opens_at IS NULL OR e.registration_closes_at IS NULL
  OR e.ends_at<=e.starts_at OR e.registration_closes_at<=e.registration_opens_at OR e.registration_closes_at>e.starts_at
  OR e.location_type_code='Unknown' OR (e.location_type_code<>'Online' AND coalesce(length(trim(e.location_text)),0)=0)
  OR (e.location_type_code<>'In_Person' AND coalesce(e.online_url,'')!~*'^https://[^/@[:space:]]+([/?#][^[:space:]]*)?$')
  OR (new_publication AND e.registration_closes_at<=statement_timestamp()) THEN RAISE EXCEPTION 'EVENT_REQUIRED_FIELDS'; END IF;
END; $$;
CREATE FUNCTION lub.save_event(target uuid,org uuid,title text,description text,location_type text,location text,url text,starts timestamptz,ends timestamptz,opens timestamptz,closes timestamptz,capacity int,template uuid,hours numeric,expected int) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e lub.organization_content; result uuid;
BEGIN
 PERFORM 1 FROM lub.organizations WHERE id=org FOR UPDATE;
 IF NOT lub.has_org_permission(org,'EVENTS_MANAGE') THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 IF title IS NULL OR length(title)>120 OR description IS NULL OR length(description)>6000 OR location_type IS NULL OR location_type NOT IN ('In_Person','Online','Hybrid','Unknown')
  OR hours IS NULL OR hours NOT BETWEEN 0 AND 1000 OR hours<>round(hours,2) OR (capacity IS NOT NULL AND capacity NOT BETWEEN 1 AND 10000)
  OR (starts IS NOT NULL AND ends IS NOT NULL AND ends<=starts) OR (opens IS NOT NULL AND closes IS NOT NULL AND closes<=opens)
  OR (nullif(trim(url),'') IS NOT NULL AND trim(url)!~*'^https://[^/@[:space:]]+([/?#][^[:space:]]*)?$') THEN RAISE EXCEPTION 'Invalid event'; END IF;
 IF template IS NOT NULL AND NOT EXISTS(SELECT 1 FROM lub.organizations o CROSS JOIN LATERAL jsonb_array_elements(o.forms) f WHERE o.id=org AND f->>'id'=template::text AND f->'version'->>'status_code'='Published') THEN RAISE EXCEPTION 'Published form required'; END IF;
 IF target IS NULL THEN
  INSERT INTO lub.organization_content(organization_id,created_by_user_id,kind,title,body,location_type_code,location_text,online_url,starts_at,ends_at,registration_opens_at,registration_closes_at,capacity,form_id,attendance_hours)
  VALUES(org,auth.uid(),'Event',trim(title),trim(description),location_type,nullif(trim(location),''),nullif(trim(url),''),starts,ends,opens,closes,capacity,template,hours) RETURNING id INTO result;
 ELSE
  e:=lub.lock_event(target);
  IF e.organization_id<>org OR e.revision IS DISTINCT FROM expected OR e.status_code NOT IN ('Draft','Published') OR e.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Refresh event'; END IF;
  IF e.published_at IS NOT NULL AND (template IS DISTINCT FROM e.form_id OR hours IS DISTINCT FROM e.attendance_hours) THEN RAISE EXCEPTION 'Published form and hours are immutable'; END IF;
  IF capacity IS NOT NULL AND capacity<(SELECT count(*) FROM lub.event_registrations r WHERE r.event_id=target AND r.status_code='Registered' AND r.review_status_code<>'Rejected' AND lub.is_student_account(r.user_id)) THEN RAISE EXCEPTION 'Capacity below registrations'; END IF;
  UPDATE lub.organization_content SET title=trim(save_event.title),body=trim(description),location_type_code=location_type,location_text=nullif(trim(location),''),online_url=nullif(trim(url),''),starts_at=starts,ends_at=ends,registration_opens_at=opens,registration_closes_at=closes,capacity=save_event.capacity,form_id=template,attendance_hours=hours,revision=revision+1,updated_at=now() WHERE id=target;
  result:=target; IF e.status_code='Published' THEN PERFORM lub.validate_event_ready(target,false); END IF;
 END IF;
 RETURN result;
END; $$;
CREATE FUNCTION lub.award_event_hours(target uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e lub.organization_content; day date; term uuid; r record; member lub.organization_memberships;
BEGIN
 SELECT * INTO e FROM lub.organization_content WHERE id=target AND kind='Event'; day:=(e.ends_at AT TIME ZONE 'Asia/Riyadh')::date;
 IF e.attendance_hours=0 THEN RETURN; END IF;
 SELECT id INTO term FROM lub.academic_terms WHERE day BETWEEN start_date AND end_date FOR KEY SHARE;
 FOR r IN SELECT x.id,x.user_id FROM lub.event_registrations x WHERE x.event_id=target AND x.status_code='Registered' AND x.review_status_code='Accepted' AND x.attendance='Present' AND lub.is_student_account(x.user_id) ORDER BY x.user_id LOOP
  SELECT * INTO member FROM lub.organization_memberships m WHERE m.organization_id=e.organization_id AND m.user_id=r.user_id AND m.start_date<=day AND (m.end_date IS NULL OR m.end_date>day) ORDER BY m.start_date DESC,m.id LIMIT 1 FOR UPDATE;
  IF member.id IS NULL THEN CONTINUE; END IF;
  IF term IS NULL OR NOT lub.can_approve_hours(e.organization_id,NULL) THEN RAISE EXCEPTION 'Term and hours approval required' USING ERRCODE='P0002'; END IF;
  IF EXISTS(SELECT 1 FROM lub.organization_memberships m CROSS JOIN LATERAL jsonb_array_elements(m.hours) h WHERE h->>'source_code'='EVENT_ATTENDANCE' AND h->>'source_id'=r.id::text) THEN RAISE EXCEPTION 'Attendance hours already awarded'; END IF;
  UPDATE lub.organization_memberships SET hours=hours||jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'committee_id',NULL,'academic_term_id',term,'source_code','EVENT_ATTENDANCE','source_id',r.id,
   'hours',e.attendance_hours,'activity_date',day,'description',e.title,'status_code','Approved','requested_by_user_id',auth.uid(),'reviewed_by_user_id',auth.uid(),'reviewed_at',clock_timestamp(),'review_note','إكمال الفعالية وتثبيت الحضور','created_at',clock_timestamp(),'updated_at',clock_timestamp())),updated_at=now() WHERE id=member.id;
 END LOOP;
END; $$;
CREATE FUNCTION lub.change_event_status(target uuid,status text,expected int) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e lub.organization_content; recipient record;
BEGIN
 e:=lub.lock_event(target);
 IF NOT lub.can_operate_event(target) THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 IF e.revision IS DISTINCT FROM expected OR status IS NULL OR NOT ((e.status_code='Draft' AND status IN ('Published','Cancelled')) OR (e.status_code='Published' AND status IN ('Draft','Completed','Cancelled'))) THEN RAISE EXCEPTION 'Invalid event transition'; END IF;
 IF status='Published' THEN PERFORM lub.validate_event_ready(target,true);
 ELSIF status='Completed' THEN
  IF e.ends_at>statement_timestamp() OR EXISTS(SELECT 1 FROM lub.event_registrations r WHERE r.event_id=target AND r.status_code='Registered' AND lub.is_student_account(r.user_id) AND (r.review_status_code='Pending' OR r.attendance='Pending')) THEN RAISE EXCEPTION 'Review attendance after the event'; END IF;
  PERFORM lub.award_event_hours(target);
 END IF;
 UPDATE lub.organization_content SET status_code=status,revision=revision+1,published_at=CASE WHEN status='Published' THEN coalesce(published_at,now()) ELSE published_at END,completed_at=CASE WHEN status='Completed' THEN now() END,cancelled_at=CASE WHEN status='Cancelled' THEN now() END,updated_at=now() WHERE id=target;
 FOR recipient IN SELECT r.user_id FROM lub.event_registrations r WHERE r.event_id=target ORDER BY r.user_id LOOP PERFORM lub.workflow_notify(recipient.user_id,'EVENT_'||status,'/events/'||target); END LOOP;
END; $$;
CREATE FUNCTION lub.set_event_poster(target_event uuid,asset uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e lub.organization_content;
BEGIN
 e:=lub.lock_event(target_event);
 IF NOT lub.can_operate_event(target_event) OR e.status_code NOT IN ('Draft','Published') THEN RAISE EXCEPTION 'Event permission required' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM lub.assets a WHERE a.id=asset AND a.mime_type IN ('image/png','image/jpeg') AND a.size_bytes<=5242880 AND (a.owner_user_id=auth.uid() OR a.id=e.primary_image_id) FOR KEY SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Own image required' USING ERRCODE='42501'; END IF;
 UPDATE lub.organization_content SET primary_image_id=asset,revision=revision+1,updated_at=now() WHERE id=target_event;
END; $$;
CREATE FUNCTION lub.remove_event_poster(target uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e lub.organization_content;
BEGIN
 e:=lub.lock_event(target); IF NOT lub.can_operate_event(target) OR e.status_code NOT IN ('Draft','Published') THEN RAISE EXCEPTION 'Event permission required' USING ERRCODE='42501'; END IF;
 UPDATE lub.organization_content SET primary_image_id=NULL,revision=revision+1,updated_at=now() WHERE id=target;
END; $$;
CREATE FUNCTION lub.save_and_publish_event(target uuid,org uuid,title text,description text,location_type text,location text,url text,starts timestamptz,ends timestamptz,opens timestamptz,closes timestamptz,capacity int,template uuid,hours numeric,expected int,poster uuid,publish boolean) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result uuid; revision int; state text;
BEGIN
 result:=lub.save_event(target,org,title,description,location_type,location,url,starts,ends,opens,closes,capacity,template,hours,expected);
 IF poster IS NOT NULL THEN PERFORM lub.set_event_poster(result,poster); END IF;
 SELECT e.revision,e.status_code INTO revision,state FROM lub.organization_content e WHERE e.id=result;
 IF publish AND state='Draft' THEN PERFORM lub.change_event_status(result,'Published',revision); END IF; RETURN result;
END; $$;
CREATE FUNCTION lub.event_list_action(target uuid,operation text,expected int) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e lub.organization_content; state text;
BEGIN
 e:=lub.lock_event(target); IF NOT lub.can_operate_event(target) THEN RAISE EXCEPTION 'Event permission required' USING ERRCODE='42501'; END IF;
 IF e.revision IS DISTINCT FROM expected OR operation IS NULL OR operation NOT IN ('archive','restore','delete') THEN RAISE EXCEPTION 'Refresh event'; END IF;
 IF operation='restore' THEN
  IF e.status_code<>'Archived' THEN RAISE EXCEPTION 'Archived event required'; END IF;
  state:=coalesce(e.archived_from_status,'Draft');
  UPDATE lub.organization_content SET status_code=state,published_at=CASE WHEN state='Draft' THEN NULL ELSE coalesce(e.archived_from_published_at,e.published_at) END,
   completed_at=CASE WHEN state='Completed' THEN completed_at END,cancelled_at=CASE WHEN state='Cancelled' THEN cancelled_at END,archived_at=NULL,archived_from_status=NULL,archived_from_published_at=NULL,revision=revision+1,updated_at=now() WHERE id=target;
 ELSIF operation='archive' THEN
  IF e.status_code='Archived' THEN RAISE EXCEPTION 'Already archived'; END IF;
  UPDATE lub.organization_content SET archived_from_status=status_code,archived_from_published_at=published_at,status_code='Archived',archived_at=now(),is_featured=false,revision=revision+1,updated_at=now() WHERE id=target;
 ELSE
  IF e.status_code<>'Draft' OR e.published_at IS NOT NULL OR EXISTS(SELECT 1 FROM lub.event_registrations WHERE event_id=target) THEN RAISE EXCEPTION 'Only unused drafts can be deleted'; END IF;
  UPDATE lub.organization_content SET deleted_at=now(),is_featured=false,revision=revision+1,updated_at=now() WHERE id=target;
 END IF;
END; $$;
CREATE FUNCTION lub.duplicate_event(target uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e lub.organization_content; result uuid;
BEGIN
 e:=lub.lock_event(target); IF NOT lub.can_operate_event(target) THEN RAISE EXCEPTION 'Event permission required' USING ERRCODE='42501'; END IF;
 INSERT INTO lub.organization_content(organization_id,created_by_user_id,duplicated_from_content_id,kind,title,title_en,body,body_en,location_type_code,location_text,online_url,starts_at,ends_at,registration_opens_at,registration_closes_at,capacity,form_id,attendance_hours,primary_image_id,skill_ids,requires_review)
 VALUES(e.organization_id,auth.uid(),e.id,'Event',e.title,e.title_en,e.body,e.body_en,e.location_type_code,e.location_text,e.online_url,e.starts_at,e.ends_at,e.registration_opens_at,e.registration_closes_at,e.capacity,e.form_id,e.attendance_hours,e.primary_image_id,e.skill_ids,e.requires_review) RETURNING id INTO result; RETURN result;
END; $$;
CREATE FUNCTION lub.set_event_public_content(target uuid,report text,photos text[]) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e lub.organization_content; entries jsonb;
BEGIN
 e:=lub.lock_event(target); IF NOT lub.can_operate_event(target) THEN RAISE EXCEPTION 'Event permission required' USING ERRCODE='42501'; END IF;
 IF report IS NULL OR length(report)>5000 OR photos IS NULL OR cardinality(photos)>4 OR array_position(photos,NULL) IS NOT NULL THEN RAISE EXCEPTION 'Invalid public content'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',gen_random_uuid(),'url',p) ORDER BY ordinal),'[]') INTO entries FROM unnest(photos) WITH ORDINALITY x(p,ordinal);
 UPDATE lub.organization_content SET public_report=report,public_photos=entries,revision=revision+1,updated_at=now() WHERE id=target;
END; $$;
CREATE FUNCTION lub.public_event_poster(target uuid) RETURNS TABLE(object_key text,mime_type text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT a.object_key,a.mime_type::text FROM lub.organization_content e JOIN lub.assets a ON a.id=e.primary_image_id WHERE e.id=target AND e.kind='Event' AND lub.content_is_public(e.id) AND a.mime_type IN ('image/png','image/jpeg');
$$;
CREATE FUNCTION lub.public_event_poster_dimensions(target uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('width',a.image_width,'height',a.image_height) FROM lub.organization_content e JOIN lub.assets a ON a.id=e.primary_image_id WHERE e.id=target AND e.kind='Event' AND lub.content_is_public(e.id) AND a.image_width IS NOT NULL AND a.image_height IS NOT NULL;
$$;
CREATE FUNCTION lub.public_event_thumbnail(target uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT a.thumbnail_png_base64 FROM lub.organization_content e JOIN lub.assets a ON a.id=e.primary_image_id WHERE e.id=target AND e.kind='Event' AND lub.content_is_public(e.id);
$$;
REVOKE ALL ON FUNCTION lub.can_operate_event(uuid,text),lub.can_read_event(uuid),lub.lock_event(uuid),lub.validate_event_ready(uuid,boolean),lub.award_event_hours(uuid),lub.save_event(uuid,uuid,text,text,text,text,text,timestamptz,timestamptz,timestamptz,timestamptz,int,uuid,numeric,int),lub.change_event_status(uuid,text,int),lub.set_event_poster(uuid,uuid),lub.remove_event_poster(uuid),lub.save_and_publish_event(uuid,uuid,text,text,text,text,text,timestamptz,timestamptz,timestamptz,timestamptz,int,uuid,numeric,int,uuid,boolean),lub.event_list_action(uuid,text,int),lub.duplicate_event(uuid),lub.set_event_public_content(uuid,text,text[]),lub.public_event_poster(uuid),lub.public_event_poster_dimensions(uuid),lub.public_event_thumbnail(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION lub.can_operate_event(uuid,text),lub.save_event(uuid,uuid,text,text,text,text,text,timestamptz,timestamptz,timestamptz,timestamptz,int,uuid,numeric,int),lub.change_event_status(uuid,text,int),lub.set_event_poster(uuid,uuid),lub.remove_event_poster(uuid),lub.save_and_publish_event(uuid,uuid,text,text,text,text,text,timestamptz,timestamptz,timestamptz,timestamptz,int,uuid,numeric,int,uuid,boolean),lub.event_list_action(uuid,text,int),lub.duplicate_event(uuid),lub.set_event_public_content(uuid,text,text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION lub.can_read_event(uuid),lub.public_event_poster(uuid),lub.public_event_poster_dimensions(uuid),lub.public_event_thumbnail(uuid) TO anon,authenticated;
