-- Fresh scoped permissions; the global administrator is not an operational leader.
CREATE OR REPLACE FUNCTION lub.has_org_permission(target_org uuid, capability text, target_committee uuid DEFAULT NULL) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT capability IN ('ORG_PROFILE_MANAGE','COMMITTEE_MANAGE','COMMITTEE_PROFILE_MANAGE','MEMBERS_VIEW','FORMS_MANAGE','REGISTRATION_ROUNDS_MANAGE','APPLICATIONS_VIEW','APPLICATIONS_REVIEW','APPLICATIONS_BULK_ACTION','PERMISSIONS_GRANT','TASKS_MANAGE','TASK_TEMPLATES_MANAGE','HOUR_RULES_MANAGE','HOURS_APPROVE','HOURS_MANUAL_ADD','RENEWALS_MANAGE')
 AND EXISTS(SELECT 1 FROM lub.organizations WHERE id=target_org AND status_code='Active')
 AND (target_committee IS NULL OR EXISTS(SELECT 1 FROM lub.committees WHERE id=target_committee AND organization_id=target_org AND status_code='Active'))
 AND EXISTS(SELECT 1 FROM lub.organization_memberships m JOIN lub.users u ON u.id=m.user_id WHERE u.id=auth.uid() AND u.status_code='Active' AND m.organization_id=target_org AND m.status_code='Active' AND m.start_date<=current_date AND (m.end_date IS NULL OR m.end_date>current_date)
 AND (EXISTS(SELECT 1 FROM lub.role_assignments r WHERE r.organization_membership_id=m.id AND r.start_date<=current_date AND (r.end_date IS NULL OR r.end_date>current_date) AND (r.role_code IN ('OL','OD') OR (r.role_code IN ('CL','CD') AND r.committee_id=target_committee AND capability IN ('COMMITTEE_PROFILE_MANAGE','MEMBERS_VIEW','TASKS_MANAGE','TASK_TEMPLATES_MANAGE','HOUR_RULES_MANAGE','HOURS_APPROVE','HOURS_MANUAL_ADD'))))
 OR EXISTS(SELECT 1 FROM lub.permission_grants g WHERE g.organization_membership_id=m.id AND g.permission_code=capability AND g.start_at<=statement_timestamp() AND (g.end_at IS NULL OR g.end_at>statement_timestamp()) AND (g.committee_id IS NULL OR g.committee_id=target_committee))));
$$;
CREATE FUNCTION lub.has_hours_access(org uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT lub.has_org_permission(org,'HOURS_APPROVE') OR lub.has_org_permission(org,'HOURS_MANUAL_ADD') OR lub.has_org_permission(org,'HOUR_RULES_MANAGE') OR lub.has_org_permission(org,'RENEWALS_MANAGE') OR EXISTS(SELECT 1 FROM lub.committees c WHERE c.organization_id=org AND (lub.has_org_permission(org,'HOURS_APPROVE',c.id) OR lub.has_org_permission(org,'HOURS_MANUAL_ADD',c.id) OR lub.has_org_permission(org,'HOUR_RULES_MANAGE',c.id)));
$$;
CREATE FUNCTION lub.owns_membership(target uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM lub.organization_memberships m JOIN lub.users u ON u.id=m.user_id WHERE m.id=target AND m.user_id=auth.uid() AND u.status_code='Active');
$$;
CREATE FUNCTION lub.can_approve_hours(org uuid,committee uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT lub.has_org_permission(org,'HOURS_APPROVE') OR lub.has_org_permission(org,'HOURS_APPROVE',committee); $$;
GRANT SELECT ON lub.academic_terms,lub.hour_records,lub.hour_rules,lub.renewal_campaigns,lub.renewal_campaign_exclusions,lub.membership_renewals TO authenticated;
CREATE POLICY academic_terms_read ON lub.academic_terms FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM lub.users WHERE id=auth.uid() AND status_code='Active'));
CREATE POLICY hour_records_read ON lub.hour_records FOR SELECT TO authenticated USING(lub.owns_membership(organization_membership_id) OR lub.can_approve_hours(organization_id,committee_id) OR lub.has_org_permission(organization_id,'HOURS_MANUAL_ADD',committee_id));
CREATE POLICY hour_rules_read ON lub.hour_rules FOR SELECT TO authenticated USING(lub.has_org_permission(organization_id,'HOUR_RULES_MANAGE',committee_id) OR lub.has_org_permission(organization_id,'TASKS_MANAGE',committee_id));
CREATE POLICY renewal_campaigns_read ON lub.renewal_campaigns FOR SELECT TO authenticated USING(lub.has_org_permission(organization_id,'RENEWALS_MANAGE') OR (status_code<>'Draft' AND EXISTS(SELECT 1 FROM lub.membership_renewals r WHERE r.renewal_campaign_id=id AND lub.owns_membership(r.organization_membership_id))));
CREATE POLICY membership_renewals_read ON lub.membership_renewals FOR SELECT TO authenticated USING(lub.owns_membership(organization_membership_id) OR EXISTS(SELECT 1 FROM lub.renewal_campaigns c WHERE c.id=renewal_campaign_id AND lub.has_org_permission(c.organization_id,'RENEWALS_MANAGE')));
CREATE POLICY renewal_exclusions_read ON lub.renewal_campaign_exclusions FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM lub.renewal_campaigns c WHERE c.id=renewal_campaign_id AND lub.has_org_permission(c.organization_id,'RENEWALS_MANAGE')));
-- Avoid RLS recursion between campaigns and responses.
CREATE FUNCTION lub.owns_renewal_campaign(target uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT EXISTS(SELECT 1 FROM lub.membership_renewals r WHERE r.renewal_campaign_id=target AND lub.owns_membership(r.organization_membership_id)); $$;
ALTER POLICY renewal_campaigns_read ON lub.renewal_campaigns USING(lub.has_org_permission(organization_id,'RENEWALS_MANAGE') OR (status_code<>'Draft' AND lub.owns_renewal_campaign(id)));
CREATE FUNCTION lub.create_academic_term(year text,code text,name text,starts date,ends date) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result uuid;
BEGIN
 IF NOT lub.is_super_admin() THEN RAISE EXCEPTION 'Administrator required' USING ERRCODE='42501'; END IF;
 -- ponytail: one rare term-creation lock; replace with a range exclusion if terms become high-volume writes.
 PERFORM pg_catalog.pg_advisory_xact_lock(762015);
 IF EXISTS(SELECT 1 FROM lub.academic_terms WHERE start_date<=ends AND end_date>=starts) THEN RAISE EXCEPTION 'Overlapping term'; END IF;
 INSERT INTO lub.academic_terms(academic_year,term_code,name_ar,start_date,end_date) VALUES(trim(year),trim(code),trim(name),starts,ends) RETURNING id INTO result;
 PERFORM lub.task_audit(result,NULL,'ACADEMIC_TERM_CREATED');RETURN result;
END; $$;
CREATE TRIGGER academic_terms_immutable BEFORE UPDATE OR DELETE ON lub.academic_terms FOR EACH ROW EXECUTE FUNCTION lub.guard_task_revision();
CREATE FUNCTION lub.workflow_notify(recipient uuid,kind text,target text) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 INSERT INTO lub.notifications(recipient_user_id,type_code,title,body,target_url) VALUES(recipient,kind,'تحديث على الساعات أو التجديد','افتح سجلك للاطلاع على التحديث.',target);
$$;
CREATE FUNCTION lub.hour_record_event() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE recipient uuid;
BEGIN
 IF NEW.status_code<>'Pending' THEN
  INSERT INTO lub.hour_decisions(hour_record_id,status_code,actor_user_id,note) VALUES(NEW.id,NEW.status_code,NEW.reviewed_by_user_id,coalesce(NEW.review_note,''));
 END IF;
 SELECT user_id INTO recipient FROM lub.organization_memberships WHERE id=NEW.organization_membership_id;
 PERFORM lub.workflow_notify(recipient,'HOURS_CHANGED','/hours');PERFORM lub.task_audit(NEW.id,NEW.organization_id,'HOURS_'||NEW.status_code);
 RETURN NEW;
END; $$;
CREATE FUNCTION lub.guard_hour_record() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Hours history is immutable'; END IF;
 IF (to_jsonb(NEW)-ARRAY['status_code','reviewed_by_user_id','reviewed_at','review_note','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status_code','reviewed_by_user_id','reviewed_at','review_note','updated_at']) OR NOT ((OLD.status_code='Pending' AND NEW.status_code IN ('Approved','Rejected')) OR (OLD.status_code='Approved' AND NEW.status_code='Voided')) THEN RAISE EXCEPTION 'Invalid hours transition'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER hour_record_guard BEFORE UPDATE OR DELETE ON lub.hour_records FOR EACH ROW EXECUTE FUNCTION lub.guard_hour_record();
CREATE TRIGGER hour_record_event AFTER INSERT OR UPDATE ON lub.hour_records FOR EACH ROW EXECUTE FUNCTION lub.hour_record_event();
CREATE FUNCTION lub.add_hours(member uuid,committee uuid,term uuid,amount numeric,day date,reason text,self_report boolean DEFAULT false) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE m lub.organization_memberships; result uuid; approved boolean;
BEGIN
 SELECT * INTO m FROM lub.organization_memberships WHERE id=member FOR UPDATE;
 IF m.id IS NULL OR m.status_code<>'Active' OR m.start_date>current_date OR (m.end_date IS NOT NULL AND m.end_date<=current_date) OR NOT EXISTS(SELECT 1 FROM lub.users WHERE id=m.user_id AND status_code='Active') THEN RAISE EXCEPTION 'Active member required'; END IF;
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
 INSERT INTO lub.hour_records(organization_id,organization_membership_id,committee_id,academic_term_id,source_code,hours,activity_date,description,status_code,requested_by_user_id,reviewed_by_user_id,reviewed_at,review_note)
 VALUES(m.organization_id,member,committee,term,CASE WHEN self_report THEN 'SELF_REPORTED' ELSE 'MANUAL' END,amount,day,trim(reason),CASE WHEN approved THEN 'Approved' ELSE 'Pending' END,auth.uid(),CASE WHEN approved THEN auth.uid() END,CASE WHEN approved THEN now() END,CASE WHEN approved THEN trim(reason) END) RETURNING id INTO result;
 RETURN result;
END; $$;
CREATE FUNCTION lub.review_hours(target uuid,status text,note text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE h lub.hour_records;
BEGIN
 SELECT * INTO h FROM lub.hour_records WHERE id=target FOR UPDATE;
 IF h.id IS NULL OR NOT lub.can_approve_hours(h.organization_id,h.committee_id) THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 IF status IS NULL OR NOT ((h.status_code='Pending' AND status IN ('Approved','Rejected')) OR (h.status_code='Approved' AND status='Voided')) OR note IS NULL OR length(note)>3000 OR (status IN ('Rejected','Voided') AND length(trim(note))=0) THEN RAISE EXCEPTION 'Invalid review'; END IF;
 UPDATE lub.hour_records SET status_code=status,reviewed_by_user_id=auth.uid(),reviewed_at=now(),review_note=trim(note),updated_at=now() WHERE id=target;
END; $$;
CREATE FUNCTION lub.award_task_hours(target uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p lub.task_participants; t lub.tasks; s lub.task_submissions; term uuid; day date; amount numeric; result uuid; approved boolean;
BEGIN
 SELECT * INTO p FROM lub.task_participants WHERE id=target FOR UPDATE;SELECT * INTO t FROM lub.tasks WHERE id=p.task_id;
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
CREATE FUNCTION lub.import_task_hours(target uuid) RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT lub.award_task_hours(target); $$;
CREATE FUNCTION lub.task_hours_trigger() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN IF NEW.status_code='Approved' AND OLD.status_code IS DISTINCT FROM NEW.status_code THEN PERFORM lub.award_task_hours(NEW.id); END IF;RETURN NEW; END; $$;
CREATE TRIGGER task_hours_award AFTER UPDATE ON lub.task_participants FOR EACH ROW EXECUTE FUNCTION lub.task_hours_trigger();
CREATE FUNCTION lub.set_self_report_hours(org uuid,enabled boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF NOT lub.has_org_permission(org,'ORG_PROFILE_MANAGE') THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 UPDATE lub.organizations SET self_report_hours_enabled=enabled WHERE id=org;PERFORM lub.task_audit(org,org,'HOURS_SELF_REPORT_POLICY');
END; $$;
CREATE FUNCTION lub.save_hour_rule(target uuid,org uuid,committee uuid,template uuid,name text,amount numeric,starts date,ends date,active boolean,expected int) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r lub.hour_rules;
BEGIN
 IF NOT lub.has_org_permission(org,'HOUR_RULES_MANAGE',committee) THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 IF amount IS NULL OR amount<>round(amount,2) OR amount::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Invalid hours'; END IF;
 IF template IS NOT NULL AND NOT EXISTS(SELECT 1 FROM lub.task_templates WHERE id=template AND organization_id=org AND (committee_id IS NULL OR committee_id=committee)) THEN RAISE EXCEPTION 'Template mismatch'; END IF;
 IF target IS NULL THEN INSERT INTO lub.hour_rules(organization_id,committee_id,task_template_id,name,default_hours,effective_from,effective_to,is_active) VALUES(org,committee,template,trim(name),amount,starts,ends,active) RETURNING id INTO target;
 ELSE SELECT * INTO r FROM lub.hour_rules WHERE id=target FOR UPDATE;
  IF r.id IS NULL OR r.organization_id IS DISTINCT FROM org OR r.committee_id IS DISTINCT FROM committee OR r.task_template_id IS DISTINCT FROM template OR r.revision IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Rule changed'; END IF;
  UPDATE lub.hour_rules SET name=trim(save_hour_rule.name),default_hours=amount,effective_from=starts,effective_to=ends,is_active=active,revision=revision+1 WHERE id=target;
 END IF;PERFORM lub.task_audit(target,org,'HOUR_RULE_CHANGED');RETURN target;
END; $$;
CREATE FUNCTION lub.hour_owner_name(target uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT p.full_name_ar FROM lub.hour_records h JOIN lub.organization_memberships m ON m.id=h.organization_membership_id JOIN lub.student_profiles p ON p.user_id=m.user_id WHERE h.id=target AND (lub.owns_membership(m.id) OR lub.can_approve_hours(h.organization_id,h.committee_id) OR lub.has_org_permission(h.organization_id,'HOURS_MANUAL_ADD',h.committee_id));
$$;
CREATE FUNCTION lub.hour_members(org uuid,committee uuid,skip int DEFAULT 0) RETURNS TABLE(id uuid,name text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT m.id,p.full_name_ar::text FROM lub.organization_memberships m JOIN lub.student_profiles p ON p.user_id=m.user_id JOIN lub.users u ON u.id=m.user_id WHERE m.organization_id=org AND m.status_code='Active' AND u.status_code='Active' AND m.start_date<=current_date AND (m.end_date IS NULL OR m.end_date>current_date) AND (lub.has_org_permission(org,'HOURS_MANUAL_ADD',committee) OR lub.has_org_permission(org,'RENEWALS_MANAGE')) AND (committee IS NULL OR EXISTS(SELECT 1 FROM lub.committee_memberships cm WHERE cm.organization_membership_id=m.id AND cm.committee_id=committee AND cm.status_code='Active' AND cm.start_date<=current_date AND (cm.end_date IS NULL OR cm.end_date>current_date))) ORDER BY p.full_name_ar,m.id LIMIT 26 OFFSET greatest(0,least(skip,250000));
$$;
CREATE FUNCTION lub.create_renewal(org uuid,term uuid,opens timestamptz,closes timestamptz,exclude_leaders boolean) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result uuid;
BEGIN
 IF NOT lub.has_org_permission(org,'RENEWALS_MANAGE') THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 INSERT INTO lub.renewal_campaigns(organization_id,academic_term_id,opens_at,closes_at,exclude_leadership) VALUES(org,term,opens,closes,exclude_leaders) RETURNING id INTO result;
 PERFORM lub.task_audit(result,org,'RENEWAL_CREATED');RETURN result;
END; $$;
CREATE FUNCTION lub.exclude_renewal_member(target uuid,member uuid,reason text,excluded boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c lub.renewal_campaigns;
BEGIN
 SELECT * INTO c FROM lub.renewal_campaigns WHERE id=target FOR UPDATE;
 IF c.id IS NULL OR c.status_code<>'Draft' OR NOT lub.has_org_permission(c.organization_id,'RENEWALS_MANAGE') OR NOT EXISTS(SELECT 1 FROM lub.organization_memberships WHERE id=member AND organization_id=c.organization_id) THEN RAISE EXCEPTION 'Exclusion unavailable' USING ERRCODE='42501'; END IF;
 IF excluded THEN INSERT INTO lub.renewal_campaign_exclusions VALUES(target,member,trim(reason)) ON CONFLICT (renewal_campaign_id,organization_membership_id) DO UPDATE SET reason=excluded.reason;
 ELSE DELETE FROM lub.renewal_campaign_exclusions WHERE renewal_campaign_id=target AND organization_membership_id=member;END IF;
 PERFORM lub.task_audit(target,c.organization_id,'RENEWAL_EXCLUSION_CHANGED');
END; $$;
CREATE FUNCTION lub.change_renewal_status(target uuid,status text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c lub.renewal_campaigns;
BEGIN
 SELECT * INTO c FROM lub.renewal_campaigns WHERE id=target FOR UPDATE;
 IF c.id IS NULL OR NOT lub.has_org_permission(c.organization_id,'RENEWALS_MANAGE') THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 IF status IS NULL OR NOT ((c.status_code='Draft' AND status='Open' AND c.closes_at>statement_timestamp()) OR (c.status_code='Open' AND status='Closed') OR (c.status_code='Closed' AND status='Archived')) THEN RAISE EXCEPTION 'Invalid renewal transition'; END IF;
 IF status='Open' THEN
  INSERT INTO lub.membership_renewals(renewal_campaign_id,organization_membership_id)
  SELECT c.id,m.id FROM lub.organization_memberships m JOIN lub.users u ON u.id=m.user_id WHERE m.organization_id=c.organization_id AND m.status_code='Active' AND u.status_code='Active' AND m.start_date<=current_date AND (m.end_date IS NULL OR m.end_date>current_date)
  AND NOT EXISTS(SELECT 1 FROM lub.renewal_campaign_exclusions e WHERE e.renewal_campaign_id=c.id AND e.organization_membership_id=m.id)
  AND (NOT c.exclude_leadership OR NOT EXISTS(SELECT 1 FROM lub.role_assignments r WHERE r.organization_membership_id=m.id AND r.start_date<=current_date AND (r.end_date IS NULL OR r.end_date>current_date))) FOR UPDATE OF m;
 ELSEIF status='Closed' THEN
  UPDATE lub.membership_renewals SET response_code='No_Response',responded_at=now() WHERE renewal_campaign_id=c.id AND response_code='Pending';
 END IF;
 UPDATE lub.renewal_campaigns SET status_code=status WHERE id=target;
 IF status IN ('Open','Closed') THEN
  INSERT INTO lub.notifications(recipient_user_id,type_code,title,body,target_url)
  SELECT m.user_id,'RENEWAL_'||status,'تحديث تجديد العضوية','افتح التجديد للاطلاع على الحملة ونتيجتك.','/renewals' FROM lub.membership_renewals r JOIN lub.organization_memberships m ON m.id=r.organization_membership_id WHERE r.renewal_campaign_id=target;
 END IF;
 PERFORM lub.task_audit(target,c.organization_id,'RENEWAL_'||status);
END; $$;
CREATE FUNCTION lub.respond_renewal(target uuid,response text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE campaign uuid; c lub.renewal_campaigns; r lub.membership_renewals;
BEGIN
 SELECT renewal_campaign_id INTO campaign FROM lub.membership_renewals WHERE id=target;
 SELECT * INTO c FROM lub.renewal_campaigns WHERE id=campaign FOR UPDATE;SELECT * INTO r FROM lub.membership_renewals WHERE id=target FOR UPDATE;
 IF r.id IS NULL OR NOT lub.owns_membership(r.organization_membership_id) OR NOT lub.task_scope_member(c.organization_id,NULL) OR NOT EXISTS(SELECT 1 FROM lub.organization_memberships WHERE id=r.organization_membership_id AND status_code='Active' AND start_date<=current_date AND (end_date IS NULL OR end_date>current_date)) OR c.status_code<>'Open' OR statement_timestamp()<c.opens_at OR statement_timestamp()>=c.closes_at OR r.response_code<>'Pending' OR response IS NULL OR response NOT IN ('Renewed','Declined') THEN RAISE EXCEPTION 'Response unavailable' USING ERRCODE='42501'; END IF;
 UPDATE lub.membership_renewals SET response_code=response,responded_at=now() WHERE id=target;
 PERFORM lub.task_audit(target,c.organization_id,'RENEWAL_RESPONSE');
END; $$;
CREATE FUNCTION lub.renewal_member_name(target uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT p.full_name_ar FROM lub.membership_renewals r JOIN lub.renewal_campaigns c ON c.id=r.renewal_campaign_id JOIN lub.organization_memberships m ON m.id=r.organization_membership_id JOIN lub.student_profiles p ON p.user_id=m.user_id WHERE r.id=target AND (lub.owns_membership(m.id) OR lub.has_org_permission(c.organization_id,'RENEWALS_MANAGE'));
$$;
CREATE TRIGGER hour_decisions_immutable BEFORE UPDATE OR DELETE ON lub.hour_decisions FOR EACH ROW EXECUTE FUNCTION lub.guard_task_revision();
GRANT SELECT ON lub.hour_decisions TO authenticated;
CREATE POLICY hour_decisions_read ON lub.hour_decisions FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM lub.hour_records WHERE id=hour_record_id));
REVOKE ALL ON FUNCTION lub.has_hours_access(uuid),lub.owns_membership(uuid),lub.owns_renewal_campaign(uuid),lub.create_academic_term(text,text,text,date,date),lub.workflow_notify(uuid,text,text),lub.hour_record_event(),lub.guard_hour_record(),lub.add_hours(uuid,uuid,uuid,numeric,date,text,boolean),lub.review_hours(uuid,text,text),lub.award_task_hours(uuid),lub.import_task_hours(uuid),lub.task_hours_trigger(),lub.set_self_report_hours(uuid,boolean),lub.save_hour_rule(uuid,uuid,uuid,uuid,text,numeric,date,date,boolean,int),lub.hour_owner_name(uuid),lub.hour_members(uuid,uuid,int),lub.create_renewal(uuid,uuid,timestamptz,timestamptz,boolean),lub.exclude_renewal_member(uuid,uuid,text,boolean),lub.change_renewal_status(uuid,text),lub.respond_renewal(uuid,text),lub.renewal_member_name(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lub.has_hours_access(uuid),lub.owns_membership(uuid),lub.owns_renewal_campaign(uuid),lub.create_academic_term(text,text,text,date,date),lub.add_hours(uuid,uuid,uuid,numeric,date,text,boolean),lub.review_hours(uuid,text,text),lub.import_task_hours(uuid),lub.set_self_report_hours(uuid,boolean),lub.save_hour_rule(uuid,uuid,uuid,uuid,text,numeric,date,date,boolean,int),lub.hour_owner_name(uuid),lub.hour_members(uuid,uuid,int),lub.create_renewal(uuid,uuid,timestamptz,timestamptz,boolean),lub.exclude_renewal_member(uuid,uuid,text,boolean),lub.change_renewal_status(uuid,text),lub.respond_renewal(uuid,text),lub.renewal_member_name(uuid) TO authenticated;
CREATE FUNCTION lub.hour_import_candidates(org uuid) RETURNS TABLE(id uuid,name text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT p.id,s.full_name_ar::text FROM lub.task_participants p JOIN lub.tasks t ON t.id=p.task_id JOIN lub.student_profiles s ON s.user_id=p.user_id WHERE t.organization_id=org AND p.status_code='Approved' AND lub.can_approve_hours(org,t.committee_id) AND NOT EXISTS(SELECT 1 FROM lub.hour_records h WHERE h.task_participant_id=p.id) ORDER BY p.closed_at,p.id LIMIT 25;
$$;
CREATE FUNCTION lub.hour_grants(org uuid,skip int DEFAULT 0) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(g),'[]') FROM (SELECT g.id,p.full_name_ar as name,g.permission_code,g.committee_id,g.end_at FROM lub.permission_grants g JOIN lub.organization_memberships m ON m.id=g.organization_membership_id JOIN lub.student_profiles p ON p.user_id=m.user_id WHERE g.organization_id=org AND lub.has_org_permission(org,'PERMISSIONS_GRANT') AND g.permission_code IN ('HOURS_APPROVE','HOURS_MANUAL_ADD','HOUR_RULES_MANAGE','RENEWALS_MANAGE') AND g.start_at<=statement_timestamp() AND (g.end_at IS NULL OR g.end_at>statement_timestamp()) ORDER BY p.full_name_ar,g.id LIMIT 26 OFFSET greatest(0,least(skip,250000))) g;
$$;
CREATE FUNCTION lub.grant_hours_permission(member uuid,capability text,committee uuid,ends timestamptz) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE org uuid;
BEGIN
 SELECT organization_id INTO org FROM lub.organization_memberships WHERE id=member AND status_code='Active' AND start_date<=current_date AND (end_date IS NULL OR end_date>current_date) FOR UPDATE;
 IF org IS NULL OR NOT lub.has_org_permission(org,'PERMISSIONS_GRANT') OR capability IS NULL OR capability NOT IN ('HOURS_APPROVE','HOURS_MANUAL_ADD','HOUR_RULES_MANAGE','RENEWALS_MANAGE') OR (ends IS NOT NULL AND ends<=statement_timestamp()) OR (capability='RENEWALS_MANAGE' AND committee IS NOT NULL) THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 IF committee IS NOT NULL AND NOT EXISTS(SELECT 1 FROM lub.committees WHERE id=committee AND organization_id=org AND status_code='Active') THEN RAISE EXCEPTION 'Invalid scope'; END IF;
 INSERT INTO lub.permission_grants(organization_membership_id,organization_id,committee_id,permission_code,end_at,granted_by_user_id) VALUES(member,org,committee,capability,ends,auth.uid());PERFORM lub.task_audit(member,org,'HOURS_PERMISSION_GRANTED');
END; $$;
CREATE FUNCTION lub.end_hours_permission(target uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE org uuid;
BEGIN
 SELECT organization_id INTO org FROM lub.permission_grants WHERE id=target AND permission_code IN ('HOURS_APPROVE','HOURS_MANUAL_ADD','HOUR_RULES_MANAGE','RENEWALS_MANAGE') FOR UPDATE;
 IF org IS NULL OR NOT lub.has_org_permission(org,'PERMISSIONS_GRANT') THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 UPDATE lub.permission_grants SET end_at=clock_timestamp() WHERE id=target AND start_at<=statement_timestamp() AND (end_at IS NULL OR end_at>statement_timestamp());PERFORM lub.task_audit(target,org,'HOURS_PERMISSION_ENDED');
END; $$;
REVOKE ALL ON FUNCTION lub.hour_import_candidates(uuid),lub.hour_grants(uuid,int),lub.grant_hours_permission(uuid,text,uuid,timestamptz),lub.end_hours_permission(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lub.hour_import_candidates(uuid),lub.hour_grants(uuid,int),lub.grant_hours_permission(uuid,text,uuid,timestamptz),lub.end_hours_permission(uuid) TO authenticated;
CREATE FUNCTION lub.hour_template_options(org uuid) RETURNS TABLE(id uuid,name text,committee_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT t.id,t.name::text,t.committee_id FROM lub.task_templates t WHERE t.organization_id=org AND t.is_active AND lub.has_org_permission(org,'HOUR_RULES_MANAGE',t.committee_id) ORDER BY t.name,t.id LIMIT 100;
$$;
CREATE FUNCTION lub.save_task_with_rule(org uuid,committee uuid,template uuid,title text,description text,starts timestamptz,due timestamptz,rule uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE amount numeric;
BEGIN
 SELECT r.default_hours INTO amount FROM lub.hour_rules r WHERE r.id=rule AND r.organization_id=org AND (r.committee_id IS NULL OR r.committee_id=committee) AND (r.task_template_id IS NULL OR r.task_template_id=template) AND r.is_active AND (statement_timestamp() AT TIME ZONE 'Asia/Riyadh')::date>=r.effective_from AND (r.effective_to IS NULL OR (statement_timestamp() AT TIME ZONE 'Asia/Riyadh')::date<=r.effective_to);
 IF amount IS NULL THEN RAISE EXCEPTION 'Rule unavailable'; END IF;
 RETURN lub.save_task(NULL,org,committee,template,title,description,starts,due,amount,NULL);
END; $$;
CREATE FUNCTION lub.renewal_exclusion_name(campaign uuid,member uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT p.full_name_ar FROM lub.renewal_campaign_exclusions e JOIN lub.renewal_campaigns c ON c.id=e.renewal_campaign_id JOIN lub.organization_memberships m ON m.id=e.organization_membership_id JOIN lub.student_profiles p ON p.user_id=m.user_id WHERE c.id=campaign AND m.id=member AND lub.has_org_permission(c.organization_id,'RENEWALS_MANAGE');
$$;
REVOKE ALL ON FUNCTION lub.hour_template_options(uuid),lub.save_task_with_rule(uuid,uuid,uuid,text,text,timestamptz,timestamptz,uuid),lub.renewal_exclusion_name(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lub.hour_template_options(uuid),lub.save_task_with_rule(uuid,uuid,uuid,text,text,timestamptz,timestamptz,uuid),lub.renewal_exclusion_name(uuid,uuid) TO authenticated;

REVOKE ALL ON FUNCTION lub.can_approve_hours(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lub.can_approve_hours(uuid,uuid) TO authenticated;
