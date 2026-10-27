CREATE FUNCTION lub.can_edit_organization_profile(target uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM lub.organizations WHERE id=target) AND (lub.is_super_admin() OR lub.has_org_permission(target,'ORG_PROFILE_MANAGE'));
$$;
REVOKE ALL ON FUNCTION lub.can_edit_organization_profile(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION lub.can_edit_organization_profile(uuid) TO authenticated;
ALTER POLICY organizations_profile_update ON lub.organizations USING(lub.can_edit_organization_profile(id)) WITH CHECK(lub.can_edit_organization_profile(id));
ALTER POLICY org_tags_insert ON lub.organization_tags WITH CHECK(lub.can_edit_organization_profile(organization_id));
ALTER POLICY org_tags_delete ON lub.organization_tags USING(lub.can_edit_organization_profile(organization_id));
ALTER POLICY org_links_insert ON lub.organization_links WITH CHECK(lub.can_edit_organization_profile(organization_id));
ALTER POLICY org_links_delete ON lub.organization_links USING(lub.can_edit_organization_profile(organization_id));
GRANT UPDATE(slug,type_code) ON lub.organizations TO authenticated;
--> statement-breakpoint
CREATE FUNCTION lub.admin_update_organization_identity(target uuid,new_slug text,kind text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT lub.is_super_admin() THEN RAISE EXCEPTION 'Super Admin required' USING ERRCODE='42501';END IF;
 IF new_slug IS NULL OR char_length(new_slug) NOT BETWEEN 1 AND 80 OR new_slug!~'^[a-z0-9]+(-[a-z0-9]+)*$' OR kind IS NULL OR kind NOT IN ('Club','Council') THEN RAISE EXCEPTION 'Invalid organization identity';END IF;
 UPDATE lub.organizations SET slug=new_slug,type_code=kind,updated_at=now() WHERE id=target;
 IF NOT FOUND THEN RAISE EXCEPTION 'Organization not found';END IF;
END;$$;
--> statement-breakpoint
CREATE FUNCTION lub.admin_organization_identity(target uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT lub.is_super_admin() THEN RAISE EXCEPTION 'Super Admin required' USING ERRCODE='42501';END IF;
 RETURN (SELECT jsonb_build_object('slug',o.slug,'typeCode',o.type_code,'statusCode',o.status_code,'leaderName',(SELECT p.full_name_ar FROM lub.role_assignments r JOIN lub.organization_memberships m ON m.id=r.organization_membership_id JOIN lub.users u ON u.id=m.user_id JOIN lub.student_profiles p ON p.user_id=u.id WHERE r.organization_id=o.id AND r.is_primary_leader AND r.start_date<=current_date AND (r.end_date IS NULL OR r.end_date>current_date) AND m.status_code='Active' AND m.start_date<=current_date AND (m.end_date IS NULL OR m.end_date>current_date) AND u.status_code='Active' AND lub.is_student_account(u.id) ORDER BY r.start_date DESC,r.id LIMIT 1)) FROM lub.organizations o WHERE o.id=target);
END;$$;
--> statement-breakpoint
CREATE FUNCTION lub.admin_organization_directory(search text,kind text,state text,skip int DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT lub.is_super_admin() THEN RAISE EXCEPTION 'Super Admin required' USING ERRCODE='42501';END IF;
 IF search IS NULL OR char_length(search)>120 OR kind IS NULL OR kind NOT IN ('','Club','Council') OR state IS NULL OR state NOT IN ('','Active','Inactive','Archived') THEN RAISE EXCEPTION 'Invalid filters';END IF;
 RETURN jsonb_build_object('total',(SELECT count(*)::int FROM lub.organizations o WHERE (kind='' OR o.type_code=kind) AND (state='' OR o.status_code=state) AND (search='' OR position(lub.arabic_search_key(search) in lub.arabic_search_key(o.name_ar||' '||o.slug))>0)),
 'organizations',coalesce((SELECT jsonb_agg(x ORDER BY x."nameAr",x.id) FROM (
  SELECT o.id,o.slug,o.name_ar AS "nameAr",o.type_code AS "typeCode",o.status_code AS "statusCode",o.logo_url AS "logoUrl",leader.name AS "leaderName",
   (SELECT count(*)::int FROM lub.organization_memberships m JOIN lub.users u ON u.id=m.user_id WHERE m.organization_id=o.id AND m.status_code='Active' AND m.start_date<=current_date AND (m.end_date IS NULL OR m.end_date>current_date) AND u.status_code='Active' AND lub.is_student_account(u.id)) AS "memberCount"
  FROM lub.organizations o LEFT JOIN LATERAL (SELECT p.full_name_ar AS name FROM lub.role_assignments r JOIN lub.organization_memberships m ON m.id=r.organization_membership_id JOIN lub.users u ON u.id=m.user_id JOIN lub.student_profiles p ON p.user_id=u.id WHERE r.organization_id=o.id AND r.is_primary_leader AND r.start_date<=current_date AND (r.end_date IS NULL OR r.end_date>current_date) AND m.status_code='Active' AND m.start_date<=current_date AND (m.end_date IS NULL OR m.end_date>current_date) AND u.status_code='Active' AND lub.is_student_account(u.id) ORDER BY r.start_date DESC,r.id LIMIT 1) leader ON true
  WHERE (kind='' OR o.type_code=kind) AND (state='' OR o.status_code=state) AND (search='' OR position(lub.arabic_search_key(search) in lub.arabic_search_key(o.name_ar||' '||o.slug))>0)
  ORDER BY o.name_ar,o.id LIMIT 25 OFFSET greatest(0,least(skip,250000))
 ) x),'[]'::jsonb));
END;$$;
--> statement-breakpoint
CREATE FUNCTION lub.admin_leader_candidates(search text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT lub.is_super_admin() THEN RAISE EXCEPTION 'Super Admin required' USING ERRCODE='42501';END IF;
 IF search IS NULL OR char_length(trim(search)) NOT BETWEEN 3 AND 254 THEN RETURN '[]'::jsonb;END IF;
 RETURN coalesce((SELECT jsonb_agg(x ORDER BY x.email) FROM(SELECT p.full_name_ar AS name,u.email FROM lub.users u JOIN lub.student_profiles p ON p.user_id=u.id WHERE u.status_code='Active' AND u.email_verified_at IS NOT NULL AND lub.is_student_account(u.id) AND position(lower(trim(search)) in lower(u.email))>0 ORDER BY u.email LIMIT 8)x),'[]'::jsonb);
END;$$;
--> statement-breakpoint
CREATE FUNCTION lub.admin_organization_slug_available(candidate text,except_org uuid DEFAULT NULL) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT lub.is_super_admin() THEN RAISE EXCEPTION 'Super Admin required' USING ERRCODE='42501';END IF;
 RETURN candidate IS NOT NULL AND char_length(candidate) BETWEEN 1 AND 80 AND candidate~'^[a-z0-9]+(-[a-z0-9]+)*$' AND NOT EXISTS(SELECT 1 FROM lub.organizations WHERE slug=candidate AND (except_org IS NULL OR id<>except_org));
END;$$;
REVOKE ALL ON FUNCTION lub.admin_update_organization_identity(uuid,text,text),lub.admin_organization_identity(uuid),lub.admin_organization_directory(text,text,text,int),lub.admin_leader_candidates(text),lub.admin_organization_slug_available(text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION lub.admin_update_organization_identity(uuid,text,text),lub.admin_organization_identity(uuid),lub.admin_organization_directory(text,text,text,int),lub.admin_leader_candidates(text),lub.admin_organization_slug_available(text,uuid) TO authenticated;

--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.guard_org_update() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF (NEW.id,NEW.created_at) IS DISTINCT FROM (OLD.id,OLD.created_at) THEN
    RAISE EXCEPTION 'Organization identity is immutable' USING ERRCODE = '42501';
  END IF;
  IF (NEW.slug,NEW.type_code) IS DISTINCT FROM (OLD.slug,OLD.type_code) AND NOT lub.is_super_admin() THEN RAISE EXCEPTION 'Identity requires Super Admin' USING ERRCODE='42501';END IF;
  IF (NEW.status_code,NEW.archived_at) IS DISTINCT FROM (OLD.status_code,OLD.archived_at) AND NOT lub.is_super_admin() THEN
    RAISE EXCEPTION 'Lifecycle requires Super Admin' USING ERRCODE = '42501';
  END IF;
  IF (NEW.name_ar,NEW.summary,NEW.mission,NEW.logo_url,NEW.show_leadership_publicly,NEW.links_customized,NEW.public_profile_content) IS DISTINCT FROM (OLD.name_ar,OLD.summary,OLD.mission,OLD.logo_url,OLD.show_leadership_publicly,OLD.links_customized,OLD.public_profile_content)
    AND NOT lub.can_edit_organization_profile(OLD.id) THEN
    RAISE EXCEPTION 'Profile permission required' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

--> statement-breakpoint
DROP POLICY organization_logos_manager_upload ON storage.objects;
CREATE POLICY organization_logos_manager_upload ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'lub-organization-logos'
  AND CASE WHEN name ~* '^organizations/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(png|svg)$'
    THEN lub.can_edit_organization_profile(split_part(name, '/', 2)::uuid)
    ELSE false END
);

--> statement-breakpoint
DROP POLICY organization_logos_manager_delete ON storage.objects;
CREATE POLICY organization_logos_manager_delete ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'lub-organization-logos'
  AND CASE WHEN name ~* '^organizations/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(png|svg)$'
    THEN lub.can_edit_organization_profile(split_part(name, '/', 2)::uuid)
    ELSE false END
);

--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.set_primary_leader(target_org uuid, candidate_email text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE candidate uuid; membership uuid; current_leader uuid;
BEGIN
  IF NOT lub.is_super_admin() THEN RAISE EXCEPTION 'Super Admin required' USING ERRCODE = '42501'; END IF;
  PERFORM 1 FROM lub.organizations WHERE id=target_org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Organization required'; END IF;
  SELECT u.id INTO candidate FROM lub.users u JOIN lub.student_profiles p ON p.user_id = u.id
    WHERE lub.is_student_account(u.id) AND u.email = lower(trim(candidate_email)) AND u.status_code = 'Active' AND u.email_verified_at IS NOT NULL;
  IF candidate IS NULL THEN RAISE EXCEPTION 'Verified onboarded candidate required'; END IF;
  SELECT m.user_id INTO current_leader FROM lub.role_assignments r JOIN lub.organization_memberships m ON m.id = r.organization_membership_id
    WHERE r.organization_id = target_org AND r.is_primary_leader AND r.end_date IS NULL;
  IF current_leader = candidate THEN RETURN; END IF;
  SELECT id INTO membership FROM lub.organization_memberships WHERE organization_id = target_org AND user_id = candidate AND status_code = 'Active' AND end_date IS NULL;
  IF membership IS NULL THEN
    INSERT INTO lub.organization_memberships(organization_id,user_id) VALUES(target_org,candidate) RETURNING id INTO membership;
  ELSE
    IF EXISTS (SELECT 1 FROM lub.organization_memberships WHERE id = membership AND start_date > current_date) THEN RAISE EXCEPTION 'Membership not started'; END IF;
  END IF;
  UPDATE lub.role_assignments SET end_date = current_date WHERE organization_id = target_org AND is_primary_leader AND end_date IS NULL;
  INSERT INTO lub.role_assignments(organization_membership_id,organization_id,role_code,is_primary_leader,assigned_by_user_id)
    VALUES(membership,target_org,'OL',true,auth.uid());
END;
$$;

--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.organization_request_logo(target uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT r.logo_webp_base64 FROM lub.organization_opening_requests r WHERE r.id=target AND ((r.status_code='Accepted' AND EXISTS(SELECT 1 FROM lub.organizations o WHERE o.id=r.organization_id AND o.status_code='Active' AND o.logo_url='https://lub.community/organization-requests/'||r.id||'/logo')) OR (EXISTS(SELECT 1 FROM lub.users WHERE id=auth.uid() AND status_code='Active') AND (r.applicant_user_id=auth.uid() OR lub.is_super_admin())));
$$;
