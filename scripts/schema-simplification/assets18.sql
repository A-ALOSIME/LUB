-- Files retain their original display names; storage keys never contain them.
CREATE FUNCTION lub.register_application_asset(target uuid,key text,name text,mime text,size int) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE extension text;
BEGIN
 PERFORM 1 FROM lub.users WHERE id=auth.uid() AND status_code='Active' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Active account required' USING ERRCODE='42501'; END IF;
 extension:=CASE mime WHEN 'application/pdf' THEN '.pdf' WHEN 'image/jpeg' THEN '.jpg' WHEN 'image/png' THEN '.png' END;
 IF target IS NULL OR extension IS NULL OR key IS DISTINCT FROM auth.uid()::text||'/'||target::text||extension
  OR name IS NULL OR length(name) NOT BETWEEN 1 AND 120 OR name ~ '[[:cntrl:]/]' OR position(chr(92) in name)>0
  OR size IS NULL OR size NOT BETWEEN 1 AND 5242880 THEN RAISE EXCEPTION 'Invalid file'; END IF;
 IF (SELECT count(*) FROM lub.assets WHERE owner_user_id=auth.uid() AND created_at>statement_timestamp()-interval '1 day')>=30 THEN RAISE EXCEPTION 'Upload quota'; END IF;
 INSERT INTO lub.assets(id,owner_user_id,object_key,file_name,mime_type,size_bytes) VALUES(target,auth.uid(),key,name,mime,size);
END; $$;
CREATE FUNCTION lub.set_asset_thumbnail(target uuid,thumbnail text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM lub.assets a JOIN lub.users u ON u.id=auth.uid() AND u.status_code='Active' WHERE a.id=target AND a.owner_user_id=auth.uid() AND a.mime_type IN ('image/png','image/jpeg')) THEN RAISE EXCEPTION 'Owner required' USING ERRCODE='42501'; END IF;
 IF thumbnail IS NULL OR length(thumbnail)>87384 OR substring(decode(thumbnail,'base64') FROM 1 FOR 8)<>decode('89504e470d0a1a0a','hex') THEN RAISE EXCEPTION 'Invalid thumbnail'; END IF;
 UPDATE lub.assets SET thumbnail_png_base64=thumbnail WHERE id=target;
END; $$;
CREATE FUNCTION lub.set_asset_image_dimensions(target uuid,w integer,h integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM lub.assets a JOIN lub.users u ON u.id=auth.uid() AND u.status_code='Active' WHERE a.id=target AND a.owner_user_id=auth.uid() AND a.mime_type IN ('image/png','image/jpeg')) THEN RAISE EXCEPTION 'Owner required' USING ERRCODE='42501'; END IF;
 IF w IS NULL OR h IS NULL OR w NOT BETWEEN 1 AND 100000 OR h NOT BETWEEN 1 AND 100000 THEN RAISE EXCEPTION 'Invalid dimensions'; END IF;
 UPDATE lub.assets SET image_width=w,image_height=h WHERE id=target;
END; $$;
ALTER TABLE lub.assets DROP CONSTRAINT assets_check;
ALTER TABLE lub.assets ADD CONSTRAINT asset_dimensions CHECK((image_width IS NULL AND image_height IS NULL)
 OR (image_width IS NOT NULL AND image_height IS NOT NULL AND image_width BETWEEN 1 AND 100000 AND image_height BETWEEN 1 AND 100000));

CREATE FUNCTION lub.content_is_public(target uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM lub.organization_content c JOIN lub.organizations o ON o.id=c.organization_id
 WHERE c.id=target AND o.status_code='Active' AND c.published_at IS NOT NULL AND c.archived_at IS NULL AND c.deleted_at IS NULL
 AND (c.status_code IN ('Published','Completed') OR (c.kind='Event' AND c.status_code='Archived')));
$$;
CREATE FUNCTION lub.can_read_public_asset_object(key text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM lub.assets a WHERE a.object_key=key AND a.mime_type IN ('image/png','image/jpeg')
 AND EXISTS(SELECT 1 FROM lub.organization_content c WHERE lub.content_is_public(c.id)
 AND (c.primary_image_id=a.id OR EXISTS(SELECT 1 FROM jsonb_array_elements(c.public_photos) f WHERE f->>'assetId'=a.id::text))));
$$;
CREATE FUNCTION lub.can_read_asset(target uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM lub.users u WHERE u.id=auth.uid() AND u.status_code='Active')
 AND EXISTS(SELECT 1 FROM lub.assets a WHERE a.id=target AND (a.owner_user_id=auth.uid() OR lub.is_super_admin()
 OR lub.can_read_public_asset_object(a.object_key)
 OR EXISTS(SELECT 1 FROM lub.membership_cases c WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(c.attachments) f WHERE f->>'assetId'=a.id::text)
   AND (c.user_id=auth.uid() OR lub.can_read_application(c.id)))
 OR EXISTS(SELECT 1 FROM lub.event_registrations r WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(r.attachments) f WHERE f->>'assetId'=a.id::text)
   AND (r.user_id=auth.uid() OR lub.has_org_permission(r.organization_id,'EVENT_REGISTRATIONS_REVIEW')))
 OR EXISTS(SELECT 1 FROM lub.task_participants p WHERE (p.user_id=auth.uid() OR lub.can_review_task(p.task_id))
   AND EXISTS(SELECT 1 FROM jsonb_array_elements(p.submissions) s CROSS JOIN LATERAL jsonb_array_elements(s->'attachments') f WHERE f->>'assetId'=a.id::text))
 OR EXISTS(SELECT 1 FROM lub.tasks t WHERE t.image_asset_id=a.id AND (lub.can_manage_task(t.id) OR lub.owns_task_participation(t.id)
   OR (t.status_code='Open' AND t.deleted_at IS NULL AND lub.task_scope_member(t.organization_id,t.committee_id))))
 OR EXISTS(SELECT 1 FROM lub.organization_content c WHERE lub.has_org_permission(c.organization_id,CASE WHEN c.kind='Event' THEN 'EVENTS_MANAGE' ELSE 'ANNOUNCEMENTS_MANAGE' END)
   AND (c.primary_image_id=a.id OR EXISTS(SELECT 1 FROM jsonb_array_elements(c.attachments||c.public_photos) f WHERE f->>'assetId'=a.id::text)))));
$$;
DROP POLICY own_asset ON lub.assets;
CREATE POLICY asset_read ON lub.assets FOR SELECT TO authenticated USING(lub.can_read_asset(id));

CREATE FUNCTION lub.asset_is_referenced(target uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM lub.tasks WHERE image_asset_id=target)
 OR EXISTS(SELECT 1 FROM lub.organization_content c WHERE c.primary_image_id=target OR EXISTS(SELECT 1 FROM jsonb_array_elements(c.attachments||c.public_photos) f WHERE f->>'assetId'=target::text))
 OR EXISTS(SELECT 1 FROM lub.membership_cases c CROSS JOIN LATERAL jsonb_array_elements(c.attachments) f WHERE f->>'assetId'=target::text)
 OR EXISTS(SELECT 1 FROM lub.event_registrations r CROSS JOIN LATERAL jsonb_array_elements(r.attachments) f WHERE f->>'assetId'=target::text)
 OR EXISTS(SELECT 1 FROM lub.task_participants p CROSS JOIN LATERAL jsonb_array_elements(p.submissions) s CROSS JOIN LATERAL jsonb_array_elements(s->'attachments') f WHERE f->>'assetId'=target::text);
$$;
CREATE FUNCTION lub.can_delete_asset_object(key text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM lub.users WHERE id=auth.uid() AND status_code='Active')
 AND key ~ ('^'||auth.uid()::text||'/[0-9a-f-]{36}[.](pdf|png|jpg)$')
 AND NOT EXISTS(SELECT 1 FROM lub.assets a WHERE a.object_key=key AND (a.owner_user_id<>auth.uid() OR lub.asset_is_referenced(a.id)));
$$;
CREATE FUNCTION lub.guard_asset_delete() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF lub.asset_is_referenced(OLD.id) THEN RAISE EXCEPTION 'Referenced asset cannot be deleted' USING ERRCODE='23503'; END IF;
 RETURN OLD;
END; $$;
CREATE TRIGGER referenced_asset_delete BEFORE DELETE ON lub.assets FOR EACH ROW EXECUTE FUNCTION lub.guard_asset_delete();
CREATE FUNCTION lub.guard_nested_asset_references() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE refs jsonb; ref uuid; photo jsonb;
BEGIN
 IF TG_TABLE_NAME='task_participants' THEN
  SELECT coalesce(jsonb_agg(f),'[]') INTO refs FROM jsonb_array_elements(NEW.submissions) s CROSS JOIN LATERAL jsonb_array_elements(s->'attachments') f;
 ELSIF TG_TABLE_NAME='organization_content' THEN
  IF jsonb_array_length(NEW.public_photos)>4 THEN RAISE EXCEPTION 'Too many public photos'; END IF;
  FOR photo IN SELECT value FROM jsonb_array_elements(NEW.public_photos) LOOP
   IF (photo?'assetId')=(photo?'url') OR (photo?'url' AND (jsonb_typeof(photo->'url') IS DISTINCT FROM 'string' OR length(photo->>'url')>2048 OR photo->>'url'!~*'^https://[^/@[:space:]]+([/?#][^[:space:]]*)?$')) THEN RAISE EXCEPTION 'Invalid public photo'; END IF;
  END LOOP;
  refs:=NEW.attachments||coalesce((SELECT jsonb_agg(f) FROM jsonb_array_elements(NEW.public_photos) f WHERE f?'assetId'),'[]');
 ELSE refs:=NEW.attachments; END IF;
 FOR ref IN SELECT DISTINCT (f->>'assetId')::uuid FROM jsonb_array_elements(refs) f ORDER BY 1 LOOP
  IF ref IS NULL THEN RAISE EXCEPTION 'Asset reference required' USING ERRCODE='23503'; END IF;
  PERFORM 1 FROM lub.assets a WHERE a.id=ref FOR KEY SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Asset does not exist' USING ERRCODE='23503'; END IF;
 END LOOP;
 RETURN NEW;
END; $$;
CREATE TRIGGER case_asset_references BEFORE INSERT OR UPDATE OF attachments ON lub.membership_cases FOR EACH ROW EXECUTE FUNCTION lub.guard_nested_asset_references();
CREATE TRIGGER registration_asset_references BEFORE INSERT OR UPDATE OF attachments ON lub.event_registrations FOR EACH ROW EXECUTE FUNCTION lub.guard_nested_asset_references();
CREATE TRIGGER submission_asset_references BEFORE INSERT OR UPDATE OF submissions ON lub.task_participants FOR EACH ROW EXECUTE FUNCTION lub.guard_nested_asset_references();
CREATE TRIGGER content_asset_references BEFORE INSERT OR UPDATE OF attachments,public_photos ON lub.organization_content FOR EACH ROW EXECUTE FUNCTION lub.guard_nested_asset_references();

CREATE FUNCTION lub.guard_application_file_object_delete() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE asset uuid;
BEGIN
 IF OLD.bucket_id<>'lub-application-files' THEN RETURN OLD; END IF;
 SELECT a.id INTO asset FROM lub.assets a WHERE a.object_key=OLD.name FOR UPDATE;
 IF asset IS NOT NULL AND lub.asset_is_referenced(asset) THEN RAISE EXCEPTION 'Referenced file cannot be removed' USING ERRCODE='23503'; END IF;
 RETURN OLD;
END; $$;
CREATE TRIGGER application_file_delete_guard BEFORE DELETE ON storage.objects FOR EACH ROW EXECUTE FUNCTION lub.guard_application_file_object_delete();

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('lub-application-files','lub-application-files',false,5242880,ARRAY['application/pdf','image/jpeg','image/png'])
ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=5242880,allowed_mime_types=ARRAY['application/pdf','image/jpeg','image/png'];
-- Own unregistered objects remain readable/removable after a metadata-write failure.
CREATE POLICY asset_object_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='lub-application-files' AND
 ((name ~ ('^'||auth.uid()::text||'/[0-9a-f-]{36}[.](pdf|png|jpg)$') AND EXISTS(SELECT 1 FROM lub.users WHERE id=auth.uid() AND status_code='Active'))
 OR EXISTS(SELECT 1 FROM lub.assets a WHERE a.object_key=name AND lub.can_read_asset(a.id))));
CREATE POLICY asset_object_public_read ON storage.objects FOR SELECT TO anon USING(bucket_id='lub-application-files' AND lub.can_read_public_asset_object(name));
CREATE POLICY asset_object_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='lub-application-files'
 AND name ~ ('^'||auth.uid()::text||'/[0-9a-f-]{36}[.](pdf|png|jpg)$')
 AND EXISTS(SELECT 1 FROM lub.users WHERE id=auth.uid() AND status_code='Active'));
CREATE POLICY asset_object_delete ON storage.objects FOR DELETE TO authenticated USING(bucket_id='lub-application-files' AND lub.can_delete_asset_object(name));
GRANT USAGE ON SCHEMA storage TO anon,authenticated;
GRANT SELECT ON storage.objects TO anon;
GRANT SELECT,INSERT,DELETE ON storage.objects TO authenticated;

REVOKE ALL ON FUNCTION lub.register_application_asset(uuid,text,text,text,int),lub.set_asset_thumbnail(uuid,text),lub.set_asset_image_dimensions(uuid,int,int),
 lub.content_is_public(uuid),lub.can_read_public_asset_object(text),lub.can_read_asset(uuid),lub.asset_is_referenced(uuid),lub.can_delete_asset_object(text),lub.guard_asset_delete(),lub.guard_nested_asset_references(),lub.guard_application_file_object_delete() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION lub.register_application_asset(uuid,text,text,text,int),lub.set_asset_thumbnail(uuid,text),lub.set_asset_image_dimensions(uuid,int,int),lub.can_read_asset(uuid),lub.can_delete_asset_object(text) TO authenticated;
GRANT EXECUTE ON FUNCTION lub.can_read_public_asset_object(text) TO anon,authenticated;
