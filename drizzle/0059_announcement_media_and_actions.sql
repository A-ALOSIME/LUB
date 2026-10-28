ALTER TABLE lub.announcements ADD COLUMN external_url text, ADD COLUMN image_asset_id uuid REFERENCES lub.application_assets(id), ADD COLUMN deleted_at timestamptz;
ALTER TABLE lub.announcements ADD CONSTRAINT announcement_external_url_check CHECK(external_url IS NULL OR (length(external_url)<=2000 AND external_url~*'^https?://[^[:space:]]+$'));
CREATE INDEX announcement_image_asset_idx ON lub.announcements(image_asset_id) WHERE image_asset_id IS NOT NULL;
CREATE POLICY announcement_not_deleted ON lub.announcements AS RESTRICTIVE FOR SELECT TO anon,authenticated USING(deleted_at IS NULL);
CREATE FUNCTION lub.guard_announcement_image() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.image_asset_id IS NOT NULL AND (TG_OP='INSERT' OR NEW.image_asset_id IS DISTINCT FROM OLD.image_asset_id) AND NOT EXISTS(SELECT 1 FROM lub.application_assets a WHERE a.id=NEW.image_asset_id AND a.owner_user_id=auth.uid() AND a.mime_type IN ('image/jpeg','image/png') AND a.size_bytes<=5242880) THEN RAISE EXCEPTION 'Invalid image' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER announcement_image_guard BEFORE INSERT OR UPDATE ON lub.announcements FOR EACH ROW EXECUTE FUNCTION lub.guard_announcement_image();
CREATE FUNCTION lub.save_announcement(target uuid,org uuid,heading text,content text,link text,published boolean,pinned boolean,asset uuid,replace_image boolean) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a lub.announcements;
BEGIN
 IF NOT lub.has_org_permission(org,'ORG_PROFILE_MANAGE') THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM lub.organizations WHERE id=org FOR UPDATE;
 IF target IS NOT NULL THEN
  SELECT * INTO a FROM lub.announcements WHERE id=target AND organization_id=org AND deleted_at IS NULL AND archived_at IS NULL FOR UPDATE;
  IF a.id IS NULL THEN RAISE EXCEPTION 'Announcement unavailable'; END IF;
 END IF;
 IF pinned AND NOT published THEN RAISE EXCEPTION 'Publish before pinning'; END IF;
 IF pinned THEN UPDATE lub.announcements SET pinned_at=NULL WHERE organization_id=org AND pinned_at IS NOT NULL; END IF;
 IF target IS NULL THEN
  INSERT INTO lub.announcements(organization_id,title,body,external_url,image_asset_id,published_at,pinned_at) VALUES(org,heading,content,nullif(trim(link),''),CASE WHEN replace_image THEN asset END,CASE WHEN published THEN now() END,CASE WHEN pinned THEN now() END) RETURNING id INTO target;
 ELSE
  UPDATE lub.announcements SET title=heading,body=content,external_url=nullif(trim(link),''),image_asset_id=CASE WHEN replace_image THEN asset ELSE image_asset_id END,published_at=CASE WHEN published THEN coalesce(a.published_at,now()) END,pinned_at=CASE WHEN pinned THEN now() END,updated_at=now() WHERE id=target;
 END IF;
 RETURN target;
END; $$;
CREATE FUNCTION lub.change_announcement_state(target uuid,operation text,pinned boolean DEFAULT false) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE org uuid; a lub.announcements;
BEGIN
 SELECT organization_id INTO org FROM lub.announcements WHERE id=target;
 IF org IS NULL OR NOT lub.has_org_permission(org,'ORG_PROFILE_MANAGE') THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM lub.organizations WHERE id=org FOR UPDATE;
 SELECT * INTO a FROM lub.announcements WHERE id=target AND deleted_at IS NULL FOR UPDATE;
 IF a.id IS NULL OR operation NOT IN ('pin','archive','delete') THEN RAISE EXCEPTION 'Announcement unavailable'; END IF;
 IF operation='pin' THEN
  IF a.published_at IS NULL OR a.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Published announcement required'; END IF;
  IF pinned THEN UPDATE lub.announcements SET pinned_at=NULL WHERE organization_id=org AND pinned_at IS NOT NULL; END IF;
  UPDATE lub.announcements SET pinned_at=CASE WHEN pinned THEN now() END,updated_at=now() WHERE id=target;
 ELSE
  UPDATE lub.announcements SET pinned_at=NULL,archived_at=coalesce(archived_at,now()),deleted_at=CASE WHEN operation='delete' THEN now() END,updated_at=now() WHERE id=target;
 END IF;
END; $$;
CREATE FUNCTION lub.public_announcement_image(target uuid) RETURNS TABLE(object_key text,mime_type text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT a.object_key::text,a.mime_type::text FROM lub.announcements n JOIN lub.application_assets a ON a.id=n.image_asset_id WHERE n.id=target AND n.published_at IS NOT NULL AND n.published_at<=statement_timestamp() AND n.archived_at IS NULL AND n.deleted_at IS NULL AND a.mime_type IN ('image/jpeg','image/png');
$$;
CREATE FUNCTION lub.can_read_public_announcement_object(target text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM lub.announcements n JOIN lub.application_assets a ON a.id=n.image_asset_id WHERE a.object_key=target AND n.published_at IS NOT NULL AND n.published_at<=statement_timestamp() AND n.archived_at IS NULL AND n.deleted_at IS NULL AND a.mime_type IN ('image/jpeg','image/png'));
$$;
CREATE POLICY announcement_images_public_read ON storage.objects FOR SELECT TO anon,authenticated USING(bucket_id='lub-application-files' AND lub.can_read_public_announcement_object(name));
REVOKE ALL ON FUNCTION lub.guard_announcement_image(),lub.save_announcement(uuid,uuid,text,text,text,boolean,boolean,uuid,boolean),lub.change_announcement_state(uuid,text,boolean),lub.public_announcement_image(uuid),lub.can_read_public_announcement_object(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lub.save_announcement(uuid,uuid,text,text,text,boolean,boolean,uuid,boolean),lub.change_announcement_state(uuid,text,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION lub.public_announcement_image(uuid),lub.can_read_public_announcement_object(text) TO anon,authenticated;
CREATE OR REPLACE FUNCTION lub.can_read_asset(target text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM lub.application_assets a WHERE a.object_key=target AND EXISTS(SELECT 1 FROM lub.users WHERE id=auth.uid() AND status_code='Active') AND (a.owner_user_id=auth.uid() OR EXISTS(SELECT 1 FROM lub.form_response_assets f WHERE f.asset_id=a.id AND lub.can_read_response(f.form_response_id)) OR EXISTS(SELECT 1 FROM lub.task_submission_assets s WHERE s.asset_id=a.id AND lub.can_read_task_submission(s.task_submission_id)) OR EXISTS(SELECT 1 FROM lub.event_assets ea WHERE ea.asset_id=a.id AND lub.can_operate_event(ea.event_id)) OR EXISTS(SELECT 1 FROM lub.announcements n WHERE n.image_asset_id=a.id AND n.deleted_at IS NULL AND lub.has_org_permission(n.organization_id,'ORG_PROFILE_MANAGE')) OR lub.can_read_public_announcement_object(a.object_key) OR EXISTS(SELECT 1 FROM lub.tasks t WHERE t.image_asset_id=a.id AND lub.can_read_task(t.id)) OR EXISTS(SELECT 1 FROM lub.task_revisions r WHERE r.snapshot_json->>'image_asset_id'=a.id::text AND lub.can_read_task_revision(r.id))));
$$;
CREATE OR REPLACE FUNCTION lub.can_delete_application_object(target text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT split_part(target,'/',1)=auth.uid()::text AND EXISTS(SELECT 1 FROM lub.users WHERE id=auth.uid() AND status_code='Active') AND NOT EXISTS(SELECT 1 FROM lub.application_assets a WHERE a.object_key=target AND (EXISTS(SELECT 1 FROM lub.form_response_assets f WHERE f.asset_id=a.id) OR EXISTS(SELECT 1 FROM lub.task_submission_assets s WHERE s.asset_id=a.id) OR EXISTS(SELECT 1 FROM lub.event_assets e WHERE e.asset_id=a.id) OR EXISTS(SELECT 1 FROM lub.announcements n WHERE n.image_asset_id=a.id) OR EXISTS(SELECT 1 FROM lub.tasks t WHERE t.image_asset_id=a.id) OR EXISTS(SELECT 1 FROM lub.task_revisions r WHERE r.snapshot_json->>'image_asset_id'=a.id::text))); $$;
