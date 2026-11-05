-- Retain the existing verified-student scope; add normalized name lookup.
CREATE OR REPLACE FUNCTION lub.admin_leader_candidates(search text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE name_key text;
BEGIN
 IF NOT lub.is_super_admin() THEN RAISE EXCEPTION 'Super Admin required' USING ERRCODE='42501';END IF;
 IF search IS NULL OR char_length(trim(search)) NOT BETWEEN 3 AND 254 THEN RETURN '[]'::jsonb;END IF;
 name_key:=lub.arabic_search_key(trim(search));
 IF name_key='' THEN RETURN '[]'::jsonb;END IF;
 RETURN coalesce((SELECT jsonb_agg(x ORDER BY x.email) FROM (
 SELECT p.full_name_ar AS name,u.email,p.major_name AS major FROM lub.users u JOIN lub.student_profiles p ON p.user_id=u.id
 WHERE u.status_code='Active' AND u.email_verified_at IS NOT NULL AND lub.is_student_account(u.id)
 AND (position(lower(trim(search)) in lower(u.email))>0 OR position(name_key in lub.arabic_search_key(p.full_name_ar))>0)
 ORDER BY u.email LIMIT 8) x),'[]'::jsonb);
END;$$;
