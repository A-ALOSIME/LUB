-- Private task workflow; no direct authenticated writes or public functions.
CREATE OR REPLACE FUNCTION lub.has_org_permission(target_org uuid, capability text, target_committee uuid DEFAULT NULL) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT capability IN ('ORG_PROFILE_MANAGE','COMMITTEE_MANAGE','COMMITTEE_PROFILE_MANAGE','MEMBERS_VIEW','FORMS_MANAGE','REGISTRATION_ROUNDS_MANAGE','APPLICATIONS_VIEW','APPLICATIONS_REVIEW','APPLICATIONS_BULK_ACTION','PERMISSIONS_GRANT','TASKS_MANAGE','TASK_TEMPLATES_MANAGE')
 AND EXISTS(SELECT 1 FROM lub.organizations WHERE id=target_org AND status_code='Active')
 AND (target_committee IS NULL OR EXISTS(SELECT 1 FROM lub.committees WHERE id=target_committee AND organization_id=target_org AND status_code='Active'))
 AND EXISTS(SELECT 1 FROM lub.organization_memberships m JOIN lub.users u ON u.id=m.user_id WHERE u.id=auth.uid() AND u.status_code='Active' AND m.organization_id=target_org AND m.status_code='Active' AND m.start_date<=current_date AND (m.end_date IS NULL OR m.end_date>current_date)
 AND (EXISTS(SELECT 1 FROM lub.role_assignments r WHERE r.organization_membership_id=m.id AND r.start_date<=current_date AND (r.end_date IS NULL OR r.end_date>current_date) AND (r.role_code IN ('OL','OD') OR (r.role_code IN ('CL','CD') AND r.committee_id=target_committee AND capability IN ('COMMITTEE_PROFILE_MANAGE','MEMBERS_VIEW','TASKS_MANAGE','TASK_TEMPLATES_MANAGE'))))
 OR EXISTS(SELECT 1 FROM lub.permission_grants g WHERE g.organization_membership_id=m.id AND g.permission_code=capability AND g.start_at<=statement_timestamp() AND (g.end_at IS NULL OR g.end_at>statement_timestamp()) AND (g.committee_id IS NULL OR g.committee_id=target_committee))));
$$;
CREATE FUNCTION lub.task_scope_member(org uuid,committee uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM lub.organization_memberships m JOIN lub.users u ON u.id=m.user_id JOIN lub.organizations o ON o.id=m.organization_id
 WHERE m.organization_id=org AND m.user_id=auth.uid() AND u.status_code='Active' AND o.status_code='Active' AND m.status_code='Active' AND m.start_date<=current_date AND (m.end_date IS NULL OR m.end_date>current_date)
 AND (committee IS NULL OR EXISTS(SELECT 1 FROM lub.committee_memberships cm JOIN lub.committees c ON c.id=cm.committee_id WHERE cm.organization_membership_id=m.id AND cm.committee_id=committee AND c.organization_id=org AND c.status_code='Active' AND cm.status_code='Active' AND cm.start_date<=current_date AND (cm.end_date IS NULL OR cm.end_date>current_date))));
$$;
CREATE FUNCTION lub.has_task_access(org uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT lub.has_org_permission(org,'TASKS_MANAGE') OR lub.has_org_permission(org,'TASK_TEMPLATES_MANAGE') OR EXISTS(SELECT 1 FROM lub.committees c WHERE c.organization_id=org AND (lub.has_org_permission(org,'TASKS_MANAGE',c.id) OR lub.has_org_permission(org,'TASK_TEMPLATES_MANAGE',c.id)));
$$;
CREATE FUNCTION lub.can_manage_task(target uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT EXISTS(SELECT 1 FROM lub.tasks t WHERE t.id=target AND lub.has_org_permission(t.organization_id,'TASKS_MANAGE',t.committee_id)); $$;
CREATE FUNCTION lub.can_read_task(target uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT EXISTS(SELECT 1 FROM lub.tasks t WHERE t.id=target AND (lub.can_manage_task(t.id) OR (t.status_code<>'Draft' AND lub.task_scope_member(t.organization_id,t.committee_id)))); $$;
CREATE FUNCTION lub.owns_task_participant(target uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT EXISTS(SELECT 1 FROM lub.task_participants p JOIN lub.users u ON u.id=p.user_id WHERE p.id=target AND p.user_id=auth.uid() AND u.status_code='Active'); $$;
CREATE FUNCTION lub.can_read_task_submission(target uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT EXISTS(SELECT 1 FROM lub.task_submissions s JOIN lub.task_participants p ON p.id=s.task_participant_id WHERE s.id=target AND (lub.owns_task_participant(p.id) OR lub.can_manage_task(p.task_id))); $$;
CREATE FUNCTION lub.can_read_task_revision(target uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM lub.task_revisions r WHERE r.id=target AND (lub.can_read_task(r.task_id) OR EXISTS(SELECT 1 FROM lub.task_participants p WHERE p.task_id=r.task_id AND lub.owns_task_participant(p.id) AND (r.changed_at<=p.joined_at OR EXISTS(SELECT 1 FROM lub.task_submissions s WHERE s.task_participant_id=p.id AND s.task_revision_id=r.id)))));
$$;
GRANT SELECT ON lub.task_templates,lub.tasks,lub.task_revisions,lub.task_participants,lub.task_submissions,lub.task_submission_assets,lub.notifications TO authenticated;
CREATE POLICY task_templates_read ON lub.task_templates FOR SELECT TO authenticated USING(lub.has_org_permission(organization_id,'TASK_TEMPLATES_MANAGE',committee_id) OR lub.has_org_permission(organization_id,'TASKS_MANAGE',committee_id));
CREATE POLICY tasks_read ON lub.tasks FOR SELECT TO authenticated USING(lub.can_read_task(id));
CREATE POLICY task_revisions_read ON lub.task_revisions FOR SELECT TO authenticated USING(lub.can_read_task_revision(id));
CREATE POLICY task_participants_read ON lub.task_participants FOR SELECT TO authenticated USING(lub.owns_task_participant(id) OR lub.can_manage_task(task_id));
CREATE POLICY task_submissions_read ON lub.task_submissions FOR SELECT TO authenticated USING(lub.can_read_task_submission(id));
CREATE POLICY task_submission_assets_read ON lub.task_submission_assets FOR SELECT TO authenticated USING(lub.can_read_task_submission(task_submission_id));
CREATE POLICY notifications_read ON lub.notifications FOR SELECT TO authenticated USING(recipient_user_id=auth.uid() AND EXISTS(SELECT 1 FROM lub.users WHERE id=auth.uid() AND status_code='Active'));
CREATE FUNCTION lub.task_audit(target uuid,org uuid,action text) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ INSERT INTO lub.audit_log(actor_user_id,organization_id,action_code,entity_type,entity_id,metadata) VALUES(auth.uid(),org,action,'task_workflow',target,'{}'); $$;
CREATE FUNCTION lub.task_notify(target uuid,recipient uuid,kind text) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 INSERT INTO lub.notifications(recipient_user_id,type_code,title,body,target_url) VALUES(recipient,kind,'تحديث على مشاركتك في مهمة','افتح المهمة للاطلاع على التحديث.','/tasks/'||target::text);
$$;
CREATE FUNCTION lub.record_task_revision() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO lub.task_revisions(task_id,revision_number,snapshot_json,changed_by_user_id,changed_at) VALUES(NEW.id,NEW.revision,to_jsonb(NEW)-'created_by_user_id',auth.uid(),clock_timestamp());
 PERFORM lub.task_audit(NEW.id,NEW.organization_id,CASE WHEN TG_OP='INSERT' THEN 'TASK_CREATED' ELSE 'TASK_CHANGED' END);
 IF TG_OP='UPDATE' THEN
  INSERT INTO lub.notifications(recipient_user_id,type_code,title,body,target_url) SELECT p.user_id,'TASK_CHANGED','تحديث على مهمة تشارك بها','تغيّرت تفاصيل المهمة أو حالتها. راجع النسخة الجديدة.','/tasks/'||NEW.id::text FROM lub.task_participants p
  WHERE p.task_id=NEW.id AND (lub.task_scope_member_for(p.user_id,NEW.organization_id,NEW.committee_id));
 END IF;
 RETURN NEW;
END; $$;
-- Recipient eligibility uses a trusted user ID only inside notification triggers.
CREATE FUNCTION lub.task_scope_member_for(actor uuid,org uuid,committee uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM lub.organization_memberships m JOIN lub.users u ON u.id=m.user_id JOIN lub.organizations o ON o.id=m.organization_id WHERE m.organization_id=org AND m.user_id=actor AND u.status_code='Active' AND o.status_code='Active' AND m.status_code='Active' AND m.start_date<=current_date AND (m.end_date IS NULL OR m.end_date>current_date) AND (committee IS NULL OR EXISTS(SELECT 1 FROM lub.committee_memberships cm JOIN lub.committees c ON c.id=cm.committee_id WHERE cm.organization_membership_id=m.id AND cm.committee_id=committee AND c.organization_id=org AND c.status_code='Active' AND cm.status_code='Active' AND cm.start_date<=current_date AND (cm.end_date IS NULL OR cm.end_date>current_date))));
$$;
CREATE TRIGGER task_revision_record AFTER INSERT OR UPDATE ON lub.tasks FOR EACH ROW EXECUTE FUNCTION lub.record_task_revision();
CREATE FUNCTION lub.guard_task_revision() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN RAISE EXCEPTION 'Task revisions are immutable'; END; $$;
CREATE TRIGGER task_revision_immutable BEFORE UPDATE OR DELETE ON lub.task_revisions FOR EACH ROW EXECUTE FUNCTION lub.guard_task_revision();
CREATE FUNCTION lub.save_task(target uuid,org uuid,committee uuid,template uuid,title text,description text,starts timestamptz,due timestamptz,hours numeric,expected int) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t lub.tasks; source lub.task_templates;
BEGIN
 IF target IS NOT NULL THEN
  SELECT * INTO t FROM lub.tasks WHERE id=target FOR UPDATE;
  IF t.id IS NULL OR t.organization_id IS DISTINCT FROM org OR t.committee_id IS DISTINCT FROM committee OR t.revision IS DISTINCT FROM expected OR t.status_code NOT IN ('Draft','Open') THEN RAISE EXCEPTION 'Task changed or closed'; END IF;
 END IF;
 IF NOT lub.has_org_permission(org,'TASKS_MANAGE',committee) THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 IF template IS NOT NULL THEN
  SELECT * INTO source FROM lub.task_templates WHERE id=template AND organization_id=org AND (committee_id IS NULL OR committee_id=committee) AND is_active;
  IF source.id IS NULL THEN RAISE EXCEPTION 'Invalid template'; END IF;
 END IF;
 IF target IS NULL THEN
  INSERT INTO lub.tasks(organization_id,committee_id,task_template_id,created_by_user_id,title,description,starts_at,due_at,default_hours) VALUES(org,committee,template,auth.uid(),trim(title),trim(description),starts,due,hours) RETURNING id INTO target;
 ELSE
  IF (t.title,t.description,t.starts_at,t.due_at,t.default_hours) IS NOT DISTINCT FROM (trim(title),trim(description),starts,due,hours) THEN RETURN target; END IF;
  UPDATE lub.tasks SET title=trim(save_task.title),description=trim(save_task.description),starts_at=starts,due_at=due,default_hours=hours,revision=revision+1,updated_at=now() WHERE id=target;
 END IF;
 RETURN target;
END; $$;
CREATE FUNCTION lub.change_task_status(target uuid,status text,expected int) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t lub.tasks;
BEGIN
 SELECT * INTO t FROM lub.tasks WHERE id=target FOR UPDATE;
 IF t.id IS NULL OR NOT lub.can_manage_task(target) THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 IF t.revision IS DISTINCT FROM expected OR NOT ((t.status_code='Draft' AND status IN ('Open','Cancelled')) OR (t.status_code='Open' AND status IN ('Completed','Cancelled'))) THEN RAISE EXCEPTION 'Invalid transition'; END IF;
 UPDATE lub.tasks SET status_code=status,closed_at=CASE WHEN status IN ('Completed','Cancelled') THEN now() END,revision=revision+1,updated_at=now() WHERE id=target;
END; $$;
CREATE FUNCTION lub.save_task_template(target uuid,org uuid,committee uuid,name text,description text,hours numeric,active boolean,expected int,source uuid DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t lub.task_templates;
BEGIN
 IF NOT lub.has_org_permission(org,'TASK_TEMPLATES_MANAGE',committee) THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 IF source IS NOT NULL THEN
  SELECT * INTO t FROM lub.task_templates WHERE id=source;
  IF target IS NOT NULL OR t.id IS NULL OR t.organization_id<>org OR NOT lub.has_org_permission(org,'TASK_TEMPLATES_MANAGE',t.committee_id) THEN RAISE EXCEPTION 'Invalid template source'; END IF;
  description:=t.description_template; hours:=t.default_hours;
 END IF;
 IF target IS NULL THEN
  INSERT INTO lub.task_templates(organization_id,committee_id,name,description_template,default_hours,is_active,copied_from_template_id) VALUES(org,committee,trim(name),trim(description),hours,active,source) RETURNING id INTO target;
 ELSE
  SELECT * INTO t FROM lub.task_templates WHERE id=target FOR UPDATE;
  IF t.id IS NULL OR t.organization_id IS DISTINCT FROM org OR t.committee_id IS DISTINCT FROM committee OR t.revision IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Template changed'; END IF;
  UPDATE lub.task_templates SET name=trim(save_task_template.name),description_template=trim(description),default_hours=hours,is_active=active,revision=revision+1 WHERE id=target;
 END IF;
 PERFORM lub.task_audit(target,org,'TASK_TEMPLATE_SAVED'); RETURN target;
END; $$;
REVOKE ALL ON FUNCTION lub.task_scope_member(uuid,uuid),lub.task_scope_member_for(uuid,uuid,uuid),lub.has_task_access(uuid),lub.can_manage_task(uuid),lub.can_read_task(uuid),lub.owns_task_participant(uuid),lub.can_read_task_submission(uuid),lub.can_read_task_revision(uuid),lub.task_audit(uuid,uuid,text),lub.task_notify(uuid,uuid,text),lub.record_task_revision(),lub.guard_task_revision(),lub.save_task(uuid,uuid,uuid,uuid,text,text,timestamptz,timestamptz,numeric,int),lub.change_task_status(uuid,text,int),lub.save_task_template(uuid,uuid,uuid,text,text,numeric,boolean,int,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lub.task_scope_member(uuid,uuid),lub.has_task_access(uuid),lub.can_manage_task(uuid),lub.can_read_task(uuid),lub.owns_task_participant(uuid),lub.can_read_task_submission(uuid),lub.can_read_task_revision(uuid),lub.save_task(uuid,uuid,uuid,uuid,text,text,timestamptz,timestamptz,numeric,int),lub.change_task_status(uuid,text,int),lub.save_task_template(uuid,uuid,uuid,text,text,numeric,boolean,int,uuid) TO authenticated;

CREATE FUNCTION lub.join_task(target uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t lub.tasks; member uuid; result uuid;
BEGIN
 SELECT * INTO t FROM lub.tasks WHERE id=target FOR UPDATE;
 IF t.id IS NULL OR t.status_code<>'Open' OR (t.starts_at IS NOT NULL AND t.starts_at>now()) OR NOT (lub.task_scope_member(t.organization_id,t.committee_id) OR lub.can_manage_task(t.id)) THEN RAISE EXCEPTION 'Participation unavailable' USING ERRCODE='42501'; END IF;
 SELECT id INTO member FROM lub.organization_memberships WHERE organization_id=t.organization_id AND user_id=auth.uid() AND status_code='Active' AND start_date<=current_date AND (end_date IS NULL OR end_date>current_date) FOR UPDATE;
 IF member IS NULL OR NOT EXISTS(SELECT 1 FROM lub.student_profiles WHERE user_id=auth.uid()) THEN RAISE EXCEPTION 'Active member required'; END IF;
 INSERT INTO lub.task_participants(task_id,organization_membership_id,user_id,joined_at) VALUES(target,member,auth.uid(),clock_timestamp()) RETURNING id INTO result;
 PERFORM lub.task_audit(result,t.organization_id,'TASK_JOINED'); RETURN result;
END; $$;
CREATE FUNCTION lub.start_task_participation(target uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE task uuid; t lub.tasks; p lub.task_participants;
BEGIN
 SELECT task_id INTO task FROM lub.task_participants WHERE id=target; SELECT * INTO t FROM lub.tasks WHERE id=task FOR UPDATE; SELECT * INTO p FROM lub.task_participants WHERE id=target FOR UPDATE;
 IF t.id IS NULL OR t.status_code<>'Open' OR p.status_code<>'Joined' OR NOT lub.owns_task_participant(target) OR NOT (lub.task_scope_member(t.organization_id,t.committee_id) OR lub.can_manage_task(t.id)) THEN RAISE EXCEPTION 'Participation unavailable'; END IF;
 UPDATE lub.task_participants SET status_code='In_Progress' WHERE id=target; PERFORM lub.task_audit(target,t.organization_id,'TASK_STARTED');
END; $$;
CREATE FUNCTION lub.submit_task(target uuid,message text,assets uuid[],expected int,task_expected int) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE task uuid; t lub.tasks; p lub.task_participants; current_revision int; result uuid; pinned uuid; asset uuid;
BEGIN
 SELECT task_id INTO task FROM lub.task_participants WHERE id=target; SELECT * INTO t FROM lub.tasks WHERE id=task FOR UPDATE; SELECT * INTO p FROM lub.task_participants WHERE id=target FOR UPDATE;
 IF t.id IS NULL OR t.status_code<>'Open' OR t.revision IS DISTINCT FROM task_expected OR p.status_code NOT IN ('Joined','In_Progress') OR NOT lub.owns_task_participant(target) OR NOT (lub.task_scope_member(t.organization_id,t.committee_id) OR lub.can_manage_task(t.id)) THEN RAISE EXCEPTION 'Participation unavailable' USING ERRCODE='42501'; END IF;
 SELECT coalesce(max(revision_number),0) INTO current_revision FROM lub.task_submissions WHERE task_participant_id=target;
 IF expected IS DISTINCT FROM current_revision OR assets IS NULL OR cardinality(assets)>5 OR cardinality(assets)<>(SELECT count(DISTINCT a) FROM unnest(assets) a) OR message IS NULL OR length(message)>6000 OR (length(trim(message))=0 AND cardinality(assets)=0) THEN RAISE EXCEPTION 'Invalid submission'; END IF;
 FOREACH asset IN ARRAY assets LOOP
  PERFORM 1 FROM lub.application_assets WHERE id=asset AND owner_user_id=auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid attachment'; END IF;
 END LOOP;
 SELECT id INTO pinned FROM lub.task_revisions WHERE task_id=t.id AND revision_number=t.revision;
 INSERT INTO lub.task_submissions(task_participant_id,task_revision_id,revision_number,message) VALUES(target,pinned,current_revision+1,trim(message)) RETURNING id INTO result;
 INSERT INTO lub.task_submission_assets(task_submission_id,asset_id) SELECT result,a FROM unnest(assets) a;
 UPDATE lub.task_participants SET status_code='Submitted' WHERE id=target;
 PERFORM lub.task_audit(result,t.organization_id,'TASK_SUBMITTED'); RETURN result;
END; $$;
CREATE FUNCTION lub.review_task_submission(target uuid,status text,note text,hours numeric) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE task uuid; t lub.tasks; p lub.task_participants; s lub.task_submissions;
BEGIN
 SELECT part.task_id INTO task FROM lub.task_submissions sub JOIN lub.task_participants part ON part.id=sub.task_participant_id WHERE sub.id=target;
 SELECT * INTO t FROM lub.tasks WHERE id=task FOR UPDATE;
 SELECT part.* INTO p FROM lub.task_participants part JOIN lub.task_submissions sub ON sub.task_participant_id=part.id WHERE sub.id=target FOR UPDATE OF part;
 SELECT * INTO s FROM lub.task_submissions WHERE id=target FOR UPDATE;
 IF t.id IS NULL OR t.status_code<>'Open' OR NOT lub.can_manage_task(task) THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 IF p.status_code<>'Submitted' OR s.status_code<>'Submitted' OR status NOT IN ('Approved','Rejected') OR status IS NULL OR note IS NULL OR length(note)>3000 OR (status='Rejected' AND length(trim(note))=0) OR (hours IS NOT NULL AND (status<>'Approved' OR hours<0 OR hours>1000 OR hours::text IN ('NaN','Infinity','-Infinity'))) THEN RAISE EXCEPTION 'Invalid review'; END IF;
 UPDATE lub.task_submissions SET status_code=status,review_note=trim(note),reviewed_at=now(),reviewed_by_user_id=auth.uid() WHERE id=target;
 UPDATE lub.task_participants SET status_code=CASE WHEN status='Approved' THEN 'Approved' ELSE 'In_Progress' END,closed_at=CASE WHEN status='Approved' THEN now() END,reviewed_by_user_id=auth.uid(),approved_hours_override=CASE WHEN status='Approved' THEN hours END WHERE id=p.id;
 PERFORM lub.task_notify(task,p.user_id,'TASK_REVIEWED'); PERFORM lub.task_audit(target,t.organization_id,'TASK_REVIEWED');
END; $$;
CREATE FUNCTION lub.close_task_participant(target uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE task uuid; t lub.tasks; p lub.task_participants;
BEGIN
 SELECT task_id INTO task FROM lub.task_participants WHERE id=target;SELECT * INTO t FROM lub.tasks WHERE id=task FOR UPDATE;SELECT * INTO p FROM lub.task_participants WHERE id=target FOR UPDATE;
 IF t.id IS NULL OR t.status_code<>'Open' OR NOT lub.can_manage_task(task) OR p.status_code NOT IN ('Joined','In_Progress','Submitted') THEN RAISE EXCEPTION 'Participation unavailable'; END IF;
 UPDATE lub.task_participants SET status_code='Closed',closed_at=now(),reviewed_by_user_id=auth.uid() WHERE id=target;
 PERFORM lub.task_notify(task,p.user_id,'TASK_PARTICIPATION_CLOSED');PERFORM lub.task_audit(target,t.organization_id,'TASK_PARTICIPATION_CLOSED');
END; $$;
CREATE FUNCTION lub.read_task_notification(target uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM lub.users WHERE id=auth.uid() AND status_code='Active') THEN RAISE EXCEPTION 'Account unavailable'; END IF;
 UPDATE lub.notifications SET read_at=coalesce(read_at,now()) WHERE id=target AND recipient_user_id=auth.uid();IF NOT FOUND THEN RAISE EXCEPTION 'Notification unavailable';END IF;
END; $$;
CREATE OR REPLACE FUNCTION lub.can_read_asset(target text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM lub.application_assets a WHERE a.object_key=target AND EXISTS(SELECT 1 FROM lub.users WHERE id=auth.uid() AND status_code='Active') AND (a.owner_user_id=auth.uid() OR EXISTS(SELECT 1 FROM lub.form_response_assets f WHERE f.asset_id=a.id AND lub.can_read_response(f.form_response_id)) OR EXISTS(SELECT 1 FROM lub.task_submission_assets s WHERE s.asset_id=a.id AND lub.can_read_task_submission(s.task_submission_id))));
$$;
CREATE OR REPLACE FUNCTION lub.can_delete_application_object(target text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT split_part(target,'/',1)=auth.uid()::text AND EXISTS(SELECT 1 FROM lub.users WHERE id=auth.uid() AND status_code='Active')
 AND NOT EXISTS(SELECT 1 FROM lub.application_assets a WHERE a.object_key=target AND (EXISTS(SELECT 1 FROM lub.form_response_assets f WHERE f.asset_id=a.id) OR EXISTS(SELECT 1 FROM lub.task_submission_assets s WHERE s.asset_id=a.id)));
$$;
CREATE FUNCTION lub.task_team(target uuid,page_offset int DEFAULT 0) RETURNS TABLE(id uuid,name text,status text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT p.id,s.full_name_ar,p.status_code::text FROM lub.task_participants p JOIN lub.student_profiles s ON s.user_id=p.user_id WHERE p.task_id=target AND lub.can_read_task(target) ORDER BY p.joined_at,p.id LIMIT 101 OFFSET greatest(0,least(page_offset,1000000));
$$;
CREATE FUNCTION lub.grant_task_permission(member uuid,capability text,committee uuid,ends timestamptz) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE org uuid;
BEGIN
 SELECT organization_id INTO org FROM lub.organization_memberships WHERE id=member AND status_code='Active' AND start_date<=current_date AND (end_date IS NULL OR end_date>current_date) FOR UPDATE;
 IF org IS NULL OR NOT lub.has_org_permission(org,'PERMISSIONS_GRANT') OR capability IS NULL OR capability NOT IN ('TASKS_MANAGE','TASK_TEMPLATES_MANAGE') OR (ends IS NOT NULL AND ends<=now()) THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 IF committee IS NOT NULL AND NOT EXISTS(SELECT 1 FROM lub.committees WHERE id=committee AND organization_id=org AND status_code='Active') THEN RAISE EXCEPTION 'Invalid scope';END IF;
 INSERT INTO lub.permission_grants(organization_membership_id,organization_id,committee_id,permission_code,end_at,granted_by_user_id) VALUES(member,org,committee,capability,ends,auth.uid());PERFORM lub.task_audit(member,org,'TASK_PERMISSION_GRANTED');
END; $$;
CREATE FUNCTION lub.end_task_permission(target uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE org uuid;
BEGIN
 SELECT organization_id INTO org FROM lub.permission_grants WHERE id=target AND permission_code IN ('TASKS_MANAGE','TASK_TEMPLATES_MANAGE') FOR UPDATE;
 IF org IS NULL OR NOT lub.has_org_permission(org,'PERMISSIONS_GRANT') THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501';END IF;
 UPDATE lub.permission_grants SET end_at=clock_timestamp() WHERE id=target AND start_at<=now() AND (end_at IS NULL OR end_at>now());PERFORM lub.task_audit(target,org,'TASK_PERMISSION_ENDED');
END; $$;
REVOKE ALL ON FUNCTION lub.join_task(uuid),lub.start_task_participation(uuid),lub.submit_task(uuid,text,uuid[],int,int),lub.review_task_submission(uuid,text,text,numeric),lub.close_task_participant(uuid),lub.read_task_notification(uuid),lub.task_team(uuid,int),lub.grant_task_permission(uuid,text,uuid,timestamptz),lub.end_task_permission(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lub.join_task(uuid),lub.start_task_participation(uuid),lub.submit_task(uuid,text,uuid[],int,int),lub.review_task_submission(uuid,text,text,numeric),lub.close_task_participant(uuid),lub.read_task_notification(uuid),lub.task_team(uuid,int),lub.grant_task_permission(uuid,text,uuid,timestamptz),lub.end_task_permission(uuid) TO authenticated;

CREATE FUNCTION lub.task_grant_members(org uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT lub.has_org_permission(org,'PERMISSIONS_GRANT') THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501';END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id',m.id,'name',p.full_name_ar,'grants',coalesce((SELECT jsonb_agg(jsonb_build_object('id',g.id,'code',g.permission_code,'committee',c.name,'ends',g.end_at)) FROM lub.permission_grants g LEFT JOIN lub.committees c ON c.id=g.committee_id WHERE g.organization_membership_id=m.id AND g.permission_code IN ('TASKS_MANAGE','TASK_TEMPLATES_MANAGE') AND g.start_at<=now() AND (g.end_at IS NULL OR g.end_at>now())),'[]'))) FROM lub.organization_memberships m JOIN lub.users u ON u.id=m.user_id JOIN lub.student_profiles p ON p.user_id=m.user_id WHERE m.organization_id=org AND m.status_code='Active' AND m.start_date<=current_date AND (m.end_date IS NULL OR m.end_date>current_date) AND u.status_code='Active'),'[]');
END; $$;
CREATE FUNCTION lub.copy_committee_task_templates() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.copied_from_committee_id IS NOT NULL THEN
  IF NOT lub.has_org_permission(NEW.organization_id,'COMMITTEE_MANAGE') OR NOT EXISTS(SELECT 1 FROM lub.committees WHERE id=NEW.copied_from_committee_id AND organization_id=NEW.organization_id) THEN RAISE EXCEPTION 'Invalid copy scope';END IF;
  INSERT INTO lub.task_templates(organization_id,committee_id,name,description_template,default_hours,copied_from_template_id) SELECT NEW.organization_id,NEW.id,t.name,t.description_template,t.default_hours,t.id FROM lub.task_templates t WHERE t.committee_id=NEW.copied_from_committee_id AND t.organization_id=NEW.organization_id AND t.is_active;
 END IF; RETURN NEW;
END; $$;
CREATE TRIGGER committee_task_templates_copy AFTER INSERT ON lub.committees FOR EACH ROW EXECUTE FUNCTION lub.copy_committee_task_templates();
REVOKE ALL ON FUNCTION lub.task_grant_members(uuid),lub.copy_committee_task_templates() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lub.task_grant_members(uuid) TO authenticated;

CREATE FUNCTION lub.guard_task_submission() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Submissions are immutable';END IF;
 IF OLD.status_code<>'Submitted' OR NEW.status_code NOT IN ('Approved','Rejected')
 OR (to_jsonb(OLD)-'status_code'-'review_note'-'reviewed_at'-'reviewed_by_user_id') IS DISTINCT FROM (to_jsonb(NEW)-'status_code'-'review_note'-'reviewed_at'-'reviewed_by_user_id') THEN RAISE EXCEPTION 'Submission content and final reviews are immutable';END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER task_submission_immutable BEFORE UPDATE OR DELETE ON lub.task_submissions FOR EACH ROW EXECUTE FUNCTION lub.guard_task_submission();
CREATE TRIGGER task_submission_assets_immutable BEFORE UPDATE OR DELETE ON lub.task_submission_assets FOR EACH ROW EXECUTE FUNCTION lub.guard_task_revision();
REVOKE ALL ON FUNCTION lub.guard_task_submission() FROM PUBLIC;
