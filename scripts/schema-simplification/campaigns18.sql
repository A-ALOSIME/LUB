-- Registration campaigns and submitted cases replace rounds, responses and version archives.
CREATE FUNCTION lub.round_is_open(target uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM lub.membership_campaigns c JOIN lub.organizations o ON o.id=c.organization_id
  WHERE c.id=target AND c.kind='Registration' AND c.status_code='Open' AND c.opens_at<=statement_timestamp() AND c.closes_at>statement_timestamp() AND o.status_code='Active');
$$;
CREATE FUNCTION lub.can_read_application(target uuid,capability text DEFAULT 'APPLICATIONS_VIEW') RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM lub.membership_cases c JOIN lub.users u ON u.id=auth.uid() AND u.status_code='Active' WHERE c.id=target AND c.kind='Registration'
  AND ((capability='APPLICATIONS_VIEW' AND c.user_id=auth.uid()) OR lub.has_org_permission(c.organization_id,capability,c.requested_committee_id)
   OR (capability='APPLICATIONS_VIEW' AND (lub.has_org_permission(c.organization_id,'APPLICATIONS_REVIEW',c.requested_committee_id) OR lub.has_org_permission(c.organization_id,'APPLICATIONS_BULK_ACTION',c.requested_committee_id)))));
$$;
CREATE FUNCTION lub.can_read_round(target uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM lub.membership_campaigns c JOIN lub.organizations o ON o.id=c.organization_id WHERE c.id=target AND c.kind='Registration'
  AND ((c.status_code='Open' AND c.closes_at>statement_timestamp() AND o.status_code='Active') OR lub.has_org_permission(c.organization_id,'REGISTRATION_ROUNDS_MANAGE')
   OR EXISTS(SELECT 1 FROM lub.membership_cases a WHERE a.campaign_id=c.id AND lub.can_read_application(a.id))));
$$;
CREATE FUNCTION lub.lock_registration_campaign(target uuid,required_capability text DEFAULT NULL) RETURNS lub.membership_campaigns LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE campaign lub.membership_campaigns; org uuid;
BEGIN
 SELECT organization_id INTO org FROM lub.membership_campaigns WHERE id=target AND kind='Registration';
 IF org IS NULL THEN RAISE EXCEPTION 'Registration campaign required'; END IF;
 PERFORM 1 FROM lub.organizations WHERE id=org FOR SHARE;
 SELECT * INTO campaign FROM lub.membership_campaigns WHERE id=target AND kind='Registration' FOR UPDATE;
 IF campaign.id IS NULL OR (required_capability IS NOT NULL AND NOT lub.has_org_permission(org,required_capability)) THEN RAISE EXCEPTION 'Campaign permission required' USING ERRCODE='42501'; END IF;
 RETURN campaign;
END; $$;
CREATE FUNCTION lub.change_round_status(target uuid,status text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE campaign lub.membership_campaigns;
BEGIN
 -- All campaign writes acquire the organization before the campaign row.
 PERFORM 1 FROM lub.organizations o WHERE o.id=(SELECT c.organization_id FROM lub.membership_campaigns c WHERE c.id=target) FOR UPDATE;
 campaign:=lub.lock_registration_campaign(target,'REGISTRATION_ROUNDS_MANAGE');
 IF status IS NULL OR status NOT IN ('Open','Paused','Closed','Archived','Draft') THEN RAISE EXCEPTION 'Invalid campaign state'; END IF;
 IF status='Open' THEN
  IF campaign.form_id IS NULL OR campaign.opens_at IS NULL OR campaign.closes_at IS NULL OR length(trim(campaign.title))<2 THEN RAISE EXCEPTION 'ROUND_REQUIRED_FIELDS'; END IF;
  IF campaign.closes_at<=statement_timestamp() THEN RAISE EXCEPTION 'ROUND_EXPIRED'; END IF;
  IF EXISTS(SELECT 1 FROM lub.membership_campaigns c WHERE c.organization_id=campaign.organization_id AND c.kind='Registration' AND c.id<>target AND c.status_code='Open' AND c.closes_at>statement_timestamp()) THEN RAISE EXCEPTION 'ROUND_ACTIVE_EXISTS'; END IF;
 ELSIF status='Draft' AND campaign.status_code<>'Archived' THEN RAISE EXCEPTION 'Only an archived campaign can be restored as draft';
 ELSIF campaign.status_code='Archived' AND status<>'Draft' THEN RAISE EXCEPTION 'Restore archived campaign first'; END IF;
 UPDATE lub.membership_campaigns SET status_code=status,updated_at=now() WHERE id=target;
END; $$;
CREATE FUNCTION lub.save_registration_round(target uuid,org uuid,template uuid,title text,opens timestamptz,closes timestamptz,withdrawal boolean,publish boolean) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE campaign lub.membership_campaigns; result uuid;
BEGIN
 IF NOT lub.has_org_permission(org,'REGISTRATION_ROUNDS_MANAGE') THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM lub.organizations WHERE id=org FOR UPDATE;
 IF title IS NULL OR withdrawal IS NULL OR publish IS NULL OR length(title)>120 OR (opens IS NOT NULL AND closes IS NOT NULL AND closes<=opens) THEN RAISE EXCEPTION 'Invalid campaign'; END IF;
 IF target IS NULL THEN
  INSERT INTO lub.membership_campaigns(organization_id,kind,title,form_id,opens_at,closes_at,allow_withdrawal) VALUES(org,'Registration',trim(title),template,opens,closes,withdrawal) RETURNING id INTO result;
 ELSE
  campaign:=lub.lock_registration_campaign(target,'REGISTRATION_ROUNDS_MANAGE');
  IF campaign.organization_id<>org OR campaign.status_code='Archived' THEN RAISE EXCEPTION 'Invalid campaign'; END IF;
  IF template IS DISTINCT FROM campaign.form_id AND EXISTS(SELECT 1 FROM lub.membership_cases c WHERE c.campaign_id=target) THEN RAISE EXCEPTION 'ROUND_FORM_LOCKED'; END IF;
  UPDATE lub.membership_campaigns SET title=trim(save_registration_round.title),form_id=template,opens_at=opens,closes_at=closes,allow_withdrawal=withdrawal,updated_at=now() WHERE id=target;
  result:=target;
 END IF;
 IF publish OR campaign.status_code='Open' THEN PERFORM lub.change_round_status(result,'Open'); END IF;
 RETURN result;
END; $$;
CREATE FUNCTION lub.set_round_requirements(target uuid,hours numeric,majors jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE campaign lub.membership_campaigns;
BEGIN
 campaign:=lub.lock_registration_campaign(target,'REGISTRATION_ROUNDS_MANAGE');
 IF hours IS NULL OR hours<0 OR hours>100000 OR hours<>round(hours,2) OR majors IS NULL OR jsonb_typeof(majors)<>'array' OR jsonb_array_length(majors)>3
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(majors) m WHERE jsonb_typeof(m)<>'string' OR m#>>'{}' NOT IN ('علوم حاسب','نظم معلومات','تقنية معلومات'))
  OR (SELECT count(*)<>count(DISTINCT value) FROM jsonb_array_elements(majors)) THEN RAISE EXCEPTION 'Invalid registration requirements'; END IF;
 UPDATE lub.membership_campaigns SET minimum_hours=hours,allowed_majors=majors,updated_at=now() WHERE id=target;
END; $$;
CREATE FUNCTION lub.round_requirements_met(target uuid,student uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM lub.membership_campaigns c JOIN lub.users u ON u.id=student WHERE c.id=target AND c.kind='Registration'
  AND (jsonb_array_length(c.allowed_majors)=0 OR c.allowed_majors ? u.major_name)
  AND (SELECT coalesce(sum((h->>'hours')::numeric),0) FROM lub.organization_memberships m CROSS JOIN LATERAL jsonb_array_elements(m.hours) h
   WHERE m.user_id=student AND h->>'status_code'='Approved')>=c.minimum_hours);
$$;
CREATE FUNCTION lub.form_answer_attachments(d jsonb,answers jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',f->>'id','assetId',answers->>(f->>'id'))),'[]')
 FROM jsonb_array_elements(d->'sections') s CROSS JOIN LATERAL jsonb_array_elements(s->'fields') f WHERE f->>'type'='File' AND answers ? (f->>'id');
$$;
CREATE FUNCTION lub.submit_application(target_round uuid,target_version uuid,input jsonb,committee uuid,target_application uuid DEFAULT NULL,expected_revision int DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE campaign lub.membership_campaigns; original lub.membership_cases; version jsonb; cleaned jsonb; selected uuid; result uuid;
BEGIN
 campaign:=lub.lock_registration_campaign(target_round);
 PERFORM 1 FROM lub.users WHERE id=auth.uid() FOR UPDATE;
 IF NOT lub.is_student_account(auth.uid()) OR NOT lub.round_is_open(target_round) THEN RAISE EXCEPTION 'Open campaign and active student required' USING ERRCODE='42501'; END IF;
 IF NOT lub.round_requirements_met(target_round,auth.uid()) THEN RAISE EXCEPTION 'ROUND_REQUIREMENTS_NOT_MET'; END IF;
 IF EXISTS(SELECT 1 FROM lub.organization_memberships m WHERE m.organization_id=campaign.organization_id AND m.user_id=auth.uid() AND m.status_code='Active' AND m.start_date<=lub.today_riyadh() AND (m.end_date IS NULL OR m.end_date>lub.today_riyadh())) THEN RAISE EXCEPTION 'Already a member'; END IF;
 IF target_application IS NULL THEN
  IF EXISTS(SELECT 1 FROM lub.membership_cases c WHERE c.campaign_id=target_round AND c.user_id=auth.uid() AND c.status_code IN ('Submitted','Interview','Rejected')) THEN RAISE EXCEPTION 'Existing application'; END IF;
  SELECT f->'version' INTO version FROM lub.organizations o CROSS JOIN LATERAL jsonb_array_elements(o.forms) f WHERE o.id=campaign.organization_id AND f->>'id'=campaign.form_id::text;
  IF version IS NULL OR version->>'status_code'<>'Published' OR version->>'id' IS DISTINCT FROM target_version::text THEN RAISE EXCEPTION 'Refresh form'; END IF;
 ELSE
  SELECT * INTO original FROM lub.membership_cases c WHERE c.id=target_application AND c.campaign_id=target_round AND c.user_id=auth.uid() AND c.status_code IN ('Submitted','Interview') FOR UPDATE;
  IF original.id IS NULL OR original.response_revision IS DISTINCT FROM expected_revision OR original.form_snapshot->>'id' IS DISTINCT FROM target_version::text THEN RAISE EXCEPTION 'Locked or stale application'; END IF;
  version:=original.form_snapshot;
 END IF;
 cleaned:=lub.validate_form_answers(version->'definition',input);
 selected:=lub.form_committee_answer(version->'definition',cleaned,campaign.organization_id);
 IF committee IS NOT NULL THEN RAISE EXCEPTION 'Select a committee through the form question'; END IF;
 IF target_application IS NULL THEN
  INSERT INTO lub.membership_cases(campaign_id,organization_id,kind,user_id,status_code,requested_committee_id,form_snapshot,answers,attachments)
   VALUES(target_round,campaign.organization_id,'Registration',auth.uid(),'Submitted',selected,version,cleaned,lub.form_answer_attachments(version->'definition',cleaned)) RETURNING id INTO result;
  INSERT INTO lub.history_events(organization_id,membership_case_id,event_code,to_status_code,actor_user_id) VALUES(campaign.organization_id,result,'ApplicationSubmitted','Submitted',auth.uid());
 ELSE
  result:=original.id;
  UPDATE lub.membership_cases SET answers=cleaned,attachments=lub.form_answer_attachments(version->'definition',cleaned),requested_committee_id=selected,response_revision=response_revision+1,edited_at=now() WHERE id=result;
 END IF;
 RETURN result;
END; $$;
CREATE FUNCTION lub.withdraw_application(target uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE campaign lub.membership_campaigns; original lub.membership_cases;
BEGIN
 campaign:=lub.lock_registration_campaign((SELECT c.campaign_id FROM lub.membership_cases c WHERE c.id=target AND c.kind='Registration'));
 SELECT * INTO original FROM lub.membership_cases WHERE id=target FOR UPDATE;
 IF NOT lub.is_student_account(auth.uid()) OR original.user_id IS DISTINCT FROM auth.uid() OR original.status_code NOT IN ('Submitted','Interview') OR NOT campaign.allow_withdrawal OR NOT lub.round_is_open(campaign.id) THEN RAISE EXCEPTION 'Withdrawal unavailable' USING ERRCODE='42501'; END IF;
 UPDATE lub.membership_cases SET status_code='Withdrawn',status_revision=status_revision+1,decided_at=now(),decided_by_user_id=auth.uid() WHERE id=target;
 INSERT INTO lub.history_events(organization_id,membership_case_id,event_code,from_status_code,to_status_code,actor_user_id) VALUES(original.organization_id,target,'ApplicationWithdrawn',original.status_code,'Withdrawn',auth.uid());
END; $$;
CREATE FUNCTION lub.workflow_notify(recipient uuid,kind text,target text) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 UPDATE lub.users SET notifications=notifications||jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'typeCode',kind,'title','تحديث على مشاركتك','body','افتح سجلك للاطلاع على التحديث.','targetUrl',target,'createdAt',clock_timestamp(),'readAt',NULL)),updated_at=now() WHERE id=recipient;
$$;
CREATE FUNCTION lub.decide_application(target uuid,status text,message text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE campaign lub.membership_campaigns; original lub.membership_cases; membership uuid;
BEGIN
 campaign:=lub.lock_registration_campaign((SELECT c.campaign_id FROM lub.membership_cases c WHERE c.id=target AND c.kind='Registration'));
 SELECT * INTO original FROM lub.membership_cases WHERE id=target FOR UPDATE;
 IF NOT lub.can_read_application(target,'APPLICATIONS_REVIEW') OR original.status_code NOT IN ('Submitted','Interview') OR campaign.status_code='Archived' THEN RAISE EXCEPTION 'Review permission required' USING ERRCODE='42501'; END IF;
 IF status IS NULL OR status NOT IN ('Accepted','Rejected','Interview') OR message IS NULL OR length(message)>3000 OR (status IN ('Rejected','Interview') AND length(trim(message))=0) THEN RAISE EXCEPTION 'Decision and reason required'; END IF;
 IF status='Accepted' THEN
  PERFORM 1 FROM lub.users WHERE id=original.user_id FOR UPDATE;
  IF NOT lub.is_student_account(original.user_id) THEN RAISE EXCEPTION 'Active student required'; END IF;
  IF original.requested_committee_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM lub.committees c WHERE c.id=original.requested_committee_id AND c.organization_id=original.organization_id AND c.status_code='Active') THEN RAISE EXCEPTION 'Active committee required'; END IF;
  SELECT m.id INTO membership FROM lub.organization_memberships m WHERE m.organization_id=original.organization_id AND m.user_id=original.user_id AND m.status_code='Active' AND m.end_date IS NULL FOR UPDATE;
  IF membership IS NULL THEN
   INSERT INTO lub.organization_memberships(organization_id,user_id) VALUES(original.organization_id,original.user_id) RETURNING id INTO membership;
   INSERT INTO lub.history_events(organization_id,organization_membership_id,event_code,to_status_code,actor_user_id) VALUES(original.organization_id,membership,'MembershipStarted','Active',auth.uid());
  END IF;
  IF original.requested_committee_id IS NOT NULL THEN
   INSERT INTO lub.committee_memberships(organization_id,organization_membership_id,committee_id) VALUES(original.organization_id,membership,original.requested_committee_id) ON CONFLICT(organization_membership_id,committee_id) WHERE status_code='Active' AND end_date IS NULL DO NOTHING;
  END IF;
 END IF;
 UPDATE lub.membership_cases SET status_code=status,status_revision=status_revision+1,organization_membership_id=membership,decision_note=trim(message),decided_by_user_id=auth.uid(),decided_at=CASE WHEN status IN ('Accepted','Rejected') THEN now() END WHERE id=target;
 INSERT INTO lub.history_events(organization_id,membership_case_id,event_code,from_status_code,to_status_code,reason,actor_user_id) VALUES(original.organization_id,target,'ApplicationDecision',original.status_code,status,trim(message),auth.uid());
 PERFORM lub.workflow_notify(original.user_id,'APPLICATION_'||upper(status),'/applications');
END; $$;

CREATE FUNCTION lub.bulk_decide_applications(targets uuid[],status text,message text) RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE target uuid; count_changed int:=0;
BEGIN
 IF targets IS NULL OR cardinality(targets) NOT BETWEEN 1 AND 100 OR array_position(targets,NULL) IS NOT NULL
  OR (SELECT count(DISTINCT value) FROM unnest(targets) value)<>cardinality(targets)
  OR status IS NULL OR status NOT IN ('Accepted','Rejected','Interview') OR message IS NULL OR length(message)>3000 THEN RAISE EXCEPTION 'Invalid bulk decision'; END IF;
 IF (SELECT count(*) FROM lub.membership_cases c WHERE c.id=ANY(targets) AND c.kind='Registration')<>cardinality(targets) THEN RAISE EXCEPTION 'Application required'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(targets) value WHERE NOT lub.can_read_application(value,'APPLICATIONS_BULK_ACTION')) THEN RAISE EXCEPTION 'Bulk permission required' USING ERRCODE='42501'; END IF;
 PERFORM o.id FROM lub.organizations o WHERE o.id IN (SELECT c.organization_id FROM lub.membership_cases c WHERE c.id=ANY(targets)) ORDER BY o.id FOR SHARE;
 PERFORM c.id FROM lub.membership_campaigns c WHERE c.id IN (SELECT a.campaign_id FROM lub.membership_cases a WHERE a.id=ANY(targets)) ORDER BY c.id FOR UPDATE;
 PERFORM c.id FROM lub.membership_cases c WHERE c.id=ANY(targets) ORDER BY c.id FOR UPDATE;
 PERFORM u.id FROM lub.users u WHERE u.id IN (SELECT c.user_id FROM lub.membership_cases c WHERE c.id=ANY(targets)) ORDER BY u.id FOR UPDATE;
 FOR target IN SELECT value FROM unnest(targets) value ORDER BY value LOOP
  PERFORM lub.decide_application(target,status,message); count_changed:=count_changed+1;
 END LOOP;
 RETURN count_changed;
END; $$;

CREATE FUNCTION lub.guard_membership_case_snapshot() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE cleaned jsonb;
BEGIN
 IF TG_OP='UPDATE' AND (NEW.user_id,NEW.organization_id,NEW.campaign_id,NEW.kind,NEW.submitted_at,NEW.form_snapshot)
  IS DISTINCT FROM (OLD.user_id,OLD.organization_id,OLD.campaign_id,OLD.kind,OLD.submitted_at,OLD.form_snapshot) THEN RAISE EXCEPTION 'Submitted identity and question snapshot are immutable'; END IF;
 IF NEW.kind='Registration' THEN
  PERFORM lub.validate_form_definition(NEW.form_snapshot->'definition');
  cleaned:=lub.validate_form_answers(NEW.form_snapshot->'definition',NEW.answers);
  IF NEW.answers IS DISTINCT FROM cleaned OR NEW.attachments IS DISTINCT FROM lub.form_answer_attachments(NEW.form_snapshot->'definition',cleaned) THEN RAISE EXCEPTION 'Answers and field attachments must match the submitted definition'; END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER membership_case_snapshot BEFORE INSERT OR UPDATE OF user_id,organization_id,campaign_id,kind,submitted_at,form_snapshot,answers,attachments ON lub.membership_cases FOR EACH ROW EXECUTE FUNCTION lub.guard_membership_case_snapshot();

REVOKE ALL ON FUNCTION lub.lock_registration_campaign(uuid,text),lub.round_requirements_met(uuid,uuid),lub.form_answer_attachments(jsonb,jsonb),lub.workflow_notify(uuid,text,text),
 lub.round_is_open(uuid),lub.can_read_application(uuid,text),lub.can_read_round(uuid),lub.change_round_status(uuid,text),lub.save_registration_round(uuid,uuid,uuid,text,timestamptz,timestamptz,boolean,boolean),
 lub.set_round_requirements(uuid,numeric,jsonb),lub.submit_application(uuid,uuid,jsonb,uuid,uuid,int),lub.withdraw_application(uuid),lub.decide_application(uuid,text,text),lub.bulk_decide_applications(uuid[],text,text),lub.guard_membership_case_snapshot() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION lub.round_is_open(uuid),lub.can_read_application(uuid,text),lub.can_read_round(uuid),lub.change_round_status(uuid,text),lub.save_registration_round(uuid,uuid,uuid,text,timestamptz,timestamptz,boolean,boolean),
 lub.set_round_requirements(uuid,numeric,jsonb),lub.submit_application(uuid,uuid,jsonb,uuid,uuid,int),lub.withdraw_application(uuid),lub.decide_application(uuid,text,text),lub.bulk_decide_applications(uuid[],text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION lub.round_is_open(uuid),lub.can_read_round(uuid) TO anon;
