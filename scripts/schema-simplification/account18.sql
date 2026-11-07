-- Account writes keep the existing verified-server-only boundary; no client-supplied identity is trusted.
CREATE FUNCTION lub.canonical_student_major(value text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT CASE lub.arabic_search_key(regexp_replace(btrim(value),'[[:space:]]+',' ','g'))
  WHEN 'نظم معلومات' THEN 'نظم معلومات' WHEN 'نظم المعلومات' THEN 'نظم معلومات'
  WHEN 'تقنيه معلومات' THEN 'تقنية معلومات' WHEN 'تقنيه المعلومات' THEN 'تقنية معلومات'
  WHEN 'علوم حاسب' THEN 'علوم حاسب' WHEN 'علوم الحاسب' THEN 'علوم حاسب' ELSE NULL END;
$$;
CREATE FUNCTION lub.is_active_account(owner_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM lub.users u WHERE u.id=owner_id AND u.status_code='Active' AND u.onboarded_at IS NOT NULL);
$$;
CREATE FUNCTION lub.save_student_account(owner_id uuid,verified_email text,verified timestamptz,full_name text,major text,level text,phone_value text,university_cipher text,university_hash text,national_cipher text,national_hash text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE previous lub.users; existing boolean;
BEGIN
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(owner_id::text,1));
 SELECT * INTO previous FROM lub.users u WHERE u.id=owner_id FOR UPDATE;
 existing:=FOUND AND previous.onboarded_at IS NOT NULL;
 IF FOUND AND previous.status_code<>'Active' THEN RAISE EXCEPTION 'Account inactive'; END IF;
 IF lub.is_super_admin(owner_id) THEN RAISE EXCEPTION 'Student account required' USING ERRCODE='42501'; END IF;
 IF full_name IS NULL OR length(trim(full_name)) NOT BETWEEN 3 AND 120 OR lub.canonical_student_major(major) IS NULL
  OR level IS NULL OR level NOT IN ('1','2','3','4','5','6','7','8','9','10','11','12','graduate')
  OR verified_email IS NULL OR verified_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' OR verified IS NULL
  OR phone_value IS NULL OR phone_value !~ '^(\+?[0-9]{8,15})?$'
  OR national_cipher IS NULL OR length(national_cipher) NOT BETWEEN 20 AND 1024
  OR national_hash IS NULL OR national_hash !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Invalid student account'; END IF;
 IF (university_cipher IS NULL)<>(university_hash IS NULL)
  OR (university_hash IS NOT NULL AND (university_hash !~ '^[0-9a-f]{64}$' OR length(university_cipher) NOT BETWEEN 20 AND 1024))
  OR (NOT existing AND university_hash IS NULL) THEN RAISE EXCEPTION 'University number required'; END IF;
 INSERT INTO lub.users(id,email,phone,email_verified_at,full_name_ar,major_name,academic_level,university_id_ciphertext,university_id_lookup_hash,onboarded_at)
 VALUES(owner_id,lower(verified_email),nullif(phone_value,''),verified,trim(full_name),lub.canonical_student_major(major),level,
  CASE WHEN university_hash IS NOT NULL AND university_hash IS DISTINCT FROM previous.university_id_lookup_hash THEN university_cipher ELSE previous.university_id_ciphertext END,
  coalesce(university_hash,previous.university_id_lookup_hash),coalesce(previous.onboarded_at,now()))
 ON CONFLICT(id) DO UPDATE SET email=excluded.email,phone=excluded.phone,email_verified_at=excluded.email_verified_at,
  full_name_ar=excluded.full_name_ar,major_name=excluded.major_name,academic_level=excluded.academic_level,
  university_id_ciphertext=excluded.university_id_ciphertext,university_id_lookup_hash=excluded.university_id_lookup_hash,
  onboarded_at=excluded.onboarded_at,updated_at=now();
 INSERT INTO lub.private_student_identifiers(user_id,national_id_ciphertext,national_id_lookup_hash)
 VALUES(owner_id,national_cipher,national_hash) ON CONFLICT(user_id) DO UPDATE SET
  national_id_ciphertext=CASE WHEN private_student_identifiers.national_id_lookup_hash<>excluded.national_id_lookup_hash THEN excluded.national_id_ciphertext ELSE private_student_identifiers.national_id_ciphertext END,
  national_id_lookup_hash=excluded.national_id_lookup_hash,updated_at=now();
END;
$$;
CREATE FUNCTION lub.sync_verified_account_email(owner_id uuid,verified_email text,verified timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF verified IS NULL OR verified_email IS NULL OR verified_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' THEN RAISE EXCEPTION 'Verified email required'; END IF;
 UPDATE lub.users SET email=lower(verified_email),email_verified_at=verified,updated_at=now()
  WHERE id=owner_id AND status_code='Active' AND email IS DISTINCT FROM lower(verified_email);
END;
$$;
CREATE FUNCTION lub.read_student_identifiers(requestor uuid,target uuid) RETURNS TABLE(university_cipher text,national_cipher text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM lub.users u WHERE u.id=requestor AND u.status_code='Active')
  OR (requestor<>target AND NOT lub.is_super_admin(requestor)) THEN RAISE EXCEPTION 'Private identifier access denied' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT u.university_id_ciphertext,i.national_id_ciphertext FROM lub.users u
  LEFT JOIN lub.private_student_identifiers i ON i.user_id=u.id WHERE u.id=target;
END;
$$;
CREATE FUNCTION lub.claim_profile_completion_notice() RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR lub.is_super_admin() THEN RETURN false; END IF;
 UPDATE lub.users SET completion_prompt_seen_at=now() WHERE id=auth.uid() AND status_code='Active'
  AND (onboarded_at IS NULL OR lub.canonical_student_major(major_name) IS NULL
   OR NOT EXISTS(SELECT 1 FROM lub.private_student_identifiers i WHERE i.user_id=users.id))
  AND completion_prompt_seen_at IS NULL;
 RETURN FOUND;
END;
$$;
CREATE FUNCTION lub.save_talent_privacy(enabled boolean,indexable boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF NOT lub.is_student_account(auth.uid()) THEN RAISE EXCEPTION 'Student account required' USING ERRCODE='42501'; END IF;
 UPDATE lub.users SET public_profile_enabled=enabled,allow_indexing=enabled AND indexable,updated_at=now() WHERE id=auth.uid()
  RETURNING jsonb_build_object('enabled',public_profile_enabled,'indexable',allow_indexing,'slug',public_slug) INTO result;
 RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION lub.save_student_account(uuid,text,timestamptz,text,text,text,text,text,text,text,text),lub.sync_verified_account_email(uuid,text,timestamptz),lub.read_student_identifiers(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION lub.save_student_account(uuid,text,timestamptz,text,text,text,text,text,text,text,text),lub.sync_verified_account_email(uuid,text,timestamptz),lub.read_student_identifiers(uuid,uuid) TO lub_runtime;
REVOKE ALL ON FUNCTION lub.claim_profile_completion_notice(),lub.save_talent_privacy(boolean,boolean),lub.is_active_account(uuid),lub.canonical_student_major(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lub.claim_profile_completion_notice(),lub.save_talent_privacy(boolean,boolean),lub.is_active_account(uuid),lub.canonical_student_major(text) TO authenticated;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('lub-avatars','lub-avatars',false,65536,ARRAY['image/webp'])
ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=65536,allowed_mime_types=ARRAY['image/webp'];
-- Supabase owns this table and already enables RLS. Fail closed on an invalid environment.
DO $$ BEGIN
 IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='storage.objects'::regclass) THEN
  RAISE EXCEPTION 'Storage row security must already be enabled';
 END IF;
END; $$;
GRANT UPDATE ON storage.objects TO authenticated;
DROP POLICY IF EXISTS account_avatar_select ON storage.objects;
DROP POLICY IF EXISTS account_avatar_insert ON storage.objects;
DROP POLICY IF EXISTS account_avatar_update ON storage.objects;
DROP POLICY IF EXISTS account_avatar_delete ON storage.objects;
CREATE POLICY account_avatar_select ON storage.objects FOR SELECT TO authenticated USING(bucket_id='lub-avatars' AND name=auth.uid()::text||'/avatar.webp' AND lub.is_active_account(auth.uid()));
CREATE POLICY account_avatar_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='lub-avatars' AND name=auth.uid()::text||'/avatar.webp' AND lub.is_active_account(auth.uid()));
CREATE POLICY account_avatar_update ON storage.objects FOR UPDATE TO authenticated USING(bucket_id='lub-avatars' AND name=auth.uid()::text||'/avatar.webp' AND lub.is_active_account(auth.uid())) WITH CHECK(bucket_id='lub-avatars' AND name=auth.uid()::text||'/avatar.webp' AND lub.is_active_account(auth.uid()));
CREATE POLICY account_avatar_delete ON storage.objects FOR DELETE TO authenticated USING(bucket_id='lub-avatars' AND name=auth.uid()::text||'/avatar.webp' AND lub.is_active_account(auth.uid()));
