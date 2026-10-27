CREATE OR REPLACE FUNCTION lub.validate_form_definition(d jsonb) RETURNS void LANGUAGE plpgsql SET search_path='' AS $$
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
   IF f->>'id' IS NULL OR f->>'id'=ANY(ids) OR total>60 OR COALESCE(f->>'type','') NOT IN ('ShortText','LongText','Number','Email','Date','Select','Radio','MultiSelect','Checkbox','File','Committee') OR COALESCE(length(trim(f->>'label')),0) NOT BETWEEN 1 AND 300 OR length(f->>'help')>1000 OR jsonb_typeof(f->'required') IS DISTINCT FROM 'boolean' OR COALESCE((f->>'maxLength')::int,0) NOT BETWEEN 1 AND 2000 OR jsonb_typeof(f->'options') IS DISTINCT FROM 'array' OR jsonb_array_length(f->'options')>30 THEN RAISE EXCEPTION 'Invalid field'; END IF;
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
--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.validate_form_answers(d jsonb,input jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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
   WHEN 'Committee' THEN IF jsonb_typeof(v)<>'string' OR txt !~ '^[0-9a-f-]{36}$' THEN RAISE EXCEPTION 'Invalid committee'; END IF; PERFORM txt::uuid;
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
CREATE FUNCTION lub.form_committee_answer(d jsonb,input jsonb,org uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE f jsonb; target uuid; result uuid;
BEGIN
 FOR f IN SELECT x FROM jsonb_array_elements(d->'sections') s CROSS JOIN LATERAL jsonb_array_elements(s->'fields') x WHERE x->>'type'='Committee' LOOP
  IF input ? (f->>'id') THEN
   target:=(input->>(f->>'id'))::uuid;
   IF NOT EXISTS(SELECT 1 FROM lub.form_committee_options(org) c WHERE c.id=target) THEN RAISE EXCEPTION 'Committee no longer available';END IF;
   result:=coalesce(result,target);
  END IF;
 END LOOP;
 RETURN result;
END; $$;
REVOKE ALL ON FUNCTION lub.form_committee_answer(jsonb,jsonb,uuid) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION lub.form_committee_options(org uuid) RETURNS TABLE(id uuid,name text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH RECURSIVE tree AS (
 SELECT c.id,c.name::text AS path FROM lub.committees c JOIN lub.organizations o ON o.id=c.organization_id WHERE c.organization_id=org AND c.parent_committee_id IS NULL AND c.status_code='Active' AND c.is_public AND o.status_code='Active'
 UNION ALL SELECT c.id,t.path||' / '||c.name FROM lub.committees c JOIN tree t ON t.id=c.parent_committee_id WHERE c.organization_id=org AND c.status_code='Active' AND c.is_public
 ) SELECT id,path FROM tree ORDER BY path,id;
$$;
REVOKE ALL ON FUNCTION lub.form_committee_options(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lub.form_committee_options(uuid) TO anon,authenticated;

CREATE FUNCTION lub.application_committee_labels(target uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('legacy',c.name,'answers',coalesce((SELECT jsonb_object_agg(ff->>'id',cc.name) FROM jsonb_array_elements(v.definition->'sections') s CROSS JOIN LATERAL jsonb_array_elements(s->'fields') ff JOIN lub.committees cc ON cc.id::text=f.answers->>(ff->>'id') WHERE ff->>'type'='Committee'),'{}'::jsonb))
 FROM lub.membership_applications a JOIN lub.form_responses f ON f.id=a.form_response_id JOIN lub.form_versions v ON v.id=f.form_version_id LEFT JOIN lub.committees c ON c.id=a.requested_committee_id WHERE a.id=target AND lub.can_read_application(a.id);
$$;
REVOKE ALL ON FUNCTION lub.application_committee_labels(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION lub.application_committee_labels(uuid) TO authenticated;

--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.submit_application(target_round uuid,target_version uuid,input jsonb,committee uuid,target_application uuid DEFAULT NULL,expected_revision int DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r lub.registration_rounds; a lub.membership_applications; v lub.form_versions; cleaned jsonb; response uuid; target uuid; f jsonb;
BEGIN
 SELECT * INTO r FROM lub.registration_rounds WHERE id=target_round FOR UPDATE;
 IF EXISTS(SELECT 1 FROM lub.global_role_assignments WHERE user_id=auth.uid() AND role_code='SA' AND start_at<=now() AND (end_at IS NULL OR end_at>now())) OR NOT lub.round_is_open(target_round) OR NOT EXISTS(SELECT 1 FROM lub.users u JOIN lub.student_profiles p ON p.user_id=u.id WHERE u.id=auth.uid() AND u.status_code='Active' AND u.email_verified_at IS NOT NULL) THEN RAISE EXCEPTION 'Open round and active profile required'; END IF;
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
 committee:=lub.form_committee_answer(v.definition,cleaned,r.organization_id);
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v.definition->'sections') s CROSS JOIN LATERAL jsonb_array_elements(s->'fields') ff WHERE ff->>'type'='Committee') AND target_application IS NOT NULL THEN committee:=a.requested_committee_id; END IF;
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
--> statement-breakpoint
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
  cleaned:=lub.validate_form_answers(v.definition,input); PERFORM lub.form_committee_answer(v.definition,cleaned,e.organization_id);
  IF f.id IS NULL THEN INSERT INTO lub.form_responses(form_version_id,respondent_user_id,answers) VALUES(v.id,auth.uid(),cleaned) RETURNING id INTO response;
  ELSE UPDATE lub.form_responses SET answers=cleaned,revision=revision+1,updated_at=now() WHERE id=f.id; response:=f.id; DELETE FROM lub.form_response_assets WHERE form_response_id=f.id; END IF;
  FOR field IN SELECT x FROM jsonb_array_elements(v.definition->'sections') s CROSS JOIN LATERAL jsonb_array_elements(s->'fields') x WHERE x->>'type'='File' LOOP IF cleaned ? (field->>'id') THEN INSERT INTO lub.form_response_assets(form_response_id,asset_id,field_id) VALUES(response,(cleaned->>(field->>'id'))::uuid,(field->>'id')::uuid); END IF; END LOOP;
 ELSE IF version IS NOT NULL OR input IS DISTINCT FROM '{}'::jsonb THEN RAISE EXCEPTION 'Unexpected answers'; END IF; END IF;
 IF r.id IS NULL THEN INSERT INTO lub.event_registrations(event_id,user_id,form_response_id,review_status_code) VALUES(target,auth.uid(),response,CASE WHEN e.requires_approval THEN 'Pending' ELSE 'Accepted' END) RETURNING id INTO result; INSERT INTO lub.event_registration_history(event_registration_id,status_code,actor_user_id) SELECT id,review_status_code,auth.uid() FROM lub.event_registrations WHERE id=result; ELSE result:=r.id; END IF;
 PERFORM lub.workflow_notify(auth.uid(),'EVENT_REGISTRATION_CHANGED','/events/'||target); PERFORM lub.task_audit(result,e.organization_id,'EVENT_REGISTERED');RETURN result;
END; $$;
--> statement-breakpoint
-- BEGIN legacy committee conversion
DO $$
DECLARE t record; latest lub.form_versions; draft lub.form_versions; d jsonb; dd jsonb; section_index int; next_number int; field jsonb;
BEGIN
 FOR t IN SELECT DISTINCT ft.id FROM lub.form_templates ft JOIN lub.registration_rounds r ON r.form_template_id=ft.id WHERE EXISTS(SELECT 1 FROM lub.committees c WHERE c.organization_id=r.organization_id AND c.is_public AND c.status_code='Active') LOOP
  SELECT * INTO latest FROM lub.form_versions WHERE form_template_id=t.id AND status_code='Published' ORDER BY version_number DESC LIMIT 1;
  IF latest.id IS NULL OR EXISTS(SELECT 1 FROM jsonb_array_elements(latest.definition->'sections') s CROSS JOIN LATERAL jsonb_array_elements(s->'fields') f WHERE f->>'type'='Committee') THEN CONTINUE;END IF;
  SELECT * INTO draft FROM lub.form_versions WHERE form_template_id=t.id AND status_code='Draft';
  SELECT max(version_number)+1 INTO next_number FROM lub.form_versions WHERE form_template_id=t.id;
  field:=jsonb_build_object('id',gen_random_uuid(),'type','Committee','label','اللجنة المطلوبة','help','','required',false,'options','[]'::jsonb,'maxLength',300);
  d:=latest.definition;
  SELECT ordinality::int-1 INTO section_index FROM jsonb_array_elements(d->'sections') WITH ORDINALITY s WHERE jsonb_array_length(s.value->'fields')<30 ORDER BY ordinality DESC LIMIT 1;
  IF section_index IS NULL THEN
   d:=jsonb_set(d,'{sections}',(d->'sections')||jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'title','اللجنة','description','','fields',jsonb_build_array(field))));
  ELSE d:=jsonb_set(d,ARRAY['sections',section_index::text,'fields'],(d->'sections'->section_index->'fields')||jsonb_build_array(field));END IF;
  PERFORM lub.validate_form_definition(d);
  INSERT INTO lub.form_versions(form_template_id,version_number,status_code,definition,published_at) VALUES(t.id,next_number,'Published',d,now());
  IF draft.id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(draft.definition->'sections') s CROSS JOIN LATERAL jsonb_array_elements(s->'fields') f WHERE f->>'type'='Committee') THEN
   dd:=draft.definition;
   SELECT ordinality::int-1 INTO section_index FROM jsonb_array_elements(dd->'sections') WITH ORDINALITY s WHERE jsonb_array_length(s.value->'fields')<30 ORDER BY ordinality DESC LIMIT 1;
   IF section_index IS NULL THEN dd:=jsonb_set(dd,'{sections}',(dd->'sections')||jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'title','اللجنة','description','','fields',jsonb_build_array(field))));
   ELSE dd:=jsonb_set(dd,ARRAY['sections',section_index::text,'fields'],(dd->'sections'->section_index->'fields')||jsonb_build_array(field));END IF;
   PERFORM lub.validate_form_definition(dd);
   UPDATE lub.form_versions SET status_code='Retired' WHERE id=draft.id;
   INSERT INTO lub.form_versions(form_template_id,version_number,status_code,definition) VALUES(t.id,next_number+1,'Draft',dd);
  END IF;
 END LOOP;
END; $$;
-- END legacy committee conversion
