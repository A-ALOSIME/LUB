-- Templates retain reusable media and canonical skill keys, without counting as evidence.
ALTER TABLE lub.task_templates ADD COLUMN image_asset_id uuid REFERENCES lub.application_assets(id), ADD COLUMN skill_keys jsonb NOT NULL DEFAULT '[]'::jsonb CONSTRAINT task_template_skill_keys_check CHECK(jsonb_typeof(skill_keys)='array' AND jsonb_array_length(skill_keys)<=30);
CREATE INDEX task_template_image_idx ON lub.task_templates(image_asset_id) WHERE image_asset_id IS NOT NULL;
CREATE FUNCTION lub.save_task_template_bundle(target uuid,org uuid,committee uuid,name text,description text,hours numeric,active boolean,expected int,source uuid,asset uuid,keys jsonb,replace_image boolean) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE saved uuid;entry jsonb;original lub.task_templates;
BEGIN
 IF NOT lub.has_org_permission(org,'TASK_TEMPLATES_MANAGE',committee) THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501';END IF;
 IF source IS NOT NULL THEN
  SELECT * INTO original FROM lub.task_templates WHERE id=source;
  IF target IS NOT NULL OR original.id IS NULL OR original.organization_id<>org OR NOT lub.has_org_permission(org,'TASK_TEMPLATES_MANAGE',original.committee_id) THEN RAISE EXCEPTION 'Invalid source' USING ERRCODE='42501';END IF;
  keys:=original.skill_keys;asset:=original.image_asset_id;replace_image:=true;
 ELSIF asset IS NOT NULL AND replace_image AND NOT EXISTS(SELECT 1 FROM lub.application_assets a WHERE a.id=asset AND a.owner_user_id=auth.uid() AND a.mime_type IN('image/png','image/jpeg') AND a.size_bytes<=5242880) THEN RAISE EXCEPTION 'Invalid image';END IF;
 IF keys IS NOT NULL THEN
  IF jsonb_typeof(keys) IS DISTINCT FROM 'array' OR jsonb_array_length(keys)>30 OR (SELECT count(DISTINCT value) FROM jsonb_array_elements(keys))<>jsonb_array_length(keys) THEN RAISE EXCEPTION 'Invalid skills';END IF;
  FOR entry IN SELECT value FROM jsonb_array_elements(keys) LOOP
   IF jsonb_typeof(entry) IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'Invalid skill';END IF;
   PERFORM lub.resolve_profile_skill_key(entry#>>'{}');
  END LOOP;
 END IF;
 saved:=lub.save_task_template(target,org,committee,name,description,hours,active,expected,source);
 UPDATE lub.task_templates SET image_asset_id=CASE WHEN replace_image THEN asset ELSE image_asset_id END,skill_keys=coalesce(keys,skill_keys) WHERE id=saved;
 RETURN saved;
END; $$;
-- The row policy guards the template before its metadata is projected.
CREATE FUNCTION lub.task_template_skills(target uuid) RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('key',x.key,'labelAr',coalesce(d.name_ar,s.name_ar),'labelEn',coalesce(d.name_en,s.name_en,s.name_ar),'category',jsonb_build_object('key',c.code,'labelAr',c.name_ar,'labelEn',c.name_en),'featured',false,'order',0,'tasks',0,'events',0,'filterValue',coalesce(s.name_ar,d.name_ar)) ORDER BY x.position),'[]')
 FROM lub.task_templates t CROSS JOIN LATERAL jsonb_array_elements_text(t.skill_keys) WITH ORDINALITY x(key,position)
 LEFT JOIN lub.skill_dictionary d ON d.key=x.key
 LEFT JOIN LATERAL(SELECT name_ar,name_en FROM lub.skills s WHERE s.is_active AND coalesce(s.dictionary_key,'custom:'||lub.skill_key(s.name_ar))=x.key ORDER BY s.id LIMIT 1) s ON true
 JOIN lub.skill_categories c ON c.code=coalesce(d.category_code,'other') WHERE t.id=target;
$$;
CREATE FUNCTION lub.apply_task_template_media(target uuid,source uuid,expected int) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE task lub.tasks;template lub.task_templates;
BEGIN
 SELECT * INTO task FROM lub.tasks WHERE id=target FOR UPDATE;
 IF task.id IS NULL OR NOT lub.can_manage_task(target) OR task.status_code<>'Draft' OR task.revision IS DISTINCT FROM expected OR task.task_template_id IS DISTINCT FROM source THEN RAISE EXCEPTION 'Task permission required' USING ERRCODE='42501';END IF;
 SELECT * INTO template FROM lub.task_templates WHERE id=source;
 IF template.id IS NULL OR NOT template.is_active OR template.organization_id<>task.organization_id OR (template.committee_id IS NOT NULL AND template.committee_id IS DISTINCT FROM task.committee_id) THEN RAISE EXCEPTION 'Invalid template';END IF;
 UPDATE lub.tasks SET image_asset_id=template.image_asset_id,revision=revision+1 WHERE id=target;
 PERFORM lub.set_activity_skill_tags('Task',target,template.skill_keys,(SELECT revision FROM lub.tasks WHERE id=target));
END; $$;
CREATE OR REPLACE FUNCTION lub.copy_committee_task_templates() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.copied_from_committee_id IS NOT NULL THEN
  INSERT INTO lub.task_templates(organization_id,committee_id,name,description_template,default_hours,copied_from_template_id,image_asset_id,skill_keys)
  SELECT NEW.organization_id,NEW.id,t.name,t.description_template,t.default_hours,t.id,t.image_asset_id,t.skill_keys FROM lub.task_templates t WHERE t.committee_id=NEW.copied_from_committee_id AND t.organization_id=NEW.organization_id AND t.is_active;
 END IF;RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION lub.save_task_template_bundle(uuid,uuid,uuid,text,text,numeric,boolean,int,uuid,uuid,jsonb,boolean),lub.task_template_skills(uuid),lub.apply_task_template_media(uuid,uuid,int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lub.save_task_template_bundle(uuid,uuid,uuid,text,text,numeric,boolean,int,uuid,uuid,jsonb,boolean),lub.task_template_skills(uuid),lub.apply_task_template_media(uuid,uuid,int) TO authenticated;
CREATE OR REPLACE FUNCTION lub.can_read_asset(target text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM lub.application_assets a WHERE a.object_key=target AND EXISTS(SELECT 1 FROM lub.users WHERE id=auth.uid() AND status_code='Active') AND (a.owner_user_id=auth.uid() OR EXISTS(SELECT 1 FROM lub.form_response_assets f WHERE f.asset_id=a.id AND lub.can_read_response(f.form_response_id)) OR EXISTS(SELECT 1 FROM lub.task_submission_assets s WHERE s.asset_id=a.id AND lub.can_read_task_submission(s.task_submission_id)) OR EXISTS(SELECT 1 FROM lub.event_assets ea WHERE ea.asset_id=a.id AND lub.can_operate_event(ea.event_id)) OR EXISTS(SELECT 1 FROM lub.announcements n WHERE n.image_asset_id=a.id AND n.deleted_at IS NULL AND lub.has_org_permission(n.organization_id,'ORG_PROFILE_MANAGE')) OR lub.can_read_public_announcement_object(a.object_key) OR EXISTS(SELECT 1 FROM lub.task_templates t WHERE t.image_asset_id=a.id AND (lub.has_org_permission(t.organization_id,'TASK_TEMPLATES_MANAGE',t.committee_id) OR lub.has_org_permission(t.organization_id,'TASKS_MANAGE',t.committee_id))) OR EXISTS(SELECT 1 FROM lub.tasks t WHERE t.image_asset_id=a.id AND lub.can_read_task(t.id)) OR EXISTS(SELECT 1 FROM lub.task_revisions r WHERE r.snapshot_json->>'image_asset_id'=a.id::text AND lub.can_read_task_revision(r.id))));
$$;
CREATE OR REPLACE FUNCTION lub.can_delete_application_object(target text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT split_part(target,'/',1)=auth.uid()::text AND EXISTS(SELECT 1 FROM lub.users WHERE id=auth.uid() AND status_code='Active') AND NOT EXISTS(SELECT 1 FROM lub.application_assets a WHERE a.object_key=target AND (EXISTS(SELECT 1 FROM lub.form_response_assets f WHERE f.asset_id=a.id) OR EXISTS(SELECT 1 FROM lub.task_submission_assets s WHERE s.asset_id=a.id) OR EXISTS(SELECT 1 FROM lub.event_assets e WHERE e.asset_id=a.id) OR EXISTS(SELECT 1 FROM lub.announcements n WHERE n.image_asset_id=a.id) OR EXISTS(SELECT 1 FROM lub.task_templates t WHERE t.image_asset_id=a.id) OR EXISTS(SELECT 1 FROM lub.tasks t WHERE t.image_asset_id=a.id) OR EXISTS(SELECT 1 FROM lub.task_revisions r WHERE r.snapshot_json->>'image_asset_id'=a.id::text))); $$;
