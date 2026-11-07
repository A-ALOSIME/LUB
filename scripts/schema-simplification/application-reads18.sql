CREATE FUNCTION lub.application_detail(target uuid,own_only boolean DEFAULT false) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('id',a.id,'organization_id',a.organization_id,'campaign_title',r.title,'created_at',a.submitted_at,
  'status_code',a.status_code,'requested_committee_id',a.requested_committee_id,'answers',a.answers,'response_revision',a.response_revision,
  'version',a.form_snapshot||jsonb_build_object('version_number',(a.form_snapshot->>'revision')::int),
  'committee_labels',jsonb_build_object('legacy',requested.name,'answers',coalesce((
   SELECT jsonb_object_agg(f->>'id',concat_ws(' / ',parent.name,c.name))
   FROM jsonb_array_elements(a.form_snapshot->'definition'->'sections') s CROSS JOIN LATERAL jsonb_array_elements(s->'fields') f
   JOIN lub.committees c ON c.id::text=a.answers->>(f->>'id') AND c.organization_id=a.organization_id
   LEFT JOIN lub.committees parent ON parent.id=c.parent_committee_id WHERE f->>'type'='Committee'
  ),'{}')),
  'canReview',NOT own_only AND access.review,'canStaff',NOT own_only AND access.staff,
  'history',coalesce((SELECT jsonb_agg(jsonb_build_object('to_status_code',h.to_status_code,'created_at',h.occurred_at,'reason',h.reason)
   ORDER BY h.occurred_at,h.id) FROM lub.history_events h WHERE h.membership_case_id=a.id),'[]'))
 FROM lub.membership_cases a JOIN lub.membership_campaigns r ON r.id=a.campaign_id
 LEFT JOIN lub.committees requested ON requested.id=a.requested_committee_id
 CROSS JOIN LATERAL (SELECT lub.can_read_application(a.id,'APPLICATIONS_REVIEW') AS review,
  lub.has_org_permission(a.organization_id,'APPLICATIONS_VIEW',a.requested_committee_id)
   OR lub.can_read_application(a.id,'APPLICATIONS_REVIEW') OR lub.can_read_application(a.id,'APPLICATIONS_BULK_ACTION') AS staff) access
 WHERE a.id=target AND a.kind='Registration' AND lub.is_student_account(a.user_id)
  AND EXISTS(SELECT 1 FROM lub.users u WHERE u.id=auth.uid() AND u.status_code='Active')
  AND (a.user_id=auth.uid() OR (NOT own_only AND access.staff));
$$;

CREATE FUNCTION lub.public_registration_round(org uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT lub.round_list_item(r)-'application_count'
 FROM lub.membership_campaigns r JOIN lub.organizations o ON o.id=r.organization_id
 WHERE r.organization_id=org AND r.kind='Registration' AND r.status_code='Open' AND r.closes_at>statement_timestamp() AND o.status_code='Active'
 ORDER BY r.opens_at,r.id LIMIT 1;
$$;

CREATE FUNCTION lub.can_reapply_to_round(r lub.membership_campaigns,previous_status text) RETURNS boolean
LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT (previous_status IN ('Accepted','Withdrawn') AND lub.round_is_open(r.id) AND lub.is_student_account(auth.uid())
  AND NOT lub.task_scope_member(r.organization_id,NULL) AND lub.round_requirements_met(r.id,auth.uid())
  AND NOT EXISTS(SELECT 1 FROM lub.membership_cases c WHERE c.campaign_id=r.id AND c.user_id=auth.uid() AND c.status_code IN ('Submitted','Interview','Rejected'))) IS TRUE;
$$;

CREATE FUNCTION lub.registration_round_page(target uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT (lub.round_list_item(r)-'application_count')||jsonb_build_object('organization_id',r.organization_id,'slug',o.slug,'name',o.name_ar,
  'accountStatus',u.status_code,'onboarded',u.onboarded_at IS NOT NULL,'application',lub.application_detail(a.id,true),
  'canReapply',lub.can_reapply_to_round(r,a.status_code),
  'version',CASE WHEN (r.status_code='Open' AND r.closes_at>statement_timestamp() AND o.status_code='Active')
   OR lub.has_org_permission(o.id,'REGISTRATION_ROUNDS_MANAGE') THEN (
    SELECT (f->'version')||jsonb_build_object('version_number',(f->'version'->>'revision')::int)
    FROM jsonb_array_elements(o.forms) f WHERE f->>'id'=r.form_id::text AND f->'version'->>'status_code'='Published'
   ) ELSE a.form_snapshot||jsonb_build_object('version_number',(a.form_snapshot->>'revision')::int) END,
  'committees',coalesce((SELECT jsonb_agg(c) FROM lub.form_committee_options(o.id) c),'[]'))
 FROM lub.membership_campaigns r JOIN lub.organizations o ON o.id=r.organization_id LEFT JOIN lub.users u ON u.id=auth.uid()
 LEFT JOIN LATERAL (SELECT c.id,c.status_code,c.form_snapshot FROM lub.membership_cases c
  WHERE c.campaign_id=r.id AND c.user_id=u.id AND u.status_code='Active' ORDER BY c.submitted_at DESC,c.id DESC LIMIT 1) a ON true
 WHERE r.id=target AND lub.can_read_round(r.id);
$$;

CREATE FUNCTION lub.registration_readiness(org uuid,target uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('active',u.status_code='Active','onboarded',u.onboarded_at IS NOT NULL,'major',u.major_name,
  'hours',(SELECT coalesce(sum((h->>'hours')::numeric),0) FROM lub.organization_memberships m CROSS JOIN LATERAL jsonb_array_elements(m.hours) h
   WHERE m.user_id=u.id AND h->>'status_code'='Approved'),
  'member',lub.task_scope_member(org,NULL),'application',CASE WHEN a.id IS NOT NULL THEN jsonb_build_object('id',a.id,'status_code',a.status_code) END,
  'canReapply',lub.can_reapply_to_round(r,a.status_code))
 FROM lub.users u LEFT JOIN lub.membership_campaigns r ON r.id=target AND r.organization_id=org AND r.kind='Registration'
 LEFT JOIN LATERAL (SELECT a.id,a.status_code FROM lub.membership_cases a WHERE a.campaign_id=r.id AND a.user_id=u.id
  ORDER BY a.submitted_at DESC,a.id DESC LIMIT 1) a ON true
 WHERE u.id=auth.uid();
$$;

CREATE FUNCTION lub.managed_registration_round(org uuid,target uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT lub.round_list_item(r) FROM lub.membership_campaigns r
 WHERE r.id=target AND r.organization_id=org AND r.kind='Registration' AND lub.has_org_permission(org,'REGISTRATION_ROUNDS_MANAGE');
$$;

CREATE FUNCTION lub.editable_form_organization(target uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT org FROM lub.form_storage_owner(target) org WHERE lub.has_org_permission(org,'FORMS_MANAGE');
$$;

REVOKE ALL ON FUNCTION lub.application_detail(uuid,boolean),lub.public_registration_round(uuid),lub.registration_round_page(uuid),
 lub.registration_readiness(uuid,uuid),lub.managed_registration_round(uuid,uuid),lub.editable_form_organization(uuid),
 lub.can_reapply_to_round(lub.membership_campaigns,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION lub.public_registration_round(uuid),lub.registration_round_page(uuid) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION lub.application_detail(uuid,boolean),lub.registration_readiness(uuid,uuid),
 lub.managed_registration_round(uuid,uuid),lub.editable_form_organization(uuid) TO authenticated;

CREATE FUNCTION lub.application_list(org uuid,filters jsonb,skip int,page_size int) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH matches AS MATERIALIZED (
  SELECT a.id,a.status_code,a.submitted_at AS created_at,r.title,r.id AS round_id,o.slug,o.name_ar AS organization_name,
   u.full_name_ar AS name,u.major_name AS major,u.academic_level AS level,c.name AS committee,u.is_test_account AS "isTest",
   r.allow_withdrawal,lub.round_is_open(r.id) AS round_open,
   EXISTS(SELECT 1 FROM lub.membership_cases other WHERE other.campaign_id=r.id AND other.user_id=a.user_id AND other.id<>a.id
    AND (other.status_code IN ('Submitted','Interview','Rejected') OR (other.status_code='Accepted' AND EXISTS(SELECT 1 FROM lub.organization_memberships m
      WHERE m.id=other.organization_membership_id AND m.status_code='Active' AND m.start_date<=lub.today_riyadh() AND (m.end_date IS NULL OR m.end_date>lub.today_riyadh()))))) AS has_active_application,
   EXISTS(SELECT 1 FROM lub.membership_cases newer WHERE newer.campaign_id=r.id AND newer.user_id=a.user_id AND (newer.submitted_at,newer.id)>(a.submitted_at,a.id)) AS has_newer_application,
   lub.can_read_application(a.id,'APPLICATIONS_REVIEW') AS "canReview",lub.can_read_application(a.id,'APPLICATIONS_BULK_ACTION') AS "canBulk"
  FROM lub.membership_cases a JOIN lub.membership_campaigns r ON r.id=a.campaign_id JOIN lub.organizations o ON o.id=a.organization_id
  JOIN lub.users u ON u.id=a.user_id LEFT JOIN lub.committees c ON c.id=a.requested_committee_id
  WHERE a.kind='Registration' AND lub.is_student_account(a.user_id) AND lub.is_student_account(auth.uid())
   AND (CASE WHEN org IS NULL THEN a.user_id=auth.uid() ELSE a.organization_id=org AND (
    lub.has_org_permission(org,'APPLICATIONS_VIEW',a.requested_committee_id) OR lub.can_read_application(a.id,'APPLICATIONS_REVIEW') OR lub.can_read_application(a.id,'APPLICATIONS_BULK_ACTION')) END)
   AND position(lub.arabic_search_key(coalesce(filters->>'q','')) IN lub.arabic_search_key(u.full_name_ar))>0
   AND (coalesce(filters->>'round','')='' OR r.id::text=filters->>'round')
   AND (coalesce(filters->>'committee','')='' OR a.requested_committee_id::text=filters->>'committee')
   AND (coalesce(filters->>'major','')='' OR u.major_name=filters->>'major') AND (coalesce(filters->>'level','')='' OR u.academic_level=filters->>'level')
   AND (coalesce(filters->>'lookup','')='' OR u.university_id_lookup_hash=filters->>'lookup')
   AND (coalesce(filters->>'from','')='' OR a.submitted_at>=nullif(filters->>'from','')::date::timestamp AT TIME ZONE 'Asia/Riyadh')
   AND (coalesce(filters->>'to','')='' OR a.submitted_at<(nullif(filters->>'to','')::date+1)::timestamp AT TIME ZONE 'Asia/Riyadh')
   AND (coalesce(filters->>'activity','')='' OR (filters->>'activity'='prior')=EXISTS(SELECT 1 FROM lub.organization_memberships m
     WHERE m.user_id=a.user_id AND m.id IS DISTINCT FROM a.organization_membership_id AND m.created_at<a.submitted_at))
 ), selected AS (
  SELECT * FROM matches WHERE coalesce(filters->>'status','')='' OR status_code=filters->>'status'
   OR (filters->>'status'='review' AND status_code IN ('Submitted','Interview'))
  ORDER BY created_at DESC,id LIMIT greatest(0,least(26,page_size)) OFFSET greatest(0,skip)
 )
 SELECT jsonb_build_object('items',coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.created_at DESC,s.id) FROM selected s),'[]'),
  'counts',jsonb_build_object('all',count(*),'submitted',count(*) FILTER(WHERE status_code='Submitted'),
   'interview',count(*) FILTER(WHERE status_code='Interview'),'accepted',count(*) FILTER(WHERE status_code='Accepted'),
   'rejected',count(*) FILTER(WHERE status_code='Rejected'),'withdrawn',count(*) FILTER(WHERE status_code='Withdrawn')))
 FROM matches WHERE org IS NULL OR NOT "isTest";
$$;

REVOKE ALL ON FUNCTION lub.application_list(uuid,jsonb,int,int) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION lub.application_list(uuid,jsonb,int,int) TO authenticated;

CREATE FUNCTION lub.own_request_page(kind text,query text,state text,ordering text,skip int) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF NOT lub.is_student_account(auth.uid()) THEN RAISE EXCEPTION 'Student access required' USING ERRCODE='42501'; END IF;
 IF kind IS NULL OR kind NOT IN ('applications','renewals','organizations') OR query IS NULL OR length(query)>120
  OR state IS NULL OR state NOT IN ('all','Submitted','Interview','Accepted','Rejected','Withdrawn','Pending','Renewed','Declined','No_Response')
  OR ordering IS NULL OR ordering NOT IN ('asc','desc') OR skip IS NULL OR skip NOT BETWEEN 0 AND 250000 THEN RAISE EXCEPTION 'Invalid filters'; END IF;
 WITH source AS (
  SELECT a.id,o.name_ar AS name,r.title,a.status_code AS status,a.submitted_at AS created_at,
   CASE WHEN a.status_code='Rejected' THEN a.decision_note ELSE '' END AS reason,o.slug,o.logo_url AS logo,r.id AS round,
   a.status_code IN ('Submitted','Interview') AND r.allow_withdrawal AND lub.round_is_open(r.id) AS "canWithdraw",
   false AS "canRespond",''::text AS summary,''::text AS mission,'[]'::jsonb AS interests,r.opens_at AS opens,r.closes_at AS closes
  FROM lub.membership_cases a JOIN lub.membership_campaigns r ON r.id=a.campaign_id JOIN lub.organizations o ON o.id=a.organization_id
  WHERE own_request_page.kind='applications' AND a.kind='Registration' AND a.user_id=auth.uid()
  UNION ALL
  SELECT r.id,o.name_ar,c.title,CASE WHEN r.status_code='Pending' AND c.closes_at<=statement_timestamp() THEN 'No_Response' ELSE r.status_code END,
   c.created_at,'',o.slug,o.logo_url,NULL::uuid,false,
   r.status_code='Pending' AND c.status_code='Open' AND statement_timestamp()>=c.opens_at AND statement_timestamp()<c.closes_at
    AND lub.task_scope_member(c.organization_id,NULL) AND m.status_code='Active' AND m.start_date<=lub.today_riyadh() AND (m.end_date IS NULL OR m.end_date>lub.today_riyadh())
    AND NOT EXISTS(SELECT 1 FROM lub.history_events h WHERE h.organization_membership_id=m.id AND h.event_code='Ended' AND h.occurred_at>=c.created_at),
   '','','[]'::jsonb,c.opens_at,c.closes_at
  FROM lub.membership_cases r JOIN lub.membership_campaigns c ON c.id=r.campaign_id JOIN lub.organizations o ON o.id=c.organization_id
  JOIN lub.organization_memberships m ON m.id=r.organization_membership_id WHERE own_request_page.kind='renewals' AND r.kind='Renewal' AND r.user_id=auth.uid()
  UNION ALL
  SELECT r.id,r.name_ar,CASE WHEN r.type_code='Club' THEN 'نادي' ELSE 'مجلس' END,r.status_code,r.created_at,r.decision_note,o.slug,
   CASE WHEN r.logo_webp_base64 IS NOT NULL THEN '/organization-requests/'||r.id||'/logo' END,NULL::uuid,r.status_code='Pending',false,
   r.summary,r.mission,r.interests,NULL::timestamptz,NULL::timestamptz
  FROM lub.organization_opening_requests r LEFT JOIN lub.organizations o ON o.id=r.organization_id
  WHERE own_request_page.kind='organizations' AND r.applicant_user_id=auth.uid()
 ), searched AS MATERIALIZED (
  SELECT * FROM source WHERE position(lub.arabic_search_key(query) IN lub.arabic_search_key(name||' '||title))>0
 ), filtered AS (
  SELECT * FROM searched WHERE state='all' OR status=state
 )
 SELECT jsonb_build_object('items',coalesce((SELECT jsonb_agg(x ORDER BY CASE WHEN ordering='asc' THEN x.created_at END ASC,
   CASE WHEN ordering='desc' THEN x.created_at END DESC,x.id) FROM (
    SELECT * FROM filtered ORDER BY CASE WHEN ordering='asc' THEN created_at END ASC,CASE WHEN ordering='desc' THEN created_at END DESC,id LIMIT 26 OFFSET skip
   ) x),'[]'),
  'counts',CASE WHEN EXISTS(SELECT 1 FROM lub.users WHERE id=auth.uid() AND NOT is_test_account) THEN coalesce((
   SELECT jsonb_object_agg(status,total) FROM (SELECT status,count(*) total FROM searched GROUP BY status) counts),'{}') ELSE '{}' END,
  'total',(SELECT count(*) FROM filtered)) INTO result;
 RETURN result;
END; $$;

REVOKE ALL ON FUNCTION lub.own_request_page(text,text,text,text,int) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION lub.own_request_page(text,text,text,text,int) TO authenticated;
