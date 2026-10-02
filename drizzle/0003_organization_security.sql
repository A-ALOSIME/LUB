-- Custom SQL migration file, put your code below! --
-- Authorization helpers bypass recursive RLS, never arbitrary client roles.
-- Empty search_path and qualified objects follow PostgreSQL's SECURITY DEFINER guidance.
CREATE FUNCTION lub.is_super_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM lub.global_role_assignments r JOIN lub.users u ON u.id = r.user_id
    WHERE u.id = auth.uid() AND u.status_code = 'Active' AND r.role_code = 'SA'
      AND r.start_at <= now() AND (r.end_at IS NULL OR r.end_at > now())
  );
$$;
--> statement-breakpoint
CREATE FUNCTION lub.has_org_permission(target_org uuid, capability text, target_committee uuid DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT capability IN ('ORG_PROFILE_MANAGE','COMMITTEE_MANAGE','COMMITTEE_PROFILE_MANAGE','MEMBERS_VIEW')
    AND EXISTS (SELECT 1 FROM lub.organizations o WHERE o.id = target_org AND o.status_code = 'Active')
    AND (target_committee IS NULL OR EXISTS (SELECT 1 FROM lub.committees c WHERE c.id = target_committee AND c.organization_id = target_org AND c.status_code = 'Active'))
    AND EXISTS (
      SELECT 1 FROM lub.organization_memberships m JOIN lub.users u ON u.id = m.user_id
      WHERE m.organization_id = target_org AND u.id = auth.uid() AND u.status_code = 'Active'
        AND m.status_code = 'Active' AND m.start_date <= current_date AND (m.end_date IS NULL OR m.end_date > current_date)
        AND (
          EXISTS (SELECT 1 FROM lub.role_assignments r WHERE r.organization_membership_id = m.id
            AND r.start_date <= current_date AND (r.end_date IS NULL OR r.end_date > current_date)
            AND (r.role_code IN ('OL','OD') OR (r.role_code IN ('CL','CD') AND target_committee = r.committee_id AND capability IN ('COMMITTEE_PROFILE_MANAGE','MEMBERS_VIEW'))))
          OR EXISTS (SELECT 1 FROM lub.permission_grants g WHERE g.organization_membership_id = m.id
            AND g.permission_code = capability AND g.start_at <= now() AND (g.end_at IS NULL OR g.end_at > now())
            AND (g.committee_id IS NULL OR g.committee_id = target_committee))
        )
    );
$$;
--> statement-breakpoint
CREATE FUNCTION lub.public_leadership(target_org uuid) RETURNS TABLE(full_name text, role_code text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p.full_name_ar::text, r.role_code::text FROM lub.role_assignments r
  JOIN lub.organization_memberships m ON m.id = r.organization_membership_id
  JOIN lub.users u ON u.id = m.user_id JOIN lub.student_profiles p ON p.user_id = u.id
  JOIN lub.organizations o ON o.id = m.organization_id
  WHERE o.id = target_org AND (o.show_leadership_publicly OR lub.is_super_admin() OR lub.has_org_permission(target_org,'MEMBERS_VIEW'))
    AND u.status_code = 'Active' AND m.status_code = 'Active' AND m.start_date <= current_date
    AND (m.end_date IS NULL OR m.end_date > current_date) AND r.role_code IN ('OL','OD')
    AND r.start_date <= current_date AND (r.end_date IS NULL OR r.end_date > current_date)
  ORDER BY CASE WHEN r.role_code = 'OL' THEN 0 ELSE 1 END, p.full_name_ar;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION lub.is_super_admin(), lub.has_org_permission(uuid,text,uuid), lub.public_leadership(uuid) FROM PUBLIC;
GRANT USAGE ON SCHEMA lub TO anon;
GRANT EXECUTE ON FUNCTION lub.is_super_admin(), lub.has_org_permission(uuid,text,uuid), lub.public_leadership(uuid) TO anon, authenticated;
REVOKE ALL ON lub.organizations,lub.committees,lub.tags,lub.organization_tags,lub.organization_links,
  lub.organization_memberships,lub.role_assignments,lub.global_role_assignments,lub.permission_grants FROM PUBLIC,anon,authenticated;
GRANT SELECT ON lub.organizations,lub.committees,lub.tags,lub.organization_tags,lub.organization_links TO anon,authenticated;
GRANT SELECT ON lub.organization_memberships,lub.role_assignments,lub.global_role_assignments,lub.permission_grants TO authenticated;
GRANT INSERT ON lub.organizations,lub.committees,lub.tags,lub.organization_tags,lub.organization_links TO authenticated;
GRANT UPDATE (name_ar,summary,mission,show_leadership_publicly,updated_at) ON lub.organizations TO authenticated;
GRANT UPDATE (name,description,is_public,status_code,archived_at,updated_at) ON lub.committees TO authenticated;
GRANT DELETE ON lub.organization_tags,lub.organization_links TO authenticated;
--> statement-breakpoint
CREATE POLICY organizations_public_read ON lub.organizations FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY organizations_sa_create ON lub.organizations FOR INSERT TO authenticated WITH CHECK (lub.is_super_admin() AND status_code = 'Active' AND archived_at IS NULL);
CREATE POLICY organizations_profile_update ON lub.organizations FOR UPDATE TO authenticated
  USING (lub.has_org_permission(id,'ORG_PROFILE_MANAGE')) WITH CHECK (lub.has_org_permission(id,'ORG_PROFILE_MANAGE'));
CREATE POLICY committees_read ON lub.committees FOR SELECT TO anon,authenticated
  USING ((is_public AND status_code = 'Active') OR lub.has_org_permission(organization_id,'COMMITTEE_MANAGE') OR lub.has_org_permission(organization_id,'COMMITTEE_PROFILE_MANAGE',id));
CREATE POLICY committees_create ON lub.committees FOR INSERT TO authenticated WITH CHECK (lub.has_org_permission(organization_id,'COMMITTEE_MANAGE') AND status_code = 'Active');
CREATE POLICY committees_update ON lub.committees FOR UPDATE TO authenticated
  USING (lub.has_org_permission(organization_id,'COMMITTEE_MANAGE') OR lub.has_org_permission(organization_id,'COMMITTEE_PROFILE_MANAGE',id))
  WITH CHECK (lub.has_org_permission(organization_id,'COMMITTEE_MANAGE') OR lub.has_org_permission(organization_id,'COMMITTEE_PROFILE_MANAGE',id));
CREATE POLICY tags_public_read ON lub.tags FOR SELECT TO anon,authenticated USING (is_active);
CREATE POLICY tags_create ON lub.tags FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM lub.organizations o WHERE lub.has_org_permission(o.id,'ORG_PROFILE_MANAGE')) OR lub.is_super_admin());
CREATE POLICY org_tags_public_read ON lub.organization_tags FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY org_tags_insert ON lub.organization_tags FOR INSERT TO authenticated WITH CHECK (lub.has_org_permission(organization_id,'ORG_PROFILE_MANAGE'));
CREATE POLICY org_tags_delete ON lub.organization_tags FOR DELETE TO authenticated USING (lub.has_org_permission(organization_id,'ORG_PROFILE_MANAGE'));
CREATE POLICY org_links_public_read ON lub.organization_links FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY org_links_insert ON lub.organization_links FOR INSERT TO authenticated WITH CHECK (lub.has_org_permission(organization_id,'ORG_PROFILE_MANAGE'));
CREATE POLICY org_links_delete ON lub.organization_links FOR DELETE TO authenticated USING (lub.has_org_permission(organization_id,'ORG_PROFILE_MANAGE'));
CREATE POLICY membership_read ON lub.organization_memberships FOR SELECT TO authenticated USING ((user_id = auth.uid() AND EXISTS (SELECT 1 FROM lub.users u WHERE u.id = auth.uid() AND u.status_code = 'Active')) OR lub.has_org_permission(organization_id,'MEMBERS_VIEW'));
CREATE POLICY roles_read ON lub.role_assignments FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM lub.organization_memberships m WHERE m.id = organization_membership_id AND m.user_id = auth.uid()) OR lub.has_org_permission(organization_id,'MEMBERS_VIEW'));
CREATE POLICY grants_read ON lub.permission_grants FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM lub.organization_memberships m WHERE m.id = organization_membership_id AND m.user_id = auth.uid()) OR lub.has_org_permission(organization_id,'MEMBERS_VIEW'));
CREATE POLICY global_roles_read ON lub.global_role_assignments FOR SELECT TO authenticated USING (user_id = auth.uid());
--> statement-breakpoint
CREATE FUNCTION lub.guard_org_update() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF NEW.id <> OLD.id OR NEW.slug <> OLD.slug OR NEW.type_code <> OLD.type_code OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'Organization identity is immutable' USING ERRCODE = '42501';
  END IF;
  IF (NEW.status_code,NEW.archived_at) IS DISTINCT FROM (OLD.status_code,OLD.archived_at) AND NOT lub.is_super_admin() THEN
    RAISE EXCEPTION 'Lifecycle requires Super Admin' USING ERRCODE = '42501';
  END IF;
  IF (NEW.name_ar,NEW.summary,NEW.mission,NEW.show_leadership_publicly) IS DISTINCT FROM (OLD.name_ar,OLD.summary,OLD.mission,OLD.show_leadership_publicly)
    AND NOT lub.has_org_permission(OLD.id,'ORG_PROFILE_MANAGE') THEN
    RAISE EXCEPTION 'Profile permission required' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER organization_guard BEFORE UPDATE ON lub.organizations FOR EACH ROW EXECUTE FUNCTION lub.guard_org_update();
--> statement-breakpoint
CREATE FUNCTION lub.guard_committee_update() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.copied_from_committee_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM lub.committees c WHERE c.id = NEW.copied_from_committee_id AND c.organization_id = NEW.organization_id) THEN
      RAISE EXCEPTION 'Committee copy must stay inside its organization' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF (NEW.id,NEW.organization_id,NEW.copied_from_committee_id,NEW.created_at) IS DISTINCT FROM (OLD.id,OLD.organization_id,OLD.copied_from_committee_id,OLD.created_at) THEN
    RAISE EXCEPTION 'Committee identity is immutable' USING ERRCODE = '42501';
  END IF;
  IF (NEW.status_code,NEW.archived_at) IS DISTINCT FROM (OLD.status_code,OLD.archived_at) AND NOT lub.has_org_permission(OLD.organization_id,'COMMITTEE_MANAGE') THEN
    RAISE EXCEPTION 'Committee lifecycle permission required' USING ERRCODE = '42501';
  END IF;
  IF OLD.status_code = 'Archived' AND NEW.status_code = 'Archived' THEN
    RAISE EXCEPTION 'Restore archived committee before editing' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER committee_guard BEFORE INSERT OR UPDATE ON lub.committees FOR EACH ROW EXECUTE FUNCTION lub.guard_committee_update();
--> statement-breakpoint
CREATE FUNCTION lub.record_org_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE row_data jsonb; actor uuid; target uuid; org_id uuid;
BEGIN
  actor := auth.uid();
  IF actor IS NULL THEN RETURN NULL; END IF;
  row_data := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  org_id := CASE WHEN TG_TABLE_NAME = 'organizations' THEN (row_data->>'id')::uuid ELSE (row_data->>'organization_id')::uuid END;
  target := COALESCE((row_data->>'id')::uuid,org_id);
  INSERT INTO lub.audit_log(actor_user_id,action_code,entity_type,entity_id,organization_id,metadata)
    VALUES(actor,upper(TG_TABLE_NAME)||'_'||TG_OP,TG_TABLE_NAME,target,org_id,
      jsonb_build_object('archived',COALESCE(row_data->>'status_code' = 'Archived',false),'ended',(row_data->>'end_at' IS NOT NULL OR row_data->>'end_date' IS NOT NULL)));
  RETURN NULL;
END;
$$;
CREATE TRIGGER org_audit AFTER INSERT OR UPDATE ON lub.organizations FOR EACH ROW EXECUTE FUNCTION lub.record_org_change();
CREATE TRIGGER committee_audit AFTER INSERT OR UPDATE ON lub.committees FOR EACH ROW EXECUTE FUNCTION lub.record_org_change();
CREATE TRIGGER membership_audit AFTER INSERT OR UPDATE ON lub.organization_memberships FOR EACH ROW EXECUTE FUNCTION lub.record_org_change();
CREATE TRIGGER role_audit AFTER INSERT OR UPDATE ON lub.role_assignments FOR EACH ROW EXECUTE FUNCTION lub.record_org_change();
CREATE TRIGGER global_role_audit AFTER INSERT OR UPDATE ON lub.global_role_assignments FOR EACH ROW EXECUTE FUNCTION lub.record_org_change();
CREATE TRIGGER grant_audit AFTER INSERT OR UPDATE ON lub.permission_grants FOR EACH ROW EXECUTE FUNCTION lub.record_org_change();
CREATE TRIGGER links_audit AFTER INSERT OR DELETE ON lub.organization_links FOR EACH ROW EXECUTE FUNCTION lub.record_org_change();
CREATE TRIGGER tags_audit AFTER INSERT OR DELETE ON lub.organization_tags FOR EACH ROW EXECUTE FUNCTION lub.record_org_change();
--> statement-breakpoint
CREATE FUNCTION lub.set_organization_status(target_org uuid, target_status text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT lub.is_super_admin() THEN RAISE EXCEPTION 'Super Admin required' USING ERRCODE = '42501'; END IF;
  IF target_status NOT IN ('Active','Inactive','Archived') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  UPDATE lub.organizations SET status_code = target_status, archived_at = CASE WHEN target_status = 'Archived' THEN COALESCE(archived_at,now()) ELSE NULL END, updated_at = now() WHERE id = target_org;
  IF NOT FOUND THEN RAISE EXCEPTION 'Organization not found'; END IF;
END;
$$;
--> statement-breakpoint
CREATE FUNCTION lub.set_primary_leader(target_org uuid, candidate_email text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE candidate uuid; membership uuid; current_leader uuid;
BEGIN
  IF NOT lub.is_super_admin() THEN RAISE EXCEPTION 'Super Admin required' USING ERRCODE = '42501'; END IF;
  PERFORM 1 FROM lub.organizations WHERE id = target_org AND status_code = 'Active' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active organization required'; END IF;
  SELECT u.id INTO candidate FROM lub.users u JOIN lub.student_profiles p ON p.user_id = u.id
    WHERE u.email = lower(trim(candidate_email)) AND u.status_code = 'Active' AND u.email_verified_at IS NOT NULL;
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
CREATE FUNCTION lub.grant_super_admin(candidate_email text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE candidate uuid;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(727026);
  IF NOT lub.is_super_admin() THEN RAISE EXCEPTION 'Super Admin required' USING ERRCODE = '42501'; END IF;
  SELECT u.id INTO candidate FROM lub.users u JOIN lub.student_profiles p ON p.user_id = u.id
    WHERE u.email = lower(trim(candidate_email)) AND u.status_code = 'Active' AND u.email_verified_at IS NOT NULL;
  IF candidate IS NULL THEN RAISE EXCEPTION 'Verified onboarded candidate required'; END IF;
  IF EXISTS (SELECT 1 FROM lub.global_role_assignments WHERE user_id = candidate AND start_at <= now() AND (end_at IS NULL OR end_at > now())) THEN RETURN; END IF;
  INSERT INTO lub.global_role_assignments(user_id,role_code,assigned_by_user_id) VALUES(candidate,'SA',auth.uid());
END;
$$;
--> statement-breakpoint
CREATE FUNCTION lub.end_super_admin(target_user uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(727026);
  IF NOT lub.is_super_admin() THEN RAISE EXCEPTION 'Super Admin required' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM lub.global_role_assignments r JOIN lub.users u ON u.id = r.user_id WHERE r.user_id <> target_user AND u.status_code = 'Active' AND r.start_at <= now() AND (r.end_at IS NULL OR r.end_at > now())) THEN
    RAISE EXCEPTION 'Last active Super Admin cannot be ended';
  END IF;
  UPDATE lub.global_role_assignments SET end_at = now() WHERE user_id = target_user AND start_at <= now() AND (end_at IS NULL OR end_at > now());
END;
$$;
--> statement-breakpoint
CREATE FUNCTION lub.list_super_admins() RETURNS TABLE(user_id uuid,full_name text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT lub.is_super_admin() THEN RAISE EXCEPTION 'Super Admin required' USING ERRCODE = '42501'; END IF;
  RETURN QUERY SELECT u.id,p.full_name_ar::text FROM lub.global_role_assignments r JOIN lub.users u ON u.id = r.user_id JOIN lub.student_profiles p ON p.user_id = u.id
    WHERE u.status_code = 'Active' AND r.start_at <= now() AND (r.end_at IS NULL OR r.end_at > now()) ORDER BY p.full_name_ar;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION lub.guard_org_update(),lub.guard_committee_update(),lub.record_org_change(),
  lub.set_organization_status(uuid,text),lub.set_primary_leader(uuid,text),lub.grant_super_admin(text),lub.end_super_admin(uuid),lub.list_super_admins() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lub.set_organization_status(uuid,text),lub.set_primary_leader(uuid,text),lub.grant_super_admin(text),lub.end_super_admin(uuid),lub.list_super_admins() TO authenticated;
