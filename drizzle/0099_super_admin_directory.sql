-- One authorization check, set-based member totals/leadership, all initial filter data.
CREATE FUNCTION lub.admin_directory_snapshot() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT lub.is_super_admin() THEN RAISE EXCEPTION 'Super Admin required' USING ERRCODE='42501'; END IF;
 RETURN (WITH members AS MATERIALIZED (
 SELECT m.organization_id,count(*)::int AS total FROM lub.organization_memberships m JOIN lub.users u ON u.id=m.user_id
 WHERE m.status_code='Active' AND m.start_date<=current_date AND (m.end_date IS NULL OR m.end_date>current_date) AND u.status_code='Active' AND lub.is_student_account(u.id) GROUP BY m.organization_id
 ), leaders AS MATERIALIZED (
 SELECT DISTINCT ON(r.organization_id) r.organization_id,p.full_name_ar AS name FROM lub.role_assignments r
 JOIN lub.organization_memberships m ON m.id=r.organization_membership_id JOIN lub.users u ON u.id=m.user_id JOIN lub.student_profiles p ON p.user_id=u.id
 WHERE r.is_primary_leader AND r.start_date<=current_date AND (r.end_date IS NULL OR r.end_date>current_date) AND m.status_code='Active' AND m.start_date<=current_date AND (m.end_date IS NULL OR m.end_date>current_date) AND u.status_code='Active' AND lub.is_student_account(u.id)
 ORDER BY r.organization_id,r.start_date DESC,r.id
 ), directory AS MATERIALIZED (
 SELECT o.id,o.slug,o.name_ar AS "nameAr",o.type_code AS "typeCode",o.status_code AS "statusCode",o.logo_url AS "logoUrl",l.name AS "leaderName",coalesce(m.total,0) AS "memberCount"
 FROM lub.organizations o LEFT JOIN members m ON m.organization_id=o.id LEFT JOIN leaders l ON l.organization_id=o.id
 ), requests AS MATERIALIZED (
 SELECT r.id,r.name_ar,r.type_code,r.summary,r.mission,r.interests,r.status_code,r.decision_note,r.created_at,r.decided_at,r.logo_webp_base64 IS NOT NULL AS has_logo,p.full_name_ar AS applicant_name,o.slug AS organization_slug
 FROM lub.organization_opening_requests r LEFT JOIN lub.student_profiles p ON p.user_id=r.applicant_user_id LEFT JOIN lub.organizations o ON o.id=r.organization_id
 ) SELECT jsonb_build_object('organizations',coalesce((SELECT jsonb_agg(d ORDER BY d."nameAr",d.id) FROM directory d),'[]'),
 'requests',coalesce((SELECT jsonb_agg(r ORDER BY r.created_at DESC,r.id) FROM requests r),'[]'),
 'counts',jsonb_build_object('Active',(SELECT count(*) FROM directory WHERE "statusCode"='Active'),'Inactive',(SELECT count(*) FROM directory WHERE "statusCode"='Inactive'),'Archived',(SELECT count(*) FROM directory WHERE "statusCode"='Archived'),'Pending',(SELECT count(*) FROM requests WHERE status_code='Pending'),'Accepted',(SELECT count(*) FROM requests WHERE status_code='Accepted'),'Rejected',(SELECT count(*) FROM requests WHERE status_code='Rejected'))));
END;$$;
--> statement-breakpoint
CREATE FUNCTION lub.admin_account_directory() RETURNS TABLE("userId" uuid,"fullName" text,email text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT lub.is_super_admin() THEN RAISE EXCEPTION 'Super Admin required' USING ERRCODE='42501';END IF;
 RETURN QUERY SELECT a.user_id,a.full_name,u.email::text FROM lub.list_super_admins() a JOIN lub.users u ON u.id=a.user_id ORDER BY a.full_name;
END;$$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS organizations_status_name_idx ON lub.organizations(status_code,name_ar,id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS opening_requests_status_created_idx ON lub.organization_opening_requests(status_code,created_at DESC,id);
--> statement-breakpoint
REVOKE ALL ON FUNCTION lub.admin_directory_snapshot(),lub.admin_account_directory() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION lub.admin_directory_snapshot(),lub.admin_account_directory() TO authenticated;

--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.export_hours_rows(org uuid,committee uuid,term uuid,state text,query text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT (lub.has_org_permission(org,'REPORTS_GENERATE') OR (committee IS NOT NULL AND lub.has_org_permission(org,'REPORTS_GENERATE',committee))) THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 IF query IS NULL OR length(query)>120 OR (state IS NOT NULL AND state NOT IN('Approved','Pending','Rejected')) OR (committee IS NOT NULL AND NOT EXISTS(SELECT 1 FROM lub.committees WHERE id=committee AND organization_id=org)) OR (term IS NOT NULL AND NOT EXISTS(SELECT 1 FROM lub.academic_terms WHERE id=term)) THEN RAISE EXCEPTION 'Invalid filters'; END IF;
 SELECT jsonb_build_object('organization',o.name_ar,'slug',o.slug,'period',coalesce((SELECT academic_year||'-'||CASE WHEN lub.arabic_search_key(name_ar) ~ '(اول|first)' THEN 'first-semester' WHEN lub.arabic_search_key(name_ar) ~ '(ثاني|second)' THEN 'second-semester' WHEN lub.arabic_search_key(name_ar) ~ '(ثالث|third)' THEN 'third-semester' WHEN lub.arabic_search_key(name_ar) ~ '(صيف|summer)' THEN 'summer-term' ELSE 'semester-'||start_date::text END FROM lub.academic_terms WHERE id=term),'all-terms'),'state',state,'records',coalesce((SELECT jsonb_agg(row ORDER BY row.name,row."userId") FROM (
  SELECT u.id AS "userId",p.full_name_ar AS name,p.university_id_ciphertext AS "universityCiphertext",false AS "isTest",sum(h.hours)::text AS hours,min(h.activity_date) AS "firstDate",max(h.activity_date) AS "lastDate"
  FROM lub.hour_records h JOIN lub.organization_memberships m ON m.id=h.organization_membership_id
  JOIN lub.users u ON u.id=m.user_id JOIN lub.student_profiles p ON p.user_id=u.id
  WHERE h.organization_id=org AND lub.is_student_membership(m.id) AND NOT u.is_test
    AND (committee IS NULL OR h.committee_id=committee) AND (term IS NULL OR h.academic_term_id=term)
    AND (state IS NULL OR h.status_code=state) AND position(lub.arabic_search_key(query) IN lub.arabic_search_key(p.full_name_ar))>0
  GROUP BY u.id,p.full_name_ar,p.university_id_ciphertext ORDER BY p.full_name_ar,u.id LIMIT 5001
 ) row),'[]'::jsonb)) INTO result FROM lub.organizations o WHERE o.id=org;
 IF result IS NULL OR jsonb_array_length(result->'records')>5000 THEN RAISE EXCEPTION 'Export unavailable'; END IF;
 RETURN result;
END; $$;
