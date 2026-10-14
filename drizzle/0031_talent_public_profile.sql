REVOKE ALL ON FUNCTION lub.save_talent_settings(text,boolean,boolean,boolean,boolean,boolean),lub.save_talent_project(uuid,uuid,uuid,text,text,boolean,boolean),lub.set_talent_organization(uuid,boolean,boolean),lub.set_talent_event(uuid,boolean),lub.set_talent_contribution(uuid,boolean),lub.talent_workspace(int,int,int,int) FROM PUBLIC,anon,authenticated;--> statement-breakpoint
DROP FUNCTION lub.save_talent_settings(text,boolean,boolean,boolean,boolean,boolean);--> statement-breakpoint
DROP FUNCTION lub.save_talent_project(uuid,uuid,uuid,text,text,boolean,boolean);--> statement-breakpoint
DROP FUNCTION lub.set_talent_organization(uuid,boolean,boolean);--> statement-breakpoint
DROP FUNCTION lub.set_talent_event(uuid,boolean);--> statement-breakpoint
DROP FUNCTION lub.set_talent_contribution(uuid,boolean);--> statement-breakpoint
DROP FUNCTION lub.talent_workspace(int,int,int,int);--> statement-breakpoint
CREATE FUNCTION lub.save_talent_settings(bio text,enabled boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE owner uuid:=lub.talent_owner();
BEGIN
 UPDATE lub.student_profiles SET bio=trim(save_talent_settings.bio),updated_at=now() WHERE user_id=owner;
 INSERT INTO lub.profile_settings(user_id,public_profile_enabled) VALUES(owner,enabled) ON CONFLICT(user_id) DO UPDATE SET public_profile_enabled=excluded.public_profile_enabled,updated_at=now();
 PERFORM lub.task_audit(owner,NULL,'TALENT_SETTINGS_UPDATED');
END; $$;--> statement-breakpoint
CREATE FUNCTION lub.save_talent_project(target uuid,participant uuid,contribution uuid,title text,description text,featured boolean) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE owner uuid:=lub.talent_owner();result uuid;
BEGIN
 IF (participant IS NULL)=(contribution IS NULL) OR (participant IS NOT NULL AND NOT EXISTS(SELECT 1 FROM lub.task_participants WHERE id=participant AND user_id=owner AND status_code='Approved')) OR (contribution IS NOT NULL AND NOT EXISTS(SELECT 1 FROM lub.event_contributions c JOIN lub.events e ON e.id=c.event_id WHERE c.id=contribution AND c.user_id=owner AND e.status_code='Completed')) THEN RAISE EXCEPTION 'Owned verified activity required';END IF;
 IF length(trim(title)) NOT BETWEEN 2 AND 120 OR title IS NULL OR length(trim(description))>1000 THEN RAISE EXCEPTION 'Invalid project';END IF;
 IF target IS NULL THEN
  IF (SELECT count(*) FROM lub.student_projects WHERE user_id=owner)>=100 THEN RAISE EXCEPTION 'Project limit';END IF;
  INSERT INTO lub.student_projects(user_id,task_participant_id,event_contribution_id,display_title,display_description,is_featured) VALUES(owner,participant,contribution,trim(title),trim(description),featured) RETURNING id INTO result;
 ELSE
  UPDATE lub.student_projects SET display_title=trim(title),display_description=trim(description),is_featured=featured,updated_at=now() WHERE id=target AND user_id=owner AND task_participant_id IS NOT DISTINCT FROM participant AND event_contribution_id IS NOT DISTINCT FROM contribution RETURNING id INTO result;
  IF NOT FOUND THEN RAISE EXCEPTION 'Owned project required';END IF;
 END IF;
 PERFORM lub.task_audit(result,NULL,'TALENT_PROJECT_SAVED');RETURN result;
END; $$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.public_talent(target uuid,org_skip int DEFAULT 0,event_skip int DEFAULT 0,project_skip int DEFAULT 0) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object(
  'id',p.user_id,
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
$$;--> statement-breakpoint
CREATE FUNCTION lub.talent_workspace(project_skip int DEFAULT 0,source_skip int DEFAULT 0) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT CASE WHEN u.status_code='Inactive' THEN jsonb_build_object('status','Inactive','onboarded',false) ELSE jsonb_build_object(
  'status',u.status_code,
  'onboarded',p.user_id IS NOT NULL,
  'bio',coalesce(p.bio,''),
  'settings',jsonb_build_object('public_profile_enabled',coalesce(s.public_profile_enabled,false)),
  'links',coalesce((SELECT jsonb_agg(l ORDER BY l.id) FROM lub.profile_links l WHERE l.user_id=u.id),'[]'),
  'skills',coalesce((SELECT jsonb_agg(jsonb_build_object('name',sk.name_ar,'public',ss.is_public) ORDER BY sk.name_ar) FROM lub.student_skills ss JOIN lub.skills sk ON sk.id=ss.skill_id WHERE ss.user_id=u.id),'[]'),
  'projects',coalesce((SELECT jsonb_agg(x) FROM (
   SELECT sp.id,sp.task_participant_id,sp.event_contribution_id,sp.display_title,sp.display_description,sp.is_featured
   FROM lub.student_projects sp WHERE sp.user_id=u.id ORDER BY sp.created_at DESC,sp.id LIMIT 26 OFFSET greatest(0,least(project_skip,250000))
  ) x),'[]'),
  'sources',coalesce((SELECT jsonb_agg(x) FROM (
   SELECT tp.id,'Task' AS kind,(SELECT r.snapshot_json->>'title' FROM lub.task_revisions r WHERE r.task_id=tp.task_id ORDER BY r.revision_number DESC LIMIT 1) AS title
   FROM lub.task_participants tp WHERE tp.user_id=u.id AND tp.status_code='Approved' AND NOT EXISTS(SELECT 1 FROM lub.student_projects sp WHERE sp.task_participant_id=tp.id)
   UNION ALL
   SELECT c.id,'Event',c.title FROM lub.event_contributions c JOIN lub.events e ON e.id=c.event_id WHERE c.user_id=u.id AND e.status_code='Completed' AND NOT EXISTS(SELECT 1 FROM lub.student_projects sp WHERE sp.event_contribution_id=c.id)
   ORDER BY id LIMIT 26 OFFSET greatest(0,least(source_skip,250000))
  ) x),'[]')
 ) END
 FROM lub.users u LEFT JOIN lub.student_profiles p ON p.user_id=u.id LEFT JOIN lub.profile_settings s ON s.user_id=u.id
 WHERE u.id=auth.uid();
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION lub.save_talent_settings(text,boolean),lub.save_talent_project(uuid,uuid,uuid,text,text,boolean),lub.talent_workspace(int,int),lub.talent_owner() FROM PUBLIC,anon,authenticated;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION lub.save_talent_settings(text,boolean),lub.save_talent_project(uuid,uuid,uuid,text,text,boolean),lub.talent_workspace(int,int) TO authenticated;--> statement-breakpoint
DROP TABLE "lub"."profile_organization_settings" CASCADE;--> statement-breakpoint
ALTER TABLE "lub"."event_contributions" DROP COLUMN "show_on_profile";--> statement-breakpoint
ALTER TABLE "lub"."event_registrations" DROP COLUMN "show_on_profile";--> statement-breakpoint
ALTER TABLE "lub"."profile_settings" DROP COLUMN "show_total_hours";--> statement-breakpoint
ALTER TABLE "lub"."profile_settings" DROP COLUMN "show_role_history";--> statement-breakpoint
ALTER TABLE "lub"."profile_settings" DROP COLUMN "show_events";--> statement-breakpoint
ALTER TABLE "lub"."profile_settings" DROP COLUMN "show_projects";--> statement-breakpoint
ALTER TABLE "lub"."student_projects" DROP COLUMN "is_public";
