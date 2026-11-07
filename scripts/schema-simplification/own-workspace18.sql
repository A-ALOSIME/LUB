-- Own-only dashboard data and activity updates.
CREATE FUNCTION lub.own_membership_history() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',m.id,'organizationName',o.name_ar,'logo',o.logo_url,'type',o.type_code,
  'hours',lub.member_approved_hours(o.id,m.user_id,NULL)::text,'slug',o.slug,'organizationStatus',o.status_code,
  'statusCode',m.status_code,'startDate',m.start_date,'endDate',m.end_date,'roles',
  coalesce((SELECT jsonb_agg(jsonb_build_object('code',a.role_code,'startDate',d.starts,'endDate',d.ends,'hours',
    (SELECT coalesce(sum((h->>'hours')::numeric),0)::text FROM jsonb_array_elements(m.hours) h
     WHERE h->>'status_code'='Approved' AND (h->>'activity_date')::date>=d.starts
      AND (d.ends IS NULL OR (h->>'activity_date')::date<d.ends) AND (a.committee_id IS NULL OR h->>'committee_id'=a.committee_id::text)))
    ORDER BY a.start_at,a.id) FROM lub.access_assignments a
    CROSS JOIN LATERAL (SELECT (a.start_at AT TIME ZONE 'Asia/Riyadh')::date starts,(a.end_at AT TIME ZONE 'Asia/Riyadh')::date ends) d
    WHERE a.organization_membership_id=m.id),'[]')) ORDER BY o.name_ar,m.start_date,m.id),'[]')
 FROM lub.organization_memberships m JOIN lub.organizations o ON o.id=m.organization_id
 WHERE m.user_id=auth.uid() AND NOT o.is_test;
$$;

CREATE FUNCTION lub.own_workspace_page() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('status',u.status_code,'profile',CASE WHEN u.onboarded_at IS NOT NULL THEN jsonb_build_object(
  'fullName',u.full_name_ar,'nameEn',u.full_name_en,'major',u.major_name,'academicLevel',u.academic_level,'phone',u.phone) END,
  'access',lub.management_overview()->'access','memberships',lub.own_membership_history(),
  'tasks',coalesce((SELECT jsonb_agg(jsonb_build_object('id',p.task_id,'title',p.title,'status',p.status_code) ORDER BY p.joined_at DESC,p.id)
   FROM (SELECT p.id,p.task_id,t.title,p.status_code,p.joined_at FROM lub.task_participants p JOIN lub.tasks t ON t.id=p.task_id
    WHERE p.user_id=u.id ORDER BY p.joined_at DESC,p.id LIMIT 5) p),'[]'),
  'hours',coalesce((SELECT sum((h->>'hours')::numeric)::text FROM lub.organization_memberships m CROSS JOIN LATERAL jsonb_array_elements(m.hours) h
   WHERE m.user_id=u.id AND h->>'status_code'='Approved'),'0'))
 FROM lub.users u WHERE u.id=auth.uid();
$$;

CREATE FUNCTION lub.own_overview_updates() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH actor AS MATERIALIZED (SELECT u.id FROM lub.users u WHERE u.id=auth.uid() AND lub.is_student_account(u.id)),
 tasks AS (
  SELECT t.id,t.title,t.title_en AS "titleEn",t.created_at,coalesce(p.status_code,'Available') status FROM actor u
  JOIN lub.tasks t ON t.deleted_at IS NULL AND t.status_code='Open'
  LEFT JOIN lub.task_participants p ON p.task_id=t.id AND p.user_id=u.id AND p.withdrawn_at IS NULL
  WHERE p.id IS NOT NULL OR lub.task_scope_member(t.organization_id,t.committee_id)
  ORDER BY t.created_at DESC,t.id LIMIT 2
 ), events AS (
  SELECT r.id,e.title,e.title_en AS "titleEn",r.registered_at,CASE WHEN r.status_code='Cancelled' THEN 'Withdrawn' ELSE r.review_status_code END status
  FROM actor u JOIN lub.event_registrations r ON r.user_id=u.id JOIN lub.organization_content e ON e.id=r.event_id
  ORDER BY r.registered_at DESC,r.id LIMIT 2
 ), hours AS (
  SELECT o.name_ar title,o.name_en AS "titleEn",h->>'status_code' status,h->>'hours' hours,
   coalesce(h->>'reviewed_at',h->>'created_at')::timestamptz AS at,h->>'id' id
  FROM actor u JOIN lub.organization_memberships m ON m.user_id=u.id JOIN lub.organizations o ON o.id=m.organization_id
  CROSS JOIN LATERAL jsonb_array_elements(m.hours) h ORDER BY at DESC NULLS LAST,id LIMIT 2
 ), requests AS (
  SELECT * FROM (
   SELECT a.id,o.name_ar title,o.name_en AS "titleEn",CASE WHEN a.kind='Renewal' AND a.status_code='Pending' THEN 'RenewalPending' ELSE a.status_code END status,
    coalesce(a.decided_at,a.edited_at,a.submitted_at) AS at
   FROM actor u JOIN lub.membership_cases a ON a.user_id=u.id JOIN lub.organizations o ON o.id=a.organization_id
   JOIN lub.membership_campaigns c ON c.id=a.campaign_id
   WHERE a.kind='Registration' OR (a.status_code='Pending' AND c.status_code IN ('Open','Paused'))
   UNION ALL SELECT r.id,r.name_ar,r.name_en,r.status_code,coalesce(r.decided_at,r.created_at)
   FROM actor u JOIN lub.organization_opening_requests r ON r.applicant_user_id=u.id
  ) cases ORDER BY (status='RenewalPending') DESC,at DESC,id LIMIT 3
 )
 SELECT jsonb_build_object(
  'tasks',coalesce((SELECT jsonb_agg(jsonb_build_object('title',title,'titleEn',"titleEn",'status',status) ORDER BY created_at DESC,id) FROM tasks),'[]'),
  'events',coalesce((SELECT jsonb_agg(jsonb_build_object('title',title,'titleEn',"titleEn",'status',status) ORDER BY registered_at DESC,id) FROM events),'[]'),
  'hours',coalesce((SELECT jsonb_agg(jsonb_build_object('title',title,'titleEn',"titleEn",'status',status,'hours',hours) ORDER BY at DESC NULLS LAST,id) FROM hours),'[]'),
  'requests',coalesce((SELECT jsonb_agg(jsonb_build_object('title',title,'titleEn',"titleEn",'status',status) ORDER BY (status='RenewalPending') DESC,at DESC,id) FROM requests),'[]'));
$$;

REVOKE ALL ON FUNCTION lub.own_membership_history(),lub.own_workspace_page(),lub.own_overview_updates() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION lub.own_membership_history(),lub.own_workspace_page(),lub.own_overview_updates() TO authenticated;
