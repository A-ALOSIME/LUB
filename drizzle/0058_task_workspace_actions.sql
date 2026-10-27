-- Keep task participation, submissions and immutable revisions when a task is removed.
ALTER TABLE lub.tasks ADD COLUMN deleted_at timestamptz, ADD COLUMN image_asset_id uuid REFERENCES lub.application_assets(id);
CREATE INDEX tasks_image_asset_idx ON lub.tasks(image_asset_id) WHERE image_asset_id IS NOT NULL;
CREATE INDEX task_revision_image_idx ON lub.task_revisions((snapshot_json->>'image_asset_id')) WHERE snapshot_json->>'image_asset_id' IS NOT NULL;
CREATE OR REPLACE FUNCTION lub.can_manage_task(target uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT EXISTS(SELECT 1 FROM lub.tasks t WHERE t.id=target AND t.deleted_at IS NULL AND lub.has_org_permission(t.organization_id,'TASKS_MANAGE',t.committee_id)); $$;
CREATE OR REPLACE FUNCTION lub.can_read_task(target uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT EXISTS(SELECT 1 FROM lub.tasks t WHERE t.id=target AND t.deleted_at IS NULL AND (lub.can_manage_task(t.id) OR (t.status_code<>'Draft' AND lub.task_scope_member(t.organization_id,t.committee_id)))); $$;
CREATE FUNCTION lub.delete_task(target uuid,expected int) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t lub.tasks;
BEGIN
 SELECT * INTO t FROM lub.tasks WHERE id=target FOR UPDATE;
 IF t.id IS NULL OR NOT lub.can_manage_task(target) THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 IF t.revision IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Task changed'; END IF;
 UPDATE lub.tasks SET deleted_at=now(),status_code=CASE WHEN status_code IN ('Draft','Open') THEN 'Cancelled' ELSE status_code END,closed_at=coalesce(closed_at,now()),revision=revision+1 WHERE id=target;
END; $$;
CREATE FUNCTION lub.withdraw_task_participation(target uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE task uuid; t lub.tasks; p lub.task_participants;
BEGIN
 SELECT task_id INTO task FROM lub.task_participants WHERE id=target;
 SELECT * INTO t FROM lub.tasks WHERE id=task FOR UPDATE;
 SELECT * INTO p FROM lub.task_participants WHERE id=target FOR UPDATE;
 IF t.id IS NULL OR t.status_code<>'Open' OR NOT lub.can_read_task(task) OR NOT lub.owns_task_participant(target) OR p.status_code NOT IN ('Joined','In_Progress','Submitted') THEN RAISE EXCEPTION 'Participation unavailable' USING ERRCODE='42501'; END IF;
 UPDATE lub.task_participants SET status_code='Closed',closed_at=now() WHERE id=target;
 PERFORM lub.task_audit(target,t.organization_id,'TASK_PARTICIPANT_WITHDREW');
END; $$;
CREATE FUNCTION lub.task_summary(target uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT CASE WHEN lub.can_read_task(target) THEN (SELECT jsonb_build_object('participants',count(*) FILTER(WHERE p.status_code<>'Closed'),'submitted',count(*) FILTER(WHERE p.status_code IN ('Submitted','Approved'))) FROM lub.task_participants p WHERE p.task_id=target AND lub.is_student_account(p.user_id)) END;
$$;
CREATE FUNCTION lub.set_task_image(target uuid,asset uuid,expected int) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t lub.tasks;
BEGIN
 SELECT * INTO t FROM lub.tasks WHERE id=target FOR UPDATE;
 IF t.id IS NULL OR NOT lub.can_manage_task(target) OR t.status_code NOT IN ('Draft','Open') THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 IF t.revision IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Task changed'; END IF;
 IF asset IS NOT NULL AND NOT EXISTS(SELECT 1 FROM lub.application_assets a WHERE a.id=asset AND a.owner_user_id=auth.uid() AND a.mime_type IN ('image/jpeg','image/png') AND a.size_bytes<=5242880) THEN RAISE EXCEPTION 'Invalid image'; END IF;
 UPDATE lub.tasks SET image_asset_id=asset,revision=revision+1 WHERE id=target;
END; $$;
REVOKE ALL ON FUNCTION lub.delete_task(uuid,int),lub.withdraw_task_participation(uuid),lub.task_summary(uuid),lub.set_task_image(uuid,uuid,int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lub.delete_task(uuid,int),lub.withdraw_task_participation(uuid),lub.task_summary(uuid),lub.set_task_image(uuid,uuid,int) TO authenticated;
CREATE OR REPLACE FUNCTION lub.can_read_asset(target text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM lub.application_assets a WHERE a.object_key=target AND EXISTS(SELECT 1 FROM lub.users WHERE id=auth.uid() AND status_code='Active') AND (a.owner_user_id=auth.uid() OR EXISTS(SELECT 1 FROM lub.form_response_assets f WHERE f.asset_id=a.id AND lub.can_read_response(f.form_response_id)) OR EXISTS(SELECT 1 FROM lub.task_submission_assets s WHERE s.asset_id=a.id AND lub.can_read_task_submission(s.task_submission_id)) OR EXISTS(SELECT 1 FROM lub.event_assets ea WHERE ea.asset_id=a.id AND lub.can_operate_event(ea.event_id)) OR EXISTS(SELECT 1 FROM lub.tasks t WHERE t.image_asset_id=a.id AND lub.can_read_task(t.id)) OR EXISTS(SELECT 1 FROM lub.task_revisions r WHERE r.snapshot_json->>'image_asset_id'=a.id::text AND lub.can_read_task_revision(r.id))));
$$;
CREATE OR REPLACE FUNCTION lub.can_delete_application_object(target text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT split_part(target,'/',1)=auth.uid()::text AND EXISTS(SELECT 1 FROM lub.users WHERE id=auth.uid() AND status_code='Active') AND NOT EXISTS(SELECT 1 FROM lub.application_assets a WHERE a.object_key=target AND (EXISTS(SELECT 1 FROM lub.form_response_assets f WHERE f.asset_id=a.id) OR EXISTS(SELECT 1 FROM lub.task_submission_assets s WHERE s.asset_id=a.id) OR EXISTS(SELECT 1 FROM lub.event_assets e WHERE e.asset_id=a.id) OR EXISTS(SELECT 1 FROM lub.tasks t WHERE t.image_asset_id=a.id) OR EXISTS(SELECT 1 FROM lub.task_revisions r WHERE r.snapshot_json->>'image_asset_id'=a.id::text))); $$;
