-- One current form per library entry; submitted cases keep their own immutable snapshot.
CREATE FUNCTION lub.form_storage_owner(target uuid) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT o.id FROM lub.organizations o WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(o.forms) f WHERE f->>'id'=target::text);
$$;
CREATE FUNCTION lub.lock_owned_form(target uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE org uuid;
BEGIN
 org:=lub.form_storage_owner(target);
 IF org IS NULL OR NOT lub.has_org_permission(org,'FORMS_MANAGE') THEN RAISE EXCEPTION 'Form permission required' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM lub.organizations WHERE id=org FOR UPDATE;
 IF NOT lub.has_org_permission(org,'FORMS_MANAGE') OR lub.form_storage_owner(target) IS DISTINCT FROM org THEN RAISE EXCEPTION 'Form permission required' USING ERRCODE='42501'; END IF;
 RETURN org;
END; $$;
CREATE FUNCTION lub.store_form_entry(org uuid,target uuid,entry jsonb) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 UPDATE lub.organizations SET forms=coalesce((SELECT jsonb_agg(CASE WHEN f->>'id'=target::text THEN entry ELSE f END ORDER BY ordinal)
  FROM jsonb_array_elements(forms) WITH ORDINALITY AS x(f,ordinal) WHERE f->>'id'<>target::text OR entry IS NOT NULL),'[]'),updated_at=now() WHERE id=org;
$$;
CREATE FUNCTION lub.check_form_library() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE f jsonb; v jsonb;
BEGIN
 IF jsonb_array_length(NEW.forms)>100 THEN RAISE EXCEPTION 'Too many forms'; END IF;
 FOR f IN SELECT value FROM jsonb_array_elements(NEW.forms) LOOP
  v:=f->'version';
  IF jsonb_typeof(f->'name') IS DISTINCT FROM 'string' OR length(trim(f->>'name')) NOT BETWEEN 2 AND 120
   OR jsonb_typeof(v) IS DISTINCT FROM 'object' OR v->>'id' IS DISTINCT FROM f->>'id' OR coalesce(v->>'status_code','') NOT IN ('Draft','Published')
   OR jsonb_typeof(v->'revision') IS DISTINCT FROM 'number' OR coalesce(v->>'revision','') !~ '^[1-9][0-9]{0,8}$'
   OR EXISTS(SELECT 1 FROM jsonb_object_keys(f) k WHERE k NOT IN ('id','name','sourceFormId','createdAt','updatedAt','version'))
   OR EXISTS(SELECT 1 FROM jsonb_object_keys(v) k WHERE k NOT IN ('id','status_code','revision','definition')) THEN RAISE EXCEPTION 'Invalid form library'; END IF;
  PERFORM lub.validate_form_definition(v->'definition');
 END LOOP;
 IF EXISTS(SELECT 1 FROM lub.membership_campaigns c WHERE c.organization_id=NEW.id AND c.form_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.forms) entry WHERE entry->>'id'=c.form_id::text))
  OR EXISTS(SELECT 1 FROM lub.organization_content c WHERE c.organization_id=NEW.id AND c.form_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.forms) entry WHERE entry->>'id'=c.form_id::text)) THEN RAISE EXCEPTION 'Referenced form cannot be removed' USING ERRCODE='23503'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER form_library_valid BEFORE INSERT OR UPDATE OF forms ON lub.organizations FOR EACH ROW EXECUTE FUNCTION lub.check_form_library();

CREATE FUNCTION lub.check_content_form_reference() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE library jsonb; entry jsonb;
BEGIN
 IF NEW.form_id IS NULL THEN
  IF TG_TABLE_NAME='membership_campaigns' AND NEW.kind='Registration' AND NEW.status_code NOT IN ('Draft','Archived') THEN RAISE EXCEPTION 'ROUND_REQUIRED_FIELDS'; END IF;
  RETURN NEW;
 END IF;
 -- Serialize nested-reference changes with library edits/deletion; a JSON field has no native FK.
 SELECT o.forms INTO library FROM lub.organizations o WHERE o.id=NEW.organization_id FOR SHARE;
 SELECT f INTO entry FROM jsonb_array_elements(library) f WHERE f->>'id'=NEW.form_id::text;
 IF entry IS NULL THEN RAISE EXCEPTION 'Form must belong to this organization' USING ERRCODE='23503'; END IF;
 IF NEW.status_code NOT IN ('Draft','Archived') AND entry->'version'->>'status_code'<>'Published' THEN RAISE EXCEPTION 'Published form required'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER campaign_form_reference BEFORE INSERT OR UPDATE OF form_id,organization_id,status_code ON lub.membership_campaigns FOR EACH ROW EXECUTE FUNCTION lub.check_content_form_reference();
CREATE TRIGGER content_form_reference BEFORE INSERT OR UPDATE OF form_id,organization_id,status_code ON lub.organization_content FOR EACH ROW EXECUTE FUNCTION lub.check_content_form_reference();

CREATE FUNCTION lub.create_form(org uuid,title text,source uuid DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE target uuid:=gen_random_uuid(); d jsonb;
BEGIN
 IF NOT lub.has_org_permission(org,'FORMS_MANAGE') THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM lub.organizations WHERE id=org FOR UPDATE;
 IF title IS NULL OR length(trim(title)) NOT BETWEEN 2 AND 120 THEN RAISE EXCEPTION 'Invalid form title'; END IF;
 IF source IS NULL THEN
  d:=jsonb_build_object('layout','SinglePage','sections',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'title','قسم جديد','description','','fields',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'type','ShortText','label','سؤال جديد','help','','required',false,'options','[]'::jsonb,'maxLength',300)))));
 ELSE
  SELECT f->'version'->'definition' INTO d FROM lub.organizations o CROSS JOIN LATERAL jsonb_array_elements(o.forms) f WHERE o.id=org AND f->>'id'=source::text;
  IF d IS NULL THEN RAISE EXCEPTION 'Invalid source'; END IF;
 END IF;
 UPDATE lub.organizations SET forms=forms||jsonb_build_array(jsonb_build_object('id',target,'name',trim(title),'sourceFormId',source,'createdAt',now(),'updatedAt',now(),
  'version',jsonb_build_object('id',target,'revision',1,'status_code','Draft','definition',d))),updated_at=now() WHERE id=org;
 RETURN target;
END; $$;
CREATE FUNCTION lub.save_form_draft(target uuid,d jsonb,expected_revision int) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE org uuid; entry jsonb;
BEGIN
 org:=lub.lock_owned_form(target);
 SELECT f INTO entry FROM lub.organizations o CROSS JOIN LATERAL jsonb_array_elements(o.forms) f WHERE o.id=org AND f->>'id'=target::text;
 IF (entry->'version'->>'revision')::int IS DISTINCT FROM expected_revision THEN RAISE EXCEPTION 'Stale form revision'; END IF;
 PERFORM lub.validate_form_definition(d);
 entry:=entry||jsonb_build_object('updatedAt',now(),'version',(entry->'version')||jsonb_build_object('definition',d,'revision',expected_revision+1));
 PERFORM lub.store_form_entry(org,target,entry);
END; $$;
CREATE FUNCTION lub.publish_form_version(target uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE org uuid; entry jsonb;
BEGIN
 org:=lub.lock_owned_form(target);
 SELECT f INTO entry FROM lub.organizations o CROSS JOIN LATERAL jsonb_array_elements(o.forms) f WHERE o.id=org AND f->>'id'=target::text;
 PERFORM lub.validate_form_definition(entry->'version'->'definition');
 PERFORM lub.store_form_entry(org,target,entry||jsonb_build_object('updatedAt',now(),'version',(entry->'version')||jsonb_build_object('status_code','Published')));
END; $$;
CREATE FUNCTION lub.start_form_draft(target uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM lub.lock_owned_form(target); RETURN target;
END; $$;
CREATE FUNCTION lub.duplicate_form(target uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE org uuid; title text;
BEGIN
 org:=lub.lock_owned_form(target);
 SELECT 'نسخة من '||left(f->>'name',112) INTO title FROM lub.organizations o CROSS JOIN LATERAL jsonb_array_elements(o.forms) f WHERE o.id=org AND f->>'id'=target::text;
 RETURN lub.create_form(org,title,target);
END; $$;
CREATE FUNCTION lub.can_delete_form(target uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT lub.has_org_permission(lub.form_storage_owner(target),'FORMS_MANAGE')
  AND NOT EXISTS(SELECT 1 FROM lub.membership_campaigns c WHERE c.form_id=target)
  AND NOT EXISTS(SELECT 1 FROM lub.organization_content c WHERE c.form_id=target);
$$;
CREATE FUNCTION lub.delete_form(target uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE org uuid;
BEGIN
 org:=lub.lock_owned_form(target);
 IF NOT lub.can_delete_form(target) THEN RAISE EXCEPTION 'Referenced form cannot be deleted' USING ERRCODE='23503'; END IF;
 PERFORM lub.store_form_entry(org,target,NULL);
END; $$;
CREATE FUNCTION lub.form_library(org uuid,selected uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT lub.has_org_permission(org,'FORMS_MANAGE') AND NOT lub.has_org_permission(org,'REGISTRATION_ROUNDS_MANAGE') THEN RAISE EXCEPTION 'Form permission required' USING ERRCODE='42501'; END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id',f->>'id','name',f->>'name','organization_id',org,'updated_at',f->>'updatedAt','version_count',1,
  'can_delete',lub.can_delete_form((f->>'id')::uuid),'round_count',(SELECT count(*) FROM lub.membership_campaigns c WHERE c.kind='Registration' AND c.form_id=(f->>'id')::uuid),
  'event_count',(SELECT count(*) FROM lub.organization_content c WHERE c.kind='Event' AND c.form_id=(f->>'id')::uuid),
  'versions',jsonb_build_array(((f->'version')||jsonb_build_object('version_number',(f->'version'->>'revision')::int))-CASE WHEN f->>'id'=selected::text THEN '' ELSE 'definition' END)) ORDER BY f->>'createdAt' DESC,f->>'id')
  FROM lub.organizations o CROSS JOIN LATERAL jsonb_array_elements(o.forms) f WHERE o.id=org),'[]');
END; $$;
REVOKE ALL ON FUNCTION lub.form_storage_owner(uuid),lub.lock_owned_form(uuid),lub.store_form_entry(uuid,uuid,jsonb),lub.check_form_library(),lub.check_content_form_reference(),
 lub.create_form(uuid,text,uuid),lub.save_form_draft(uuid,jsonb,int),lub.publish_form_version(uuid),lub.start_form_draft(uuid),lub.duplicate_form(uuid),lub.can_delete_form(uuid),lub.delete_form(uuid),lub.form_library(uuid,uuid),
 lub.validate_form_definition(jsonb),lub.validate_form_answers(jsonb,jsonb),lub.form_committee_answer(jsonb,jsonb,uuid),lub.form_committee_options(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION lub.create_form(uuid,text,uuid),lub.save_form_draft(uuid,jsonb,int),lub.publish_form_version(uuid),lub.start_form_draft(uuid),lub.duplicate_form(uuid),lub.can_delete_form(uuid),lub.delete_form(uuid),lub.form_library(uuid,uuid),
 lub.validate_form_definition(jsonb),lub.validate_form_answers(jsonb,jsonb),lub.form_committee_answer(jsonb,jsonb,uuid),lub.form_committee_options(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION lub.form_committee_options(uuid) TO anon;
