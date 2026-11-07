-- Organization editor operations on inline public content and the retained committee tree.
CREATE FUNCTION lub.can_edit_organization_profile(target uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM lub.organizations WHERE id=target)
  AND (lub.is_super_admin() OR lub.has_org_permission(target,'ORG_PROFILE_MANAGE'));
$$;

CREATE FUNCTION lub.save_organization_profile(target uuid,profile jsonb,interest_list jsonb,contact_list jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM 1 FROM lub.organizations WHERE id=target FOR UPDATE;
 IF NOT FOUND OR NOT lub.can_edit_organization_profile(target) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(profile) IS DISTINCT FROM 'object' OR octet_length(profile::text)>50000
  OR jsonb_typeof(interest_list) IS DISTINCT FROM 'array' OR jsonb_typeof(contact_list) IS DISTINCT FROM 'array' THEN
  RAISE EXCEPTION 'Invalid organization profile';
 END IF;
 IF jsonb_array_length(interest_list)>10 OR jsonb_array_length(contact_list)>12
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(interest_list) e WHERE jsonb_typeof(e)<>'string' OR length(trim(e#>>'{}')) NOT BETWEEN 1 AND 40)
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(contact_list) e WHERE
    jsonb_typeof(e->'value') IS DISTINCT FROM 'string' OR length(e->>'value') NOT BETWEEN 1 AND 2048
    OR (e->>'value')~'[[:space:][:cntrl:]]'
    OR NOT coalesce(CASE e->>'kind'
      WHEN 'Email' THEN (e->>'value')~'^[^@]+@[^@]+[.][^@]+$'
      WHEN 'Phone' THEN (e->>'value')~'^[+]?[0-9]{7,15}$'
      ELSE e->>'kind' IN ('Behance','Website','LinkedIn','GitHub','Instagram','X','YouTube','TikTok','WhatsApp','Telegram')
       AND (e->>'value')~'^https://[^/@?#]+([/?#]|$)' END,false))
 THEN RAISE EXCEPTION 'Invalid organization interests or links'; END IF;
 UPDATE lub.organizations SET name_ar=trim(profile->>'nameAr'),summary=profile->>'summary',mission=profile->>'mission',
  show_leadership_publicly=(profile->>'showLeadershipPublicly')::boolean,public_profile_content=profile->'publicProfileContent',
  interests=interest_list,links_customized=true,links=coalesce((SELECT jsonb_agg(
   jsonb_build_object('id',gen_random_uuid(),'kind',e->>'kind','value',e->>'value') ORDER BY ordinal)
   FROM jsonb_array_elements(contact_list) WITH ORDINALITY AS links(e,ordinal)),'[]'),updated_at=now() WHERE id=target;
END; $$;

CREATE FUNCTION lub.organization_committee_editor(org uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'description',c.description,'isPublic',c.is_public,
  'statusCode',c.status_code,'parentCommitteeId',c.parent_committee_id,'copiedFromCommitteeId',c.copied_from_committee_id,
  'canEdit',true,'memberCount',members.total,'leaderName',leader.name) ORDER BY c.name,c.id),'[]')
 FROM lub.committees c
 CROSS JOIN LATERAL (SELECT lub.has_org_permission(org,'MEMBERS_VIEW',c.id) AS can_view) allowed
 LEFT JOIN LATERAL (
  SELECT count(*)::int total FROM lub.committee_memberships cm JOIN lub.organization_memberships m ON m.id=cm.organization_membership_id
  WHERE cm.committee_id=c.id AND cm.status_code='Active' AND cm.start_date<=lub.today_riyadh()
   AND (cm.end_date IS NULL OR cm.end_date>lub.today_riyadh()) AND m.status_code='Active'
   AND m.start_date<=lub.today_riyadh() AND (m.end_date IS NULL OR m.end_date>lub.today_riyadh()) AND lub.is_student_account(m.user_id)
 ) members ON allowed.can_view
 LEFT JOIN LATERAL (
  SELECT u.full_name_ar AS name FROM lub.access_assignments a JOIN lub.users u ON u.id=a.user_id
  JOIN lub.organization_memberships m ON m.id=a.organization_membership_id
  WHERE a.committee_id=c.id AND a.role_code='CL' AND a.start_at<=statement_timestamp() AND (a.end_at IS NULL OR a.end_at>statement_timestamp())
   AND m.status_code='Active' AND m.start_date<=lub.today_riyadh() AND (m.end_date IS NULL OR m.end_date>lub.today_riyadh())
   AND lub.is_student_account(a.user_id) ORDER BY a.start_at DESC,a.id LIMIT 1
 ) leader ON allowed.can_view
 WHERE c.organization_id=org AND (lub.has_org_permission(org,'COMMITTEE_MANAGE') OR lub.has_org_permission(org,'COMMITTEE_PROFILE_MANAGE',c.id));
$$;

CREATE FUNCTION lub.save_committee(org uuid,target uuid,label text,details text,visible boolean,parent uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result uuid;
BEGIN
 PERFORM 1 FROM lub.organizations WHERE id=org FOR UPDATE;
 IF NOT FOUND OR NOT lub.has_org_permission(org,'COMMITTEE_MANAGE') THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
 IF label IS NULL OR details IS NULL OR visible IS NULL THEN RAISE EXCEPTION 'Invalid committee'; END IF;
 IF parent IS NOT NULL AND (parent=target
  OR NOT EXISTS(SELECT 1 FROM lub.committees WHERE id=parent AND organization_id=org AND status_code='Active' AND parent_committee_id IS NULL)
  OR EXISTS(SELECT 1 FROM lub.committees WHERE parent_committee_id=target)) THEN
  RAISE EXCEPTION 'Only one subcommittee level is supported' USING ERRCODE='23514';
 END IF;
 IF target IS NULL THEN
  INSERT INTO lub.committees(organization_id,name,description,is_public,parent_committee_id)
  VALUES(org,trim(label),trim(details),visible,parent) RETURNING id INTO result;
 ELSE
  UPDATE lub.committees SET name=trim(label),description=trim(details),is_public=visible,parent_committee_id=parent,updated_at=now()
   WHERE id=target AND organization_id=org AND status_code='Active' RETURNING id INTO result;
  IF result IS NULL THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
 END IF;
 RETURN result;
END; $$;

CREATE FUNCTION lub.copy_committee(org uuid,target uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE source lub.committees; result uuid;
BEGIN
 PERFORM 1 FROM lub.organizations WHERE id=org FOR UPDATE;
 IF NOT FOUND OR NOT lub.has_org_permission(org,'COMMITTEE_MANAGE') THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
 SELECT * INTO source FROM lub.committees WHERE id=target AND organization_id=org;
 IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
 INSERT INTO lub.committees(organization_id,copied_from_committee_id,parent_committee_id,name,name_en,description,description_en,is_public)
 VALUES(org,source.id,source.parent_committee_id,left(source.name,110)||' (نسخة)',
  CASE WHEN nullif(source.name_en,'') IS NOT NULL THEN left(source.name_en,110)||' (Copy)' END,source.description,source.description_en,source.is_public)
 RETURNING id INTO result;
 RETURN result;
END; $$;

CREATE FUNCTION lub.set_committee_status(org uuid,target uuid,next_state text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM 1 FROM lub.organizations WHERE id=org FOR UPDATE;
 IF NOT FOUND OR NOT lub.has_org_permission(org,'COMMITTEE_MANAGE') THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
 IF next_state IS NULL OR next_state NOT IN ('Active','Archived') THEN RAISE EXCEPTION 'Invalid committee status'; END IF;
 UPDATE lub.committees SET status_code=next_state,archived_at=CASE WHEN next_state='Archived' THEN coalesce(archived_at,now()) END,updated_at=now()
 WHERE id=target AND organization_id=org;
 IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
END; $$;

CREATE FUNCTION lub.can_edit_organization_logo(object_name text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT CASE WHEN object_name~'^organizations/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](png|svg)$'
  THEN lub.can_edit_organization_profile(split_part(object_name,'/',2)::uuid) ELSE false END;
$$;

CREATE FUNCTION lub.save_organization_logo(target uuid,new_url text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE previous jsonb; object_name text;
BEGIN
 SELECT jsonb_build_object('slug',slug,'previousLogoUrl',logo_url) INTO previous FROM lub.organizations WHERE id=target FOR UPDATE;
 IF NOT FOUND OR NOT lub.can_edit_organization_profile(target) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
 IF new_url IS NULL OR length(new_url)>2048 THEN RAISE EXCEPTION 'Invalid organization logo'; END IF;
 IF new_url<>'' THEN
  object_name:=split_part(new_url,'/storage/v1/object/public/lub-organization-logos/',2);
  IF new_url!~'^https?://[^/@[:space:]]+/' OR NOT lub.can_edit_organization_logo(object_name)
   OR split_part(object_name,'/',2)<>target::text
   OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='lub-organization-logos' AND name=object_name)
  THEN RAISE EXCEPTION 'Invalid organization logo'; END IF;
 END IF;
 UPDATE lub.organizations SET logo_url=new_url,updated_at=now() WHERE id=target;
 RETURN previous;
END; $$;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('lub-organization-logos','lub-organization-logos',true,2097152,ARRAY['image/png','image/svg+xml'])
ON CONFLICT(id) DO UPDATE SET public=true,file_size_limit=EXCLUDED.file_size_limit,allowed_mime_types=EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS organization_logos_manager_upload ON storage.objects;
DROP POLICY IF EXISTS organization_logos_manager_delete ON storage.objects;
DROP POLICY IF EXISTS organization_logos_manager_select ON storage.objects;
CREATE POLICY organization_logos_manager_upload ON storage.objects FOR INSERT TO authenticated
 WITH CHECK(bucket_id='lub-organization-logos' AND lub.can_edit_organization_logo(name));
CREATE POLICY organization_logos_manager_delete ON storage.objects FOR DELETE TO authenticated
 USING(bucket_id='lub-organization-logos' AND lub.can_edit_organization_logo(name));
CREATE POLICY organization_logos_manager_select ON storage.objects FOR SELECT TO authenticated
 USING(bucket_id='lub-organization-logos' AND lub.can_edit_organization_logo(name));

REVOKE ALL ON FUNCTION lub.can_edit_organization_profile(uuid),lub.save_organization_profile(uuid,jsonb,jsonb,jsonb),lub.organization_committee_editor(uuid),
 lub.save_committee(uuid,uuid,text,text,boolean,uuid),lub.copy_committee(uuid,uuid),lub.set_committee_status(uuid,uuid,text),
 lub.can_edit_organization_logo(text),lub.save_organization_logo(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION lub.can_edit_organization_profile(uuid),lub.save_organization_profile(uuid,jsonb,jsonb,jsonb),lub.organization_committee_editor(uuid),
 lub.save_committee(uuid,uuid,text,text,boolean,uuid),lub.copy_committee(uuid,uuid),lub.set_committee_status(uuid,uuid,text),
 lub.can_edit_organization_logo(text),lub.save_organization_logo(uuid,text) TO authenticated;
