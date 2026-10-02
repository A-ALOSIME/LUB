-- Only scoped RPCs may mutate application workflows.
CREATE OR REPLACE FUNCTION lub.has_org_permission(target_org uuid, capability text, target_committee uuid DEFAULT NULL) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT capability IN ('ORG_PROFILE_MANAGE','COMMITTEE_MANAGE','COMMITTEE_PROFILE_MANAGE','MEMBERS_VIEW','FORMS_MANAGE','REGISTRATION_ROUNDS_MANAGE','APPLICATIONS_VIEW','APPLICATIONS_REVIEW','APPLICATIONS_BULK_ACTION','PERMISSIONS_GRANT')
 AND EXISTS(SELECT 1 FROM lub.organizations WHERE id=target_org AND status_code='Active')
 AND (target_committee IS NULL OR EXISTS(SELECT 1 FROM lub.committees WHERE id=target_committee AND organization_id=target_org AND status_code='Active'))
 AND EXISTS(SELECT 1 FROM lub.organization_memberships m JOIN lub.users u ON u.id=m.user_id WHERE u.id=auth.uid() AND u.status_code='Active' AND m.organization_id=target_org AND m.status_code='Active' AND m.start_date<=current_date AND (m.end_date IS NULL OR m.end_date>current_date)
 AND (EXISTS(SELECT 1 FROM lub.role_assignments r WHERE r.organization_membership_id=m.id AND r.start_date<=current_date AND (r.end_date IS NULL OR r.end_date>current_date) AND (r.role_code IN ('OL','OD') OR (r.role_code IN ('CL','CD') AND r.committee_id=target_committee AND capability IN ('COMMITTEE_PROFILE_MANAGE','MEMBERS_VIEW'))))
 OR EXISTS(SELECT 1 FROM lub.permission_grants g WHERE g.organization_membership_id=m.id AND g.permission_code=capability AND g.start_at<=now() AND (g.end_at IS NULL OR g.end_at>now()) AND (g.committee_id IS NULL OR g.committee_id=target_committee))));
$$;
CREATE FUNCTION lub.round_is_open(target uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM lub.registration_rounds r JOIN lub.organizations o ON o.id=r.organization_id WHERE r.id=target AND r.status_code='Open' AND r.opens_at<=now() AND r.closes_at>now() AND o.status_code='Active');
$$;
CREATE FUNCTION lub.can_read_application(target uuid,capability text DEFAULT 'APPLICATIONS_VIEW') RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM lub.membership_applications a JOIN lub.registration_rounds r ON r.id=a.registration_round_id JOIN lub.users u ON u.id=auth.uid() AND u.status_code='Active' WHERE a.id=target AND ((capability='APPLICATIONS_VIEW' AND a.applicant_user_id=auth.uid()) OR lub.has_org_permission(r.organization_id,capability) OR lub.has_org_permission(r.organization_id,capability,a.requested_committee_id) OR (capability='APPLICATIONS_VIEW' AND (lub.has_org_permission(r.organization_id,'APPLICATIONS_REVIEW') OR lub.has_org_permission(r.organization_id,'APPLICATIONS_BULK_ACTION') OR lub.has_org_permission(r.organization_id,'APPLICATIONS_REVIEW',a.requested_committee_id) OR lub.has_org_permission(r.organization_id,'APPLICATIONS_BULK_ACTION',a.requested_committee_id)))));
$$;
CREATE FUNCTION lub.can_read_template(target uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM lub.form_templates t WHERE t.id=target AND (t.is_system_template OR lub.has_org_permission(t.organization_id,'FORMS_MANAGE') OR lub.has_org_permission(t.organization_id,'REGISTRATION_ROUNDS_MANAGE') OR EXISTS(SELECT 1 FROM lub.registration_rounds r JOIN lub.organizations o ON o.id=r.organization_id WHERE r.form_template_id=t.id AND r.status_code IN ('Open','Closed') AND o.status_code='Active') OR EXISTS(SELECT 1 FROM lub.membership_applications a JOIN lub.registration_rounds r ON r.id=a.registration_round_id WHERE r.form_template_id=t.id AND lub.can_read_application(a.id))));
$$;
CREATE FUNCTION lub.can_read_version(target uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM lub.form_versions v JOIN lub.form_templates t ON t.id=v.form_template_id WHERE v.id=target AND (lub.has_org_permission(t.organization_id,'FORMS_MANAGE') OR (v.status_code='Published' AND lub.can_read_template(t.id)) OR EXISTS(SELECT 1 FROM lub.form_responses f JOIN lub.membership_applications a ON a.form_response_id=f.id WHERE f.form_version_id=v.id AND lub.can_read_application(a.id))));
$$;
CREATE FUNCTION lub.can_read_response(target uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT EXISTS(SELECT 1 FROM lub.membership_applications a WHERE a.form_response_id=target AND lub.can_read_application(a.id)); $$;
CREATE FUNCTION lub.can_read_asset(target text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT EXISTS(SELECT 1 FROM lub.application_assets a WHERE a.object_key=target AND EXISTS(SELECT 1 FROM lub.users WHERE id=auth.uid() AND status_code='Active') AND (a.owner_user_id=auth.uid() OR EXISTS(SELECT 1 FROM lub.form_response_assets f WHERE f.asset_id=a.id AND lub.can_read_response(f.form_response_id)))); $$;
GRANT SELECT ON lub.form_templates,lub.form_versions,lub.registration_rounds TO anon,authenticated;
GRANT SELECT ON lub.form_responses,lub.membership_applications,lub.application_internal_notes,lub.application_messages,lub.application_status_history,lub.bulk_actions,lub.bulk_action_items,lub.application_assets,lub.form_response_assets,lub.committee_memberships TO authenticated;
CREATE POLICY templates_read ON lub.form_templates FOR SELECT TO anon,authenticated USING(lub.can_read_template(id));
CREATE POLICY versions_read ON lub.form_versions FOR SELECT TO anon,authenticated USING(lub.can_read_version(id));
CREATE FUNCTION lub.can_read_round(target uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT EXISTS(SELECT 1 FROM lub.registration_rounds r JOIN lub.organizations o ON o.id=r.organization_id WHERE r.id=target AND ((r.status_code IN ('Open','Closed') AND o.status_code='Active') OR lub.has_org_permission(r.organization_id,'REGISTRATION_ROUNDS_MANAGE') OR EXISTS(SELECT 1 FROM lub.membership_applications a WHERE a.registration_round_id=r.id AND lub.can_read_application(a.id)))); $$;
REVOKE ALL ON FUNCTION lub.can_read_round(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lub.can_read_round(uuid) TO anon,authenticated;
CREATE POLICY rounds_read ON lub.registration_rounds FOR SELECT TO anon,authenticated USING(lub.can_read_round(id));
CREATE POLICY applications_read ON lub.membership_applications FOR SELECT TO authenticated USING(lub.can_read_application(id));
CREATE POLICY responses_read ON lub.form_responses FOR SELECT TO authenticated USING(lub.can_read_response(id));
CREATE POLICY notes_read ON lub.application_internal_notes FOR SELECT TO authenticated USING(lub.can_read_application(application_id,'APPLICATIONS_REVIEW'));
CREATE POLICY messages_read ON lub.application_messages FOR SELECT TO authenticated USING(lub.can_read_application(application_id));
CREATE POLICY history_read ON lub.application_status_history FOR SELECT TO authenticated USING(lub.can_read_application(application_id));
CREATE POLICY bulk_read ON lub.bulk_actions FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM lub.bulk_action_items i WHERE i.bulk_action_id=bulk_actions.id AND lub.can_read_application(i.application_id,'APPLICATIONS_BULK_ACTION')));
CREATE POLICY bulk_items_read ON lub.bulk_action_items FOR SELECT TO authenticated USING(lub.can_read_application(application_id,'APPLICATIONS_BULK_ACTION'));
CREATE POLICY assets_read ON lub.application_assets FOR SELECT TO authenticated USING(lub.can_read_asset(object_key));
CREATE POLICY response_assets_read ON lub.form_response_assets FOR SELECT TO authenticated USING(lub.can_read_response(form_response_id));
CREATE POLICY committee_memberships_read ON lub.committee_memberships FOR SELECT TO authenticated USING(lub.has_org_permission(organization_id,'MEMBERS_VIEW',committee_id) OR EXISTS(SELECT 1 FROM lub.organization_memberships m WHERE m.id=organization_membership_id AND m.user_id=auth.uid()));
ALTER TABLE lub.organization_memberships ADD CONSTRAINT membership_source_application_fk FOREIGN KEY(source_application_id) REFERENCES lub.membership_applications(id);
--> statement-breakpoint
CREATE FUNCTION lub.application_audit(target uuid,org uuid,action text) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ INSERT INTO lub.audit_log(actor_user_id,action_code,entity_type,entity_id,organization_id,metadata) VALUES(auth.uid(),action,'application_workflow',target,org,'{}'); $$;
CREATE FUNCTION lub.validate_form_definition(d jsonb) RETURNS void LANGUAGE plpgsql SET search_path='' AS $$
DECLARE s jsonb; f jsonb; o jsonb; prior jsonb:='{}'; ids text[]:='{}'; total int:=0;
BEGIN
 IF d IS NULL OR jsonb_typeof(d)<>'object' OR octet_length(d::text)>128000 OR COALESCE(d->>'layout','') NOT IN ('SinglePage','Progressive') OR jsonb_typeof(d->'sections') IS DISTINCT FROM 'array' OR jsonb_array_length(d->'sections') NOT BETWEEN 1 AND 12 THEN RAISE EXCEPTION 'Invalid definition'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(d) k WHERE k NOT IN ('layout','sections')) THEN RAISE EXCEPTION 'Invalid definition shape'; END IF;
 FOR s IN SELECT value FROM jsonb_array_elements(d->'sections') LOOP
  PERFORM (s->>'id')::uuid;
  IF s->>'id' !~ '^[0-9a-f-]{36}$' OR EXISTS(SELECT 1 FROM jsonb_object_keys(s) k WHERE k NOT IN ('id','title','description','fields')) OR jsonb_typeof(s->'description') IS DISTINCT FROM 'string' OR jsonb_typeof(s->'title') IS DISTINCT FROM 'string' OR jsonb_typeof(s->'id') IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'Invalid section shape'; END IF;
  IF s->>'id' IS NULL OR s->>'id'=ANY(ids) OR COALESCE(length(trim(s->>'title')),0) NOT BETWEEN 1 AND 120 OR length(s->>'description')>1000 OR jsonb_typeof(s->'fields') IS DISTINCT FROM 'array' OR jsonb_array_length(s->'fields') NOT BETWEEN 1 AND 30 THEN RAISE EXCEPTION 'Invalid section'; END IF;
  ids:=array_append(ids,s->>'id');
  FOR f IN SELECT value FROM jsonb_array_elements(s->'fields') LOOP
   PERFORM (f->>'id')::uuid; total:=total+1;
   IF f->>'id' !~ '^[0-9a-f-]{36}$' OR EXISTS(SELECT 1 FROM jsonb_object_keys(f) k WHERE k NOT IN ('id','type','label','help','required','options','maxLength','min','max','condition')) OR jsonb_typeof(f->'help') IS DISTINCT FROM 'string' OR jsonb_typeof(f->'label') IS DISTINCT FROM 'string' OR jsonb_typeof(f->'id') IS DISTINCT FROM 'string' OR jsonb_typeof(f->'maxLength') IS DISTINCT FROM 'number' OR (f ? 'min' AND jsonb_typeof(f->'min')<>'number') OR (f ? 'max' AND jsonb_typeof(f->'max')<>'number') THEN RAISE EXCEPTION 'Invalid field shape'; END IF;
   IF f->>'id' IS NULL OR f->>'id'=ANY(ids) OR total>60 OR COALESCE(f->>'type','') NOT IN ('ShortText','LongText','Number','Email','Date','Select','Radio','MultiSelect','Checkbox','File') OR COALESCE(length(trim(f->>'label')),0) NOT BETWEEN 1 AND 300 OR length(f->>'help')>1000 OR jsonb_typeof(f->'required') IS DISTINCT FROM 'boolean' OR COALESCE((f->>'maxLength')::int,0) NOT BETWEEN 1 AND 2000 OR jsonb_typeof(f->'options') IS DISTINCT FROM 'array' OR jsonb_array_length(f->'options')>30 THEN RAISE EXCEPTION 'Invalid field'; END IF;
   ids:=array_append(ids,f->>'id');
   IF (f->>'type' IN ('Select','Radio','MultiSelect') AND jsonb_array_length(f->'options')<2) OR (f->>'type' NOT IN ('Select','Radio','MultiSelect') AND jsonb_array_length(f->'options')<>0) OR (SELECT count(*)<>count(DISTINCT value->>'value') FROM jsonb_array_elements(f->'options')) THEN RAISE EXCEPTION 'Invalid choices'; END IF;
   FOR o IN SELECT value FROM jsonb_array_elements(f->'options') LOOP IF jsonb_typeof(o->'value') IS DISTINCT FROM 'string' OR jsonb_typeof(o->'label') IS DISTINCT FROM 'string' OR EXISTS(SELECT 1 FROM jsonb_object_keys(o) k WHERE k NOT IN ('value','label')) OR COALESCE(o->>'value','') !~ '^[a-zA-Z0-9_-]{1,40}$' OR COALESCE(length(trim(o->>'label')),0) NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'Invalid option'; END IF; END LOOP;
   IF f ? 'min' AND f ? 'max' AND (f->>'min')::numeric>(f->>'max')::numeric THEN RAISE EXCEPTION 'Invalid bounds'; END IF;
   IF f ? 'condition' AND (NOT prior ? (f->'condition'->>'fieldId') OR prior->(f->'condition'->>'fieldId')->>'type'='File' OR COALESCE(f->'condition'->>'operator','') NOT IN ('Equals','NotEquals') OR COALESCE(length(f->'condition'->>'value'),0) NOT BETWEEN 1 AND 120) THEN RAISE EXCEPTION 'Invalid condition'; END IF;
   IF f ? 'condition' THEN
    IF jsonb_typeof(f->'condition'->'value') IS DISTINCT FROM 'string' OR EXISTS(SELECT 1 FROM jsonb_object_keys(f->'condition') k WHERE k NOT IN ('fieldId','operator','value')) OR (prior->(f->'condition'->>'fieldId')->>'type'='Checkbox' AND f->'condition'->>'value' NOT IN ('true','false')) OR (jsonb_array_length(prior->(f->'condition'->>'fieldId')->'options')>0 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(prior->(f->'condition'->>'fieldId')->'options') oo WHERE oo->>'value'=f->'condition'->>'value')) THEN RAISE EXCEPTION 'Invalid condition answer'; END IF;
   END IF;
   prior:=prior||jsonb_build_object(f->>'id',f);
  END LOOP;
 END LOOP;
END; $$;
CREATE FUNCTION lub.validate_form_answers(d jsonb,input jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE f jsonb; v jsonb; c jsonb; output jsonb:='{}'; known text[]; visible boolean; equal boolean; empty boolean; n numeric; txt text;
BEGIN
 IF input IS NULL OR jsonb_typeof(input)<>'object' OR octet_length(input::text)>256000 THEN RAISE EXCEPTION 'Invalid answers'; END IF;
 SELECT array_agg(e.value->>'id') INTO known FROM jsonb_array_elements(d->'sections') s CROSS JOIN LATERAL jsonb_array_elements(s->'fields') e;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(input) k WHERE NOT k=ANY(known)) THEN RAISE EXCEPTION 'Unknown field'; END IF;
 FOR f IN SELECT e.value FROM jsonb_array_elements(d->'sections') s CROSS JOIN LATERAL jsonb_array_elements(s->'fields') e LOOP
  v:=input->(f->>'id'); c:=f->'condition'; visible:=true;
  IF c IS NOT NULL THEN
   equal:=output->>(c->>'fieldId')=c->>'value' OR (jsonb_typeof(output->(c->>'fieldId'))='array' AND output->(c->>'fieldId') ? (c->>'value'));
   visible:=output ? (c->>'fieldId') AND COALESCE(CASE WHEN c->>'operator'='Equals' THEN equal ELSE NOT equal END,false);
  END IF;
  IF NOT visible THEN CONTINUE; END IF;
  empty:=v IS NULL OR v='null'::jsonb OR v='""'::jsonb OR v='[]'::jsonb OR (f->>'type'='Checkbox' AND (f->>'required')::boolean AND v<>'true'::jsonb);
  IF empty THEN IF (f->>'required')::boolean THEN RAISE EXCEPTION 'Required field'; END IF; CONTINUE; END IF;
  txt:=v#>>'{}';
  CASE f->>'type'
   WHEN 'Checkbox' THEN IF jsonb_typeof(v)<>'boolean' THEN RAISE EXCEPTION 'Invalid checkbox'; END IF;
   WHEN 'MultiSelect' THEN IF jsonb_typeof(v)<>'array' OR jsonb_array_length(v)>30 OR (SELECT count(*)<>count(DISTINCT value) FROM jsonb_array_elements(v)) OR EXISTS(SELECT 1 FROM jsonb_array_elements(v) a WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(f->'options') o WHERE o->'value'=a)) THEN RAISE EXCEPTION 'Invalid choice'; END IF;
   WHEN 'Select','Radio' THEN IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(f->'options') o WHERE o->'value'=v) THEN RAISE EXCEPTION 'Invalid choice'; END IF;
   WHEN 'Number' THEN IF txt !~ '^-?[0-9]+([.][0-9]+)?$' THEN RAISE EXCEPTION 'Invalid number'; END IF; n:=txt::numeric; IF (f ? 'min' AND n<(f->>'min')::numeric) OR (f ? 'max' AND n>(f->>'max')::numeric) THEN RAISE EXCEPTION 'Invalid bounds'; END IF; v:=to_jsonb(n);
   WHEN 'File' THEN IF NOT EXISTS(SELECT 1 FROM lub.application_assets a WHERE a.id=txt::uuid AND a.owner_user_id=auth.uid()) THEN RAISE EXCEPTION 'Invalid attachment'; END IF;
   ELSE
    IF jsonb_typeof(v)<>'string' OR length(trim(txt)) NOT BETWEEN 1 AND (f->>'maxLength')::int THEN RAISE EXCEPTION 'Invalid text'; END IF;
    IF f->>'type'='Email' AND (length(txt)>254 OR txt !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$') THEN RAISE EXCEPTION 'Invalid email'; END IF;
    IF f->>'type'='Date' AND (txt !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' OR to_char(txt::date,'YYYY-MM-DD')<>txt) THEN RAISE EXCEPTION 'Invalid date'; END IF;
    v:=to_jsonb(trim(txt));
  END CASE;
  output:=output||jsonb_build_object(f->>'id',v);
 END LOOP; RETURN output;
END; $$;
--> statement-breakpoint
INSERT INTO lub.form_templates(id,name,is_system_template) VALUES('20000000-0000-4000-8000-000000000001','نموذج LUB للانضمام',true);
INSERT INTO lub.form_versions(id,form_template_id,version_number,status_code,definition,published_at) VALUES('20000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001',1,'Published','{"layout":"SinglePage","sections":[{"id":"10000000-0000-4000-8000-000000000001","title":"عن مشاركتك","description":"البيانات الأساسية موجودة في ملفك؛ نحتاج التعرف على اهتمامك فقط.","fields":[{"id":"10000000-0000-4000-8000-000000000002","type":"LongText","label":"ليش ترغب بالانضمام؟","help":"","required":true,"options":[],"maxLength":1000},{"id":"10000000-0000-4000-8000-000000000003","type":"LongText","label":"خبرتك أو مهاراتك المرتبطة بالجهة","help":"","required":false,"options":[],"maxLength":1500}]}]}',now());
CREATE FUNCTION lub.guard_form_version() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN IF TG_OP='DELETE' OR OLD.status_code<>'Draft' OR (NEW.id,NEW.form_template_id,NEW.version_number) IS DISTINCT FROM (OLD.id,OLD.form_template_id,OLD.version_number) THEN RAISE EXCEPTION 'Immutable version'; END IF; RETURN NEW; END; $$;
CREATE TRIGGER immutable_form_version BEFORE UPDATE OR DELETE ON lub.form_versions FOR EACH ROW EXECUTE FUNCTION lub.guard_form_version();
CREATE FUNCTION lub.create_form(org uuid,title text,source uuid DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE target uuid; d jsonb;
BEGIN
 IF NOT lub.has_org_permission(org,'FORMS_MANAGE') THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 IF source IS NOT NULL AND NOT EXISTS(SELECT 1 FROM lub.form_templates WHERE id=source AND (is_system_template OR organization_id=org)) THEN RAISE EXCEPTION 'Invalid source'; END IF;
 IF source IS NULL THEN d:=jsonb_build_object('layout','SinglePage','sections',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'title','قسم جديد','description','','fields',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'type','ShortText','label','سؤال جديد','help','','required',false,'options','[]'::jsonb,'maxLength',300)))));
 ELSE SELECT definition INTO d FROM lub.form_versions WHERE form_template_id=source ORDER BY version_number DESC LIMIT 1; END IF;
 INSERT INTO lub.form_templates(organization_id,name,source_template_id) VALUES(org,trim(title),source) RETURNING id INTO target;
 INSERT INTO lub.form_versions(form_template_id,version_number,definition) VALUES(target,1,d);
 PERFORM lub.application_audit(target,org,'FORM_CREATED'); RETURN target;
END; $$;
CREATE FUNCTION lub.save_form_draft(target uuid,d jsonb,expected_revision int) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE org uuid;
BEGIN
 SELECT t.organization_id INTO org FROM lub.form_versions v JOIN lub.form_templates t ON t.id=v.form_template_id WHERE v.id=target AND v.status_code='Draft' AND v.revision=expected_revision FOR UPDATE OF v;
 IF org IS NULL OR NOT lub.has_org_permission(org,'FORMS_MANAGE') THEN RAISE EXCEPTION 'Permission or stale draft' USING ERRCODE='42501'; END IF;
 PERFORM lub.validate_form_definition(d); UPDATE lub.form_versions SET definition=d,revision=revision+1 WHERE id=target;
 PERFORM lub.application_audit(target,org,'FORM_DRAFT_SAVED');
END; $$;
CREATE FUNCTION lub.publish_form_version(target uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE org uuid; d jsonb;
BEGIN
 SELECT t.organization_id,v.definition INTO org,d FROM lub.form_versions v JOIN lub.form_templates t ON t.id=v.form_template_id WHERE v.id=target AND v.status_code='Draft' FOR UPDATE OF v;
 IF org IS NULL OR NOT lub.has_org_permission(org,'FORMS_MANAGE') THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 PERFORM lub.validate_form_definition(d); UPDATE lub.form_versions SET status_code='Published',published_at=now() WHERE id=target; PERFORM lub.application_audit(target,org,'FORM_PUBLISHED');
END; $$;
CREATE FUNCTION lub.start_form_draft(target uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE org uuid; draft uuid; latest lub.form_versions;
BEGIN
 SELECT organization_id INTO org FROM lub.form_templates WHERE id=target AND status_code='Active' FOR UPDATE;
 IF org IS NULL OR NOT lub.has_org_permission(org,'FORMS_MANAGE') THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 SELECT id INTO draft FROM lub.form_versions WHERE form_template_id=target AND status_code='Draft'; IF draft IS NOT NULL THEN RETURN draft; END IF;
 SELECT * INTO latest FROM lub.form_versions WHERE form_template_id=target ORDER BY version_number DESC LIMIT 1;
 INSERT INTO lub.form_versions(form_template_id,version_number,definition) VALUES(target,latest.version_number+1,latest.definition) RETURNING id INTO draft;
 PERFORM lub.application_audit(draft,org,'FORM_DRAFT_CREATED'); RETURN draft;
END; $$;
CREATE FUNCTION lub.create_registration_round(org uuid,template uuid,title text,opens timestamptz,closes timestamptz,withdrawal boolean) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE target uuid;
BEGIN
 IF NOT lub.has_org_permission(org,'REGISTRATION_ROUNDS_MANAGE') OR NOT EXISTS(SELECT 1 FROM lub.form_templates t JOIN lub.form_versions v ON v.form_template_id=t.id WHERE t.id=template AND t.organization_id=org AND v.status_code='Published') THEN RAISE EXCEPTION 'Permission or published form required' USING ERRCODE='42501'; END IF;
 INSERT INTO lub.registration_rounds(organization_id,form_template_id,title,opens_at,closes_at,allow_withdrawal) VALUES(org,template,trim(title),opens,closes,withdrawal) RETURNING id INTO target; PERFORM lub.application_audit(target,org,'ROUND_CREATED'); RETURN target;
END; $$;
CREATE FUNCTION lub.change_round_status(target uuid,status text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r lub.registration_rounds;
BEGIN
 SELECT * INTO r FROM lub.registration_rounds WHERE id=target FOR UPDATE;
 IF NOT lub.has_org_permission(r.organization_id,'REGISTRATION_ROUNDS_MANAGE') THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 IF NOT ((r.status_code='Draft' AND status='Open') OR (r.status_code='Open' AND status='Closed') OR (r.status_code IN ('Draft','Closed') AND status='Archived')) THEN RAISE EXCEPTION 'Invalid transition'; END IF;
 UPDATE lub.registration_rounds SET status_code=status WHERE id=target; PERFORM lub.application_audit(target,r.organization_id,'ROUND_'||upper(status));
END; $$;
--> statement-breakpoint
CREATE FUNCTION lub.submit_application(target_round uuid,target_version uuid,input jsonb,committee uuid,target_application uuid DEFAULT NULL,expected_revision int DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r lub.registration_rounds; a lub.membership_applications; v lub.form_versions; cleaned jsonb; response uuid; target uuid; f jsonb;
BEGIN
 SELECT * INTO r FROM lub.registration_rounds WHERE id=target_round FOR UPDATE;
 IF NOT lub.round_is_open(target_round) OR NOT EXISTS(SELECT 1 FROM lub.users u JOIN lub.student_profiles p ON p.user_id=u.id WHERE u.id=auth.uid() AND u.status_code='Active' AND u.email_verified_at IS NOT NULL) THEN RAISE EXCEPTION 'Open round and active profile required'; END IF;
 IF committee IS NOT NULL AND NOT EXISTS(SELECT 1 FROM lub.committees WHERE id=committee AND organization_id=r.organization_id AND status_code='Active' AND is_public) THEN RAISE EXCEPTION 'Invalid committee'; END IF;
 SELECT * INTO v FROM lub.form_versions WHERE id=target_version AND form_template_id=r.form_template_id;
 IF v.id IS NULL THEN RAISE EXCEPTION 'Invalid version'; END IF;
 IF target_application IS NULL THEN
  IF v.status_code<>'Published' OR EXISTS(SELECT 1 FROM lub.form_versions WHERE form_template_id=v.form_template_id AND status_code='Published' AND version_number>v.version_number) THEN RAISE EXCEPTION 'Refresh version'; END IF;
  IF EXISTS(SELECT 1 FROM lub.organization_memberships WHERE organization_id=r.organization_id AND user_id=auth.uid() AND status_code='Active' AND end_date IS NULL) THEN RAISE EXCEPTION 'Already member'; END IF;
 ELSE
  SELECT * INTO a FROM lub.membership_applications WHERE id=target_application AND registration_round_id=target_round AND applicant_user_id=auth.uid() AND status_code IN ('Submitted','Interview') FOR UPDATE;
  IF a.id IS NULL OR NOT EXISTS(SELECT 1 FROM lub.form_responses WHERE id=a.form_response_id AND form_version_id=target_version AND revision=expected_revision) THEN RAISE EXCEPTION 'Locked or stale application'; END IF;
 END IF;
 cleaned:=lub.validate_form_answers(v.definition,input);
 IF target_application IS NULL THEN
  INSERT INTO lub.form_responses(form_version_id,respondent_user_id,answers) VALUES(v.id,auth.uid(),cleaned) RETURNING id INTO response;
  INSERT INTO lub.membership_applications(registration_round_id,applicant_user_id,requested_committee_id,form_response_id) VALUES(r.id,auth.uid(),committee,response) RETURNING id INTO target;
  INSERT INTO lub.application_status_history(application_id,to_status_code,changed_by_user_id) VALUES(target,'Submitted',auth.uid());
 ELSE
  target:=a.id; response:=a.form_response_id; UPDATE lub.form_responses SET answers=cleaned,revision=revision+1,updated_at=now() WHERE id=response; UPDATE lub.membership_applications SET requested_committee_id=committee WHERE id=target;
  DELETE FROM lub.form_response_assets WHERE form_response_id=response;
 END IF;
 FOR f IN SELECT e.value FROM jsonb_array_elements(v.definition->'sections') s CROSS JOIN LATERAL jsonb_array_elements(s->'fields') e WHERE e.value->>'type'='File' LOOP
  IF cleaned ? (f->>'id') THEN INSERT INTO lub.form_response_assets(form_response_id,asset_id,field_id) VALUES(response,(cleaned->>(f->>'id'))::uuid,(f->>'id')::uuid); END IF;
 END LOOP;
 PERFORM lub.application_audit(target,r.organization_id,CASE WHEN target_application IS NULL THEN 'APPLICATION_SUBMITTED' ELSE 'APPLICATION_EDITED' END); RETURN target;
END; $$;
CREATE FUNCTION lub.apply_decision(target uuid,status text,message text,bulk uuid DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a lub.membership_applications; r lub.registration_rounds; member uuid;
BEGIN
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
 INSERT INTO lub.application_status_history(application_id,from_status_code,to_status_code,changed_by_user_id,bulk_action_id) VALUES(target,a.status_code,status,auth.uid(),bulk);
 PERFORM lub.application_audit(target,r.organization_id,'APPLICATION_'||upper(status)); RETURN member;
END; $$;
CREATE FUNCTION lub.decide_application(target uuid,status text,message text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN PERFORM lub.apply_decision(target,status,message); END; $$;
CREATE FUNCTION lub.add_application_note(target uuid,body text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN IF NOT lub.can_read_application(target,'APPLICATIONS_REVIEW') THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF; INSERT INTO lub.application_internal_notes(application_id,author_user_id,body) VALUES(target,auth.uid(),trim(body)); END; $$;
CREATE FUNCTION lub.bulk_decide_applications(targets uuid[],status text,message text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE org uuid; b uuid; a lub.membership_applications; member uuid;
BEGIN
 IF cardinality(targets) NOT BETWEEN 1 AND 100 OR (SELECT count(DISTINCT x) FROM unnest(targets) x)<>cardinality(targets) THEN RAISE EXCEPTION 'Invalid selection'; END IF;
 SELECT r.organization_id INTO org FROM lub.membership_applications mm JOIN lub.registration_rounds r ON r.id=mm.registration_round_id WHERE mm.id=targets[1];
 IF (SELECT count(*) FROM lub.membership_applications mm JOIN lub.registration_rounds r ON r.id=mm.registration_round_id WHERE mm.id=ANY(targets) AND r.organization_id=org)<>cardinality(targets) THEN RAISE EXCEPTION 'Invalid organization selection'; END IF;
 PERFORM 1 FROM lub.registration_rounds WHERE id IN(SELECT registration_round_id FROM lub.membership_applications WHERE id=ANY(targets)) ORDER BY id FOR UPDATE;
 INSERT INTO lub.bulk_actions(organization_id,action_type_code,executed_by_user_id) VALUES(org,status,auth.uid()) RETURNING id INTO b;
 FOR a IN SELECT * FROM lub.membership_applications WHERE id=ANY(targets) ORDER BY id FOR UPDATE LOOP
  member:=lub.apply_decision(a.id,status,message,b);
  INSERT INTO lub.bulk_action_items(bulk_action_id,application_id,previous_status_code,new_status_code,created_membership_id,expected_status_revision) VALUES(b,a.id,a.status_code,status,member,a.status_revision+1);
 END LOOP; RETURN b;
END; $$;
CREATE FUNCTION lub.undo_application_bulk(target uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b lub.bulk_actions; item lub.bulk_action_items; a lub.membership_applications;
BEGIN
 SELECT * INTO b FROM lub.bulk_actions WHERE id=target FOR UPDATE;
 IF b.id IS NULL OR b.executed_by_user_id<>auth.uid() THEN RAISE EXCEPTION 'Undo unavailable'; END IF;
 IF b.undone_at IS NOT NULL THEN RETURN; END IF;
 PERFORM 1 FROM lub.registration_rounds WHERE id IN(SELECT registration_round_id FROM lub.membership_applications WHERE id IN(SELECT application_id FROM lub.bulk_action_items WHERE bulk_action_id=target)) ORDER BY id FOR UPDATE;
 FOR item IN SELECT * FROM lub.bulk_action_items WHERE bulk_action_id=target ORDER BY application_id LOOP
  IF NOT lub.can_read_application(item.application_id,'APPLICATIONS_BULK_ACTION') THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
  SELECT * INTO a FROM lub.membership_applications WHERE id=item.application_id FOR UPDATE;
  IF a.status_revision<>item.expected_status_revision OR a.status_code<>item.new_status_code THEN UPDATE lub.bulk_action_items SET undo_result_code='SkippedChanged' WHERE bulk_action_id=target AND application_id=a.id; CONTINUE; END IF;
  IF item.created_membership_id IS NOT NULL AND (NOT EXISTS(SELECT 1 FROM lub.organization_memberships WHERE id=item.created_membership_id AND status_code='Active' AND end_date IS NULL AND source_application_id=a.id) OR EXISTS(SELECT 1 FROM lub.role_assignments WHERE organization_membership_id=item.created_membership_id) OR EXISTS(SELECT 1 FROM lub.permission_grants WHERE organization_membership_id=item.created_membership_id)) THEN UPDATE lub.bulk_action_items SET undo_result_code='SkippedChanged' WHERE bulk_action_id=target AND application_id=a.id; CONTINUE; END IF;
  IF item.created_membership_id IS NOT NULL THEN UPDATE lub.committee_memberships SET status_code='Ended',end_date=current_date WHERE organization_membership_id=item.created_membership_id AND status_code='Active'; UPDATE lub.organization_memberships SET status_code='Ended',end_date=current_date WHERE id=item.created_membership_id AND status_code='Active'; END IF;
  UPDATE lub.membership_applications SET status_code=item.previous_status_code,status_revision=status_revision+1,accepted_membership_id=NULL,decided_at=NULL,decided_by_user_id=NULL WHERE id=a.id;
  UPDATE lub.bulk_action_items SET undo_result_code='Restored' WHERE bulk_action_id=target AND application_id=a.id;
  INSERT INTO lub.application_status_history(application_id,from_status_code,to_status_code,changed_by_user_id,bulk_action_id,reason) VALUES(a.id,a.status_code,item.previous_status_code,auth.uid(),target,'Undo');
  PERFORM lub.application_audit(a.id,b.organization_id,'APPLICATION_BULK_UNDONE');
 END LOOP; UPDATE lub.bulk_actions SET undone_at=now(),undone_by_user_id=auth.uid() WHERE id=target;
END; $$;
CREATE FUNCTION lub.withdraw_application(target uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a lub.membership_applications; r lub.registration_rounds;
BEGIN
 SELECT rr.* INTO r FROM lub.registration_rounds rr JOIN lub.membership_applications aa ON aa.registration_round_id=rr.id WHERE aa.id=target FOR UPDATE OF rr;
 SELECT * INTO a FROM lub.membership_applications WHERE id=target FOR UPDATE;
 IF a.applicant_user_id IS DISTINCT FROM auth.uid() OR a.status_code NOT IN ('Submitted','Interview') OR NOT r.allow_withdrawal OR NOT lub.round_is_open(r.id) THEN RAISE EXCEPTION 'Withdrawal unavailable'; END IF;
 UPDATE lub.membership_applications SET status_code='Withdrawn',status_revision=status_revision+1 WHERE id=target;
 INSERT INTO lub.application_status_history(application_id,from_status_code,to_status_code,changed_by_user_id) VALUES(target,a.status_code,'Withdrawn',auth.uid()); PERFORM lub.application_audit(target,r.organization_id,'APPLICATION_WITHDRAWN');
END; $$;
CREATE FUNCTION lub.application_profiles(target_org uuid) RETURNS TABLE(application_id uuid,full_name text,major text,level text,university_lookup text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT a.id,p.full_name_ar::text,p.major_name::text,p.academic_level::text,p.university_id_lookup_hash::text FROM lub.membership_applications a JOIN lub.registration_rounds r ON r.id=a.registration_round_id JOIN lub.student_profiles p ON p.user_id=a.applicant_user_id WHERE r.organization_id=target_org AND lub.can_read_application(a.id);
$$;
CREATE FUNCTION lub.grant_application_permission(member uuid,capability text,committee uuid,ends timestamptz) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE org uuid;
BEGIN
 SELECT organization_id INTO org FROM lub.organization_memberships WHERE id=member AND status_code='Active' AND start_date<=current_date AND (end_date IS NULL OR end_date>current_date);
 IF NOT lub.has_org_permission(org,'PERMISSIONS_GRANT') OR capability NOT IN ('FORMS_MANAGE','REGISTRATION_ROUNDS_MANAGE','APPLICATIONS_VIEW','APPLICATIONS_REVIEW','APPLICATIONS_BULK_ACTION') OR (ends IS NOT NULL AND ends<=now()) THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 IF committee IS NOT NULL AND (capability NOT IN ('APPLICATIONS_VIEW','APPLICATIONS_REVIEW','APPLICATIONS_BULK_ACTION') OR NOT EXISTS(SELECT 1 FROM lub.committees WHERE id=committee AND organization_id=org AND status_code='Active')) THEN RAISE EXCEPTION 'Invalid scope'; END IF;
 INSERT INTO lub.permission_grants(organization_membership_id,organization_id,committee_id,permission_code,end_at,granted_by_user_id) VALUES(member,org,committee,capability,ends,auth.uid());
END; $$;
CREATE FUNCTION lub.register_application_asset(target uuid,key text,name text,mime text,size int) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF key<>auth.uid()::text||'/'||target::text OR NOT EXISTS(SELECT 1 FROM lub.users WHERE id=auth.uid() AND status_code='Active') OR length(name) NOT BETWEEN 1 AND 120 OR name ~ '[[:cntrl:]/]' OR position(chr(92) in name)>0 THEN RAISE EXCEPTION 'Invalid asset'; END IF;
 IF (SELECT count(*) FROM lub.application_assets WHERE owner_user_id=auth.uid() AND created_at>now()-interval '1 day')>=30 THEN RAISE EXCEPTION 'Upload quota'; END IF;
 INSERT INTO lub.application_assets(id,owner_user_id,object_key,file_name,mime_type,size_bytes) VALUES(target,auth.uid(),key,name,mime,size);
END; $$;
CREATE FUNCTION lub.application_grant_members(org uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT lub.has_org_permission(org,'PERMISSIONS_GRANT') THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object('id',m.id,'name',p.full_name_ar,'grants',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',g.id,'code',g.permission_code,'committee',cc.name,'ends',g.end_at)) FROM lub.permission_grants g LEFT JOIN lub.committees cc ON cc.id=g.committee_id WHERE g.organization_membership_id=m.id AND g.permission_code IN ('FORMS_MANAGE','REGISTRATION_ROUNDS_MANAGE','APPLICATIONS_VIEW','APPLICATIONS_REVIEW','APPLICATIONS_BULK_ACTION') AND g.start_at<=now() AND (g.end_at IS NULL OR g.end_at>now())),'[]'::jsonb))) FROM lub.organization_memberships m JOIN lub.student_profiles p ON p.user_id=m.user_id JOIN lub.users u ON u.id=m.user_id WHERE m.organization_id=org AND m.status_code='Active' AND u.status_code='Active' AND m.start_date<=current_date AND (m.end_date IS NULL OR m.end_date>current_date)),'[]'::jsonb);
END; $$;
REVOKE ALL ON FUNCTION lub.application_grant_members(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lub.application_grant_members(uuid) TO authenticated;
CREATE FUNCTION lub.has_application_access(org uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT EXISTS(SELECT 1 FROM unnest(ARRAY['FORMS_MANAGE','REGISTRATION_ROUNDS_MANAGE','APPLICATIONS_VIEW','APPLICATIONS_REVIEW','APPLICATIONS_BULK_ACTION','PERMISSIONS_GRANT']) c WHERE lub.has_org_permission(org,c) OR EXISTS(SELECT 1 FROM lub.committees cc WHERE cc.organization_id=org AND lub.has_org_permission(org,c,cc.id))); $$;
REVOKE ALL ON FUNCTION lub.has_application_access(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lub.has_application_access(uuid) TO authenticated;
CREATE FUNCTION lub.end_application_permission(target uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE org uuid;
BEGIN
 SELECT organization_id INTO org FROM lub.permission_grants WHERE id=target AND permission_code IN ('FORMS_MANAGE','REGISTRATION_ROUNDS_MANAGE','APPLICATIONS_VIEW','APPLICATIONS_REVIEW','APPLICATIONS_BULK_ACTION') FOR UPDATE;
 IF org IS NULL OR NOT lub.has_org_permission(org,'PERMISSIONS_GRANT') THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 UPDATE lub.permission_grants SET end_at=now() WHERE id=target AND start_at<=now() AND (end_at IS NULL OR end_at>now());
END; $$;
REVOKE ALL ON FUNCTION lub.end_application_permission(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lub.end_application_permission(uuid) TO authenticated;
CREATE FUNCTION lub.application_prior_member(target uuid) RETURNS TABLE(found boolean) LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT true FROM lub.membership_applications a JOIN lub.organization_memberships m ON m.user_id=a.applicant_user_id WHERE a.id=target AND lub.can_read_application(a.id) AND m.source_application_id IS DISTINCT FROM a.id AND m.created_at<a.created_at LIMIT 1; $$;
REVOKE ALL ON FUNCTION lub.application_prior_member(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lub.application_prior_member(uuid) TO authenticated;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('lub-application-files','lub-application-files',false,5242880,ARRAY['application/pdf','image/jpeg','image/png']);
CREATE POLICY lub_files_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='lub-application-files' AND name ~ ('^'||auth.uid()::text||'/[0-9a-f-]{36}$') AND EXISTS(SELECT 1 FROM lub.users WHERE id=auth.uid() AND status_code='Active'));
CREATE POLICY lub_files_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='lub-application-files' AND (lub.can_read_asset(name) OR (split_part(name,'/',1)=auth.uid()::text AND EXISTS(SELECT 1 FROM lub.users WHERE id=auth.uid() AND status_code='Active'))));
CREATE POLICY lub_files_delete ON storage.objects FOR DELETE TO authenticated USING(bucket_id='lub-application-files' AND split_part(name,'/',1)=auth.uid()::text AND NOT EXISTS(SELECT 1 FROM lub.application_assets a JOIN lub.form_response_assets f ON f.asset_id=a.id WHERE a.object_key=name));
--> statement-breakpoint
REVOKE ALL ON FUNCTION lub.round_is_open(uuid),lub.can_read_application(uuid,text),lub.can_read_template(uuid),lub.can_read_version(uuid),lub.can_read_response(uuid),lub.can_read_asset(text),lub.application_audit(uuid,uuid,text),lub.validate_form_definition(jsonb),lub.validate_form_answers(jsonb,jsonb),lub.guard_form_version(),lub.create_form(uuid,text,uuid),lub.save_form_draft(uuid,jsonb,int),lub.publish_form_version(uuid),lub.start_form_draft(uuid),lub.create_registration_round(uuid,uuid,text,timestamptz,timestamptz,boolean),lub.change_round_status(uuid,text),lub.submit_application(uuid,uuid,jsonb,uuid,uuid,int),lub.apply_decision(uuid,text,text,uuid),lub.decide_application(uuid,text,text),lub.add_application_note(uuid,text),lub.bulk_decide_applications(uuid[],text,text),lub.undo_application_bulk(uuid),lub.withdraw_application(uuid),lub.application_profiles(uuid),lub.grant_application_permission(uuid,text,uuid,timestamptz),lub.register_application_asset(uuid,text,text,text,int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lub.round_is_open(uuid),lub.can_read_application(uuid,text),lub.can_read_template(uuid),lub.can_read_version(uuid) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION lub.can_read_response(uuid),lub.can_read_asset(text),lub.create_form(uuid,text,uuid),lub.save_form_draft(uuid,jsonb,int),lub.publish_form_version(uuid),lub.start_form_draft(uuid),lub.create_registration_round(uuid,uuid,text,timestamptz,timestamptz,boolean),lub.change_round_status(uuid,text),lub.submit_application(uuid,uuid,jsonb,uuid,uuid,int),lub.decide_application(uuid,text,text),lub.add_application_note(uuid,text),lub.bulk_decide_applications(uuid[],text,text),lub.undo_application_bulk(uuid),lub.withdraw_application(uuid),lub.application_profiles(uuid),lub.grant_application_permission(uuid,text,uuid,timestamptz),lub.register_application_asset(uuid,text,text,text,int) TO authenticated;
