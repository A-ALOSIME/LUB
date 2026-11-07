CREATE FUNCTION lub.round_list_item(c lub.membership_campaigns) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('id',c.id,'title',c.title,'status_code',c.status_code,'allow_withdrawal',c.allow_withdrawal,
  'minimum_approved_hours',c.minimum_hours,'allowed_majors',c.allowed_majors,'form_template_id',coalesce(c.form_id::text,''),
  'opens_at',coalesce(c.opens_at::text,''),'closes_at',coalesce(c.closes_at::text,''),'open',lub.round_is_open(c.id),
  'application_count',CASE WHEN lub.has_org_permission(c.organization_id,'REGISTRATION_ROUNDS_MANAGE') THEN (SELECT count(*) FROM lub.membership_cases a JOIN lub.users u ON u.id=a.user_id
   WHERE a.campaign_id=c.id AND NOT u.is_test_account AND lub.is_student_account(u.id)) ELSE 0 END);
$$;

CREATE FUNCTION lub.renewal_list_item(c lub.membership_campaigns,org_name text) RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT jsonb_build_object('id',c.id,'organization_id',c.organization_id,'academic_term_id',c.academic_term_id,
  'opens_at',c.opens_at,'closes_at',c.closes_at,'exclude_leadership',c.exclude_leadership,'status_code',c.status_code,
  'name',c.title,'org_name',org_name,'created_at',c.created_at);
$$;

CREATE FUNCTION lub.campaign_page(org uuid,kind_filter text,state text,query text,ascending boolean,page int) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH matching AS (
  SELECT c AS campaign,o.name_ar AS org_name,c.id,c.title,c.opens_at,c.closes_at,c.status_code,
   CASE c.kind WHEN 'Registration' THEN 'round' ELSE 'renewal' END AS kind
  FROM lub.membership_campaigns c JOIN lub.organizations o ON o.id=c.organization_id
  WHERE c.organization_id=org AND (CASE c.kind WHEN 'Registration' THEN lub.has_org_permission(org,'REGISTRATION_ROUNDS_MANAGE')
    ELSE lub.has_org_permission(org,'RENEWALS_MANAGE') END)
   AND ((state='all' AND c.status_code<>'Archived') OR c.status_code=state)
   AND (kind_filter='all' OR c.kind=CASE kind_filter WHEN 'round' THEN 'Registration' WHEN 'renewal' THEN 'Renewal' END)
   AND position(lub.arabic_search_key(query) IN lub.arabic_search_key(c.title))>0
  ORDER BY CASE WHEN ascending THEN c.opens_at END ASC NULLS LAST,CASE WHEN NOT ascending THEN c.opens_at END DESC NULLS LAST,c.id
  LIMIT 26 OFFSET greatest(page,0)::bigint*25
 )
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'title',title,'opens',opens_at,'closes',closes_at,'status',status_code,'kind',kind,
   'round',CASE WHEN kind='round' THEN lub.round_list_item(campaign) END,
   'campaign',CASE WHEN kind='renewal' THEN lub.renewal_list_item(campaign,org_name)||jsonb_build_object('summary',lub.renewal_campaign_summary(id)) END)
  ORDER BY CASE WHEN ascending THEN opens_at END ASC NULLS LAST,CASE WHEN NOT ascending THEN opens_at END DESC NULLS LAST,id),'[]') FROM matching;
$$;

CREATE FUNCTION lub.my_renewal_cases(page int) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('account',jsonb_build_object('status',u.status_code,'onboarded',u.onboarded_at IS NOT NULL),
  'items',coalesce((SELECT jsonb_agg(jsonb_build_object('campaign',x.campaign,'response',x.response) ORDER BY x.created_at DESC,x.id) FROM (
   SELECT c.id,c.created_at,lub.renewal_list_item(c,o.name_ar) AS campaign,
    jsonb_build_object('id',r.id,'organization_membership_id',r.organization_membership_id,'name',NULL,
     'response_code',CASE WHEN r.status_code='Pending' AND c.closes_at<=statement_timestamp() THEN 'No_Response' ELSE r.status_code END,
     'responded_at',r.decided_at,'canRespond',c.status_code='Open' AND c.opens_at<=statement_timestamp() AND c.closes_at>statement_timestamp()
       AND r.status_code='Pending' AND lub.task_scope_member(c.organization_id,NULL) AND m.status_code='Active'
       AND m.start_date<=lub.today_riyadh() AND (m.end_date IS NULL OR m.end_date>lub.today_riyadh())
       AND NOT EXISTS(SELECT 1 FROM lub.history_events h WHERE h.organization_membership_id=m.id AND h.event_code='Ended' AND h.occurred_at>=c.created_at)) AS response
   FROM lub.membership_cases r JOIN lub.membership_campaigns c ON c.id=r.campaign_id JOIN lub.organizations o ON o.id=c.organization_id
   JOIN lub.organization_memberships m ON m.id=r.organization_membership_id
   WHERE r.kind='Renewal' AND r.user_id=u.id AND lub.is_student_account(u.id)
   ORDER BY c.created_at DESC,c.id LIMIT 26 OFFSET greatest(page,0)::bigint*25
  ) x),'[]')) FROM lub.users u WHERE u.id=auth.uid();
$$;

CREATE FUNCTION lub.renewal_management_page(org uuid,selected uuid,page int,member_page int) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('account',jsonb_build_object('status',u.status_code,'onboarded',u.onboarded_at IS NOT NULL),
  'name',o.name_ar,'allowed',true,
  'terms',coalesce((SELECT jsonb_agg(t ORDER BY t.start_date DESC) FROM (SELECT * FROM lub.academic_terms ORDER BY start_date DESC,id LIMIT 100) t),'[]'),
  'campaigns',coalesce((SELECT jsonb_agg(lub.renewal_list_item(c,o.name_ar)||jsonb_build_object('summary',lub.renewal_campaign_summary(c.id)) ORDER BY c.created_at DESC,c.id)
   FROM (SELECT * FROM lub.membership_campaigns WHERE organization_id=o.id AND kind='Renewal' ORDER BY created_at DESC,id LIMIT 26 OFFSET greatest(page,0)::bigint*25) c),'[]'),
  'selected',CASE WHEN chosen.id IS NOT NULL THEN lub.renewal_list_item(chosen,o.name_ar) END,
  'responses',coalesce((SELECT jsonb_agg(jsonb_build_object('id',x.id,'organization_membership_id',x.organization_membership_id,
    'name',x.name,'response_code',x.state,'responded_at',x.decided_at,'canRespond',false) ORDER BY x.id) FROM (
   SELECT r.id,r.organization_membership_id,student.full_name_ar AS name,r.decided_at,
    CASE WHEN r.status_code='Pending' AND chosen.closes_at<=statement_timestamp() THEN 'No_Response' ELSE r.status_code END AS state
   FROM lub.membership_cases r JOIN lub.users student ON student.id=r.user_id WHERE r.campaign_id=chosen.id AND lub.is_student_account(student.id)
   ORDER BY r.id LIMIT 26 OFFSET greatest(member_page,0)::bigint*25
  ) x),'[]'),
  'counts',coalesce((SELECT jsonb_agg(stats ORDER BY stats.status) FROM (
   SELECT CASE WHEN r.status_code='Pending' AND chosen.closes_at<=statement_timestamp() THEN 'No_Response' ELSE r.status_code END AS status,count(*)::int AS count
   FROM lub.membership_cases r JOIN lub.users student ON student.id=r.user_id
   WHERE r.campaign_id=chosen.id AND NOT student.is_test_account AND lub.is_student_account(student.id) GROUP BY 1
  ) stats),'[]'))
 FROM lub.organizations o JOIN lub.users u ON u.id=auth.uid()
 LEFT JOIN LATERAL (SELECT c.* FROM lub.membership_campaigns c WHERE c.organization_id=o.id AND c.kind='Renewal'
  AND (selected IS NULL OR c.id=selected) ORDER BY c.created_at DESC,c.id LIMIT 1) chosen ON true
 WHERE o.id=org AND lub.has_org_permission(org,'RENEWALS_MANAGE');
$$;

REVOKE ALL ON FUNCTION lub.round_list_item(lub.membership_campaigns),lub.renewal_list_item(lub.membership_campaigns,text),
 lub.campaign_page(uuid,text,text,text,boolean,int),lub.my_renewal_cases(int),lub.renewal_management_page(uuid,uuid,int,int) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION lub.campaign_page(uuid,text,text,text,boolean,int),lub.my_renewal_cases(int),lub.renewal_management_page(uuid,uuid,int,int) TO authenticated;

CREATE FUNCTION lub.registration_management_page(org uuid,selected uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('name',o.name_ar,'accountStatus',u.status_code,'onboarded',u.onboarded_at IS NOT NULL,
  'allowed',allowed.capabilities,
  'template_count',CASE WHEN allowed.capabilities ?| ARRAY['FORMS_MANAGE','REGISTRATION_ROUNDS_MANAGE'] THEN jsonb_array_length(o.forms) ELSE 0 END,
  'templates',CASE WHEN allowed.capabilities ?| ARRAY['FORMS_MANAGE','REGISTRATION_ROUNDS_MANAGE'] THEN coalesce((
   SELECT jsonb_agg(t ORDER BY (t->>'id'=selected::text) DESC NULLS LAST,ordinal) FROM (
    SELECT t,ordinal FROM jsonb_array_elements(lub.form_library(o.id,selected)) WITH ORDINALITY AS entries(t,ordinal)
    ORDER BY (t->>'id'=selected::text) DESC NULLS LAST,ordinal LIMIT 51
   ) limited
  ),'[]') ELSE '[]' END,
  'rounds',coalesce((SELECT jsonb_agg(lub.round_list_item(c) ORDER BY c.created_at DESC,c.id) FROM (
   SELECT * FROM lub.membership_campaigns c WHERE c.kind='Registration' AND c.organization_id=o.id AND lub.can_read_round(c.id)
   ORDER BY c.created_at DESC,c.id LIMIT 51
  ) c),'[]'),
  'committees',coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'name',c.name) ORDER BY c.name,c.id)
   FROM lub.committees c WHERE c.organization_id=o.id AND c.status_code='Active'),'[]'))
 FROM lub.organizations o JOIN lub.users u ON u.id=auth.uid()
 CROSS JOIN LATERAL (SELECT coalesce(jsonb_agg(capability),'[]') AS capabilities FROM unnest(ARRAY[
  'FORMS_MANAGE','REGISTRATION_ROUNDS_MANAGE','APPLICATIONS_VIEW','APPLICATIONS_REVIEW','APPLICATIONS_BULK_ACTION'
 ]) capability WHERE lub.has_scoped_capability(o.id,capability)) allowed
 WHERE o.id=org AND jsonb_array_length(allowed.capabilities)>0;
$$;
REVOKE ALL ON FUNCTION lub.registration_management_page(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION lub.registration_management_page(uuid,uuid) TO authenticated;
