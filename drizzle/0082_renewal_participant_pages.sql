CREATE FUNCTION lub.renewal_participant_page(target uuid,query text,state text,page int) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE campaign lub.renewal_campaigns;result jsonb;
BEGIN
 SELECT * INTO campaign FROM lub.renewal_campaigns WHERE id=target;
 IF campaign.id IS NULL OR NOT lub.has_org_permission(campaign.organization_id,'RENEWALS_MANAGE') THEN RETURN NULL; END IF;
 IF query IS NULL OR length(query)>120 OR state IS NULL OR state NOT IN('all','Pending','Renewed','Declined','No_Response') OR page IS NULL OR page NOT BETWEEN 0 AND 10000 THEN RAISE EXCEPTION 'Invalid filters'; END IF;
 WITH filtered AS MATERIALIZED (
  SELECT r.id,p.full_name_ar AS name,p.major_name AS major,p.academic_level AS level,u.is_test,
   CASE WHEN r.response_code='Pending' AND campaign.closes_at<=statement_timestamp() THEN 'No_Response' ELSE r.response_code END AS status,
   coalesce(r.responded_at,campaign.created_at) AS at
  FROM lub.membership_renewals r JOIN lub.organization_memberships m ON m.id=r.organization_membership_id
  JOIN lub.users u ON u.id=m.user_id JOIN lub.student_profiles p ON p.user_id=u.id
  WHERE r.renewal_campaign_id=target AND lub.is_student_account(u.id) AND position(lub.arabic_search_key(query) IN lub.arabic_search_key(p.full_name_ar))>0
 ), selected AS (SELECT id,name,major,level,status,at FROM filtered WHERE state='all' OR status=state)
 SELECT jsonb_build_object('organization',campaign.organization_id,'title',(SELECT name_ar FROM lub.academic_terms WHERE id=campaign.academic_term_id),
  'items',coalesce((SELECT jsonb_agg(row ORDER BY row.at DESC,row.id) FROM (SELECT * FROM selected ORDER BY at DESC,id LIMIT 25 OFFSET page*25) row),'[]'::jsonb),
  'counts',coalesce((SELECT jsonb_object_agg(status,count) FROM (SELECT status,count(*)::int AS count FROM filtered WHERE NOT is_test GROUP BY status) stats),'{}'::jsonb),
  'total',(SELECT count(*) FROM selected),'more',(SELECT count(*) FROM selected)>(page+1)*25) INTO result;
 RETURN result;
END; $$;
REVOKE ALL ON FUNCTION lub.renewal_participant_page(uuid,text,text,int) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION lub.renewal_participant_page(uuid,text,text,int) TO authenticated;
--> statement-breakpoint
CREATE FUNCTION lub.renewal_campaign_summary(target uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE org uuid;
BEGIN
 SELECT organization_id INTO org FROM lub.renewal_campaigns WHERE id=target;
 IF org IS NULL OR NOT lub.has_org_permission(org,'RENEWALS_MANAGE') THEN RETURN NULL; END IF;
 RETURN jsonb_build_object('renewed',(SELECT count(DISTINCT m.user_id) FROM lub.membership_renewals r JOIN lub.organization_memberships m ON m.id=r.organization_membership_id JOIN lub.users u ON u.id=m.user_id WHERE r.renewal_campaign_id=target AND r.response_code='Renewed' AND NOT u.is_test AND lub.is_student_account(u.id)),
 'members',(SELECT count(DISTINCT m.user_id) FROM lub.organization_memberships m JOIN lub.users u ON u.id=m.user_id WHERE m.organization_id=org AND m.merged_into IS NULL AND m.status_code='Active' AND m.start_date<=current_date AND (m.end_date IS NULL OR m.end_date>current_date) AND NOT u.is_test AND lub.is_student_account(u.id)));
END; $$;
REVOKE ALL ON FUNCTION lub.renewal_campaign_summary(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION lub.renewal_campaign_summary(uuid) TO authenticated;
