-- Renewal invitations share campaigns/cases without individual exclusion records.
CREATE FUNCTION lub.lock_renewal_campaign(target uuid,capability text DEFAULT NULL) RETURNS lub.membership_campaigns LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result lub.membership_campaigns; org uuid;
BEGIN
 SELECT organization_id INTO org FROM lub.membership_campaigns WHERE id=target AND kind='Renewal';
 IF org IS NULL THEN RAISE EXCEPTION 'Renewal campaign required'; END IF;
 PERFORM 1 FROM lub.organizations WHERE id=org FOR SHARE;
 SELECT * INTO result FROM lub.membership_campaigns WHERE id=target AND kind='Renewal' FOR UPDATE;
 IF result.id IS NULL OR (capability IS NOT NULL AND NOT lub.has_org_permission(org,capability)) THEN RAISE EXCEPTION 'Campaign permission required' USING ERRCODE='42501'; END IF;
 RETURN result;
END; $$;
CREATE FUNCTION lub.create_renewal(org uuid,term uuid,opens timestamptz,closes timestamptz,exclude_leaders boolean) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result uuid; title text;
BEGIN
 PERFORM 1 FROM lub.organizations WHERE id=org FOR UPDATE;
 IF NOT lub.has_org_permission(org,'RENEWALS_MANAGE') THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 SELECT name_ar INTO title FROM lub.academic_terms WHERE id=term FOR KEY SHARE;
 IF title IS NULL OR opens IS NULL OR closes IS NULL OR closes<=opens OR exclude_leaders IS NULL THEN RAISE EXCEPTION 'Term and valid period required'; END IF;
 INSERT INTO lub.membership_campaigns(organization_id,kind,academic_term_id,title,opens_at,closes_at,exclude_leadership)
 VALUES(org,'Renewal',term,title,opens,closes,exclude_leaders) RETURNING id INTO result;
 RETURN result;
END; $$;
CREATE FUNCTION lub.save_renewal_draft(target uuid,term uuid,opens timestamptz,closes timestamptz,leaders boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE campaign lub.membership_campaigns; term_title text;
BEGIN
 campaign:=lub.lock_renewal_campaign(target,'RENEWALS_MANAGE');
 SELECT name_ar INTO term_title FROM lub.academic_terms WHERE id=term FOR KEY SHARE;
 IF campaign.status_code<>'Draft' OR term_title IS NULL OR opens IS NULL OR closes IS NULL OR closes<=opens OR leaders IS NULL THEN RAISE EXCEPTION 'Valid draft required'; END IF;
 UPDATE lub.membership_campaigns SET academic_term_id=term,title=term_title,opens_at=opens,closes_at=closes,exclude_leadership=leaders,updated_at=now() WHERE id=target;
END; $$;
CREATE FUNCTION lub.change_renewal_status(target uuid,status text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE campaign lub.membership_campaigns; invited record;
BEGIN
 PERFORM 1 FROM lub.organizations o WHERE o.id=(SELECT c.organization_id FROM lub.membership_campaigns c WHERE c.id=target) FOR UPDATE;
 campaign:=lub.lock_renewal_campaign(target,'RENEWALS_MANAGE');
 IF status IS NULL OR NOT ((campaign.status_code IN ('Draft','Paused') AND status='Open' AND campaign.closes_at>statement_timestamp())
 OR (campaign.status_code='Open' AND status='Paused') OR (campaign.status_code IN ('Open','Paused') AND status='Closed')
 OR (campaign.status_code='Closed' AND status='Archived') OR (campaign.status_code='Archived' AND status='Closed')) THEN RAISE EXCEPTION 'Invalid renewal transition'; END IF;
 IF status='Open' AND campaign.status_code='Draft' THEN
  INSERT INTO lub.membership_cases(campaign_id,organization_id,kind,user_id,organization_membership_id,status_code)
  SELECT target,m.organization_id,'Renewal',m.user_id,m.id,'Pending' FROM lub.organization_memberships m
  WHERE m.organization_id=campaign.organization_id AND m.status_code='Active' AND m.start_date<=lub.today_riyadh() AND (m.end_date IS NULL OR m.end_date>lub.today_riyadh()) AND lub.is_student_account(m.user_id)
   AND (NOT campaign.exclude_leadership OR NOT EXISTS(SELECT 1 FROM lub.access_assignments a WHERE a.organization_membership_id=m.id AND a.start_at<=statement_timestamp() AND (a.end_at IS NULL OR a.end_at>statement_timestamp())))
  ORDER BY m.id FOR UPDATE OF m;
  FOR invited IN SELECT c.user_id FROM lub.membership_cases c WHERE c.campaign_id=target ORDER BY c.user_id LOOP
   PERFORM lub.workflow_notify(invited.user_id,'RENEWAL_Open','/applications?tab=renewals');
  END LOOP;
 ELSIF status='Closed' AND campaign.status_code IN ('Open','Paused') THEN
  INSERT INTO lub.history_events(organization_id,membership_case_id,event_code,from_status_code,to_status_code,actor_user_id)
  SELECT c.organization_id,c.id,'RenewalClosed','Pending','No_Response',auth.uid() FROM lub.membership_cases c WHERE c.campaign_id=target AND c.status_code='Pending';
  UPDATE lub.membership_cases SET status_code='No_Response',status_revision=status_revision+1,decided_at=now(),decided_by_user_id=auth.uid() WHERE campaign_id=target AND status_code='Pending';
  FOR invited IN SELECT c.user_id FROM lub.membership_cases c WHERE c.campaign_id=target ORDER BY c.user_id LOOP
   PERFORM lub.workflow_notify(invited.user_id,'RENEWAL_Closed','/applications?tab=renewals');
  END LOOP;
 END IF;
 UPDATE lub.membership_campaigns SET status_code=status,updated_at=now() WHERE id=target;
END; $$;
CREATE FUNCTION lub.respond_renewal(target uuid,response text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE campaign lub.membership_campaigns; invitation lub.membership_cases;
BEGIN
 campaign:=lub.lock_renewal_campaign((SELECT campaign_id FROM lub.membership_cases WHERE id=target AND kind='Renewal'));
 SELECT * INTO invitation FROM lub.membership_cases WHERE id=target AND kind='Renewal' FOR UPDATE;
 IF invitation.id IS NULL OR invitation.user_id IS DISTINCT FROM auth.uid() OR NOT lub.is_student_account(auth.uid()) OR NOT lub.task_scope_member(campaign.organization_id,NULL)
  OR campaign.status_code<>'Open' OR statement_timestamp()<campaign.opens_at OR statement_timestamp()>=campaign.closes_at OR invitation.status_code<>'Pending'
  OR response IS NULL OR response NOT IN ('Renewed','Declined') THEN RAISE EXCEPTION 'Response unavailable' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM lub.organization_memberships m WHERE m.id=invitation.organization_membership_id AND m.user_id=auth.uid() AND m.status_code='Active'
  AND m.start_date<=lub.today_riyadh() AND (m.end_date IS NULL OR m.end_date>lub.today_riyadh()) FOR UPDATE;
 IF NOT FOUND OR EXISTS(SELECT 1 FROM lub.history_events h WHERE h.organization_membership_id=invitation.organization_membership_id AND h.event_code='Ended' AND h.occurred_at>=campaign.created_at) THEN RAISE EXCEPTION 'Active invited membership required' USING ERRCODE='42501'; END IF;
 UPDATE lub.membership_cases SET status_code=response,status_revision=status_revision+1,decided_at=now(),decided_by_user_id=auth.uid() WHERE id=target;
 INSERT INTO lub.history_events(organization_id,membership_case_id,event_code,from_status_code,to_status_code,actor_user_id)
 VALUES(invitation.organization_id,target,'RenewalResponse','Pending',response,auth.uid());
END; $$;
CREATE FUNCTION lub.transition_campaign(kind text,target uuid,operation text,expected text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE campaign lub.membership_campaigns; org uuid; requested_kind text;
BEGIN
 requested_kind:=CASE kind WHEN 'round' THEN 'Registration' WHEN 'renewal' THEN 'Renewal' END;
 SELECT organization_id INTO org FROM lub.membership_campaigns WHERE id=target AND membership_campaigns.kind=requested_kind;
 PERFORM 1 FROM lub.organizations WHERE id=org FOR UPDATE;
 SELECT * INTO campaign FROM lub.membership_campaigns WHERE id=target AND membership_campaigns.kind=requested_kind FOR UPDATE;
 IF campaign.id IS NULL OR NOT lub.has_org_permission(org,CASE WHEN kind='round' THEN 'REGISTRATION_ROUNDS_MANAGE' ELSE 'RENEWALS_MANAGE' END) THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 IF campaign.status_code IS DISTINCT FROM expected OR operation IS NULL OR NOT (
  (expected='Draft' AND operation IN ('publish','delete')) OR (expected='Open' AND operation IN ('pause','close')) OR (expected='Paused' AND operation IN ('resume','close'))
  OR (expected='Closed' AND operation='archive') OR (expected='Archived' AND operation='restore')) THEN RAISE EXCEPTION 'Refresh campaign'; END IF;
 IF operation='delete' THEN
  IF EXISTS(SELECT 1 FROM lub.membership_cases c WHERE c.campaign_id=target) THEN RAISE EXCEPTION 'Used campaign cannot be deleted'; END IF;
  DELETE FROM lub.membership_campaigns WHERE id=target;
 ELSIF kind='renewal' THEN
  PERFORM lub.change_renewal_status(target,CASE operation WHEN 'publish' THEN 'Open' WHEN 'resume' THEN 'Open' WHEN 'pause' THEN 'Paused' WHEN 'close' THEN 'Closed' WHEN 'archive' THEN 'Archived' ELSE 'Closed' END);
 ELSIF operation='restore' THEN UPDATE lub.membership_campaigns SET status_code='Closed',updated_at=now() WHERE id=target;
 ELSE PERFORM lub.change_round_status(target,CASE operation WHEN 'publish' THEN 'Open' WHEN 'resume' THEN 'Open' WHEN 'pause' THEN 'Paused' WHEN 'close' THEN 'Closed' ELSE 'Archived' END);
 END IF;
END; $$;
CREATE FUNCTION lub.renewal_participant_page(target uuid,query text,state text,page int) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE campaign lub.membership_campaigns; result jsonb;
BEGIN
 SELECT * INTO campaign FROM lub.membership_campaigns WHERE id=target AND kind='Renewal';
 IF campaign.id IS NULL OR NOT lub.has_org_permission(campaign.organization_id,'RENEWALS_MANAGE') THEN RETURN NULL; END IF;
 IF query IS NULL OR length(query)>120 OR state IS NULL OR state NOT IN ('all','Pending','Renewed','Declined','No_Response') OR page IS NULL OR page NOT BETWEEN 0 AND 10000 THEN RAISE EXCEPTION 'Invalid filters'; END IF;
 WITH filtered AS MATERIALIZED (
  SELECT c.id,u.full_name_ar name,u.major_name major,u.academic_level level,u.is_test_account is_test,
   CASE WHEN c.status_code='Pending' AND campaign.closes_at<=statement_timestamp() THEN 'No_Response' ELSE c.status_code END status,
   coalesce(c.decided_at,c.submitted_at) at
  FROM lub.membership_cases c JOIN lub.users u ON u.id=c.user_id WHERE c.campaign_id=target AND lub.is_student_account(u.id)
  AND position(lub.arabic_search_key(query) IN lub.arabic_search_key(u.full_name_ar))>0
 ), selected AS (SELECT id,name,major,level,status,at FROM filtered WHERE state='all' OR status=state)
 SELECT jsonb_build_object('organization',campaign.organization_id,'title',campaign.title,
  'items',coalesce((SELECT jsonb_agg(row ORDER BY row.at DESC,row.id) FROM (SELECT * FROM selected ORDER BY at DESC,id LIMIT 25 OFFSET page*25) row),'[]'::jsonb),
  'counts',coalesce((SELECT jsonb_object_agg(status,count) FROM (SELECT status,count(*)::int count FROM filtered WHERE NOT is_test GROUP BY status) stats),'{}'::jsonb),
  'total',(SELECT count(*) FROM selected),'more',(SELECT count(*) FROM selected)>(page+1)*25) INTO result;
 RETURN result;
END; $$;
CREATE FUNCTION lub.renewal_campaign_summary(target uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE org uuid;
BEGIN
 SELECT organization_id INTO org FROM lub.membership_campaigns WHERE id=target AND kind='Renewal';
 IF org IS NULL OR NOT lub.has_org_permission(org,'RENEWALS_MANAGE') THEN RETURN NULL; END IF;
 RETURN jsonb_build_object('renewed',(SELECT count(*) FROM lub.membership_cases c JOIN lub.users u ON u.id=c.user_id WHERE c.campaign_id=target AND c.status_code='Renewed' AND NOT u.is_test_account AND lub.is_student_account(u.id)),
 'members',(SELECT count(DISTINCT m.user_id) FROM lub.organization_memberships m JOIN lub.users u ON u.id=m.user_id WHERE m.organization_id=org AND m.status_code='Active' AND m.start_date<=lub.today_riyadh() AND (m.end_date IS NULL OR m.end_date>lub.today_riyadh()) AND NOT u.is_test_account AND lub.is_student_account(u.id)));
END; $$;
DROP POLICY case_read ON lub.membership_cases;
CREATE POLICY case_read ON lub.membership_cases FOR SELECT TO authenticated USING(
 (user_id=auth.uid() AND EXISTS(SELECT 1 FROM lub.users WHERE id=auth.uid() AND status_code='Active')) OR lub.is_super_admin()
 OR (kind='Registration' AND lub.can_read_application(id)) OR (kind='Renewal' AND lub.has_org_permission(organization_id,'RENEWALS_MANAGE')));
CREATE INDEX campaigns_org_kind_term ON lub.membership_campaigns(organization_id,kind,academic_term_id);
CREATE INDEX cases_campaign_state ON lub.membership_cases(campaign_id,status_code);
REVOKE ALL ON FUNCTION lub.lock_renewal_campaign(uuid,text),lub.create_renewal(uuid,uuid,timestamptz,timestamptz,boolean),lub.save_renewal_draft(uuid,uuid,timestamptz,timestamptz,boolean),lub.change_renewal_status(uuid,text),lub.respond_renewal(uuid,text),lub.transition_campaign(text,uuid,text,text),lub.renewal_participant_page(uuid,text,text,int),lub.renewal_campaign_summary(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION lub.create_renewal(uuid,uuid,timestamptz,timestamptz,boolean),lub.save_renewal_draft(uuid,uuid,timestamptz,timestamptz,boolean),lub.change_renewal_status(uuid,text),lub.respond_renewal(uuid,text),lub.transition_campaign(text,uuid,text,text),lub.renewal_participant_page(uuid,text,text,int),lub.renewal_campaign_summary(uuid) TO authenticated;
