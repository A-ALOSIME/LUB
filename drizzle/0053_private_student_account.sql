CREATE TABLE lub.private_student_identifiers (
 user_id uuid PRIMARY KEY REFERENCES lub.users(id),
 national_id_ciphertext text NOT NULL CHECK(length(national_id_ciphertext) BETWEEN 20 AND 1024),
 national_id_lookup_hash varchar(64) NOT NULL UNIQUE CHECK(national_id_lookup_hash ~ '^[0-9a-f]{64}$'),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE lub.private_student_identifiers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON lub.private_student_identifiers FROM PUBLIC,anon,authenticated;
ALTER TABLE lub.profile_settings ADD COLUMN completion_prompt_seen_at timestamptz;
--> statement-breakpoint
CREATE FUNCTION lub.canonical_student_major(value text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT CASE regexp_replace(lub.arabic_search_key(value),'[[:space:]]','','g')
 WHEN 'نظممعلومات' THEN 'نظم معلومات' WHEN 'نظمالمعلومات' THEN 'نظم معلومات' WHEN 'نظمالمعلوماتالاداريه' THEN 'نظم معلومات' WHEN 'informationsystems' THEN 'نظم معلومات' WHEN 'managementinformationsystems' THEN 'نظم معلومات' WHEN 'is' THEN 'نظم معلومات' WHEN 'mis' THEN 'نظم معلومات'
 WHEN 'تقنيهمعلومات' THEN 'تقنية معلومات' WHEN 'تقنيهالمعلومات' THEN 'تقنية معلومات' WHEN 'تكنولوجيامعلومات' THEN 'تقنية معلومات' WHEN 'تكنولوجياالمعلومات' THEN 'تقنية معلومات' WHEN 'informationtechnology' THEN 'تقنية معلومات' WHEN 'it' THEN 'تقنية معلومات'
 WHEN 'علومحاسب' THEN 'علوم حاسب' WHEN 'علومالحاسب' THEN 'علوم حاسب' WHEN 'علومالحاسبالالي' THEN 'علوم حاسب' WHEN 'علومالحاسوب' THEN 'علوم حاسب' WHEN 'computerscience' THEN 'علوم حاسب' WHEN 'cs' THEN 'علوم حاسب' END;
$$;
UPDATE lub.student_profiles SET major_name=lub.canonical_student_major(major_name) WHERE lub.canonical_student_major(major_name) IS NOT NULL AND major_name IS DISTINCT FROM lub.canonical_student_major(major_name);
--> statement-breakpoint
-- Only the verified application server may pass encrypted identifiers or verified email.
CREATE FUNCTION lub.save_student_account(owner uuid,email text,verified timestamptz,full_name text,major text,level text,phone text,university_cipher text,university_hash text,national_cipher text,national_hash text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE previous lub.student_profiles; existing boolean;
BEGIN
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(owner::text,1));
 IF EXISTS(SELECT 1 FROM lub.users WHERE id=owner AND status_code<>'Active') THEN RAISE EXCEPTION 'Account inactive';END IF;
 IF EXISTS(SELECT 1 FROM lub.global_role_assignments WHERE user_id=owner AND role_code='SA' AND start_at<=now() AND (end_at IS NULL OR end_at>now())) THEN RAISE EXCEPTION 'Student account required' USING ERRCODE='42501';END IF;
 IF length(trim(full_name)) NOT BETWEEN 3 AND 120 OR major NOT IN ('نظم معلومات','تقنية معلومات','علوم حاسب') OR level NOT IN ('1','2','3','4','5','6','7','8','9','10','11','12','graduate') OR email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' OR verified IS NULL OR phone !~ '^(\+?[0-9]{8,15})?$' OR national_cipher IS NULL OR length(national_cipher) NOT BETWEEN 20 AND 1024 OR national_hash IS NULL OR national_hash !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Invalid student account';END IF;
 SELECT * INTO previous FROM lub.student_profiles WHERE user_id=owner FOR UPDATE;existing:=FOUND;
 IF (university_cipher IS NULL)<>(university_hash IS NULL) OR (university_hash IS NOT NULL AND (university_hash !~ '^[0-9a-f]{64}$' OR length(university_cipher) NOT BETWEEN 20 AND 1024)) OR (NOT existing AND university_hash IS NULL) THEN RAISE EXCEPTION 'University number required';END IF;
 INSERT INTO lub.users(id,email,phone,email_verified_at) VALUES(owner,lower(email),nullif(phone,''),verified) ON CONFLICT(id) DO UPDATE SET email=excluded.email,phone=excluded.phone,email_verified_at=excluded.email_verified_at,updated_at=now();
 IF existing THEN
  UPDATE lub.student_profiles SET full_name_ar=trim(full_name),major_name=major,academic_level=level,updated_at=now(),university_id_ciphertext=CASE WHEN university_hash IS NOT NULL AND university_hash<>previous.university_id_lookup_hash THEN university_cipher ELSE university_id_ciphertext END,university_id_lookup_hash=coalesce(university_hash,university_id_lookup_hash) WHERE user_id=owner;
 ELSE INSERT INTO lub.student_profiles(user_id,full_name_ar,major_name,academic_level,university_id_ciphertext,university_id_lookup_hash) VALUES(owner,trim(full_name),major,level,university_cipher,university_hash);END IF;
 INSERT INTO lub.private_student_identifiers(user_id,national_id_ciphertext,national_id_lookup_hash) VALUES(owner,national_cipher,national_hash) ON CONFLICT(user_id) DO UPDATE SET national_id_ciphertext=CASE WHEN private_student_identifiers.national_id_lookup_hash<>excluded.national_id_lookup_hash THEN excluded.national_id_ciphertext ELSE private_student_identifiers.national_id_ciphertext END,national_id_lookup_hash=excluded.national_id_lookup_hash,updated_at=now();
 INSERT INTO lub.profile_settings(user_id) VALUES(owner) ON CONFLICT DO NOTHING;
 INSERT INTO lub.audit_log(actor_user_id,action_code,entity_type,entity_id,metadata) VALUES(owner,CASE WHEN existing THEN 'PROFILE_UPDATED' ELSE 'PROFILE_CREATED' END,'student_profiles',owner,'{}');
 IF existing AND university_hash IS NOT NULL AND university_hash<>previous.university_id_lookup_hash THEN INSERT INTO lub.audit_log(actor_user_id,action_code,entity_type,entity_id,metadata) VALUES(owner,'UNIVERSITY_ID_UPDATED','student_profiles',owner,'{}');END IF;
END; $$;
CREATE FUNCTION lub.read_student_identifiers(requestor uuid,target uuid) RETURNS TABLE(university_cipher text,national_cipher text) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM lub.users WHERE id=requestor AND status_code='Active') OR (requestor<>target AND NOT EXISTS(SELECT 1 FROM lub.global_role_assignments WHERE user_id=requestor AND role_code='SA' AND start_at<=now() AND (end_at IS NULL OR end_at>now()))) THEN RAISE EXCEPTION 'Private identifier access denied' USING ERRCODE='42501';END IF;
 INSERT INTO lub.audit_log(actor_user_id,action_code,entity_type,entity_id,metadata) VALUES(requestor,'STUDENT_IDENTIFIERS_VIEWED','student_profiles',target,'{}');
 RETURN QUERY SELECT p.university_id_ciphertext,i.national_id_ciphertext FROM lub.student_profiles p LEFT JOIN lub.private_student_identifiers i ON i.user_id=p.user_id WHERE p.user_id=target;
END; $$;
CREATE FUNCTION lub.sync_verified_account_email(owner uuid,email text,verified timestamptz) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF verified IS NULL OR email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' THEN RAISE EXCEPTION 'Verified email required';END IF;
 UPDATE lub.users SET email=lower(sync_verified_account_email.email),email_verified_at=verified,updated_at=now() WHERE id=owner AND status_code='Active' AND users.email IS DISTINCT FROM lower(sync_verified_account_email.email);
 IF FOUND THEN INSERT INTO lub.audit_log(actor_user_id,action_code,entity_type,entity_id,metadata) VALUES(owner,'ACCOUNT_EMAIL_CONFIRMED','users',owner,'{}');END IF;
END; $$;
REVOKE ALL ON FUNCTION lub.save_student_account(uuid,text,timestamptz,text,text,text,text,text,text,text,text),lub.read_student_identifiers(uuid,uuid),lub.sync_verified_account_email(uuid,text,timestamptz) FROM PUBLIC,anon,authenticated;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='lub_runtime') THEN
 REVOKE ALL ON lub.private_student_identifiers FROM lub_runtime;
 GRANT EXECUTE ON FUNCTION lub.save_student_account(uuid,text,timestamptz,text,text,text,text,text,text,text,text),lub.read_student_identifiers(uuid,uuid),lub.sync_verified_account_email(uuid,text,timestamptz) TO lub_runtime;
END IF;END; $$;
--> statement-breakpoint
CREATE FUNCTION lub.claim_profile_completion_notice() RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM lub.global_role_assignments WHERE user_id=auth.uid() AND role_code='SA' AND start_at<=now() AND (end_at IS NULL OR end_at>now())) THEN RETURN false;END IF;
 UPDATE lub.profile_settings s SET completion_prompt_seen_at=now() FROM lub.student_profiles p JOIN lub.users u ON u.id=p.user_id WHERE s.user_id=auth.uid() AND p.user_id=s.user_id AND u.status_code='Active' AND s.completion_prompt_seen_at IS NULL AND (p.major_name NOT IN ('نظم معلومات','تقنية معلومات','علوم حاسب') OR NOT EXISTS(SELECT 1 FROM lub.private_student_identifiers i WHERE i.user_id=s.user_id));
 RETURN FOUND;
END; $$;
REVOKE ALL ON FUNCTION lub.claim_profile_completion_notice() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION lub.claim_profile_completion_notice() TO authenticated;
