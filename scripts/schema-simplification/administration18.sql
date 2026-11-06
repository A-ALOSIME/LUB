-- Scoped administrative operations on the simplified storage contract.
CREATE FUNCTION lub.admin_create_organization(request_name text,kind text,request_slug text,description text,goals text,candidate_email text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result uuid;
BEGIN
 IF NOT lub.is_super_admin() THEN RAISE EXCEPTION 'Super Admin required' USING ERRCODE='42501'; END IF;
 IF request_name IS NULL OR kind IS NULL OR request_slug IS NULL OR description IS NULL OR goals IS NULL THEN RAISE EXCEPTION 'Invalid organization'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(lub.arabic_search_key(trim(request_name)),0));
 IF EXISTS(SELECT 1 FROM lub.organizations o WHERE lub.arabic_search_key(o.name_ar)=lub.arabic_search_key(trim(request_name))) THEN RAISE EXCEPTION 'ORGANIZATION_NAME_EXISTS'; END IF;
 INSERT INTO lub.organizations(name_ar,type_code,slug,summary,mission) VALUES(trim(request_name),kind,request_slug,description,goals) RETURNING id INTO result;
 IF nullif(trim(candidate_email),'') IS NOT NULL THEN PERFORM lub.set_primary_leader(result,candidate_email); END IF;
 RETURN result;
END; $$;

CREATE FUNCTION lub.set_primary_leader(target_org uuid,candidate_email text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE candidate uuid; membership uuid;
BEGIN
 IF NOT lub.is_super_admin() THEN RAISE EXCEPTION 'Super Admin required' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM lub.organizations WHERE id=target_org FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Organization required'; END IF;
 -- Lock the candidate so concurrent administrator promotion cannot change its account class midway.
 SELECT u.id INTO candidate FROM lub.users u WHERE u.email=lower(trim(candidate_email)) AND lub.is_student_account(u.id) FOR UPDATE;
 IF candidate IS NULL OR NOT lub.is_student_account(candidate) THEN RAISE EXCEPTION 'Verified onboarded candidate required'; END IF;
 IF EXISTS(SELECT 1 FROM lub.access_assignments a JOIN lub.organization_memberships m ON m.id=a.organization_membership_id
   WHERE a.organization_id=target_org AND a.user_id=candidate AND a.role_code='OL' AND a.end_at IS NULL
    AND a.start_at<=statement_timestamp() AND m.status_code='Active' AND m.start_date<=lub.today_riyadh() AND (m.end_date IS NULL OR m.end_date>lub.today_riyadh())) THEN RETURN; END IF;
 SELECT m.id INTO membership FROM lub.organization_memberships m WHERE m.organization_id=target_org AND m.user_id=candidate AND m.status_code='Active' AND m.end_date IS NULL FOR UPDATE;
 IF membership IS NULL THEN
  INSERT INTO lub.organization_memberships(organization_id,user_id) VALUES(target_org,candidate) RETURNING id INTO membership;
 ELSIF EXISTS(SELECT 1 FROM lub.organization_memberships m WHERE m.id=membership AND m.start_date>lub.today_riyadh()) THEN RAISE EXCEPTION 'Membership not started'; END IF;
 UPDATE lub.access_assignments SET end_at=greatest(clock_timestamp(),start_at+interval '1 microsecond') WHERE organization_id=target_org AND role_code='OL' AND end_at IS NULL;
 INSERT INTO lub.access_assignments(user_id,organization_id,organization_membership_id,role_code,assigned_by_user_id) VALUES(candidate,target_org,membership,'OL',auth.uid());
END; $$;

CREATE FUNCTION lub.remove_primary_leader(target_org uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT lub.is_super_admin() THEN RAISE EXCEPTION 'Super Admin required' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM lub.organizations WHERE id=target_org FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Organization required'; END IF;
 UPDATE lub.access_assignments SET end_at=greatest(clock_timestamp(),start_at+interval '1 microsecond') WHERE organization_id=target_org AND role_code='OL' AND end_at IS NULL;
END; $$;

CREATE FUNCTION lub.set_organization_status(target_org uuid,target_status text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT lub.is_super_admin() THEN RAISE EXCEPTION 'Super Admin required' USING ERRCODE='42501'; END IF;
 IF target_status IS NULL OR target_status NOT IN ('Active','Inactive','Archived') THEN RAISE EXCEPTION 'Invalid status'; END IF;
 UPDATE lub.organizations SET status_code=target_status,archived_at=CASE WHEN target_status='Archived' THEN coalesce(archived_at,now()) END,updated_at=now() WHERE id=target_org;
 IF NOT FOUND THEN RAISE EXCEPTION 'Organization required'; END IF;
END; $$;

CREATE FUNCTION lub.grant_super_admin(candidate_email text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE candidate uuid;
BEGIN
 PERFORM pg_catalog.pg_advisory_xact_lock(727026);
 IF NOT lub.is_super_admin() THEN RAISE EXCEPTION 'Super Admin required' USING ERRCODE='42501'; END IF;
 SELECT u.id INTO candidate FROM lub.users u WHERE u.email=lower(trim(candidate_email)) AND u.status_code='Active' AND u.onboarded_at IS NOT NULL FOR UPDATE;
 IF candidate IS NULL THEN RAISE EXCEPTION 'Verified onboarded candidate required'; END IF;
 IF lub.is_super_admin(candidate) THEN RETURN; END IF;
 -- Expired scheduled roles must not block a new assignment's partial unique index.
 UPDATE lub.access_assignments SET end_at=greatest(clock_timestamp(),start_at+interval '1 microsecond') WHERE user_id=candidate AND role_code='SA' AND end_at IS NULL;
 INSERT INTO lub.access_assignments(user_id,role_code,assigned_by_user_id) VALUES(candidate,'SA',auth.uid());
END; $$;

CREATE FUNCTION lub.end_super_admin(target_user uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM pg_catalog.pg_advisory_xact_lock(727026);
 IF NOT lub.is_super_admin() OR target_user=auth.uid() THEN RAISE EXCEPTION 'Cannot remove own administrator role' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM lub.access_assignments a JOIN lub.users u ON u.id=a.user_id WHERE a.role_code='SA' AND a.user_id<>target_user AND u.status_code='Active' AND a.start_at<=statement_timestamp() AND (a.end_at IS NULL OR a.end_at>statement_timestamp())) THEN RAISE EXCEPTION 'Last active Super Admin cannot be ended'; END IF;
 UPDATE lub.access_assignments SET end_at=greatest(clock_timestamp(),start_at+interval '1 microsecond') WHERE user_id=target_user AND role_code='SA' AND start_at<=statement_timestamp() AND (end_at IS NULL OR end_at>statement_timestamp());
END; $$;

CREATE FUNCTION lub.list_super_admins() RETURNS TABLE(user_id uuid,full_name text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT lub.is_super_admin() THEN RAISE EXCEPTION 'Super Admin required' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT u.id,u.full_name_ar::text FROM lub.users u WHERE lub.is_super_admin(u.id) ORDER BY u.full_name_ar,u.id;
END; $$;
CREATE FUNCTION lub.admin_account_directory() RETURNS TABLE("userId" uuid,"fullName" text,email text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT lub.is_super_admin() THEN RAISE EXCEPTION 'Super Admin required' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT u.id,u.full_name_ar::text,u.email::text FROM lub.users u WHERE lub.is_super_admin(u.id) ORDER BY u.full_name_ar,u.id;
END; $$;
CREATE FUNCTION lub.admin_leader_candidates(search text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT lub.is_super_admin() THEN RAISE EXCEPTION 'Super Admin required' USING ERRCODE='42501'; END IF;
 IF search IS NULL OR length(trim(search)) NOT BETWEEN 3 AND 254 OR lub.arabic_search_key(trim(search))='' THEN RETURN '[]'; END IF;
 RETURN coalesce((SELECT jsonb_agg(x ORDER BY x.email) FROM (SELECT u.full_name_ar AS name,u.email,u.major_name AS major
  FROM lub.users u WHERE lub.is_student_account(u.id) AND (position(lower(trim(search)) IN u.email)>0 OR position(lub.arabic_search_key(trim(search)) IN lub.arabic_search_key(u.full_name_ar))>0)
  ORDER BY u.email LIMIT 8) x),'[]');
END; $$;

CREATE FUNCTION lub.admin_directory_snapshot() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT lub.is_super_admin() THEN RAISE EXCEPTION 'Super Admin required' USING ERRCODE='42501'; END IF;
 RETURN (WITH members AS MATERIALIZED (
  SELECT m.organization_id,count(*)::int total FROM lub.organization_memberships m WHERE m.status_code='Active'
   AND m.start_date<=lub.today_riyadh() AND (m.end_date IS NULL OR m.end_date>lub.today_riyadh()) AND lub.is_student_account(m.user_id) GROUP BY m.organization_id
 ), leaders AS MATERIALIZED (
  SELECT DISTINCT ON(a.organization_id) a.organization_id,u.full_name_ar AS name FROM lub.access_assignments a
   JOIN lub.organization_memberships m ON m.id=a.organization_membership_id JOIN lub.users u ON u.id=a.user_id
  WHERE a.role_code='OL' AND a.start_at<=statement_timestamp() AND (a.end_at IS NULL OR a.end_at>statement_timestamp())
   AND m.status_code='Active' AND m.start_date<=lub.today_riyadh() AND (m.end_date IS NULL OR m.end_date>lub.today_riyadh()) AND lub.is_student_account(u.id)
  ORDER BY a.organization_id,a.start_at DESC,a.id
 ), directory AS MATERIALIZED (
  SELECT o.id,o.slug,o.name_ar AS "nameAr",o.type_code AS "typeCode",o.status_code AS "statusCode",o.logo_url AS "logoUrl",l.name AS "leaderName",coalesce(m.total,0) AS "memberCount"
  FROM lub.organizations o LEFT JOIN members m ON m.organization_id=o.id LEFT JOIN leaders l ON l.organization_id=o.id
 ), requests AS MATERIALIZED (
  SELECT r.id,r.name_ar,r.type_code,r.summary,r.mission,r.interests,r.status_code,r.decision_note,r.created_at,r.decided_at,
   r.logo_webp_base64 IS NOT NULL AS has_logo,u.full_name_ar AS applicant_name,o.slug AS organization_slug
  FROM lub.organization_opening_requests r JOIN lub.users u ON u.id=r.applicant_user_id LEFT JOIN lub.organizations o ON o.id=r.organization_id
 ) SELECT jsonb_build_object('organizations',coalesce((SELECT jsonb_agg(d ORDER BY d."nameAr",d.id) FROM directory d),'[]'),
  'requests',coalesce((SELECT jsonb_agg(r ORDER BY r.created_at DESC,r.id) FROM requests r),'[]'),
  'counts',jsonb_build_object('Active',(SELECT count(*) FROM directory WHERE "statusCode"='Active'),'Inactive',(SELECT count(*) FROM directory WHERE "statusCode"='Inactive'),'Archived',(SELECT count(*) FROM directory WHERE "statusCode"='Archived'),
   'Pending',(SELECT count(*) FROM requests WHERE status_code='Pending'),'Accepted',(SELECT count(*) FROM requests WHERE status_code='Accepted'),'Rejected',(SELECT count(*) FROM requests WHERE status_code='Rejected'))));
END; $$;
CREATE FUNCTION lub.admin_organization_directory(search text,kind text,state text,skip int DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE snapshot jsonb;
BEGIN
 IF search IS NULL OR length(search)>120 OR kind IS NULL OR kind NOT IN ('','Club','Council') OR state IS NULL OR state NOT IN ('','Active','Inactive','Archived') THEN RAISE EXCEPTION 'Invalid filters'; END IF;
 snapshot:=lub.admin_directory_snapshot();
 RETURN (WITH filtered AS MATERIALIZED (SELECT e FROM jsonb_array_elements(snapshot->'organizations') e
  WHERE (kind='' OR e->>'typeCode'=kind) AND (state='' OR e->>'statusCode'=state)
   AND position(lub.arabic_search_key(search) IN lub.arabic_search_key((e->>'nameAr')||' '||(e->>'slug')))>0)
  SELECT jsonb_build_object('total',(SELECT count(*) FROM filtered),'organizations',coalesce((SELECT jsonb_agg(e ORDER BY e->>'nameAr',e->>'id') FROM (SELECT e FROM filtered ORDER BY e->>'nameAr',e->>'id' LIMIT 25 OFFSET greatest(0,least(skip,250000))) page),'[]')));
END; $$;
CREATE FUNCTION lub.admin_organization_identity(target uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 RETURN (SELECT jsonb_build_object('slug',e->>'slug','typeCode',e->>'typeCode','statusCode',e->>'statusCode','leaderName',e->>'leaderName')
  FROM jsonb_array_elements(lub.admin_directory_snapshot()->'organizations') e WHERE e->>'id'=target::text);
END; $$;
CREATE FUNCTION lub.admin_organization_slug_available(candidate text,except_org uuid DEFAULT NULL) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT lub.is_super_admin() THEN RAISE EXCEPTION 'Super Admin required' USING ERRCODE='42501'; END IF;
 RETURN candidate IS NOT NULL AND length(candidate) BETWEEN 1 AND 80 AND candidate~'^[a-z0-9]+(-[a-z0-9]+)*$'
  AND NOT EXISTS(SELECT 1 FROM lub.organizations o WHERE o.slug=candidate AND (except_org IS NULL OR o.id<>except_org));
END; $$;

CREATE INDEX organizations_status_name_idx ON lub.organizations(status_code,name_ar,id);
CREATE INDEX opening_requests_status_created_idx ON lub.organization_opening_requests(status_code,created_at DESC,id);
CREATE INDEX access_assignments_user_scope_idx ON lub.access_assignments(user_id,organization_id,role_code);
CREATE INDEX organization_memberships_user_scope_idx ON lub.organization_memberships(user_id,organization_id,status_code);
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA lub FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lub.admin_create_organization(text,text,text,text,text,text),lub.set_primary_leader(uuid,text),lub.remove_primary_leader(uuid),lub.set_organization_status(uuid,text),
 lub.grant_super_admin(text),lub.end_super_admin(uuid),lub.list_super_admins(),lub.admin_account_directory(),lub.admin_leader_candidates(text),lub.admin_directory_snapshot(),
 lub.admin_organization_directory(text,text,text,int),lub.admin_organization_identity(uuid),lub.admin_organization_slug_available(text,uuid) TO authenticated;

CREATE FUNCTION lub.create_academic_term(year text,code text,name text,starts date,ends date) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result uuid;
BEGIN
 IF NOT lub.is_super_admin() THEN RAISE EXCEPTION 'Administrator required' USING ERRCODE='42501'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(762015);
 IF year IS NULL OR length(trim(year)) NOT BETWEEN 1 AND 20 OR code IS NULL OR length(trim(code)) NOT BETWEEN 1 AND 20
  OR name IS NULL OR length(trim(name)) NOT BETWEEN 2 AND 120 OR starts IS NULL OR ends IS NULL OR ends<starts THEN RAISE EXCEPTION 'Invalid term period'; END IF;
 IF EXISTS(SELECT 1 FROM lub.academic_terms t WHERE t.start_date<=ends AND t.end_date>=starts) THEN RAISE EXCEPTION 'Overlapping term'; END IF;
 INSERT INTO lub.academic_terms(academic_year,term_code,name_ar,start_date,end_date) VALUES(trim(year),trim(code),trim(name),starts,ends) RETURNING id INTO result;
 RETURN result;
END; $$;
REVOKE ALL ON FUNCTION lub.create_academic_term(text,text,text,date,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION lub.create_academic_term(text,text,text,date,date) TO authenticated;

CREATE FUNCTION lub.has_scoped_capability(org uuid,capability text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT lub.has_org_permission(org,capability) OR EXISTS(SELECT 1 FROM lub.committees c WHERE c.organization_id=org AND lub.has_org_permission(org,capability,c.id));
$$;
CREATE FUNCTION lub.has_task_access(org uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT lub.has_scoped_capability(org,'TASKS_MANAGE') OR lub.has_scoped_capability(org,'TASKS_REVIEW');
$$;
CREATE FUNCTION lub.has_event_access(org uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT lub.has_org_permission(org,'EVENTS_MANAGE') OR lub.has_org_permission(org,'EVENT_REGISTRATIONS_REVIEW') OR lub.has_org_permission(org,'EVENT_ATTENDANCE_MANAGE');
$$;
CREATE FUNCTION lub.has_application_access(org uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM unnest(ARRAY['FORMS_MANAGE','REGISTRATION_ROUNDS_MANAGE','APPLICATIONS_VIEW','APPLICATIONS_REVIEW','APPLICATIONS_BULK_ACTION']) capability WHERE lub.has_scoped_capability(org,capability));
$$;
CREATE FUNCTION lub.has_reports_access(org uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT lub.has_scoped_capability(org,'REPORTS_GENERATE');
$$;
CREATE FUNCTION lub.has_hours_access(org uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 -- The simplified hours tab only exposes self-request review and the policy toggle.
 SELECT lub.has_scoped_capability(org,'HOURS_APPROVE') OR lub.has_org_permission(org,'ORG_PROFILE_MANAGE');
$$;
CREATE FUNCTION lub.has_management_access(org uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT lub.has_task_access(org) OR lub.has_event_access(org) OR lub.has_application_access(org) OR lub.has_reports_access(org) OR lub.has_hours_access(org)
  OR lub.has_scoped_capability(org,'MEMBERS_VIEW') OR lub.has_org_permission(org,'PERMISSIONS_GRANT') OR lub.has_org_permission(org,'RENEWALS_MANAGE')
  OR lub.has_scoped_capability(org,'COMMITTEE_PROFILE_MANAGE') OR lub.has_org_permission(org,'ORG_PROFILE_MANAGE');
$$;
CREATE FUNCTION lub.management_overview() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH account AS MATERIALIZED (SELECT u.status_code AS status,u.onboarded_at IS NOT NULL AS onboarded,u.full_name_ar AS name,
  lub.is_super_admin() AS admin FROM lub.users u WHERE u.id=auth.uid()),
 managed AS MATERIALIZED (
  SELECT o.id,o.slug,o.name_ar AS "nameAr",o.status_code AS "statusCode",
   (SELECT count(*)::int FROM lub.membership_cases c WHERE c.organization_id=o.id AND c.kind='Registration' AND c.status_code IN ('Submitted','Interview') AND lub.has_org_permission(o.id,'APPLICATIONS_VIEW',c.requested_committee_id)) AS "pendingApplications",
   lub.has_org_permission(o.id,'ORG_PROFILE_MANAGE') AS "canEdit",lub.has_scoped_capability(o.id,'COMMITTEE_PROFILE_MANAGE') AS "canManageCommittees",
   lub.has_application_access(o.id) AS "canApplications",lub.has_event_access(o.id) AS "canEvents",lub.has_reports_access(o.id) AS "canReports",lub.has_hours_access(o.id) AS "canHours",
   lub.has_org_permission(o.id,'RENEWALS_MANAGE') AS "canRenewals",lub.has_task_access(o.id) AS "canTasks",lub.has_scoped_capability(o.id,'MEMBERS_VIEW') AS "canMembers",lub.has_org_permission(o.id,'PERMISSIONS_GRANT') AS "canGrant"
  FROM lub.organizations o WHERE (SELECT NOT admin AND status='Active' FROM account) AND lub.has_management_access(o.id)
 ) SELECT jsonb_build_object('readiness',jsonb_build_object('status',a.status,'onboarded',coalesce(a.onboarded,false)),'displayName',a.name,
  'access',jsonb_build_object('superAdmin',coalesce(a.admin,false),'organizations',coalesce((SELECT jsonb_agg(m ORDER BY m."nameAr",m.id) FROM managed m),'[]')),
  'summary',jsonb_build_object('activeOrganizations',CASE WHEN a.admin THEN (SELECT count(*) FROM lub.organizations WHERE status_code='Active') ELSE 0 END,
   'archivedOrganizations',CASE WHEN a.admin THEN (SELECT count(*) FROM lub.organizations WHERE status_code='Archived') ELSE 0 END,
   'administrators',CASE WHEN a.admin THEN (SELECT count(*) FROM lub.users u WHERE lub.is_super_admin(u.id)) ELSE 0 END))
 FROM (SELECT 1) seed LEFT JOIN account a ON true;
$$;
REVOKE ALL ON FUNCTION lub.has_scoped_capability(uuid,text),lub.has_task_access(uuid),lub.has_event_access(uuid),lub.has_application_access(uuid),lub.has_reports_access(uuid),lub.has_hours_access(uuid),lub.has_management_access(uuid),lub.management_overview() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION lub.has_scoped_capability(uuid,text),lub.has_task_access(uuid),lub.has_event_access(uuid),lub.has_application_access(uuid),lub.has_reports_access(uuid),lub.has_hours_access(uuid),lub.has_management_access(uuid),lub.management_overview() TO authenticated;
