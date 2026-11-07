-- Direct reports resolve the actor and report scope on every call. No ticket or plaintext identifiers are stored.
CREATE FUNCTION public.export_member_rows(org uuid,q text,state text,committee uuid,term uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE scope uuid[]; records jsonb; org_slug text;
BEGIN
 IF state IS NULL OR state NOT IN ('all','Active','Ended','Inactive') THEN RAISE EXCEPTION 'Invalid member filters'; END IF;
 SELECT o.slug INTO org_slug FROM lub.organizations o WHERE o.id=org;
 scope:=CASE WHEN lub.has_org_permission(org,'REPORTS_GENERATE') THEN NULL ELSE lub.member_committee_scope(org,'REPORTS_GENERATE') END;
 WITH selected AS MATERIALIZED (
  SELECT * FROM lub.member_directory_rows(org,q,committee,term,true) m
  WHERE state='all' OR m.status_code=state ORDER BY m.name,m.member_id LIMIT 501
 )
 SELECT coalesce(jsonb_agg(jsonb_build_object('userId',m.user_id,'name',m.name,'major',m.major,'level',m.level,'status',m.status_code,
  'universityCiphertext',u.university_id_ciphertext,'nationalCiphertext',n.national_id_ciphertext,'email',u.email,'phone',u.phone,
  'startDate',(SELECT min(h.start_date) FROM lub.organization_memberships h WHERE h.organization_id=org AND h.user_id=m.user_id),
  'hours',lub.member_approved_hours(org,m.user_id,term,scope),'isTest',false,
  'roles',coalesce((SELECT jsonb_agg(jsonb_build_object('code',a.role_code)) FROM lub.access_assignments a
   WHERE a.organization_id=org AND a.user_id=m.user_id AND a.start_at<=statement_timestamp()
    AND (a.end_at IS NULL OR a.end_at>statement_timestamp()) AND (scope IS NULL OR a.committee_id=ANY(scope))),'[]'),
  'committees',coalesce((SELECT jsonb_agg(jsonb_build_object('name',c.name) ORDER BY c.name,c.id) FROM lub.committees c
   WHERE c.organization_id=org AND (scope IS NULL OR c.id=ANY(scope)) AND EXISTS(
    SELECT 1 FROM lub.committee_memberships cm JOIN lub.organization_memberships h ON h.id=cm.organization_membership_id
    WHERE cm.committee_id=c.id AND h.user_id=m.user_id AND h.organization_id=org)),'[]'))
  ORDER BY m.name,m.member_id),'[]') INTO records
 FROM selected m JOIN lub.users u ON u.id=m.user_id LEFT JOIN lub.private_student_identifiers n ON n.user_id=m.user_id;
 IF jsonb_array_length(records)>500 THEN RAISE EXCEPTION 'Refine export filters' USING ERRCODE='54000'; END IF;
 RETURN jsonb_build_object('records',records,'slug',org_slug,'filter',lower(state)||CASE WHEN committee IS NOT NULL THEN '-committee' ELSE '' END
  ||CASE WHEN nullif(trim(q),'') IS NOT NULL THEN '-search' ELSE '' END||CASE WHEN term IS NOT NULL THEN '-term' ELSE '' END);
END; $$;

CREATE FUNCTION public.export_registrant_rows(org uuid,event uuid,committee uuid,query text,state text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE wide boolean; scope uuid[]; payload jsonb;
BEGIN
 wide:=lub.has_org_permission(org,'REPORTS_GENERATE');
 scope:=lub.member_committee_scope(org,'REPORTS_GENERATE');
 IF auth.uid() IS NULL OR (NOT wide AND cardinality(scope)=0)
  OR (committee IS NOT NULL AND NOT committee=ANY(scope))
  OR NOT EXISTS(SELECT 1 FROM lub.organization_content e WHERE e.id=event AND e.organization_id=org AND e.kind='Event' AND e.deleted_at IS NULL)
 THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 IF query IS NULL OR length(query)>120 OR state IS NULL OR state NOT IN ('','Pending','Accepted','Rejected')
 THEN RAISE EXCEPTION 'Invalid filters'; END IF;
 WITH selected AS MATERIALIZED (
  SELECT u.id AS "userId",false AS "isTest",u.full_name_ar AS name,u.university_id_ciphertext AS "universityCiphertext",
   n.national_id_ciphertext AS "nationalCiphertext",u.phone,u.email,u.major_name AS major,u.academic_level AS level,
   (r.registered_at AT TIME ZONE 'Asia/Riyadh')::date AS "registeredDate",r.review_status_code AS status,e.attendance_hours AS hours
  FROM lub.event_registrations r JOIN lub.users u ON u.id=r.user_id JOIN lub.organization_content e ON e.id=r.event_id
  LEFT JOIN lub.private_student_identifiers n ON n.user_id=u.id
  WHERE r.event_id=event AND r.organization_id=org AND r.status_code='Registered' AND r.review_status_code='Accepted'
   AND state IN ('','Accepted') AND NOT u.is_test_account AND lub.is_student_account(u.id)
   AND (strpos(lub.arabic_search_key(u.full_name_ar),lub.arabic_search_key(query))>0 OR strpos(lub.arabic_search_key(u.full_name_en),lub.arabic_search_key(query))>0)
   AND ((wide AND committee IS NULL) OR lub.member_in_committees(org,u.id,CASE WHEN committee IS NOT NULL THEN ARRAY[committee] ELSE scope END))
  ORDER BY u.full_name_ar,u.id LIMIT 5001
 )
 SELECT jsonb_build_object('slug',o.slug,'eventId',e.id,'eventTitle',e.title,'records',
  (SELECT coalesce(jsonb_agg(s ORDER BY s.name,s."userId"),'[]') FROM selected s))
 INTO payload FROM lub.organizations o JOIN lub.organization_content e ON e.organization_id=o.id WHERE o.id=org AND e.id=event;
 IF jsonb_array_length(payload->'records')>5000 THEN RAISE EXCEPTION 'Refine export filters' USING ERRCODE='54000'; END IF;
 RETURN payload;
END; $$;

REVOKE ALL ON FUNCTION public.export_member_rows(uuid,text,text,uuid,uuid),public.export_registrant_rows(uuid,uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.export_member_rows(uuid,text,text,uuid,uuid),public.export_registrant_rows(uuid,uuid,uuid,text,text) TO authenticated;
