-- Hour entries stay in their membership period; only the current value/decision is retained.
CREATE FUNCTION lub.can_approve_hours(org uuid,committee uuid DEFAULT NULL) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT lub.has_org_permission(org,'HOURS_APPROVE',committee);
$$;
CREATE FUNCTION lub.hour_storage_owner(target uuid) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT m.id FROM lub.organization_memberships m WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(m.hours) h WHERE (h->>'id')::uuid=target);
$$;
CREATE FUNCTION lub.lock_hour_record(target uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE member uuid; org uuid; entry jsonb;
BEGIN
 member:=lub.hour_storage_owner(target);
 SELECT organization_id INTO org FROM lub.organization_memberships WHERE id=member;
 IF member IS NULL THEN RAISE EXCEPTION 'Hour record required'; END IF;
 PERFORM 1 FROM lub.organizations WHERE id=org FOR SHARE;
 PERFORM 1 FROM lub.organization_memberships WHERE id=member FOR UPDATE;
 SELECT h INTO entry FROM lub.organization_memberships m CROSS JOIN LATERAL jsonb_array_elements(m.hours) h WHERE m.id=member AND (h->>'id')::uuid=target;
 IF entry IS NULL THEN RAISE EXCEPTION 'Hour record required'; END IF;
 RETURN entry||jsonb_build_object('organization_id',org,'organization_membership_id',member);
END; $$;
CREATE FUNCTION lub.store_hour_entry(member uuid,target uuid,entry jsonb) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 UPDATE lub.organization_memberships SET hours=(SELECT jsonb_agg(CASE WHEN (h->>'id')::uuid=target THEN entry-'organization_id'-'organization_membership_id' ELSE h END ORDER BY ordinal)
  FROM jsonb_array_elements(hours) WITH ORDINALITY AS x(h,ordinal)),updated_at=now() WHERE id=member;
$$;
CREATE FUNCTION lub.check_hour_entries() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE h jsonb; actor uuid; committee uuid;
BEGIN
 FOR h IN SELECT value FROM jsonb_array_elements(NEW.hours) LOOP
  IF jsonb_typeof(h->'hours') IS DISTINCT FROM 'number' OR (h->>'hours')::numeric NOT BETWEEN 0 AND 1000 OR (h->>'hours')::numeric<>round((h->>'hours')::numeric,2)
   OR coalesce(h->>'status_code','') NOT IN ('Pending','Approved','Rejected','Voided','Withdrawn') OR coalesce(h->>'source_code','') NOT IN ('MANUAL','SELF_REPORTED','TASK','EVENT_ATTENDANCE')
   OR coalesce(h->>'activity_date','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' OR jsonb_typeof(h->'description') IS DISTINCT FROM 'string' OR length(h->>'description')>3000
   OR coalesce(h->>'academic_term_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'Invalid hour entry'; END IF;
  PERFORM 1 FROM lub.academic_terms t WHERE t.id=(h->>'academic_term_id')::uuid AND (h->>'activity_date')::date BETWEEN t.start_date AND t.end_date FOR KEY SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Hour entry requires its academic term' USING ERRCODE='23503'; END IF;
  committee:=(h->>'committee_id')::uuid;
  IF committee IS NOT NULL THEN
   PERFORM 1 FROM lub.committees c WHERE c.id=committee AND c.organization_id=NEW.organization_id FOR KEY SHARE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Hour committee must belong to the organization' USING ERRCODE='23503'; END IF;
  END IF;
  FOR actor IN SELECT (h->>key)::uuid FROM unnest(ARRAY['requested_by_user_id','reviewed_by_user_id']) key WHERE h->>key IS NOT NULL ORDER BY 1 LOOP
   PERFORM 1 FROM lub.users u WHERE u.id=actor FOR KEY SHARE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Hour actor required' USING ERRCODE='23503'; END IF;
  END LOOP;
 END LOOP;
 IF TG_OP='UPDATE' AND EXISTS(SELECT 1 FROM jsonb_array_elements(OLD.hours) original WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.hours) current_entry WHERE (current_entry->>'id')::uuid=(original->>'id')::uuid)) THEN RAISE EXCEPTION 'Void or withdraw hour entries instead of deleting them'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER membership_hour_entries BEFORE INSERT OR UPDATE OF hours ON lub.organization_memberships FOR EACH ROW EXECUTE FUNCTION lub.check_hour_entries();

CREATE FUNCTION lub.add_hours(member uuid,committee uuid,term uuid,amount numeric,day date,reason text,self_report boolean,confirm_duplicate boolean) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE membership lub.organization_memberships; result uuid:=gen_random_uuid(); approved boolean; org uuid;
BEGIN
 SELECT organization_id INTO org FROM lub.organization_memberships WHERE id=member;
 PERFORM 1 FROM lub.organizations WHERE id=org FOR SHARE;
 SELECT * INTO membership FROM lub.organization_memberships WHERE id=member FOR UPDATE;
 IF membership.id IS NULL OR NOT lub.is_student_account(membership.user_id) OR membership.status_code<>'Active' OR membership.start_date>lub.today_riyadh() OR (membership.end_date IS NOT NULL AND membership.end_date<=lub.today_riyadh()) THEN RAISE EXCEPTION 'Active member required'; END IF;
 IF day IS NULL OR day>lub.today_riyadh() OR day<membership.start_date OR NOT EXISTS(SELECT 1 FROM lub.academic_terms t WHERE t.id=term AND day BETWEEN t.start_date AND t.end_date) THEN RAISE EXCEPTION 'Invalid activity date'; END IF;
 IF committee IS NOT NULL AND NOT EXISTS(SELECT 1 FROM lub.committee_memberships cm JOIN lub.committees c ON c.id=cm.committee_id AND c.organization_id=cm.organization_id WHERE cm.organization_membership_id=member AND cm.committee_id=committee AND c.status_code='Active' AND cm.status_code='Active' AND cm.start_date<=lub.today_riyadh() AND (cm.end_date IS NULL OR cm.end_date>lub.today_riyadh())) THEN RAISE EXCEPTION 'Committee mismatch'; END IF;
 IF self_report IS NULL OR confirm_duplicate IS NULL THEN RAISE EXCEPTION 'Invalid request'; END IF;
 IF self_report THEN
  IF membership.user_id IS DISTINCT FROM auth.uid() OR NOT lub.task_scope_member(org,committee) OR NOT EXISTS(SELECT 1 FROM lub.organizations o WHERE o.id=org AND o.self_report_hours_enabled) THEN RAISE EXCEPTION 'Self-report unavailable' USING ERRCODE='42501'; END IF;
  approved:=false;
 ELSE
  IF NOT lub.has_org_permission(org,'HOURS_MANUAL_ADD',committee) THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
  approved:=lub.can_approve_hours(org,committee);
 END IF;
 IF amount IS NULL OR amount NOT BETWEEN 0 AND 1000 OR amount<>round(amount,2) OR reason IS NULL OR length(trim(reason)) NOT BETWEEN 1 AND 3000 THEN RAISE EXCEPTION 'Invalid hours or reason'; END IF;
 IF NOT confirm_duplicate AND EXISTS(SELECT 1 FROM jsonb_array_elements(membership.hours) h WHERE h->>'activity_date'=day::text AND (h->>'hours')::numeric=amount AND h->>'status_code'<>'Voided') THEN RAISE EXCEPTION 'Duplicate hours' USING ERRCODE='P0003'; END IF;
 UPDATE lub.organization_memberships SET hours=hours||jsonb_build_array(jsonb_build_object('id',result,'committee_id',committee,'academic_term_id',term,'source_code',CASE WHEN self_report THEN 'SELF_REPORTED' ELSE 'MANUAL' END,
  'source_id',NULL,'hours',amount,'activity_date',day,'description',trim(reason),'status_code',CASE WHEN approved THEN 'Approved' ELSE 'Pending' END,
  'requested_by_user_id',auth.uid(),'reviewed_by_user_id',CASE WHEN approved THEN auth.uid() END,'reviewed_at',CASE WHEN approved THEN clock_timestamp() END,'review_note',CASE WHEN approved THEN trim(reason) ELSE '' END,
  'created_at',clock_timestamp(),'updated_at',clock_timestamp())),updated_at=now() WHERE id=member;
 RETURN result;
END; $$;
CREATE FUNCTION lub.add_hours(member uuid,committee uuid,term uuid,amount numeric,day date,reason text,self_report boolean DEFAULT false) RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT lub.add_hours(member,committee,term,amount,day,reason,self_report,false);
$$;
CREATE FUNCTION lub.review_hours(target uuid,status text,note text,expected_org uuid DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE entry jsonb;
BEGIN
 entry:=lub.lock_hour_record(target);
 IF expected_org IS NOT NULL AND (entry->>'organization_id')::uuid<>expected_org THEN RAISE EXCEPTION 'Hour organization mismatch' USING ERRCODE='42501'; END IF;
 IF NOT lub.can_approve_hours((entry->>'organization_id')::uuid,(entry->>'committee_id')::uuid) THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 IF status IS NULL OR NOT ((entry->>'status_code'='Pending' AND status IN ('Approved','Rejected')) OR (entry->>'status_code'='Approved' AND status='Voided'))
  OR note IS NULL OR length(note)>3000 OR (status IN ('Rejected','Voided') AND length(trim(note))=0) THEN RAISE EXCEPTION 'Invalid review'; END IF;
 PERFORM lub.store_hour_entry((entry->>'organization_membership_id')::uuid,target,entry||jsonb_build_object('status_code',status,'reviewed_by_user_id',auth.uid(),'reviewed_at',clock_timestamp(),'review_note',trim(note),'updated_at',clock_timestamp()));
END; $$;
CREATE FUNCTION lub.adjust_hours(target uuid,delta numeric,expected numeric,reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE entry jsonb; amount numeric;
BEGIN
 entry:=lub.lock_hour_record(target); amount:=(entry->>'hours')::numeric;
 IF NOT lub.can_approve_hours((entry->>'organization_id')::uuid,(entry->>'committee_id')::uuid) THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 IF entry->>'status_code' NOT IN ('Pending','Approved') OR amount IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Record changed'; END IF;
 IF delta IS NULL OR delta=0 OR delta NOT BETWEEN -1000 AND 1000 OR delta<>round(delta,2) OR amount+delta NOT BETWEEN 0 AND 1000 OR reason IS NULL OR length(reason)>1000 THEN RAISE EXCEPTION 'Invalid adjustment'; END IF;
 PERFORM lub.store_hour_entry((entry->>'organization_membership_id')::uuid,target,entry||jsonb_build_object('hours',amount+delta,'review_note',trim(reason),'reviewed_by_user_id',auth.uid(),'reviewed_at',clock_timestamp(),'updated_at',clock_timestamp()));
END; $$;
CREATE FUNCTION lub.withdraw_self_report_hours(target uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE entry jsonb;
BEGIN
 entry:=lub.lock_hour_record(target);
 IF entry->>'source_code'<>'SELF_REPORTED' OR entry->>'status_code'<>'Pending' OR entry->>'requested_by_user_id' IS DISTINCT FROM auth.uid()::text OR NOT lub.owns_membership((entry->>'organization_membership_id')::uuid) THEN RAISE EXCEPTION 'Own pending self-request required' USING ERRCODE='42501'; END IF;
 PERFORM lub.store_hour_entry((entry->>'organization_membership_id')::uuid,target,entry||jsonb_build_object('status_code','Withdrawn','reviewed_by_user_id',auth.uid(),'reviewed_at',clock_timestamp(),'review_note','','updated_at',clock_timestamp()));
END; $$;
CREATE FUNCTION lub.set_self_report_hours(org uuid,enabled boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT lub.has_org_permission(org,'ORG_PROFILE_MANAGE') THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 IF enabled IS NULL THEN RAISE EXCEPTION 'Policy state required'; END IF;
 UPDATE lub.organizations SET self_report_hours_enabled=enabled,updated_at=now() WHERE id=org;
END; $$;

REVOKE ALL ON FUNCTION lub.hour_storage_owner(uuid),lub.lock_hour_record(uuid),lub.store_hour_entry(uuid,uuid,jsonb),lub.check_hour_entries(),
 lub.can_approve_hours(uuid,uuid),lub.add_hours(uuid,uuid,uuid,numeric,date,text,boolean,boolean),lub.add_hours(uuid,uuid,uuid,numeric,date,text,boolean),
 lub.review_hours(uuid,text,text,uuid),lub.adjust_hours(uuid,numeric,numeric,text),lub.withdraw_self_report_hours(uuid),lub.set_self_report_hours(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION lub.can_approve_hours(uuid,uuid),lub.add_hours(uuid,uuid,uuid,numeric,date,text,boolean,boolean),lub.add_hours(uuid,uuid,uuid,numeric,date,text,boolean),
 lub.review_hours(uuid,text,text,uuid),lub.adjust_hours(uuid,numeric,numeric,text),lub.withdraw_self_report_hours(uuid),lub.set_self_report_hours(uuid,boolean) TO authenticated;


-- The personal ledger and pending review queue share the same record projection.
CREATE FUNCTION lub.hour_item(entry jsonb,member lub.organization_memberships,org_name text,term_name text,committee_name text,owner_name text,reviewer_name text,can_review boolean) RETURNS jsonb
LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT (entry - ARRAY['source_id','requested_by_user_id','reviewed_by_user_id','hours']) ||
  jsonb_build_object('hours',entry->>'hours','organization_id',member.organization_id,'organization_membership_id',member.id,
   'owner',owner_name,'org_name',org_name,'term_name',term_name,'committee_name',committee_name,'reviewer',reviewer_name,
   'canReview',can_review,'canWithdraw',member.user_id=auth.uid() AND entry->>'source_code'='SELF_REPORTED'
    AND entry->>'status_code'='Pending' AND entry->>'requested_by_user_id'=auth.uid()::text);
$$;

CREATE FUNCTION lub.hours_review_workspace(org uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('selfEnabled',o.self_report_hours_enabled,'canPolicy',lub.has_org_permission(org,'ORG_PROFILE_MANAGE'),
  'records',coalesce((SELECT jsonb_agg(lub.hour_item(h,m,o.name_ar,t.name_ar,c.name,u.full_name_ar,NULL,true)
   ORDER BY h->>'created_at' DESC,h->>'id')
   FROM lub.organization_memberships m JOIN lub.users u ON u.id=m.user_id CROSS JOIN LATERAL jsonb_array_elements(m.hours) h
   JOIN lub.academic_terms t ON t.id=(h->>'academic_term_id')::uuid LEFT JOIN lub.committees c ON c.id=(h->>'committee_id')::uuid
   WHERE m.organization_id=org AND h->>'status_code'='Pending' AND lub.can_approve_hours(org,(h->>'committee_id')::uuid)
  ),'[]'))
 FROM lub.organizations o WHERE o.id=org AND lub.has_hours_access(org);
$$;

CREATE FUNCTION lub.hour_details(target uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT lub.hour_item(h,m,o.name_ar,t.name_ar,c.name,owner.full_name_ar,reviewer.full_name_ar,access.can_review)
 FROM lub.organization_memberships m JOIN lub.organizations o ON o.id=m.organization_id JOIN lub.users owner ON owner.id=m.user_id
 CROSS JOIN LATERAL jsonb_array_elements(m.hours) h
 JOIN lub.academic_terms t ON t.id=(h->>'academic_term_id')::uuid
 LEFT JOIN lub.committees c ON c.id=(h->>'committee_id')::uuid
 LEFT JOIN lub.users reviewer ON reviewer.id=(h->>'reviewed_by_user_id')::uuid
 CROSS JOIN LATERAL (SELECT lub.can_approve_hours(m.organization_id,(h->>'committee_id')::uuid) AS can_review) access
 WHERE m.id=lub.hour_storage_owner(target) AND h->>'id'=target::text AND lub.is_student_account(auth.uid())
  AND (m.user_id=auth.uid() OR access.can_review);
$$;

CREATE FUNCTION lub.my_hours(term uuid DEFAULT NULL, page integer DEFAULT NULL, status text DEFAULT NULL, query text DEFAULT '') RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH account AS MATERIALIZED (
  SELECT id,status_code,onboarded_at,is_test_account FROM lub.users WHERE id=auth.uid()
 ), memberships AS MATERIALIZED (
  SELECT m,o.name_ar AS org_name,o.self_report_hours_enabled,o.status_code AS org_status,o.is_test
  FROM account u JOIN lub.organization_memberships m ON m.user_id=u.id JOIN lub.organizations o ON o.id=m.organization_id
  WHERE lub.is_student_account(u.id)
 ), filtered AS MATERIALIZED (
  SELECT m,org_name,h,(h->>'hours')::numeric AS hours,h->>'status_code' AS state,h->>'created_at' AS created,h->>'id' AS id,
   NOT is_test AND NOT (SELECT is_test_account FROM account) AS counted
  FROM memberships CROSS JOIN LATERAL jsonb_array_elements((m).hours) h
  WHERE (term IS NULL OR h->>'academic_term_id'=term::text)
   AND position(lub.arabic_search_key(left(coalesce(query,''),120)) IN lub.arabic_search_key(org_name||' '||(h->>'description')))>0
 ), page_rows AS (
  SELECT * FROM filtered WHERE status IS NULL OR state=status ORDER BY created DESC,id
  LIMIT CASE WHEN page IS NULL THEN 51 ELSE 26 END OFFSET (least(greatest(page,0),10000)*25)
 ), totals AS (
  SELECT coalesce(sum(hours) FILTER(WHERE state='Approved' AND counted),0)::text AS approved,
   coalesce(sum(hours) FILTER(WHERE state='Pending' AND counted),0)::text AS pending,
   coalesce(sum(hours) FILTER(WHERE state='Rejected' AND counted),0)::text AS rejected,
   count(*) FILTER(WHERE state='Approved' AND counted) AS "approvedCount",
   count(*) FILTER(WHERE state='Pending' AND counted) AS "pendingCount",
   count(*) FILTER(WHERE state='Rejected' AND counted) AS "rejectedCount"
  FROM filtered
 )
 SELECT jsonb_build_object('isTest',u.is_test_account,'account',jsonb_build_object('status',u.status_code,'onboarded',u.onboarded_at IS NOT NULL),
  'terms',coalesce((SELECT jsonb_agg(t ORDER BY t.start_date DESC) FROM (SELECT * FROM lub.academic_terms ORDER BY start_date DESC LIMIT 100) t),'[]'),
  'records',coalesce((SELECT jsonb_agg(lub.hour_item(f.h,f.m,f.org_name,t.name_ar,c.name,NULL,r.full_name_ar,false)
    ORDER BY f.created DESC,f.id) FROM page_rows f JOIN lub.academic_terms t ON t.id=(f.h->>'academic_term_id')::uuid
    LEFT JOIN lub.committees c ON c.id=(f.h->>'committee_id')::uuid LEFT JOIN lub.users r ON r.id=(f.h->>'reviewed_by_user_id')::uuid),'[]'),
  'total',totals.approved,'hoursByStatus',to_jsonb(totals),
  'byOrg',coalesce((SELECT jsonb_agg(a ORDER BY a.name) FROM (
    SELECT org_name AS name,sum(hours)::text AS total FROM filtered WHERE state='Approved' AND counted GROUP BY (m).organization_id,org_name ORDER BY org_name LIMIT 100
  ) a),'[]'),
  'memberships',coalesce((SELECT jsonb_agg(x ORDER BY x.name) FROM (
   SELECT (m).id,(m).organization_id AS org,org_name AS name,self_report_hours_enabled AS self,
    coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'name',c.name) ORDER BY c.name,c.id)
      FROM lub.committee_memberships cm JOIN lub.committees c ON c.id=cm.committee_id
      WHERE cm.organization_membership_id=(m).id AND cm.status_code='Active' AND cm.start_date<=lub.today_riyadh()
       AND (cm.end_date IS NULL OR cm.end_date>lub.today_riyadh()) AND c.status_code='Active'),'[]') AS committees
   FROM memberships WHERE (m).status_code='Active' AND (m).start_date<=lub.today_riyadh()
    AND ((m).end_date IS NULL OR (m).end_date>lub.today_riyadh()) AND org_status='Active' ORDER BY org_name LIMIT 100
  ) x),'[]'))
 FROM account u CROSS JOIN totals;
$$;

REVOKE ALL ON FUNCTION lub.hour_item(jsonb,lub.organization_memberships,text,text,text,text,text,boolean),
 lub.hours_review_workspace(uuid),lub.hour_details(uuid),lub.my_hours(uuid,integer,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION lub.hours_review_workspace(uuid),lub.hour_details(uuid),lub.my_hours(uuid,integer,text,text) TO authenticated;
