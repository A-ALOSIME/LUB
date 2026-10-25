-- Confirm repeated person/date/amount entries even if the description differs.
CREATE OR REPLACE FUNCTION lub.add_hours(member uuid,committee uuid,term uuid,amount numeric,day date,reason text,self_report boolean,confirm_duplicate boolean) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$

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

 IF NOT confirm_duplicate AND EXISTS(SELECT 1 FROM lub.hour_records h WHERE h.organization_membership_id=member AND h.activity_date=day AND h.hours=amount AND h.status_code<>'Voided') THEN RAISE EXCEPTION 'Duplicate hours' USING ERRCODE='P0003'; END IF;

 INSERT INTO lub.hour_records(organization_id,organization_membership_id,committee_id,academic_term_id,source_code,hours,activity_date,description,status_code,requested_by_user_id,reviewed_by_user_id,reviewed_at,review_note)

 VALUES(m.organization_id,member,committee,term,CASE WHEN self_report THEN 'SELF_REPORTED' ELSE 'MANUAL' END,amount,day,trim(reason),CASE WHEN approved THEN 'Approved' ELSE 'Pending' END,auth.uid(),CASE WHEN approved THEN auth.uid() END,CASE WHEN approved THEN now() END,CASE WHEN approved THEN trim(reason) END) RETURNING id INTO result;

 RETURN result;

END; $$;

