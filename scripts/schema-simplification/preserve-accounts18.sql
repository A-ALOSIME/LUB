-- Run after creating the new lub schema in the same transaction as the legacy rename.
-- Supabase Auth identities and sessions stay in their managed schema.
INSERT INTO lub.users(
 id,email,phone,status_code,email_verified_at,is_test_account,
 full_name_ar,university_id_ciphertext,university_id_lookup_hash,major_name,academic_level,bio,
 onboarded_at,public_slug,public_profile_enabled,allow_indexing,completion_prompt_seen_at,created_at,updated_at
)
SELECT u.id,lower(u.email),u.phone,u.status_code,u.email_verified_at,u.is_test_account,
 p.full_name_ar,p.university_id_ciphertext,p.university_id_lookup_hash,p.major_name,p.academic_level,coalesce(p.bio,''),
 p.created_at,coalesce(s.public_slug,gen_random_uuid()),coalesce(s.public_profile_enabled,false),
 coalesce(s.public_profile_enabled AND s.allow_indexing,false),s.completion_prompt_seen_at,u.created_at,u.updated_at
FROM lub_before_simplification.users u
LEFT JOIN lub_before_simplification.student_profiles p ON p.user_id=u.id
LEFT JOIN lub_before_simplification.profile_settings s ON s.user_id=u.id;

INSERT INTO lub.private_student_identifiers(user_id,national_id_ciphertext,national_id_lookup_hash,updated_at)
SELECT user_id,national_id_ciphertext,national_id_lookup_hash,updated_at
FROM lub_before_simplification.private_student_identifiers;

INSERT INTO lub.access_assignments(id,user_id,role_code,start_at,end_at,assigned_by_user_id)
SELECT id,user_id,role_code,start_at,end_at,assigned_by_user_id
FROM lub_before_simplification.global_role_assignments
WHERE end_at IS NULL OR end_at>start_at;

DO $$ BEGIN
 IF (SELECT count(*) FROM lub.users) <> (SELECT count(*) FROM lub_before_simplification.users)
 OR (SELECT count(*) FROM lub.users WHERE onboarded_at IS NOT NULL) <> (SELECT count(*) FROM lub_before_simplification.student_profiles)
 OR (SELECT count(*) FROM lub.private_student_identifiers) <> (SELECT count(*) FROM lub_before_simplification.private_student_identifiers)
 OR EXISTS (
  SELECT 1 FROM lub_before_simplification.global_role_assignments r
  WHERE r.start_at<=statement_timestamp() AND (r.end_at IS NULL OR r.end_at>statement_timestamp())
  AND NOT EXISTS(SELECT 1 FROM lub.access_assignments a WHERE a.id=r.id AND a.user_id=r.user_id AND a.role_code='SA')
 ) THEN
  RAISE EXCEPTION 'Account preservation verification failed';
 END IF;
END; $$;
