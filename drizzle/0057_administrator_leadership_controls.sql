CREATE FUNCTION lub.remove_primary_leader(target_org uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT lub.is_super_admin() THEN RAISE EXCEPTION 'Super Admin required' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM lub.organizations WHERE id=target_org FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Organization not found'; END IF;
 UPDATE lub.role_assignments SET end_date=greatest(current_date,start_date) WHERE organization_id=target_org AND is_primary_leader AND end_date IS NULL;
END;$$;
REVOKE ALL ON FUNCTION lub.remove_primary_leader(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION lub.remove_primary_leader(uuid) TO authenticated;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.end_super_admin(target_user uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(727026);
  IF NOT lub.is_super_admin() THEN RAISE EXCEPTION 'Super Admin required' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM lub.global_role_assignments r JOIN lub.users u ON u.id = r.user_id WHERE r.user_id <> target_user AND u.status_code = 'Active' AND r.start_at <= now() AND (r.end_at IS NULL OR r.end_at > now())) THEN
    RAISE EXCEPTION 'Last active Super Admin cannot be ended';
  END IF;
  IF target_user=auth.uid() THEN RAISE EXCEPTION 'Cannot end own Super Admin permission' USING ERRCODE='42501'; END IF;
  UPDATE lub.global_role_assignments SET end_at = now() WHERE user_id = target_user AND start_at <= now() AND (end_at IS NULL OR end_at > now());
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.admin_leader_candidates(search text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT lub.is_super_admin() THEN RAISE EXCEPTION 'Super Admin required' USING ERRCODE='42501';END IF;
 IF search IS NULL OR char_length(trim(search)) NOT BETWEEN 3 AND 254 THEN RETURN '[]'::jsonb;END IF;
 RETURN coalesce((SELECT jsonb_agg(x ORDER BY x.email) FROM(SELECT p.full_name_ar AS name,u.email,p.major_name AS major FROM lub.users u JOIN lub.student_profiles p ON p.user_id=u.id WHERE u.status_code='Active' AND u.email_verified_at IS NOT NULL AND lub.is_student_account(u.id) AND position(lower(trim(search)) in lower(u.email))>0 ORDER BY u.email LIMIT 8)x),'[]'::jsonb);
END;$$;
