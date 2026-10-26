CREATE FUNCTION lub.skill_key(value text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT CASE lower(trim(value)) WHEN 'بايثون' THEN 'python' WHEN 'إس كيو إل' THEN 'sql' WHEN 'اس كيو ال' THEN 'sql' ELSE lower(trim(value)) END;
$$;
--> statement-breakpoint
CREATE FUNCTION lub.public_avatar_version(target uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT o.updated_at::text FROM storage.objects o JOIN lub.student_profiles p ON o.name=p.user_id::text||'/avatar.webp' JOIN lub.users u ON u.id=p.user_id JOIN lub.profile_settings s ON s.user_id=p.user_id WHERE o.bucket_id='lub-avatars' AND p.user_id=target AND u.status_code='Active' AND s.public_profile_enabled LIMIT 1;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION lub.skill_key(text),lub.public_avatar_version(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION lub.skill_key(text),lub.public_avatar_version(uuid) TO anon,authenticated;
--> statement-breakpoint
GRANT USAGE ON SCHEMA storage TO anon;
--> statement-breakpoint
GRANT SELECT ON storage.objects TO anon;
--> statement-breakpoint
CREATE POLICY published_account_avatar_select ON storage.objects FOR SELECT TO anon,authenticated USING(bucket_id='lub-avatars' AND CASE WHEN name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/avatar[.]webp$' THEN lub.public_avatar_version(substring(name from 1 for 36)::uuid) IS NOT NULL ELSE false END);
--> statement-breakpoint
DROP FUNCTION lub.talent_directory(text,text,int);
--> statement-breakpoint
CREATE FUNCTION lub.talent_directory(query text,skill text,skip int DEFAULT 0) RETURNS TABLE(id uuid,name text,major text,bio text,skills jsonb,level text,total text,avatar_version text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT p.user_id,p.full_name_ar::text,p.major_name::text,p.bio::text,
 coalesce((SELECT jsonb_agg(s.name_ar ORDER BY s.name_ar) FROM lub.student_skills ss JOIN lub.skills s ON s.id=ss.skill_id WHERE ss.user_id=p.user_id AND ss.is_public AND s.is_active),'[]'),p.academic_level::text,
 coalesce((SELECT sum(h.hours) FROM lub.hour_records h JOIN lub.organization_memberships m ON m.id=h.organization_membership_id WHERE m.user_id=p.user_id AND h.status_code='Approved'),0)::text,lub.public_avatar_version(p.user_id)
 FROM lub.student_profiles p JOIN lub.users u ON u.id=p.user_id JOIN lub.profile_settings ps ON ps.user_id=p.user_id
 WHERE u.status_code='Active' AND ps.public_profile_enabled
 AND (coalesce(trim(query),'')='' OR position(lower(left(trim(query),120)) in lower(p.full_name_ar))>0 OR position(lower(left(trim(query),120)) in lower(p.major_name))>0 OR EXISTS(SELECT 1 FROM lub.student_skills ss JOIN lub.skills sk ON sk.id=ss.skill_id WHERE ss.user_id=p.user_id AND ss.is_public AND sk.is_active AND position(lub.skill_key(left(trim(query),120)) in lub.skill_key(sk.name_ar))>0))
 AND (nullif(trim(skill),'') IS NULL OR EXISTS(SELECT 1 FROM lub.student_skills ss JOIN lub.skills sk ON sk.id=ss.skill_id WHERE ss.user_id=p.user_id AND ss.is_public AND sk.is_active AND lub.skill_key(sk.name_ar)=lub.skill_key(skill)))
 ORDER BY p.full_name_ar,p.user_id LIMIT 25 OFFSET greatest(0,least(skip,240000));
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION lub.talent_directory(text,text,int) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION lub.talent_directory(text,text,int) TO anon,authenticated;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.public_talent(target uuid,org_skip int DEFAULT 0,event_skip int DEFAULT 0,project_skip int DEFAULT 0) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object(
  'id',p.user_id,
  'avatar_version',lub.public_avatar_version(p.user_id),
  'name',p.full_name_ar,
  'major',p.major_name,
  'level',p.academic_level,
  'bio',nullif(trim(p.bio),''),
  'total',nullif(coalesce((SELECT sum(h.hours) FROM lub.hour_records h JOIN lub.organization_memberships m ON m.id=h.organization_membership_id WHERE m.user_id=p.user_id AND h.status_code='Approved'),0),0)::text,
  'skills',coalesce((SELECT jsonb_agg(sk.name_ar ORDER BY sk.name_ar) FROM lub.student_skills ss JOIN lub.skills sk ON sk.id=ss.skill_id WHERE ss.user_id=p.user_id AND ss.is_public AND sk.is_active),'[]'),
  'links',coalesce((SELECT jsonb_agg(jsonb_build_object('kind',l.link_type,'label',l.label,'value',l.url_or_value) ORDER BY l.id) FROM lub.profile_links l WHERE l.user_id=p.user_id AND l.is_public),'[]'),
  'organizations',coalesce((SELECT jsonb_agg(x) FROM (
   SELECT o.id,o.name_ar AS name,o.slug,o.status_code='Archived' AS archived,
    nullif(coalesce((SELECT sum(h.hours) FROM lub.hour_records h JOIN lub.organization_memberships mm ON mm.id=h.organization_membership_id WHERE mm.user_id=p.user_id AND mm.organization_id=o.id AND h.status_code='Approved'),0),0)::text AS hours,
    coalesce((SELECT jsonb_agg(membership) FROM (
     SELECT m.start_date,m.end_date,m.status_code,
      coalesce((SELECT jsonb_agg(jsonb_build_object('code',r.role_code,'starts',r.start_date,'ends',r.end_date) ORDER BY r.start_date,r.id) FROM lub.role_assignments r WHERE r.organization_membership_id=m.id),'[]') AS roles
     FROM lub.organization_memberships m WHERE m.user_id=p.user_id AND m.organization_id=o.id ORDER BY m.start_date,m.id LIMIT 100
    ) membership),'[]') AS memberships
   FROM lub.organizations o WHERE EXISTS(SELECT 1 FROM lub.organization_memberships m WHERE m.organization_id=o.id AND m.user_id=p.user_id)
   ORDER BY o.name_ar,o.id LIMIT 26 OFFSET greatest(0,least(org_skip,250000))
  ) x),'[]'),
  'events',coalesce((SELECT jsonb_agg(x) FROM (
   SELECT e.id,e.title,e.starts_at,o.name_ar AS organization,o.status_code='Archived' AS archived,a.status_code AS attendance,
    coalesce((SELECT jsonb_agg(jsonb_build_object('kind',c.contribution_type_code,'title',c.title) ORDER BY c.id) FROM lub.event_contributions c WHERE c.event_id=e.id AND c.user_id=p.user_id),'[]') AS contributions
   FROM lub.events e JOIN lub.organizations o ON o.id=e.organization_id
   LEFT JOIN lub.event_registrations r ON r.event_id=e.id AND r.user_id=p.user_id AND r.status_code='Registered'
   LEFT JOIN lub.event_attendance a ON a.event_registration_id=r.id
   WHERE e.status_code='Completed' AND e.published_at IS NOT NULL AND (
    a.status_code IS NOT NULL OR EXISTS(SELECT 1 FROM lub.event_contributions c WHERE c.event_id=e.id AND c.user_id=p.user_id)
   )
   ORDER BY e.starts_at DESC,e.id LIMIT 26 OFFSET greatest(0,least(event_skip,250000))
  ) x),'[]'),
  'projects',coalesce((SELECT jsonb_agg(x) FROM (
   SELECT sp.id,sp.display_title AS title,sp.display_description AS description,sp.is_featured AS featured
   FROM lub.student_projects sp
   WHERE sp.user_id=p.user_id AND (
    (sp.task_participant_id IS NOT NULL AND EXISTS(SELECT 1 FROM lub.task_participants tp WHERE tp.id=sp.task_participant_id AND tp.user_id=p.user_id AND tp.status_code='Approved'))
    OR (sp.event_contribution_id IS NOT NULL AND EXISTS(SELECT 1 FROM lub.event_contributions c JOIN lub.events e ON e.id=c.event_id WHERE c.id=sp.event_contribution_id AND c.user_id=p.user_id AND e.status_code='Completed'))
   )
   ORDER BY sp.is_featured DESC,sp.created_at DESC,sp.id LIMIT 26 OFFSET greatest(0,least(project_skip,250000))
  ) x),'[]')
 )
 FROM lub.student_profiles p JOIN lub.profile_settings s ON s.user_id=p.user_id JOIN lub.users u ON u.id=p.user_id
 WHERE p.user_id=target AND u.status_code='Active' AND s.public_profile_enabled;
$$;
--> statement-breakpoint


--> statement-breakpoint
CREATE FUNCTION lub.talent_skill_options() RETURNS TABLE(name text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT DISTINCT sk.name_ar FROM lub.skills sk JOIN lub.student_skills ss ON ss.skill_id=sk.id JOIN lub.profile_settings ps ON ps.user_id=ss.user_id JOIN lub.users u ON u.id=ss.user_id WHERE sk.is_active AND ss.is_public AND ps.public_profile_enabled AND u.status_code='Active' ORDER BY sk.name_ar LIMIT 1000;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION lub.talent_skill_options() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lub.talent_skill_options() TO anon,authenticated;

--> statement-breakpoint
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='lub_runtime') THEN
  EXECUTE 'GRANT EXECUTE ON FUNCTION lub.talent_directory(text,text,int),lub.public_avatar_version(uuid),lub.talent_skill_options() TO lub_runtime';
 END IF;
END $$;
