-- Tasks keep one current definition; each participant owns an append-only submission list.
CREATE FUNCTION lub.can_manage_task(target uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM lub.tasks t WHERE t.id=target AND t.deleted_at IS NULL AND lub.has_org_permission(t.organization_id,'TASKS_MANAGE',t.committee_id));
$$;
CREATE FUNCTION lub.can_review_task(target uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM lub.tasks t WHERE t.id=target AND t.deleted_at IS NULL AND lub.has_org_permission(t.organization_id,'TASKS_REVIEW',t.committee_id));
$$;
CREATE FUNCTION lub.owns_task_participant(target uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT lub.is_student_account(auth.uid()) AND EXISTS(SELECT 1 FROM lub.task_participants p WHERE p.id=target AND p.user_id=auth.uid());
$$;
CREATE FUNCTION lub.lock_task(target uuid) RETURNS lub.tasks LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result lub.tasks; org uuid;
BEGIN
 SELECT organization_id INTO org FROM lub.tasks WHERE id=target;
 PERFORM 1 FROM lub.organizations WHERE id=org FOR SHARE;
 SELECT * INTO result FROM lub.tasks WHERE id=target FOR UPDATE;
 IF result.id IS NULL THEN RAISE EXCEPTION 'Task required'; END IF; RETURN result;
END; $$;
CREATE FUNCTION lub.submission_storage_owner(target uuid) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT p.id FROM lub.task_participants p WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(p.submissions) s WHERE (s->>'id')::uuid=target);
$$;
CREATE FUNCTION lub.store_submission(participant uuid,target uuid,entry jsonb) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 UPDATE lub.task_participants SET submissions=(SELECT jsonb_agg(CASE WHEN (s->>'id')::uuid=target THEN entry ELSE s END ORDER BY ordinal)
  FROM jsonb_array_elements(submissions) WITH ORDINALITY AS x(s,ordinal)) WHERE id=participant;
$$;
CREATE FUNCTION lub.check_task_submissions() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE original jsonb; current_entry jsonb; file jsonb; previous_max int:=0;
BEGIN
 IF TG_OP='UPDATE' THEN
  SELECT coalesce(max((s->>'revision_number')::int),0) INTO previous_max FROM jsonb_array_elements(OLD.submissions) s;
  FOR original IN SELECT value FROM jsonb_array_elements(OLD.submissions) LOOP
   SELECT s INTO current_entry FROM jsonb_array_elements(NEW.submissions) s WHERE s->>'id'=original->>'id';
   IF current_entry IS NULL THEN RAISE EXCEPTION 'Submissions cannot be deleted'; END IF;
   IF original IS NOT DISTINCT FROM current_entry THEN CONTINUE; END IF;
   IF original->>'status_code'<>'Submitted' OR original->>'withdrawn_at' IS NOT NULL
    OR current_entry->>'status_code' NOT IN ('Approved','Rejected','Withdrawn')
    OR (original-ARRAY['status_code','withdrawn_at','reviewed_at','reviewed_by_user_id','review_note','review_decision_code']) IS DISTINCT FROM (current_entry-ARRAY['status_code','withdrawn_at','reviewed_at','reviewed_by_user_id','review_note','review_decision_code']) THEN RAISE EXCEPTION 'Submission content and final decisions are immutable'; END IF;
  END LOOP;
 END IF;
 IF (SELECT count(*) FROM jsonb_array_elements(NEW.submissions) s WHERE s->>'status_code'='Submitted')>1
  OR (SELECT count(*)<>count(DISTINCT s->>'revision_number') FROM jsonb_array_elements(NEW.submissions) s) THEN RAISE EXCEPTION 'Only one pending submission is allowed'; END IF;
 FOR current_entry IN SELECT value FROM jsonb_array_elements(NEW.submissions) LOOP
  IF coalesce(current_entry->>'status_code','') NOT IN ('Submitted','Approved','Rejected','Withdrawn') OR coalesce(current_entry->>'revision_number','') !~ '^[1-9][0-9]{0,8}$'
   OR jsonb_typeof(current_entry->'message') IS DISTINCT FROM 'string' OR length(current_entry->>'message')>6000
   OR jsonb_typeof(current_entry->'task_snapshot') IS DISTINCT FROM 'object' OR current_entry->'task_snapshot'->>'id' IS DISTINCT FROM NEW.task_id::text
   OR jsonb_typeof(current_entry->'attachments') IS DISTINCT FROM 'array' OR NOT lub.valid_records(current_entry->'attachments') OR jsonb_array_length(current_entry->'attachments')>5 THEN RAISE EXCEPTION 'Invalid submission record'; END IF;
  IF TG_OP='UPDATE' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(OLD.submissions) s WHERE s->>'id'=current_entry->>'id')
   AND (current_entry->>'revision_number')::int<>previous_max+1 THEN RAISE EXCEPTION 'Invalid submission sequence'; END IF;
  FOR file IN SELECT value FROM jsonb_array_elements(current_entry->'attachments') LOOP
   PERFORM 1 FROM lub.assets a WHERE a.id=(file->>'assetId')::uuid AND a.owner_user_id=NEW.user_id FOR KEY SHARE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Invalid attachment'; END IF;
  END LOOP;
 END LOOP;
 RETURN NEW;
END; $$;
CREATE TRIGGER participant_submissions BEFORE INSERT OR UPDATE OF submissions ON lub.task_participants FOR EACH ROW EXECUTE FUNCTION lub.check_task_submissions();

CREATE FUNCTION lub.save_task(target uuid,org uuid,committee uuid,title text,description text,starts timestamptz,due timestamptz,hours numeric,expected int) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE original lub.tasks; result uuid;
BEGIN
 IF NOT lub.has_org_permission(org,'TASKS_MANAGE',committee) THEN RAISE EXCEPTION 'Task permission required' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM lub.organizations WHERE id=org FOR SHARE;
 IF title IS NULL OR length(trim(title)) NOT BETWEEN 2 AND 120 OR description IS NULL OR length(trim(description)) NOT BETWEEN 1 AND 6000
  OR hours IS NULL OR hours NOT BETWEEN 0 AND 1000 OR hours<>round(hours,2) OR (starts IS NOT NULL AND due IS NOT NULL AND due<=starts) THEN RAISE EXCEPTION 'Invalid task'; END IF;
 IF target IS NULL THEN
  INSERT INTO lub.tasks(organization_id,committee_id,created_by_user_id,title,description,starts_at,due_at,default_hours) VALUES(org,committee,auth.uid(),trim(title),trim(description),starts,due,hours) RETURNING id INTO result;
 ELSE
  original:=lub.lock_task(target);
  IF original.organization_id<>org OR NOT lub.can_manage_task(target) OR original.revision IS DISTINCT FROM expected OR original.status_code NOT IN ('Draft','Open') THEN RAISE EXCEPTION 'Task changed or unavailable' USING ERRCODE='42501'; END IF;
  IF original.committee_id IS DISTINCT FROM committee AND EXISTS(SELECT 1 FROM lub.task_participants p WHERE p.task_id=target) THEN RAISE EXCEPTION 'Task scope is fixed after participation starts' USING ERRCODE='42501'; END IF;
  UPDATE lub.tasks SET committee_id=committee,title=trim(save_task.title),description=trim(save_task.description),starts_at=starts,due_at=due,default_hours=hours,revision=revision+1,updated_at=now() WHERE id=target;
  result:=target;
 END IF;
 RETURN result;
END; $$;
CREATE FUNCTION lub.change_task_status(target uuid,status text,expected int) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE task lub.tasks;
BEGIN
 task:=lub.lock_task(target);
 IF NOT lub.can_manage_task(target) OR task.revision IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Task changed or unavailable' USING ERRCODE='42501'; END IF;
 IF status IS NULL OR status NOT IN ('Open','Completed','Cancelled') OR task.status_code NOT IN ('Draft','Open') OR (status='Open' AND task.status_code<>'Draft') THEN RAISE EXCEPTION 'Invalid task transition'; END IF;
 UPDATE lub.tasks SET status_code=status,closed_at=CASE WHEN status IN ('Completed','Cancelled') THEN clock_timestamp() END,revision=revision+1,updated_at=now() WHERE id=target;
END; $$;
CREATE FUNCTION lub.join_task(target uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE task lub.tasks; member uuid; participant lub.task_participants; result uuid;
BEGIN
 task:=lub.lock_task(target);
 IF task.deleted_at IS NOT NULL OR task.status_code<>'Open' OR (task.starts_at IS NOT NULL AND task.starts_at>statement_timestamp()) OR NOT (lub.task_scope_member(task.organization_id,task.committee_id) OR lub.can_manage_task(target)) THEN RAISE EXCEPTION 'Participation unavailable' USING ERRCODE='42501'; END IF;
 SELECT m.id INTO member FROM lub.organization_memberships m WHERE m.organization_id=task.organization_id AND m.user_id=auth.uid() AND m.status_code='Active' AND m.start_date<=lub.today_riyadh() AND (m.end_date IS NULL OR m.end_date>lub.today_riyadh()) FOR UPDATE;
 IF member IS NULL OR NOT lub.is_student_account(auth.uid()) THEN RAISE EXCEPTION 'Active member required' USING ERRCODE='42501'; END IF;
 SELECT * INTO participant FROM lub.task_participants WHERE task_id=target AND user_id=auth.uid() FOR UPDATE;
 IF participant.id IS NULL THEN
  INSERT INTO lub.task_participants(task_id,organization_id,organization_membership_id,user_id,status_code,joined_at) VALUES(target,task.organization_id,member,auth.uid(),'In_Progress',clock_timestamp()) RETURNING id INTO result;
 ELSIF participant.status_code='Closed' AND participant.withdrawn_at IS NOT NULL THEN
  UPDATE lub.task_participants SET organization_membership_id=member,status_code='In_Progress',joined_at=clock_timestamp(),closed_at=NULL,withdrawn_at=NULL,reviewed_by_user_id=NULL WHERE id=participant.id RETURNING id INTO result;
 ELSE RAISE EXCEPTION 'Participation unavailable'; END IF;
 RETURN result;
END; $$;
CREATE FUNCTION lub.submit_task(target uuid,message text,assets uuid[],expected int,task_expected int) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE task lub.tasks; participant lub.task_participants; last_revision int; result uuid:=gen_random_uuid(); asset uuid; files jsonb;
BEGIN
 task:=lub.lock_task((SELECT task_id FROM lub.task_participants WHERE id=target));
 SELECT * INTO participant FROM lub.task_participants WHERE id=target FOR UPDATE;
 IF NOT lub.owns_task_participant(target) THEN RAISE EXCEPTION 'Own participation required' USING ERRCODE='42501'; END IF;
 IF task.deleted_at IS NOT NULL OR task.status_code<>'Open' OR task.revision IS DISTINCT FROM task_expected OR participant.status_code NOT IN ('Joined','In_Progress') OR NOT (lub.task_scope_member(task.organization_id,task.committee_id) OR lub.can_manage_task(task.id)) THEN RAISE EXCEPTION 'Participation unavailable'; END IF;
 SELECT coalesce(max((s->>'revision_number')::int),0) INTO last_revision FROM jsonb_array_elements(participant.submissions) s;
 IF expected IS DISTINCT FROM last_revision OR assets IS NULL OR cardinality(assets)>5 OR array_position(assets,NULL) IS NOT NULL OR cardinality(assets)<>(SELECT count(DISTINCT value) FROM unnest(assets) value)
  OR message IS NULL OR length(message)>6000 OR (length(trim(message))=0 AND cardinality(assets)=0) THEN RAISE EXCEPTION 'Invalid submission'; END IF;
 FOREACH asset IN ARRAY assets LOOP
  PERFORM 1 FROM lub.assets a WHERE a.id=asset AND a.owner_user_id=auth.uid() AND a.size_bytes<=5242880 AND a.mime_type IN ('application/pdf','image/jpeg','image/png') FOR KEY SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid attachment'; END IF;
 END LOOP;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',value,'assetId',value)),'[]') INTO files FROM unnest(assets) value;
 UPDATE lub.task_participants SET submissions=submissions||jsonb_build_array(jsonb_build_object('id',result,'revision_number',last_revision+1,'message',trim(message),'status_code','Submitted','submitted_at',clock_timestamp(),
  'reviewed_at',NULL,'reviewed_by_user_id',NULL,'review_note','','review_decision_code',NULL,'withdrawn_at',NULL,'attachments',files,
  'task_snapshot',jsonb_build_object('id',task.id,'organization_id',task.organization_id,'committee_id',task.committee_id,'title',task.title,'description',task.description,'default_hours',task.default_hours,'starts_at',task.starts_at,'due_at',task.due_at,'revision',task.revision))),status_code='Submitted' WHERE id=target;
 RETURN result;
END; $$;
CREATE FUNCTION lub.withdraw_task_submission(target uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE owner uuid; task lub.tasks; participant lub.task_participants; submission jsonb;
BEGIN
 owner:=lub.submission_storage_owner(target); task:=lub.lock_task((SELECT task_id FROM lub.task_participants WHERE id=owner));
 SELECT * INTO participant FROM lub.task_participants WHERE id=owner FOR UPDATE;
 SELECT s INTO submission FROM jsonb_array_elements(participant.submissions) s WHERE (s->>'id')::uuid=target;
 IF task.status_code<>'Open' OR NOT lub.owns_task_participant(owner) OR participant.status_code<>'Submitted' OR submission->>'status_code'<>'Submitted' THEN RAISE EXCEPTION 'Own pending submission required' USING ERRCODE='42501'; END IF;
 PERFORM lub.store_submission(owner,target,submission||jsonb_build_object('status_code','Withdrawn','withdrawn_at',clock_timestamp()));
 UPDATE lub.task_participants SET status_code='In_Progress',closed_at=NULL WHERE id=owner;
END; $$;
CREATE FUNCTION lub.withdraw_task_participation(target uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE task lub.tasks; participant lub.task_participants;
BEGIN
 task:=lub.lock_task((SELECT task_id FROM lub.task_participants WHERE id=target)); SELECT * INTO participant FROM lub.task_participants WHERE id=target FOR UPDATE;
 IF task.status_code<>'Open' OR NOT lub.owns_task_participant(target) OR participant.status_code NOT IN ('Joined','In_Progress','Submitted') THEN RAISE EXCEPTION 'Participation unavailable' USING ERRCODE='42501'; END IF;
 UPDATE lub.task_participants SET submissions=coalesce((SELECT jsonb_agg(CASE WHEN s->>'status_code'='Submitted' THEN s||jsonb_build_object('status_code','Withdrawn','withdrawn_at',clock_timestamp()) ELSE s END ORDER BY ordinal) FROM jsonb_array_elements(submissions) WITH ORDINALITY AS x(s,ordinal)),'[]'),status_code='Closed',closed_at=clock_timestamp(),withdrawn_at=clock_timestamp() WHERE id=target;
END; $$;
CREATE FUNCTION lub.award_task_hours(target uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE participant lub.task_participants; task lub.tasks; submission jsonb; term uuid; day date; amount numeric; result uuid; approved boolean;
BEGIN
 SELECT * INTO participant FROM lub.task_participants WHERE id=target FOR UPDATE; SELECT * INTO task FROM lub.tasks WHERE id=participant.task_id;
 IF participant.id IS NULL OR participant.status_code<>'Approved' OR NOT lub.is_student_account(participant.user_id) THEN RAISE EXCEPTION 'Approved participation required'; END IF;
 SELECT (h->>'id')::uuid INTO result FROM lub.organization_memberships m CROSS JOIN LATERAL jsonb_array_elements(m.hours) h WHERE h->>'source_code'='TASK' AND h->>'source_id'=target::text;
 IF result IS NOT NULL THEN RETURN result; END IF;
 SELECT s INTO submission FROM jsonb_array_elements(participant.submissions) s WHERE s->>'status_code'='Approved' ORDER BY (s->>'revision_number')::int DESC LIMIT 1;
 day:=(participant.closed_at AT TIME ZONE 'Asia/Riyadh')::date; SELECT t.id INTO term FROM lub.academic_terms t WHERE day BETWEEN t.start_date AND t.end_date;
 IF term IS NULL OR submission IS NULL THEN RAISE EXCEPTION 'Define academic term before approval' USING ERRCODE='P0002'; END IF;
 amount:=coalesce(participant.approved_hours_override,(submission->'task_snapshot'->>'default_hours')::numeric); approved:=lub.can_approve_hours(task.organization_id,task.committee_id); result:=gen_random_uuid();
 PERFORM 1 FROM lub.organization_memberships WHERE id=participant.organization_membership_id FOR UPDATE;
 UPDATE lub.organization_memberships SET hours=hours||jsonb_build_array(jsonb_build_object('id',result,'committee_id',task.committee_id,'academic_term_id',term,'source_code','TASK','source_id',target,'hours',amount,'activity_date',day,'description','مشاركة معتمدة في مهمة',
  'status_code',CASE WHEN approved THEN 'Approved' ELSE 'Pending' END,'requested_by_user_id',auth.uid(),'reviewed_by_user_id',CASE WHEN approved THEN auth.uid() END,'reviewed_at',CASE WHEN approved THEN clock_timestamp() END,'review_note','','created_at',clock_timestamp(),'updated_at',clock_timestamp())),updated_at=now() WHERE id=participant.organization_membership_id;
 RETURN result;
END; $$;
CREATE FUNCTION lub.review_task_submission_decision(target uuid,decision text,note text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE owner uuid; task lub.tasks; participant lub.task_participants; submission jsonb; status text;
BEGIN
 owner:=lub.submission_storage_owner(target); task:=lub.lock_task((SELECT task_id FROM lub.task_participants WHERE id=owner)); SELECT * INTO participant FROM lub.task_participants WHERE id=owner FOR UPDATE;
 SELECT s INTO submission FROM jsonb_array_elements(participant.submissions) s WHERE (s->>'id')::uuid=target;
 IF NOT lub.can_review_task(task.id) OR task.status_code<>'Open' THEN RAISE EXCEPTION 'Review permission required' USING ERRCODE='42501'; END IF;
 IF participant.status_code<>'Submitted' OR submission->>'status_code'<>'Submitted' OR decision IS NULL OR decision NOT IN ('Approved','Changes_Requested','Rejected') OR note IS NULL OR length(note)>3000 OR (decision<>'Approved' AND length(trim(note))=0) THEN RAISE EXCEPTION 'Invalid review'; END IF;
 status:=CASE WHEN decision='Approved' THEN 'Approved' ELSE 'Rejected' END;
 PERFORM lub.store_submission(owner,target,submission||jsonb_build_object('status_code',status,'review_decision_code',decision,'review_note',trim(note),'reviewed_at',clock_timestamp(),'reviewed_by_user_id',auth.uid()));
 UPDATE lub.task_participants SET status_code=CASE WHEN decision='Approved' THEN 'Approved' ELSE 'In_Progress' END,closed_at=CASE WHEN decision='Approved' THEN clock_timestamp() END,reviewed_by_user_id=auth.uid() WHERE id=owner;
 IF decision='Approved' THEN PERFORM lub.award_task_hours(owner); END IF;
 PERFORM lub.workflow_notify(participant.user_id,'TASK_REVIEWED','/tasks/'||task.id);
END; $$;

REVOKE ALL ON FUNCTION lub.lock_task(uuid),lub.submission_storage_owner(uuid),lub.store_submission(uuid,uuid,jsonb),lub.check_task_submissions(),lub.award_task_hours(uuid),
 lub.can_manage_task(uuid),lub.can_review_task(uuid),lub.owns_task_participant(uuid),lub.save_task(uuid,uuid,uuid,text,text,timestamptz,timestamptz,numeric,int),lub.change_task_status(uuid,text,int),
 lub.join_task(uuid),lub.submit_task(uuid,text,uuid[],int,int),lub.withdraw_task_submission(uuid),lub.withdraw_task_participation(uuid),lub.review_task_submission_decision(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION lub.can_manage_task(uuid),lub.can_review_task(uuid),lub.owns_task_participant(uuid),lub.save_task(uuid,uuid,uuid,text,text,timestamptz,timestamptz,numeric,int),lub.change_task_status(uuid,text,int),
 lub.join_task(uuid),lub.submit_task(uuid,text,uuid[],int,int),lub.withdraw_task_submission(uuid),lub.withdraw_task_participation(uuid),lub.review_task_submission_decision(uuid,text,text) TO authenticated;

CREATE FUNCTION lub.duplicate_task(target uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE original lub.tasks; result uuid;
BEGIN
 original:=lub.lock_task(target);
 IF NOT lub.can_manage_task(target) THEN RAISE EXCEPTION 'Task permission required' USING ERRCODE='42501'; END IF;
 INSERT INTO lub.tasks(organization_id,committee_id,event_id,created_by_user_id,title,title_en,description,description_en,default_hours,image_asset_id,skill_ids)
  VALUES(original.organization_id,original.committee_id,original.event_id,auth.uid(),left('نسخة من '||original.title,120),original.title_en,original.description,original.description_en,original.default_hours,original.image_asset_id,original.skill_ids) RETURNING id INTO result;
 RETURN result;
END; $$;
CREATE FUNCTION lub.delete_task(target uuid,expected int) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE original lub.tasks;
BEGIN
 original:=lub.lock_task(target);
 IF NOT lub.can_manage_task(target) OR original.revision IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Task changed or unavailable' USING ERRCODE='42501'; END IF;
 IF original.status_code='Draft' AND NOT EXISTS(SELECT 1 FROM lub.task_participants p WHERE p.task_id=target) THEN
  DELETE FROM lub.tasks WHERE id=target;
 ELSE
  UPDATE lub.tasks SET deleted_at=clock_timestamp(),status_code='Cancelled',closed_at=clock_timestamp(),revision=revision+1,updated_at=now() WHERE id=target;
 END IF;
END; $$;
CREATE FUNCTION lub.set_task_image(target uuid,asset uuid,expected int) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE original lub.tasks;
BEGIN
 original:=lub.lock_task(target);
 IF NOT lub.can_manage_task(target) OR original.revision IS DISTINCT FROM expected OR original.status_code NOT IN ('Draft','Open') THEN RAISE EXCEPTION 'Task changed or unavailable' USING ERRCODE='42501'; END IF;
 IF asset IS NOT NULL THEN
  PERFORM 1 FROM lub.assets a WHERE a.id=asset AND a.mime_type IN ('image/png','image/jpeg','image/webp') AND a.size_bytes<=5242880
   AND (a.owner_user_id=auth.uid() OR a.id=original.image_asset_id OR EXISTS(SELECT 1 FROM lub.organization_content c WHERE c.id=original.event_id AND c.organization_id=original.organization_id AND c.kind='Event' AND c.primary_image_id=a.id)) FOR KEY SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid task image'; END IF;
 END IF;
 UPDATE lub.tasks SET image_asset_id=asset,revision=revision+1,updated_at=now() WHERE id=target;
END; $$;
CREATE FUNCTION lub.link_task_event(target uuid,event uuid,expected int) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE original lub.tasks;
BEGIN
 original:=lub.lock_task(target);
 IF NOT lub.can_manage_task(target) OR original.revision IS DISTINCT FROM expected OR original.status_code NOT IN ('Draft','Open') THEN RAISE EXCEPTION 'Task changed or unavailable' USING ERRCODE='42501'; END IF;
 IF event IS NOT NULL THEN
  PERFORM 1 FROM lub.organization_content c WHERE c.id=event AND c.kind='Event' AND c.organization_id=original.organization_id AND c.deleted_at IS NULL AND c.archived_at IS NULL
   AND ((c.published_at IS NOT NULL AND c.status_code IN ('Published','Completed','Archived')) OR lub.has_org_permission(c.organization_id,'EVENTS_MANAGE')) FOR KEY SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Event must belong to the organization'; END IF;
 END IF;
 UPDATE lub.tasks SET event_id=event,revision=revision+1,updated_at=now() WHERE id=target;
END; $$;
CREATE FUNCTION lub.review_task_submission(target uuid,status text,note text,hours numeric DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE owner uuid; original lub.tasks;
BEGIN
 owner:=lub.submission_storage_owner(target); original:=lub.lock_task((SELECT task_id FROM lub.task_participants WHERE id=owner));
 IF NOT lub.can_review_task(original.id) THEN RAISE EXCEPTION 'Review permission required' USING ERRCODE='42501'; END IF;
 IF status IS NULL OR status NOT IN ('Approved','Rejected') OR (hours IS NOT NULL AND (status<>'Approved' OR hours NOT BETWEEN 0 AND 1000 OR hours<>round(hours,2))) THEN RAISE EXCEPTION 'Invalid hours or decision'; END IF;
 UPDATE lub.task_participants SET approved_hours_override=hours WHERE id=owner;
 PERFORM lub.review_task_submission_decision(target,status,note);
END; $$;
CREATE FUNCTION lub.close_task_participant(target uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE original lub.tasks; participant lub.task_participants;
BEGIN
 original:=lub.lock_task((SELECT task_id FROM lub.task_participants WHERE id=target)); SELECT * INTO participant FROM lub.task_participants WHERE id=target FOR UPDATE;
 IF NOT lub.can_review_task(original.id) OR original.status_code<>'Open' OR participant.status_code NOT IN ('Joined','In_Progress','Submitted') THEN RAISE EXCEPTION 'Review permission required' USING ERRCODE='42501'; END IF;
 UPDATE lub.task_participants SET submissions=coalesce((SELECT jsonb_agg(CASE WHEN s->>'status_code'='Submitted' THEN s||jsonb_build_object('status_code','Withdrawn','withdrawn_at',clock_timestamp()) ELSE s END ORDER BY ordinal) FROM jsonb_array_elements(submissions) WITH ORDINALITY AS x(s,ordinal)),'[]'),status_code='Closed',closed_at=clock_timestamp(),reviewed_by_user_id=auth.uid() WHERE id=target;
END; $$;
REVOKE ALL ON FUNCTION lub.duplicate_task(uuid),lub.delete_task(uuid,int),lub.set_task_image(uuid,uuid,int),lub.link_task_event(uuid,uuid,int),lub.review_task_submission(uuid,text,text,numeric),lub.close_task_participant(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION lub.duplicate_task(uuid),lub.delete_task(uuid,int),lub.set_task_image(uuid,uuid,int),lub.link_task_event(uuid,uuid,int),lub.review_task_submission(uuid,text,text,numeric),lub.close_task_participant(uuid) TO authenticated;
