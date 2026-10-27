CREATE FUNCTION lub.is_student_account(target uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM lub.student_profiles WHERE user_id=target) AND NOT EXISTS(SELECT 1 FROM lub.global_role_assignments WHERE user_id=target AND role_code='SA' AND start_at<=statement_timestamp() AND (end_at IS NULL OR end_at>statement_timestamp()));
$$;
CREATE FUNCTION lub.is_student_membership(target uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT EXISTS(SELECT 1 FROM lub.organization_memberships WHERE id=target AND lub.is_student_account(user_id)); $$;
REVOKE ALL ON FUNCTION lub.is_student_account(uuid),lub.is_student_membership(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION lub.is_student_account(uuid),lub.is_student_membership(uuid) TO authenticated;
CREATE POLICY memberships_student_identity ON lub.organization_memberships AS RESTRICTIVE FOR SELECT TO authenticated USING(lub.is_student_account(user_id));
CREATE POLICY hours_student_identity ON lub.hour_records AS RESTRICTIVE FOR SELECT TO authenticated USING(lub.is_student_membership(organization_membership_id));
CREATE POLICY applications_student_identity ON lub.membership_applications AS RESTRICTIVE FOR SELECT TO authenticated USING(lub.is_student_account(applicant_user_id));
CREATE POLICY registrations_student_identity ON lub.event_registrations AS RESTRICTIVE FOR SELECT TO authenticated USING(lub.is_student_account(user_id));

--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.has_org_permission(target_org uuid, capability text, target_committee uuid DEFAULT NULL) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT lub.is_student_account(auth.uid()) AND capability IN ('ORG_PROFILE_MANAGE','COMMITTEE_MANAGE','COMMITTEE_PROFILE_MANAGE','MEMBERS_VIEW','MEMBERS_MANAGE','FORMS_MANAGE','REGISTRATION_ROUNDS_MANAGE','APPLICATIONS_VIEW','APPLICATIONS_REVIEW','APPLICATIONS_BULK_ACTION','PERMISSIONS_GRANT','TASKS_MANAGE','TASK_TEMPLATES_MANAGE','HOUR_RULES_MANAGE','HOURS_APPROVE','HOURS_MANUAL_ADD','RENEWALS_MANAGE','REPORTS_GENERATE','EVENTS_MANAGE','EVENT_ATTENDANCE_MANAGE','EVENT_CONTRIBUTIONS_MANAGE')
 AND EXISTS(SELECT 1 FROM lub.organizations WHERE id=target_org AND status_code='Active')
 AND (target_committee IS NULL OR EXISTS(SELECT 1 FROM lub.committees WHERE id=target_committee AND organization_id=target_org AND status_code='Active'))
 AND EXISTS(SELECT 1 FROM lub.organization_memberships m JOIN lub.users u ON u.id=m.user_id WHERE u.id=auth.uid() AND u.status_code='Active' AND m.organization_id=target_org AND m.status_code='Active' AND m.start_date<=current_date AND (m.end_date IS NULL OR m.end_date>current_date)
 AND (EXISTS(SELECT 1 FROM lub.role_assignments r WHERE r.organization_membership_id=m.id AND r.start_date<=current_date AND (r.end_date IS NULL OR r.end_date>current_date) AND (r.role_code IN ('OL','OD') OR (r.role_code IN ('CL','CD') AND r.committee_id=target_committee AND capability IN ('COMMITTEE_PROFILE_MANAGE','MEMBERS_VIEW','TASKS_MANAGE','TASK_TEMPLATES_MANAGE','HOUR_RULES_MANAGE','HOURS_APPROVE','HOURS_MANUAL_ADD'))))
 OR EXISTS(SELECT 1 FROM lub.permission_grants g WHERE g.organization_membership_id=m.id AND g.permission_code=capability AND g.start_at<=statement_timestamp() AND (g.end_at IS NULL OR g.end_at>statement_timestamp()) AND (g.committee_id IS NULL OR g.committee_id=target_committee))));
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.organization_member_directory(org uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF NOT lub.has_org_permission(org,'MEMBERS_VIEW') AND NOT lub.has_org_permission(org,'MEMBERS_MANAGE') AND NOT EXISTS(SELECT 1 FROM lub.committees c WHERE c.organization_id=org AND lub.has_org_permission(org,'MEMBERS_VIEW',c.id)) THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 SELECT jsonb_build_object(
  'canManage',lub.has_org_permission(org,'MEMBERS_MANAGE'),
  'canGrant',lub.has_org_permission(org,'PERMISSIONS_GRANT'),
  'canAddHours',lub.has_org_permission(org,'HOURS_MANUAL_ADD'),
  'terms',coalesce((SELECT jsonb_agg(jsonb_build_object('id',t.id,'name',t.name_ar,'year',t.academic_year,'termCode',t.term_code,'startDate',t.start_date,'endDate',t.end_date) ORDER BY t.start_date DESC,t.id) FROM (SELECT id,name_ar,academic_year,term_code,start_date,end_date FROM lub.academic_terms ORDER BY start_date DESC,id LIMIT 30) t),'[]'::jsonb),
  'committees',coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'name',c.name) ORDER BY c.name,c.id) FROM lub.committees c WHERE c.organization_id=org AND c.status_code='Active' AND (lub.has_org_permission(org,'MEMBERS_VIEW') OR lub.has_org_permission(org,'MEMBERS_MANAGE') OR lub.has_org_permission(org,'MEMBERS_VIEW',c.id))),'[]'::jsonb),
  'members',coalesce((SELECT jsonb_agg(row_data ORDER BY member_name,member_id) FROM (
   SELECT jsonb_build_object(
    'id',m.id,'name',p.full_name_ar,'major',p.major_name,'level',p.academic_level,'status',m.status_code,'startDate',m.start_date,'endDate',m.end_date,
    'canManage',m.status_code='Active' AND lub.has_org_permission(org,'MEMBERS_MANAGE'),
    'hours',coalesce((SELECT sum(h.hours) FROM lub.hour_records h WHERE h.organization_membership_id=m.id AND h.organization_id=org AND h.status_code='Approved' AND (lub.has_org_permission(org,'MEMBERS_VIEW') OR (h.committee_id IS NOT NULL AND lub.has_org_permission(org,'MEMBERS_VIEW',h.committee_id)))),0),
    'roles',coalesce((SELECT jsonb_agg(jsonb_build_object('code',r.role_code,'committee',c.name) ORDER BY r.role_code,c.name) FROM lub.role_assignments r LEFT JOIN lub.committees c ON c.id=r.committee_id WHERE r.organization_membership_id=m.id AND r.start_date<=current_date AND (r.end_date IS NULL OR r.end_date>current_date) AND (lub.has_org_permission(org,'MEMBERS_VIEW') OR lub.has_org_permission(org,'MEMBERS_MANAGE') OR (r.committee_id IS NOT NULL AND lub.has_org_permission(org,'MEMBERS_VIEW',r.committee_id)))),'[]'::jsonb),
    'committees',coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'name',c.name) ORDER BY c.name,c.id) FROM lub.committee_memberships cm JOIN lub.committees c ON c.id=cm.committee_id WHERE cm.organization_membership_id=m.id AND cm.status_code='Active' AND cm.start_date<=current_date AND (cm.end_date IS NULL OR cm.end_date>current_date) AND (lub.has_org_permission(org,'MEMBERS_VIEW') OR lub.has_org_permission(org,'MEMBERS_VIEW',c.id))),'[]'::jsonb),
    'hourScopes',coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'name',c.name) ORDER BY c.name,c.id) FROM lub.committee_memberships cm JOIN lub.committees c ON c.id=cm.committee_id WHERE cm.organization_membership_id=m.id AND cm.status_code='Active' AND cm.start_date<=current_date AND (cm.end_date IS NULL OR cm.end_date>current_date) AND c.status_code='Active' AND lub.has_org_permission(org,'HOURS_MANUAL_ADD',c.id)),'[]'::jsonb)
   ) AS row_data,m.id AS member_id,p.full_name_ar AS member_name
   FROM lub.organization_memberships m JOIN lub.student_profiles p ON p.user_id=m.user_id JOIN lub.users u ON u.id=m.user_id
   WHERE lub.is_student_account(m.user_id) AND m.organization_id=org AND u.status_code='Active' AND (((lub.has_org_permission(org,'MEMBERS_VIEW') OR lub.has_org_permission(org,'MEMBERS_MANAGE')) AND m.status_code IN ('Active','Ended','Inactive')) OR (m.status_code='Active' AND EXISTS(SELECT 1 FROM lub.committee_memberships cm JOIN lub.committees c ON c.id=cm.committee_id WHERE cm.organization_membership_id=m.id AND cm.status_code='Active' AND cm.start_date<=current_date AND (cm.end_date IS NULL OR cm.end_date>current_date) AND lub.has_org_permission(org,'MEMBERS_VIEW',c.id))))
   ORDER BY p.full_name_ar,m.id LIMIT 500
  ) members_page),'[]'::jsonb)
 ) INTO result;
 RETURN result;
END; $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.application_grant_members(org uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT lub.has_org_permission(org,'PERMISSIONS_GRANT') THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object('id',m.id,'name',p.full_name_ar,'grants',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',g.id,'code',g.permission_code,'committee',cc.name,'ends',g.end_at)) FROM lub.permission_grants g LEFT JOIN lub.committees cc ON cc.id=g.committee_id WHERE g.organization_membership_id=m.id AND g.permission_code IN ('FORMS_MANAGE','REGISTRATION_ROUNDS_MANAGE','APPLICATIONS_VIEW','APPLICATIONS_REVIEW','APPLICATIONS_BULK_ACTION') AND g.start_at<=now() AND (g.end_at IS NULL OR g.end_at>now())),'[]'::jsonb))) FROM lub.organization_memberships m JOIN lub.student_profiles p ON p.user_id=m.user_id JOIN lub.users u ON u.id=m.user_id WHERE lub.is_student_account(m.user_id) AND m.organization_id=org AND m.status_code='Active' AND u.status_code='Active' AND m.start_date<=current_date AND (m.end_date IS NULL OR m.end_date>current_date)),'[]'::jsonb);
END; $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.task_grant_members(org uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT lub.has_org_permission(org,'PERMISSIONS_GRANT') THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501';END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id',m.id,'name',p.full_name_ar,'grants',coalesce((SELECT jsonb_agg(jsonb_build_object('id',g.id,'code',g.permission_code,'committee',c.name,'ends',g.end_at)) FROM lub.permission_grants g LEFT JOIN lub.committees c ON c.id=g.committee_id WHERE g.organization_membership_id=m.id AND g.permission_code IN ('TASKS_MANAGE','TASK_TEMPLATES_MANAGE') AND g.start_at<=now() AND (g.end_at IS NULL OR g.end_at>now())),'[]'))) FROM lub.organization_memberships m JOIN lub.users u ON u.id=m.user_id JOIN lub.student_profiles p ON p.user_id=m.user_id WHERE lub.is_student_account(m.user_id) AND m.organization_id=org AND m.status_code='Active' AND m.start_date<=current_date AND (m.end_date IS NULL OR m.end_date>current_date) AND u.status_code='Active'),'[]');
END; $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.hour_members(org uuid,committee uuid,skip int DEFAULT 0) RETURNS TABLE(id uuid,name text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT m.id,p.full_name_ar::text FROM lub.organization_memberships m JOIN lub.student_profiles p ON p.user_id=m.user_id JOIN lub.users u ON u.id=m.user_id WHERE lub.is_student_account(m.user_id) AND m.organization_id=org AND m.status_code='Active' AND u.status_code='Active' AND m.start_date<=current_date AND (m.end_date IS NULL OR m.end_date>current_date) AND (lub.has_org_permission(org,'HOURS_MANUAL_ADD',committee) OR lub.has_org_permission(org,'RENEWALS_MANAGE')) AND (committee IS NULL OR EXISTS(SELECT 1 FROM lub.committee_memberships cm WHERE cm.organization_membership_id=m.id AND cm.committee_id=committee AND cm.status_code='Active' AND cm.start_date<=current_date AND (cm.end_date IS NULL OR cm.end_date>current_date))) ORDER BY p.full_name_ar,m.id LIMIT 26 OFFSET greatest(0,least(skip,250000));
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.report_members(org uuid,committee uuid,skip int DEFAULT 0) RETURNS TABLE(id uuid,name text,start_date date,end_date date) LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT m.id,p.full_name_ar::text,m.start_date,m.end_date FROM lub.organization_memberships m JOIN lub.student_profiles p ON p.user_id=m.user_id WHERE lub.is_student_account(m.user_id) AND m.organization_id=org AND (lub.has_org_permission(org,'REPORTS_GENERATE') OR lub.has_org_permission(org,'REPORTS_GENERATE',committee)) AND EXISTS(SELECT 1 FROM lub.hour_records h WHERE h.organization_membership_id=m.id AND h.status_code='Approved' AND (committee IS NULL OR h.committee_id=committee)) ORDER BY p.full_name_ar,m.id LIMIT 26 OFFSET greatest(0,least(skip,250000));
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.report_grant_members(org uuid,skip int DEFAULT 0) RETURNS TABLE(id uuid,name text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT m.id,p.full_name_ar::text FROM lub.organization_memberships m JOIN lub.student_profiles p ON p.user_id=m.user_id WHERE lub.is_student_account(m.user_id) AND m.organization_id=org AND m.status_code='Active' AND m.start_date<=current_date AND (m.end_date IS NULL OR m.end_date>current_date) AND lub.has_org_permission(org,'PERMISSIONS_GRANT') ORDER BY p.full_name_ar,m.id LIMIT 26 OFFSET greatest(0,least(skip,250000));
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.organization_permission_workspace(org uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT lub.has_org_permission(org,'PERMISSIONS_GRANT') THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object(
  'members',coalesce((SELECT jsonb_agg(jsonb_build_object('id',m.id,'name',p.full_name_ar) ORDER BY p.full_name_ar,m.id) FROM lub.organization_memberships m JOIN lub.student_profiles p ON p.user_id=m.user_id JOIN lub.users u ON u.id=m.user_id WHERE lub.is_student_account(m.user_id) AND m.organization_id=org AND m.status_code='Active' AND m.start_date<=current_date AND (m.end_date IS NULL OR m.end_date>current_date) AND u.status_code='Active'),'[]'::jsonb),
  'committees',coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'name',c.name) ORDER BY c.name,c.id) FROM lub.committees c WHERE c.organization_id=org AND c.status_code='Active'),'[]'::jsonb),
  'grants',coalesce((SELECT jsonb_agg(jsonb_build_object('id',g.id,'member',p.full_name_ar,'code',g.permission_code,'committee',c.name,'ends',g.end_at) ORDER BY p.full_name_ar,g.permission_code) FROM lub.permission_grants g JOIN lub.organization_memberships m ON m.id=g.organization_membership_id JOIN lub.student_profiles p ON p.user_id=m.user_id LEFT JOIN lub.committees c ON c.id=g.committee_id WHERE lub.is_student_account(m.user_id) AND g.organization_id=org AND g.permission_code<>'PERMISSIONS_GRANT' AND g.start_at<=statement_timestamp() AND (g.end_at IS NULL OR g.end_at>statement_timestamp())),'[]'::jsonb)
 );
END; $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.hour_grants(org uuid,skip int DEFAULT 0) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(g),'[]') FROM (SELECT g.id,p.full_name_ar as name,g.permission_code,g.committee_id,g.end_at FROM lub.permission_grants g JOIN lub.organization_memberships m ON m.id=g.organization_membership_id JOIN lub.student_profiles p ON p.user_id=m.user_id WHERE lub.is_student_account(m.user_id) AND g.organization_id=org AND lub.has_org_permission(org,'PERMISSIONS_GRANT') AND g.permission_code IN ('HOURS_APPROVE','HOURS_MANUAL_ADD','HOUR_RULES_MANAGE','RENEWALS_MANAGE') AND g.start_at<=statement_timestamp() AND (g.end_at IS NULL OR g.end_at>statement_timestamp()) ORDER BY p.full_name_ar,g.id LIMIT 26 OFFSET greatest(0,least(skip,250000))) g;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.report_grants(org uuid,skip int DEFAULT 0) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(x),'[]') FROM(SELECT g.id,p.full_name_ar AS name,g.committee_id,g.end_at FROM lub.permission_grants g JOIN lub.organization_memberships m ON m.id=g.organization_membership_id JOIN lub.student_profiles p ON p.user_id=m.user_id WHERE lub.is_student_account(m.user_id) AND g.organization_id=org AND g.permission_code='REPORTS_GENERATE' AND g.start_at<=statement_timestamp() AND (g.end_at IS NULL OR g.end_at>statement_timestamp()) AND lub.has_org_permission(org,'PERMISSIONS_GRANT') ORDER BY g.start_at DESC,g.id LIMIT 26 OFFSET greatest(0,least(skip,250000))) x;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.event_grants(org uuid,skip int DEFAULT 0) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT coalesce(jsonb_agg(x),'[]') FROM(SELECT g.id,p.full_name_ar AS name,g.permission_code,g.end_at FROM lub.permission_grants g JOIN lub.organization_memberships m ON m.id=g.organization_membership_id JOIN lub.student_profiles p ON p.user_id=m.user_id WHERE lub.is_student_account(m.user_id) AND g.organization_id=org AND g.permission_code IN ('EVENTS_MANAGE','EVENT_ATTENDANCE_MANAGE','EVENT_CONTRIBUTIONS_MANAGE') AND g.start_at<=statement_timestamp() AND (g.end_at IS NULL OR g.end_at>statement_timestamp()) AND lub.has_org_permission(org,'PERMISSIONS_GRANT') ORDER BY g.start_at DESC,g.id LIMIT 26 OFFSET greatest(0,least(skip,250000))) x; $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.public_member_count(target_org uuid) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT count(m.id)::integer
  FROM lub.organizations o
  LEFT JOIN lub.organization_memberships m ON m.organization_id = o.id AND m.status_code = 'Active'
    AND m.start_date <= current_date AND (m.end_date IS NULL OR m.end_date > current_date)
  LEFT JOIN lub.users u ON u.id = m.user_id AND u.status_code = 'Active'
  WHERE lub.is_student_account(m.user_id) AND o.id=target_org AND o.status_code = 'Active' AND u.id IS NOT NULL
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.public_leadership(target_org uuid) RETURNS TABLE(full_name text, role_code text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p.full_name_ar::text, r.role_code::text FROM lub.role_assignments r
  JOIN lub.organization_memberships m ON m.id = r.organization_membership_id
  JOIN lub.users u ON u.id = m.user_id JOIN lub.student_profiles p ON p.user_id = u.id
  JOIN lub.organizations o ON o.id = m.organization_id
  WHERE lub.is_student_account(m.user_id) AND o.id=target_org AND (o.show_leadership_publicly OR lub.is_super_admin() OR lub.has_org_permission(target_org,'MEMBERS_VIEW'))
    AND u.status_code = 'Active' AND m.status_code = 'Active' AND m.start_date <= current_date
    AND (m.end_date IS NULL OR m.end_date > current_date) AND r.role_code IN ('OL','OD')
    AND r.start_date <= current_date AND (r.end_date IS NULL OR r.end_date > current_date)
  ORDER BY CASE WHEN r.role_code = 'OL' THEN 0 ELSE 1 END, p.full_name_ar;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.public_committee_leader(target_org uuid, target_committee uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p.full_name_ar::text
  FROM lub.committees c
  JOIN lub.organizations o ON o.id = c.organization_id
  JOIN lub.role_assignments r ON r.organization_id = c.organization_id AND r.committee_id = c.id
  JOIN lub.organization_memberships m ON m.id = r.organization_membership_id AND m.organization_id = r.organization_id
  JOIN lub.users u ON u.id = m.user_id
  JOIN lub.student_profiles p ON p.user_id = u.id
  WHERE lub.is_student_account(m.user_id) AND o.id=target_org AND c.id = target_committee
    AND o.status_code = 'Active' AND o.show_leadership_publicly
    AND c.is_public AND c.status_code = 'Active'
    AND u.status_code = 'Active' AND m.status_code = 'Active'
    AND m.start_date <= current_date AND (m.end_date IS NULL OR m.end_date > current_date)
    AND r.role_code = 'CL' AND r.start_date <= current_date AND (r.end_date IS NULL OR r.end_date > current_date)
  ORDER BY r.start_date DESC, r.id DESC LIMIT 1
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.application_profiles(target_org uuid) RETURNS TABLE(application_id uuid,full_name text,major text,level text,university_lookup text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT a.id,p.full_name_ar::text,p.major_name::text,p.academic_level::text,p.university_id_lookup_hash::text FROM lub.membership_applications a JOIN lub.registration_rounds r ON r.id=a.registration_round_id JOIN lub.student_profiles p ON p.user_id=a.applicant_user_id WHERE lub.is_student_account(a.applicant_user_id) AND r.organization_id=target_org AND lub.can_read_application(a.id);
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.round_application_count(target uuid) RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT CASE WHEN EXISTS(SELECT 1 FROM lub.registration_rounds r WHERE r.id=target AND lub.has_org_permission(r.organization_id,'REGISTRATION_ROUNDS_MANAGE')) THEN (SELECT count(*)::int FROM lub.membership_applications WHERE lub.is_student_account(applicant_user_id) AND registration_round_id=target) ELSE 0 END; $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.hour_owner_name(target uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT p.full_name_ar FROM lub.hour_records h JOIN lub.organization_memberships m ON m.id=h.organization_membership_id JOIN lub.student_profiles p ON p.user_id=m.user_id WHERE lub.is_student_membership(h.organization_membership_id) AND h.id=target AND (lub.owns_membership(m.id) OR lub.can_approve_hours(h.organization_id,h.committee_id) OR lub.has_org_permission(h.organization_id,'HOURS_MANUAL_ADD',h.committee_id));
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.hour_record_context(target uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$

 SELECT jsonb_build_object('major',p.major_name,'level',p.academic_level,'committee_name',c.name,'added_by',a.full_name_ar) FROM lub.hour_records h

 JOIN lub.organization_memberships m ON m.id=h.organization_membership_id JOIN lub.student_profiles p ON p.user_id=m.user_id

 LEFT JOIN lub.committees c ON c.id=h.committee_id LEFT JOIN lub.student_profiles a ON a.user_id=h.requested_by_user_id

 WHERE lub.is_student_membership(h.organization_membership_id) AND h.id=target AND (lub.owns_membership(m.id) OR lub.can_approve_hours(h.organization_id,h.committee_id) OR lub.has_org_permission(h.organization_id,'HOURS_MANUAL_ADD',h.committee_id));

$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.hour_import_candidates(org uuid) RETURNS TABLE(id uuid,name text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT p.id,s.full_name_ar::text FROM lub.task_participants p JOIN lub.tasks t ON t.id=p.task_id JOIN lub.student_profiles s ON s.user_id=p.user_id WHERE lub.is_student_account(p.user_id) AND t.organization_id=org AND p.status_code='Approved' AND lub.can_approve_hours(org,t.committee_id) AND NOT EXISTS(SELECT 1 FROM lub.hour_records h WHERE h.task_participant_id=p.id) ORDER BY p.closed_at,p.id LIMIT 25;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.export_hours_csv(org uuid, committee uuid, term uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE organization_name text; scope_name text; period_label text; record_count integer; total text; table_rows text; content text;
BEGIN
 IF NOT(lub.has_org_permission(org,'REPORTS_GENERATE') OR (committee IS NOT NULL AND lub.has_org_permission(org,'REPORTS_GENERATE',committee)))
   OR NOT EXISTS(SELECT 1 FROM lub.student_profiles WHERE user_id=auth.uid()) THEN
  RAISE EXCEPTION 'Hours export permission required' USING ERRCODE='42501';
 END IF;
 IF committee IS NOT NULL AND NOT EXISTS(SELECT 1 FROM lub.committees WHERE id=committee AND organization_id=org AND status_code='Active') THEN
  RAISE EXCEPTION 'Invalid committee';
 END IF;
 SELECT name_ar INTO organization_name FROM lub.organizations WHERE id=org;
 IF organization_name IS NULL THEN RAISE EXCEPTION 'Organization unavailable' USING ERRCODE='42501'; END IF;
 scope_name:='الجهة بالكامل';
 IF committee IS NOT NULL THEN SELECT name INTO scope_name FROM lub.committees WHERE id=committee; END IF;
 period_label:='كل التاريخ';
 IF term IS NOT NULL THEN
  SELECT name_ar||' · '||academic_year INTO period_label FROM lub.academic_terms WHERE id=term;
  IF period_label IS NULL THEN RAISE EXCEPTION 'Unknown academic term'; END IF;
 END IF;
 WITH selected AS MATERIALIZED(
  SELECT h.id,h.organization_membership_id,h.hours,h.activity_date,p.full_name_ar AS name
  FROM lub.hour_records h
  JOIN lub.organization_memberships m ON m.id=h.organization_membership_id
  JOIN lub.student_profiles p ON p.user_id=m.user_id
  WHERE lub.is_student_membership(h.organization_membership_id) AND h.organization_id=org AND h.status_code='Approved'
    AND (committee IS NULL OR h.committee_id=committee)
    AND (term IS NULL OR h.academic_term_id=term)
  ORDER BY h.activity_date,h.id LIMIT 5001
 ), grouped AS(
  SELECT organization_membership_id,name,sum(hours)::text AS hours,count(*)::int AS records,
    min(activity_date)::text AS first_date,max(activity_date)::text AS last_date
  FROM selected GROUP BY organization_membership_id,name
 )
 SELECT (SELECT count(*)::int FROM selected),
   coalesce((SELECT sum(hours)::text FROM selected),'0'),
   coalesce((SELECT string_agg(
     lub.export_csv(organization_name)||','||lub.export_csv(scope_name)||','||lub.export_csv(period_label)||','||
     lub.export_csv(g.name)||','||lub.export_csv(g.hours)||','||lub.export_csv(g.records::text)||','||
     lub.export_csv(g.first_date)||','||lub.export_csv(g.last_date),chr(13)||chr(10)
     ORDER BY g.name,g.organization_membership_id) FROM grouped g),'')
 INTO record_count,total,table_rows;
 IF record_count>5000 THEN RAISE EXCEPTION 'Export too large; select a term'; END IF;
 content:='"الجهة","النطاق","الفترة","الاسم","الساعات المعتمدة","عدد السجلات","أول نشاط","آخر نشاط"'||chr(13)||chr(10)||
   table_rows||chr(13)||chr(10)||lub.export_csv(organization_name)||','||lub.export_csv(scope_name)||','||
   lub.export_csv(period_label)||',"الإجمالي",'||lub.export_csv(total)||','||lub.export_csv(record_count::text)||',"",""'||chr(13)||chr(10);
 INSERT INTO lub.audit_log(actor_user_id,action_code,entity_type,entity_id,organization_id)
 VALUES(auth.uid(),'HOURS_CSV_EXPORTED','hours_export',org,org);
 RETURN content;
END; $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.export_hours_csv(org uuid, committee uuid, term uuid,status text,query text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE organization_name text; scope_name text; period_label text; record_count integer; total text; table_rows text; content text;
BEGIN
 IF NOT(lub.has_org_permission(org,'REPORTS_GENERATE') OR (committee IS NOT NULL AND lub.has_org_permission(org,'REPORTS_GENERATE',committee)))
   OR NOT EXISTS(SELECT 1 FROM lub.student_profiles WHERE user_id=auth.uid()) THEN
  RAISE EXCEPTION 'Hours export permission required' USING ERRCODE='42501';
 END IF;
 IF status IS NOT NULL AND status NOT IN ('Approved','Pending','Rejected') THEN RAISE EXCEPTION 'Invalid status'; END IF;
 IF length(query)>120 THEN RAISE EXCEPTION 'Invalid search'; END IF;
 IF committee IS NOT NULL AND NOT EXISTS(SELECT 1 FROM lub.committees WHERE id=committee AND organization_id=org AND status_code='Active') THEN
  RAISE EXCEPTION 'Invalid committee';
 END IF;
 SELECT name_ar INTO organization_name FROM lub.organizations WHERE id=org;
 IF organization_name IS NULL THEN RAISE EXCEPTION 'Organization unavailable' USING ERRCODE='42501'; END IF;
 scope_name:='الجهة بالكامل';
 IF committee IS NOT NULL THEN SELECT name INTO scope_name FROM lub.committees WHERE id=committee; END IF;
 period_label:='كل التاريخ';
 IF term IS NOT NULL THEN
  SELECT name_ar||' · '||academic_year INTO period_label FROM lub.academic_terms WHERE id=term;
  IF period_label IS NULL THEN RAISE EXCEPTION 'Unknown academic term'; END IF;
 END IF;
 WITH selected AS MATERIALIZED(
  SELECT h.id,h.organization_membership_id,h.hours,h.activity_date,p.full_name_ar AS name
  FROM lub.hour_records h
  JOIN lub.organization_memberships m ON m.id=h.organization_membership_id
  JOIN lub.student_profiles p ON p.user_id=m.user_id
  WHERE lub.is_student_membership(h.organization_membership_id) AND h.organization_id=org AND (status IS NULL OR h.status_code=status) AND (query='' OR position(lower(query) in lower(p.full_name_ar))>0)
    AND (committee IS NULL OR h.committee_id=committee)
    AND (term IS NULL OR h.academic_term_id=term)
  ORDER BY h.activity_date,h.id LIMIT 5001
 ), grouped AS(
  SELECT organization_membership_id,name,sum(hours)::text AS hours,count(*)::int AS records,
    min(activity_date)::text AS first_date,max(activity_date)::text AS last_date
  FROM selected GROUP BY organization_membership_id,name
 )
 SELECT (SELECT count(*)::int FROM selected),
   coalesce((SELECT sum(hours)::text FROM selected),'0'),
   coalesce((SELECT string_agg(
     lub.export_csv(organization_name)||','||lub.export_csv(scope_name)||','||lub.export_csv(period_label)||','||
     lub.export_csv(g.name)||','||lub.export_csv(g.hours)||','||lub.export_csv(g.records::text)||','||
     lub.export_csv(g.first_date)||','||lub.export_csv(g.last_date),chr(13)||chr(10)
     ORDER BY g.name,g.organization_membership_id) FROM grouped g),'')
 INTO record_count,total,table_rows;
 IF record_count>5000 THEN RAISE EXCEPTION 'Export too large; select a term'; END IF;
 content:='"الجهة","النطاق","الفترة","الاسم","الساعات","عدد السجلات","أول نشاط","آخر نشاط"'||chr(13)||chr(10)||
   table_rows||chr(13)||chr(10)||lub.export_csv(organization_name)||','||lub.export_csv(scope_name)||','||
   lub.export_csv(period_label)||',"الإجمالي",'||lub.export_csv(total)||','||lub.export_csv(record_count::text)||',"",""'||chr(13)||chr(10);
 INSERT INTO lub.audit_log(actor_user_id,action_code,entity_type,entity_id,organization_id)
 VALUES(auth.uid(),'HOURS_CSV_EXPORTED','hours_export',org,org);
 RETURN content;
END; $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.generate_document(org uuid,committee uuid,period text,period_value text,starts date,ends date) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result uuid:=gen_random_uuid();asset uuid:=gen_random_uuid();term uuid;period_label text;org_name text;scope_name text;data jsonb;template jsonb;content text;filename text;table_rows text;
BEGIN
 IF NOT(lub.has_org_permission(org,'REPORTS_GENERATE') OR lub.has_org_permission(org,'REPORTS_GENERATE',committee)) OR NOT EXISTS(SELECT 1 FROM lub.student_profiles WHERE user_id=auth.uid()) THEN RAISE EXCEPTION 'Report permission required' USING ERRCODE='42501'; END IF;
 IF committee IS NOT NULL AND NOT EXISTS(SELECT 1 FROM lub.committees WHERE id=committee AND organization_id=org AND status_code='Active') THEN RAISE EXCEPTION 'Invalid committee'; END IF;
 IF period='Term' THEN
  SELECT id,start_date,end_date,name_ar INTO term,starts,ends,period_label FROM lub.academic_terms WHERE id=period_value::uuid;
  IF term IS NULL THEN RAISE EXCEPTION 'Unknown term'; END IF;
 ELSIF period='Year' THEN
  SELECT min(start_date),max(end_date) INTO starts,ends FROM lub.academic_terms WHERE academic_year=period_value;
  IF starts IS NULL THEN RAISE EXCEPTION 'Unknown year'; END IF;period_label:='السنة الأكاديمية '||period_value;
 ELSIF period='Custom' THEN
  IF starts IS NULL OR ends IS NULL OR ends<starts THEN RAISE EXCEPTION 'Invalid period'; END IF;period_label:=starts::text||' — '||ends::text;
 ELSIF period='All' THEN starts:=NULL;ends:=NULL;period_label:='كل التاريخ';
 ELSE RAISE EXCEPTION 'Invalid period'; END IF;
 SELECT name_ar INTO org_name FROM lub.organizations WHERE id=org;
 SELECT name INTO scope_name FROM lub.committees WHERE id=committee;
 WITH selected AS MATERIALIZED(
  SELECT h.id,h.organization_membership_id,h.hours,h.activity_date,h.academic_term_id,p.full_name_ar AS name
  FROM lub.hour_records h JOIN lub.organization_memberships m ON m.id=h.organization_membership_id JOIN lub.student_profiles p ON p.user_id=m.user_id JOIN lub.academic_terms t ON t.id=h.academic_term_id
  WHERE lub.is_student_membership(h.organization_membership_id) AND h.organization_id=org AND h.status_code='Approved' AND (committee IS NULL OR h.committee_id=committee) AND (starts IS NULL OR h.activity_date BETWEEN starts AND ends) AND (term IS NULL OR h.academic_term_id=term) AND (period<>'Year' OR t.academic_year=period_value)
  ORDER BY h.activity_date,h.id LIMIT 5001
 ), grouped AS(
  SELECT organization_membership_id,name,sum(hours)::text AS hours,count(*)::int AS records,min(activity_date) AS first_date,max(activity_date) AS last_date FROM selected GROUP BY organization_membership_id,name
 )
 SELECT jsonb_build_object('organization',org_name,'scope',coalesce(scope_name,'الجهة بالكامل'),'period',period_label,'periodKind',period,'periodStart',starts,'periodEnd',ends,'total',coalesce((SELECT sum(hours) FROM selected),0)::text,'recordCount',(SELECT count(*) FROM selected),'rows',coalesce((SELECT jsonb_agg(to_jsonb(g) ORDER BY g.name,g.organization_membership_id) FROM grouped g),'[]'::jsonb),'records',coalesce((SELECT jsonb_agg(to_jsonb(s)-'name' ORDER BY s.activity_date,s.id) FROM selected s),'[]'::jsonb)) INTO data;
 IF (data->>'recordCount')::int=0 THEN RAISE EXCEPTION 'No approved hours in period'; END IF;
 IF (data->>'recordCount')::int>5000 THEN RAISE EXCEPTION 'Export too large; split period'; END IF;
 template:=jsonb_build_object('version',1,'title','تقرير الساعات المعتمدة','footer','تقرير داخلي من الساعات المعتمدة وقت الإصدار. موافقة الجامعة والتوقيع الخارجي خارج النظام.','language','ar','direction','rtl','columns',jsonb_build_array('الاسم','الساعات المعتمدة','عدد السجلات','أول نشاط','آخر نشاط'));
 SELECT string_agg(lub.export_csv(org_name)||','||lub.export_csv(data->>'scope')||','||lub.export_csv(period_label)||','||lub.export_csv(r->>'name')||','||lub.export_csv(r->>'hours')||','||lub.export_csv(r->>'records')||','||lub.export_csv(r->>'first_date')||','||lub.export_csv(r->>'last_date'),chr(13)||chr(10) ORDER BY n) INTO table_rows FROM jsonb_array_elements(data->'rows') WITH ORDINALITY x(r,n);
 content:=chr(65279)||'"الجهة","النطاق","الفترة","الاسم","الساعات المعتمدة","عدد السجلات","أول نشاط","آخر نشاط"'||chr(13)||chr(10)||table_rows||chr(13)||chr(10)||lub.export_csv(org_name)||','||lub.export_csv(data->>'scope')||','||lub.export_csv(period_label)||',"الإجمالي",'||lub.export_csv(data->>'total')||','||lub.export_csv(data->>'recordCount')||',"",""'||chr(13)||chr(10);
 filename:='report-'||result||'.csv';
 INSERT INTO lub.assets(id,uploaded_by_user_id,storage_key,original_name,mime_type,size_bytes,checksum_sha256,body) VALUES(asset,auth.uid(),'documents/'||filename,filename,'text/csv',octet_length(content),encode(sha256(convert_to(content,'UTF8')),'hex'),content);
 INSERT INTO lub.generated_documents(id,organization_id,committee_id,document_type_code,academic_term_id,period_start,period_end,asset_id,data_snapshot_json,template_snapshot_json,generated_by_user_id) VALUES(result,org,committee,'Hours_Report',term,starts,ends,asset,data,template,auth.uid());
 PERFORM lub.document_audit(result,org,'DOCUMENT_GENERATED');RETURN result;
END; $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.add_hours(member uuid,committee uuid,term uuid,amount numeric,day date,reason text,self_report boolean,confirm_duplicate boolean) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$

DECLARE m lub.organization_memberships; result uuid; approved boolean;

BEGIN

 SELECT * INTO m FROM lub.organization_memberships WHERE id=member FOR UPDATE;

 IF NOT lub.is_student_membership(member) OR m.id IS NULL OR m.status_code<>'Active' OR m.start_date>current_date OR (m.end_date IS NOT NULL AND m.end_date<=current_date) OR NOT EXISTS(SELECT 1 FROM lub.users WHERE id=m.user_id AND status_code='Active') THEN RAISE EXCEPTION 'Active member required'; END IF;

 IF NOT EXISTS(SELECT 1 FROM lub.academic_terms WHERE id=term AND day BETWEEN start_date AND end_date) OR day> (statement_timestamp() AT TIME ZONE 'Asia/Riyadh')::date OR day<m.start_date THEN RAISE EXCEPTION 'Invalid activity date'; END IF;

 IF committee IS NOT NULL AND NOT EXISTS(SELECT 1 FROM lub.committee_memberships cm JOIN lub.committees c ON c.id=cm.committee_id WHERE cm.organization_membership_id=member AND cm.committee_id=committee AND c.organization_id=m.organization_id AND c.status_code='Active' AND cm.status_code='Active' AND cm.start_date<=current_date AND (cm.end_date IS NULL OR cm.end_date>current_date)) THEN RAISE EXCEPTION 'Committee mismatch'; END IF;

 IF self_report THEN

  IF NOT lub.owns_membership(member) OR NOT lub.task_scope_member(m.organization_id,committee) OR NOT EXISTS(SELECT 1 FROM lub.organizations WHERE id=m.organization_id AND self_report_hours_enabled) THEN RAISE EXCEPTION 'Self report unavailable' USING ERRCODE='42501'; END IF;

  approved:=false;

 ELSE

  IF NOT lub.has_org_permission(m.organization_id,'HOURS_MANUAL_ADD',committee) THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;

  approved:=lub.can_approve_hours(m.organization_id,committee);

 END IF;

 IF amount IS NULL OR amount<0 OR amount>1000 OR amount::text IN ('NaN','Infinity','-Infinity') OR amount<>round(amount,2) THEN RAISE EXCEPTION 'Invalid amount'; END IF;

 IF NOT confirm_duplicate AND EXISTS(SELECT 1 FROM lub.hour_records h WHERE h.organization_membership_id=member AND h.activity_date=day AND h.hours=amount AND h.status_code<>'Voided') THEN RAISE EXCEPTION 'Duplicate hours' USING ERRCODE='P0003'; END IF;

 INSERT INTO lub.hour_records(organization_id,organization_membership_id,committee_id,academic_term_id,source_code,hours,activity_date,description,status_code,requested_by_user_id,reviewed_by_user_id,reviewed_at,review_note)

 VALUES(m.organization_id,member,committee,term,CASE WHEN self_report THEN 'SELF_REPORTED' ELSE 'MANUAL' END,amount,day,trim(reason),CASE WHEN approved THEN 'Approved' ELSE 'Pending' END,auth.uid(),CASE WHEN approved THEN auth.uid() END,CASE WHEN approved THEN now() END,CASE WHEN approved THEN trim(reason) END) RETURNING id INTO result;

 RETURN result;

END; $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.adjust_hours(target uuid,delta numeric,expected numeric,reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$

DECLARE h lub.hour_records; actor text;

BEGIN

 SELECT * INTO h FROM lub.hour_records WHERE id=target FOR UPDATE;

 IF NOT lub.is_student_membership(h.organization_membership_id) OR h.id IS NULL OR NOT lub.can_approve_hours(h.organization_id,h.committee_id) THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;

 IF h.status_code NOT IN ('Pending','Approved') OR h.hours IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Record changed'; END IF;

 IF delta IS NULL OR delta=0 OR delta::text IN ('NaN','Infinity','-Infinity') OR delta<>round(delta,2) OR h.hours+delta<0 OR h.hours+delta>1000 OR reason IS NULL OR length(reason)>1000 THEN RAISE EXCEPTION 'Invalid adjustment'; END IF;

 SELECT full_name_ar INTO actor FROM lub.student_profiles WHERE user_id=auth.uid();

 INSERT INTO lub.hour_adjustments(hour_record_id,before_hours,after_hours,actor_user_id,actor_name,note,transaction_id) VALUES(h.id,h.hours,h.hours+delta,auth.uid(),coalesce(actor,'عضو'),trim(reason),pg_catalog.pg_current_xact_id()::text);

 UPDATE lub.hour_records SET hours=h.hours+delta,updated_at=clock_timestamp() WHERE id=h.id;

END; $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.award_task_hours(target uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p lub.task_participants; t lub.tasks; s lub.task_submissions; term uuid; day date; amount numeric; result uuid; approved boolean;
BEGIN
 SELECT * INTO p FROM lub.task_participants WHERE id=target FOR UPDATE;SELECT * INTO t FROM lub.tasks WHERE id=p.task_id;
 IF NOT lub.is_student_account(p.user_id) THEN RETURN NULL;END IF;
 IF p.id IS NULL OR p.status_code<>'Approved' OR NOT (lub.has_org_permission(t.organization_id,'TASKS_MANAGE',t.committee_id) OR lub.can_approve_hours(t.organization_id,t.committee_id)) THEN RAISE EXCEPTION 'Approved participation required' USING ERRCODE='42501'; END IF;
 SELECT id INTO result FROM lub.hour_records WHERE task_participant_id=target;IF result IS NOT NULL THEN RETURN result; END IF;
 SELECT * INTO s FROM lub.task_submissions WHERE task_participant_id=target AND status_code='Approved' ORDER BY revision_number DESC LIMIT 1;
 day:=(p.closed_at AT TIME ZONE 'Asia/Riyadh')::date;SELECT id INTO term FROM lub.academic_terms WHERE day BETWEEN start_date AND end_date;
 IF term IS NULL OR s.id IS NULL THEN RAISE EXCEPTION 'Define academic term before approval' USING ERRCODE='P0002'; END IF;
 SELECT coalesce(p.approved_hours_override,(snapshot_json->>'default_hours')::numeric) INTO amount FROM lub.task_revisions WHERE id=s.task_revision_id;
 approved:=lub.can_approve_hours(t.organization_id,t.committee_id);
 INSERT INTO lub.hour_records(organization_id,organization_membership_id,committee_id,academic_term_id,source_code,task_participant_id,hours,activity_date,description,status_code,requested_by_user_id,reviewed_by_user_id,reviewed_at,review_note)
 VALUES(t.organization_id,p.organization_membership_id,t.committee_id,term,'TASK',target,amount,day,'مشاركة معتمدة في مهمة',CASE WHEN approved THEN 'Approved' ELSE 'Pending' END,auth.uid(),CASE WHEN approved THEN auth.uid() END,CASE WHEN approved THEN now() END,CASE WHEN approved THEN '' END) RETURNING id INTO result;
 RETURN result;
END; $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.change_event_status(target uuid,status text,expected int) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e lub.events; term uuid; day date;
BEGIN
 SELECT * INTO e FROM lub.events WHERE id=target FOR UPDATE;
 IF e.id IS NULL OR NOT lub.can_operate_event(target) OR e.revision IS DISTINCT FROM expected OR NOT ((e.status_code='Draft' AND status IN ('Published','Cancelled')) OR (e.status_code='Published' AND status IN ('Draft','Completed','Cancelled'))) THEN RAISE EXCEPTION 'Invalid transition'; END IF;
 IF status='Published' AND (length(trim(e.title))<2 OR e.starts_at IS NULL OR e.ends_at IS NULL OR e.registration_opens_at IS NULL OR e.registration_closes_at IS NULL OR e.ends_at<=e.starts_at OR e.registration_closes_at<=e.registration_opens_at OR e.registration_closes_at>e.starts_at OR (e.location_type_code<>'Online' AND coalesce(length(trim(e.location_text)),0)=0) OR (e.location_type_code<>'In_Person' AND coalesce(e.online_url,'')!~'^https://[^[:space:]@]+$')) THEN RAISE EXCEPTION 'EVENT_REQUIRED_FIELDS'; END IF;
 IF status='Published' AND e.registration_closes_at<=statement_timestamp() THEN RAISE EXCEPTION 'Registration already closed'; END IF;
 IF status='Completed' THEN
  IF e.ends_at>statement_timestamp() OR EXISTS(SELECT 1 FROM lub.event_registrations r LEFT JOIN lub.event_attendance a ON a.event_registration_id=r.id WHERE lub.is_student_account(r.user_id) AND r.event_id=target AND r.status_code='Registered' AND coalesce(a.status_code,'Pending')='Pending') THEN RAISE EXCEPTION 'Review attendance after event'; END IF;
  day:=(e.ends_at AT TIME ZONE 'Asia/Riyadh')::date; SELECT id INTO term FROM lub.academic_terms WHERE start_date<=day AND end_date>=day;
  IF e.attendance_hours>0 AND EXISTS(SELECT 1 FROM lub.event_registrations r JOIN lub.event_attendance a ON a.event_registration_id=r.id JOIN lub.organization_memberships m ON m.user_id=r.user_id AND m.organization_id=e.organization_id AND m.start_date<=day AND (m.end_date IS NULL OR m.end_date>day) WHERE lub.is_student_account(r.user_id) AND r.event_id=target AND r.status_code='Registered' AND a.status_code='Present') THEN
   IF term IS NULL OR NOT lub.has_org_permission(e.organization_id,'HOURS_APPROVE') THEN RAISE EXCEPTION 'Term and hours approval required'; END IF;
   INSERT INTO lub.hour_records(organization_id,organization_membership_id,academic_term_id,source_code,event_attendance_id,hours,activity_date,description,status_code,requested_by_user_id,reviewed_by_user_id,reviewed_at,review_note)
   SELECT e.organization_id,m.id,term,'EVENT',a.id,e.attendance_hours,day,e.title,'Approved',auth.uid(),auth.uid(),now(),'إكمال الفعالية وتثبيت الحضور' FROM lub.event_registrations r JOIN lub.event_attendance a ON a.event_registration_id=r.id JOIN lub.organization_memberships m ON m.user_id=r.user_id AND m.organization_id=e.organization_id AND m.start_date<=day AND (m.end_date IS NULL OR m.end_date>day) WHERE lub.is_student_account(r.user_id) AND r.event_id=target AND r.status_code='Registered' AND a.status_code='Present';
  END IF;
 END IF;
 UPDATE lub.events SET status_code=status,revision=revision+1,published_at=CASE WHEN status='Published' THEN now() ELSE published_at END,completed_at=CASE WHEN status='Completed' THEN now() END,cancelled_at=CASE WHEN status='Cancelled' THEN now() END,updated_at=now() WHERE id=target;
 PERFORM lub.event_notify(target,'EVENT_'||status);PERFORM lub.task_audit(target,e.organization_id,'EVENT_'||status);
END; $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.event_remaining(target uuid) RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT CASE WHEN e.capacity IS NULL THEN NULL ELSE greatest(0,e.capacity-(SELECT count(*)::int FROM lub.event_registrations r WHERE r.event_id=e.id AND lub.is_student_account(r.user_id) AND r.status_code='Registered' AND r.review_status_code<>'Rejected')) END FROM lub.events e WHERE e.id=target AND (e.published_at IS NOT NULL OR lub.has_event_access(e.organization_id)); $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.register_event(target uuid,version uuid,input jsonb,expected int) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e lub.events; r lub.event_registrations; v lub.form_versions; f lub.form_responses; cleaned jsonb; response uuid; result uuid; field jsonb;
BEGIN
 SELECT * INTO e FROM lub.events WHERE id=target FOR UPDATE;
 IF EXISTS(SELECT 1 FROM lub.global_role_assignments g WHERE g.user_id=auth.uid() AND g.role_code='SA' AND g.start_at<=now() AND (g.end_at IS NULL OR g.end_at>now())) OR e.id IS NULL OR e.status_code<>'Published' OR statement_timestamp()<e.registration_opens_at OR statement_timestamp()>=e.registration_closes_at OR NOT EXISTS(SELECT 1 FROM lub.organizations WHERE id=e.organization_id AND status_code='Active') OR NOT EXISTS(SELECT 1 FROM lub.users u JOIN lub.student_profiles p ON p.user_id=u.id WHERE u.id=auth.uid() AND u.status_code='Active' AND u.email_verified_at IS NOT NULL) THEN RAISE EXCEPTION 'Open event and active profile required'; END IF;
 SELECT * INTO r FROM lub.event_registrations WHERE event_id=target AND user_id=auth.uid();
 IF r.status_code='Cancelled' OR r.review_status_code='Rejected' THEN RAISE EXCEPTION 'Registration cancelled'; END IF;
 IF r.id IS NULL AND e.capacity IS NOT NULL AND (SELECT count(*) FROM lub.event_registrations WHERE lub.is_student_account(user_id) AND event_id=target AND status_code='Registered' AND review_status_code<>'Rejected')>=e.capacity THEN RAISE EXCEPTION 'Event full'; END IF;
 IF e.registration_form_template_id IS NOT NULL THEN
  IF r.form_response_id IS NOT NULL THEN SELECT * INTO f FROM lub.form_responses WHERE id=r.form_response_id; IF f.form_version_id IS DISTINCT FROM version OR f.revision IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Refresh response'; END IF; SELECT * INTO v FROM lub.form_versions WHERE id=f.form_version_id;
  ELSE SELECT * INTO v FROM lub.form_versions WHERE form_template_id=e.registration_form_template_id AND status_code='Published' ORDER BY version_number DESC LIMIT 1; IF v.id IS DISTINCT FROM version THEN RAISE EXCEPTION 'Refresh form'; END IF; END IF;
  cleaned:=lub.validate_form_answers(v.definition,input); PERFORM lub.form_committee_answer(v.definition,cleaned,e.organization_id);
  IF f.id IS NULL THEN INSERT INTO lub.form_responses(form_version_id,respondent_user_id,answers) VALUES(v.id,auth.uid(),cleaned) RETURNING id INTO response;
  ELSE UPDATE lub.form_responses SET answers=cleaned,revision=revision+1,updated_at=now() WHERE id=f.id; response:=f.id; DELETE FROM lub.form_response_assets WHERE form_response_id=f.id; END IF;
  FOR field IN SELECT x FROM jsonb_array_elements(v.definition->'sections') s CROSS JOIN LATERAL jsonb_array_elements(s->'fields') x WHERE x->>'type'='File' LOOP IF cleaned ? (field->>'id') THEN INSERT INTO lub.form_response_assets(form_response_id,asset_id,field_id) VALUES(response,(cleaned->>(field->>'id'))::uuid,(field->>'id')::uuid); END IF; END LOOP;
 ELSE IF version IS NOT NULL OR input IS DISTINCT FROM '{}'::jsonb THEN RAISE EXCEPTION 'Unexpected answers'; END IF; END IF;
 IF r.id IS NULL THEN INSERT INTO lub.event_registrations(event_id,user_id,form_response_id,review_status_code) VALUES(target,auth.uid(),response,CASE WHEN e.requires_approval THEN 'Pending' ELSE 'Accepted' END) RETURNING id INTO result; INSERT INTO lub.event_registration_history(event_registration_id,status_code,actor_user_id) SELECT id,review_status_code,auth.uid() FROM lub.event_registrations WHERE id=result; ELSE result:=r.id; END IF;
 PERFORM lub.workflow_notify(auth.uid(),'EVENT_REGISTRATION_CHANGED','/events/'||target); PERFORM lub.task_audit(result,e.organization_id,'EVENT_REGISTERED');RETURN result;
END; $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.save_event(target uuid,org uuid,title text,description text,location_type text,location text,url text,starts timestamptz,ends timestamptz,opens timestamptz,closes timestamptz,capacity int,template uuid,hours numeric,expected int) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e lub.events; result uuid;
BEGIN
 IF NOT lub.has_org_permission(org,'EVENTS_MANAGE') OR NOT EXISTS(SELECT 1 FROM lub.student_profiles WHERE user_id=auth.uid()) THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 IF (starts IS NOT NULL AND ends IS NOT NULL AND ends<=starts) OR (opens IS NOT NULL AND closes IS NOT NULL AND closes<=opens) OR (closes IS NOT NULL AND starts IS NOT NULL AND closes>starts) OR hours IS NULL OR hours<0 OR hours>1000 OR hours<>round(hours,2) OR location_type NOT IN ('In_Person','Online','Hybrid') OR (url IS NOT NULL AND url!~'^https://[^[:space:]@]+$') THEN RAISE EXCEPTION 'Invalid event'; END IF;
 IF template IS NOT NULL AND NOT EXISTS(SELECT 1 FROM lub.form_templates t JOIN lub.form_versions v ON v.form_template_id=t.id WHERE t.id=template AND (t.organization_id=org OR t.is_system_template) AND v.status_code='Published') THEN RAISE EXCEPTION 'Published form required'; END IF;
 IF target IS NULL THEN
 INSERT INTO lub.events(organization_id,created_by_user_id,title,description,location_type_code,location_text,online_url,starts_at,ends_at,registration_opens_at,registration_closes_at,capacity,registration_form_template_id,attendance_hours) VALUES(org,auth.uid(),trim(title),trim(description),location_type,nullif(trim(location),''),nullif(trim(url),''),starts,ends,opens,closes,capacity,template,hours) RETURNING id INTO result;
 ELSE
 SELECT * INTO e FROM lub.events WHERE id=target FOR UPDATE;
 IF e.id IS NULL OR e.organization_id<>org OR e.revision IS DISTINCT FROM expected OR e.status_code NOT IN ('Draft','Published') THEN RAISE EXCEPTION 'Refresh event'; END IF;
 IF e.published_at IS NOT NULL AND (template IS DISTINCT FROM e.registration_form_template_id OR hours IS DISTINCT FROM e.attendance_hours) THEN RAISE EXCEPTION 'Published form and award immutable'; END IF;
 IF capacity IS NOT NULL AND capacity<(SELECT count(*) FROM lub.event_registrations WHERE lub.is_student_account(user_id) AND event_id=target AND status_code='Registered' AND review_status_code<>'Rejected') THEN RAISE EXCEPTION 'Capacity below registrations'; END IF;
 UPDATE lub.events SET title=trim(save_event.title),description=trim(save_event.description),location_type_code=location_type,location_text=nullif(trim(location),''),online_url=nullif(trim(url),''),starts_at=starts,ends_at=ends,registration_opens_at=opens,registration_closes_at=closes,capacity=save_event.capacity,registration_form_template_id=template,attendance_hours=hours,revision=revision+1,updated_at=now() WHERE id=target;
 result:=target; IF e.status_code='Published' THEN PERFORM lub.event_notify(target,'EVENT_CHANGED'); END IF;
 END IF;
 PERFORM lub.task_audit(result,org,'EVENT_SAVED');RETURN result;
END; $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.can_read_registration(target uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT EXISTS(SELECT 1 FROM lub.event_registrations r JOIN lub.events e ON e.id=r.event_id JOIN lub.users u ON u.id=auth.uid() WHERE lub.is_student_account(r.user_id) AND r.id=target AND u.status_code='Active' AND (r.user_id=u.id OR lub.has_event_access(e.organization_id))); $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.set_primary_leader(target_org uuid, candidate_email text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE candidate uuid; membership uuid; current_leader uuid;
BEGIN
  IF NOT lub.is_super_admin() THEN RAISE EXCEPTION 'Super Admin required' USING ERRCODE = '42501'; END IF;
  PERFORM 1 FROM lub.organizations WHERE id = target_org AND status_code = 'Active' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active organization required'; END IF;
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