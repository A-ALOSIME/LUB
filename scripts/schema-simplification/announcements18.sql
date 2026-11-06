-- Events and announcements share content storage but retain their own capabilities and DTOs.
CREATE OR REPLACE FUNCTION lub.content_is_public(target uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM lub.organization_content c JOIN lub.organizations o ON o.id=c.organization_id
 WHERE c.id=target AND o.status_code='Active' AND c.published_at<=statement_timestamp() AND c.archived_at IS NULL AND c.deleted_at IS NULL
 AND (c.status_code IN ('Published','Completed') OR (c.kind='Event' AND c.status_code='Archived')));
$$;
DROP POLICY content_read ON lub.organization_content;
CREATE POLICY content_read ON lub.organization_content FOR SELECT TO authenticated USING(lub.content_is_public(id) OR lub.is_super_admin()
 OR lub.has_org_permission(organization_id,CASE WHEN kind='Event' THEN 'EVENTS_MANAGE' ELSE 'ANNOUNCEMENTS_MANAGE' END));
CREATE FUNCTION lub.save_announcement(target uuid,org uuid,heading text,content text,link text,published boolean,pinned boolean,asset uuid,replace_image boolean) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE original lub.organization_content;
BEGIN
 PERFORM 1 FROM lub.organizations WHERE id=org FOR UPDATE;
 IF NOT lub.has_org_permission(org,'ANNOUNCEMENTS_MANAGE') THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 IF heading IS NULL OR length(trim(heading)) NOT BETWEEN 2 AND 120 OR content IS NULL OR length(trim(content)) NOT BETWEEN 1 AND 5000
  OR published IS NULL OR pinned IS NULL OR replace_image IS NULL OR (pinned AND NOT published)
  OR (nullif(trim(link),'') IS NOT NULL AND (length(link)>2000 OR trim(link)!~*'^https?://[^/@[:space:]]+([/?#][^[:space:]]*)?$')) THEN RAISE EXCEPTION 'Invalid announcement'; END IF;
 IF target IS NOT NULL THEN
  SELECT * INTO original FROM lub.organization_content WHERE id=target AND organization_id=org AND kind='Announcement' AND deleted_at IS NULL AND archived_at IS NULL FOR UPDATE;
  IF original.id IS NULL THEN RAISE EXCEPTION 'Announcement unavailable'; END IF;
 END IF;
 IF replace_image AND asset IS NOT NULL THEN
  PERFORM 1 FROM lub.assets a WHERE a.id=asset AND a.mime_type IN ('image/jpeg','image/png') AND a.size_bytes<=5242880
   AND (a.owner_user_id=auth.uid() OR asset=original.primary_image_id) FOR KEY SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Own image required' USING ERRCODE='42501'; END IF;
 END IF;
 IF pinned THEN UPDATE lub.organization_content SET pinned_at=NULL WHERE organization_id=org AND kind='Announcement' AND pinned_at IS NOT NULL; END IF;
 IF target IS NULL THEN
  INSERT INTO lub.organization_content(organization_id,created_by_user_id,kind,title,body,external_url,primary_image_id,status_code,published_at,pinned_at)
  VALUES(org,auth.uid(),'Announcement',trim(heading),trim(content),nullif(trim(link),''),CASE WHEN replace_image THEN asset END,CASE WHEN published THEN 'Published' ELSE 'Draft' END,CASE WHEN published THEN now() END,CASE WHEN pinned THEN now() END) RETURNING id INTO target;
 ELSE
  UPDATE lub.organization_content SET title=trim(heading),body=trim(content),external_url=nullif(trim(link),''),
   primary_image_id=CASE WHEN replace_image THEN asset ELSE original.primary_image_id END,status_code=CASE WHEN published THEN 'Published' ELSE 'Draft' END,
   published_at=CASE WHEN published THEN coalesce(original.published_at,now()) END,pinned_at=CASE WHEN pinned THEN now() END,revision=revision+1,updated_at=now() WHERE id=target;
 END IF;
 RETURN target;
END; $$;
CREATE FUNCTION lub.change_announcement_state(target uuid,operation text,pinned boolean DEFAULT false) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE org uuid; original lub.organization_content;
BEGIN
 SELECT organization_id INTO org FROM lub.organization_content WHERE id=target AND kind='Announcement';
 PERFORM 1 FROM lub.organizations WHERE id=org FOR UPDATE;
 IF NOT lub.has_org_permission(org,'ANNOUNCEMENTS_MANAGE') THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 SELECT * INTO original FROM lub.organization_content WHERE id=target AND kind='Announcement' AND deleted_at IS NULL FOR UPDATE;
 IF original.id IS NULL OR operation IS NULL OR operation NOT IN ('pin','archive','restore','delete') OR pinned IS NULL THEN RAISE EXCEPTION 'Announcement unavailable'; END IF;
 IF operation='delete' AND (original.published_at IS NOT NULL OR original.archived_at IS NOT NULL) THEN RAISE EXCEPTION 'Only drafts can be deleted'; END IF;
 IF operation='restore' THEN
  IF original.archived_at IS NULL THEN RAISE EXCEPTION 'Archived announcement required'; END IF;
  UPDATE lub.organization_content SET status_code=coalesce(archived_from_status,'Draft'),archived_at=NULL,archived_from_status=NULL,revision=revision+1,updated_at=now() WHERE id=target;
 ELSIF operation='pin' THEN
  IF original.status_code<>'Published' OR original.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Published announcement required'; END IF;
  IF pinned THEN UPDATE lub.organization_content SET pinned_at=NULL WHERE organization_id=org AND kind='Announcement' AND pinned_at IS NOT NULL; END IF;
  UPDATE lub.organization_content SET pinned_at=CASE WHEN pinned THEN now() END,revision=revision+1,updated_at=now() WHERE id=target;
 ELSE
  UPDATE lub.organization_content SET archived_from_status=CASE WHEN archived_at IS NULL THEN status_code ELSE archived_from_status END,
   status_code='Archived',pinned_at=NULL,archived_at=coalesce(archived_at,now()),deleted_at=CASE WHEN operation='delete' THEN now() END,revision=revision+1,updated_at=now() WHERE id=target;
 END IF;
END; $$;
CREATE FUNCTION lub.public_organization_announcements(org uuid,locale text DEFAULT 'ar') RETURNS TABLE(id uuid,title text,body text,pinned boolean,published_at timestamptz,external_url text,has_image boolean) LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT c.id,CASE WHEN locale='en' THEN coalesce(nullif(c.title_en,''),c.title) ELSE c.title END::text,
  CASE WHEN locale='en' THEN coalesce(nullif(c.body_en,''),c.body) ELSE c.body END::text,c.pinned_at IS NOT NULL,c.published_at,c.external_url::text,c.primary_image_id IS NOT NULL
 FROM lub.organization_content c WHERE c.organization_id=org AND c.kind='Announcement' AND lub.content_is_public(c.id)
 ORDER BY (c.pinned_at IS NOT NULL) DESC,c.published_at DESC,c.id LIMIT 200;
$$;
CREATE FUNCTION lub.public_announcement_image(target uuid) RETURNS TABLE(object_key text,mime_type text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT a.object_key,a.mime_type::text FROM lub.organization_content c JOIN lub.assets a ON a.id=c.primary_image_id
 WHERE c.id=target AND c.kind='Announcement' AND lub.content_is_public(c.id) AND a.mime_type IN ('image/png','image/jpeg');
$$;
CREATE INDEX content_org_kind_status ON lub.organization_content(organization_id,kind,status_code,created_at DESC,id);
REVOKE ALL ON FUNCTION lub.save_announcement(uuid,uuid,text,text,text,boolean,boolean,uuid,boolean),lub.change_announcement_state(uuid,text,boolean),lub.public_organization_announcements(uuid,text),lub.public_announcement_image(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION lub.save_announcement(uuid,uuid,text,text,text,boolean,boolean,uuid,boolean),lub.change_announcement_state(uuid,text,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION lub.public_organization_announcements(uuid,text),lub.public_announcement_image(uuid) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION lub.content_is_public(uuid) TO authenticated;
