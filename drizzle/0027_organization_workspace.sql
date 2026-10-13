ALTER TABLE lub.permission_grants DROP CONSTRAINT grant_code_check;
ALTER TABLE lub.permission_grants ADD CONSTRAINT grant_code_check CHECK (permission_code IN ('ORG_PROFILE_MANAGE','COMMITTEE_MANAGE','COMMITTEE_PROFILE_MANAGE','MEMBERS_VIEW','MEMBERS_MANAGE','FORMS_MANAGE','REGISTRATION_ROUNDS_MANAGE','APPLICATIONS_VIEW','APPLICATIONS_REVIEW','APPLICATIONS_BULK_ACTION','PERMISSIONS_GRANT','TASKS_MANAGE','TASK_TEMPLATES_MANAGE','HOUR_RULES_MANAGE','HOURS_APPROVE','HOURS_MANUAL_ADD','RENEWALS_MANAGE','REPORTS_GENERATE','EVENTS_MANAGE','EVENT_ATTENDANCE_MANAGE','EVENT_CONTRIBUTIONS_MANAGE'));

CREATE OR REPLACE FUNCTION lub.has_org_permission(target_org uuid, capability text, target_committee uuid DEFAULT NULL) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT capability IN ('ORG_PROFILE_MANAGE','COMMITTEE_MANAGE','COMMITTEE_PROFILE_MANAGE','MEMBERS_VIEW','MEMBERS_MANAGE','FORMS_MANAGE','REGISTRATION_ROUNDS_MANAGE','APPLICATIONS_VIEW','APPLICATIONS_REVIEW','APPLICATIONS_BULK_ACTION','PERMISSIONS_GRANT','TASKS_MANAGE','TASK_TEMPLATES_MANAGE','HOUR_RULES_MANAGE','HOURS_APPROVE','HOURS_MANUAL_ADD','RENEWALS_MANAGE','REPORTS_GENERATE','EVENTS_MANAGE','EVENT_ATTENDANCE_MANAGE','EVENT_CONTRIBUTIONS_MANAGE')
 AND EXISTS(SELECT 1 FROM lub.organizations WHERE id=target_org AND status_code='Active')
 AND (target_committee IS NULL OR EXISTS(SELECT 1 FROM lub.committees WHERE id=target_committee AND organization_id=target_org AND status_code='Active'))
 AND EXISTS(SELECT 1 FROM lub.organization_memberships m JOIN lub.users u ON u.id=m.user_id WHERE u.id=auth.uid() AND u.status_code='Active' AND m.organization_id=target_org AND m.status_code='Active' AND m.start_date<=current_date AND (m.end_date IS NULL OR m.end_date>current_date)
 AND (EXISTS(SELECT 1 FROM lub.role_assignments r WHERE r.organization_membership_id=m.id AND r.start_date<=current_date AND (r.end_date IS NULL OR r.end_date>current_date) AND (r.role_code IN ('OL','OD') OR (r.role_code IN ('CL','CD') AND r.committee_id=target_committee AND capability IN ('COMMITTEE_PROFILE_MANAGE','MEMBERS_VIEW','TASKS_MANAGE','TASK_TEMPLATES_MANAGE','HOUR_RULES_MANAGE','HOURS_APPROVE','HOURS_MANUAL_ADD'))))
 OR EXISTS(SELECT 1 FROM lub.permission_grants g WHERE g.organization_membership_id=m.id AND g.permission_code=capability AND g.start_at<=statement_timestamp() AND (g.end_at IS NULL OR g.end_at>statement_timestamp()) AND (g.committee_id IS NULL OR g.committee_id=target_committee))));
$$;

CREATE FUNCTION lub.organization_member_directory(org uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF NOT lub.has_org_permission(org,'MEMBERS_VIEW') AND NOT lub.has_org_permission(org,'MEMBERS_MANAGE') AND NOT EXISTS(SELECT 1 FROM lub.committees c WHERE c.organization_id=org AND lub.has_org_permission(org,'MEMBERS_VIEW',c.id)) THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 SELECT jsonb_build_object(
  'canManage',lub.has_org_permission(org,'MEMBERS_MANAGE'),
  'canGrant',lub.has_org_permission(org,'PERMISSIONS_GRANT'),
  'canAddHours',lub.has_org_permission(org,'HOURS_MANUAL_ADD'),
  'terms',coalesce((SELECT jsonb_agg(jsonb_build_object('id',t.id,'name',t.name_ar,'year',t.academic_year,'termCode',t.term_code,'startDate',t.start_date,'endDate',t.end_date) ORDER BY t.start_date DESC,t.id) FROM (SELECT id,name_ar,academic_year,term_code,start_date,end_date FROM lub.academic_terms ORDER BY start_date DESC,id LIMIT 30) t),'[]'::jsonb),
  'committees',coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'name',c.name) ORDER BY c.name,c.id) FROM lub.committees c WHERE c.organization_id=org AND c.status_code='Active' AND (lub.has_org_permission(org,'MEMBERS_VIEW') OR lub.has_org_permission(org,'MEMBERS_MANAGE') OR lub.has_org_permission(org,'MEMBERS_VIEW',c.id))),'[]'::jsonb),
  'members',coalesce((SELECT jsonb_agg(row_data ORDER BY member_name,member_id) FROM (
   SELECT m.id AS member_id,p.full_name_ar AS member_name,jsonb_build_object(
    'id',m.id,'name',p.full_name_ar,'major',p.major_name,'level',p.academic_level,'status',m.status_code,'startDate',m.start_date,'endDate',m.end_date,
    'canManage',m.status_code='Active' AND lub.has_org_permission(org,'MEMBERS_MANAGE'),
    'hours',coalesce((SELECT sum(h.hours) FROM lub.hour_records h WHERE h.organization_membership_id=m.id AND h.organization_id=org AND h.status_code='Approved' AND (lub.has_org_permission(org,'MEMBERS_VIEW') OR (h.committee_id IS NOT NULL AND lub.has_org_permission(org,'MEMBERS_VIEW',h.committee_id)))),0),
    'roles',coalesce((SELECT jsonb_agg(jsonb_build_object('code',r.role_code,'committee',c.name) ORDER BY r.role_code,c.name) FROM lub.role_assignments r LEFT JOIN lub.committees c ON c.id=r.committee_id WHERE r.organization_membership_id=m.id AND r.start_date<=current_date AND (r.end_date IS NULL OR r.end_date>current_date) AND (lub.has_org_permission(org,'MEMBERS_VIEW') OR lub.has_org_permission(org,'MEMBERS_MANAGE') OR (r.committee_id IS NOT NULL AND lub.has_org_permission(org,'MEMBERS_VIEW',r.committee_id)))),'[]'::jsonb),
    'committees',coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'name',c.name) ORDER BY c.name,c.id) FROM lub.committee_memberships cm JOIN lub.committees c ON c.id=cm.committee_id WHERE cm.organization_membership_id=m.id AND cm.status_code='Active' AND cm.start_date<=current_date AND (cm.end_date IS NULL OR cm.end_date>current_date) AND (lub.has_org_permission(org,'MEMBERS_VIEW') OR lub.has_org_permission(org,'MEMBERS_VIEW',c.id))),'[]'::jsonb),
    'hourScopes',coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'name',c.name) ORDER BY c.name,c.id) FROM lub.committee_memberships cm JOIN lub.committees c ON c.id=cm.committee_id WHERE cm.organization_membership_id=m.id AND cm.status_code='Active' AND cm.start_date<=current_date AND (cm.end_date IS NULL OR cm.end_date>current_date) AND c.status_code='Active' AND lub.has_org_permission(org,'HOURS_MANUAL_ADD',c.id)),'[]'::jsonb)
   ) AS row_data,m.id AS member_id,p.full_name_ar AS member_name
   FROM lub.organization_memberships m JOIN lub.student_profiles p ON p.user_id=m.user_id JOIN lub.users u ON u.id=m.user_id
   WHERE m.organization_id=org AND u.status_code='Active' AND (((lub.has_org_permission(org,'MEMBERS_VIEW') OR lub.has_org_permission(org,'MEMBERS_MANAGE')) AND m.status_code IN ('Active','Ended','Inactive')) OR (m.status_code='Active' AND EXISTS(SELECT 1 FROM lub.committee_memberships cm JOIN lub.committees c ON c.id=cm.committee_id WHERE cm.organization_membership_id=m.id AND cm.status_code='Active' AND cm.start_date<=current_date AND (cm.end_date IS NULL OR cm.end_date>current_date) AND lub.has_org_permission(org,'MEMBERS_VIEW',c.id))))
   ORDER BY p.full_name_ar,m.id LIMIT 500
  ) members_page),'[]'::jsonb)
 ) INTO result;
 RETURN result;
END; $$;

CREATE FUNCTION lub.organization_permission_workspace(org uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT lub.has_org_permission(org,'PERMISSIONS_GRANT') THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object(
  'members',coalesce((SELECT jsonb_agg(jsonb_build_object('id',m.id,'name',p.full_name_ar) ORDER BY p.full_name_ar,m.id) FROM lub.organization_memberships m JOIN lub.student_profiles p ON p.user_id=m.user_id JOIN lub.users u ON u.id=m.user_id WHERE m.organization_id=org AND m.status_code='Active' AND m.start_date<=current_date AND (m.end_date IS NULL OR m.end_date>current_date) AND u.status_code='Active'),'[]'::jsonb),
  'committees',coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'name',c.name) ORDER BY c.name,c.id) FROM lub.committees c WHERE c.organization_id=org AND c.status_code='Active'),'[]'::jsonb),
  'grants',coalesce((SELECT jsonb_agg(jsonb_build_object('id',g.id,'member',p.full_name_ar,'code',g.permission_code,'committee',c.name,'ends',g.end_at) ORDER BY p.full_name_ar,g.permission_code) FROM lub.permission_grants g JOIN lub.organization_memberships m ON m.id=g.organization_membership_id JOIN lub.student_profiles p ON p.user_id=m.user_id LEFT JOIN lub.committees c ON c.id=g.committee_id WHERE g.organization_id=org AND g.permission_code<>'PERMISSIONS_GRANT' AND g.start_at<=statement_timestamp() AND (g.end_at IS NULL OR g.end_at>statement_timestamp())),'[]'::jsonb)
 );
END; $$;

CREATE FUNCTION lub.grant_organization_permission(member uuid,capability text,committee uuid,ends timestamptz) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE org uuid; grant_id uuid;
BEGIN
 SELECT organization_id INTO org FROM lub.organization_memberships WHERE id=member AND status_code='Active' AND start_date<=current_date AND (end_date IS NULL OR end_date>current_date) FOR UPDATE;
 IF org IS NULL OR NOT lub.has_org_permission(org,'PERMISSIONS_GRANT') OR (ends IS NOT NULL AND ends<=statement_timestamp()) THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 IF capability IN ('FORMS_MANAGE','REGISTRATION_ROUNDS_MANAGE','APPLICATIONS_VIEW','APPLICATIONS_REVIEW','APPLICATIONS_BULK_ACTION') THEN PERFORM lub.grant_application_permission(member,capability,committee,ends);
 ELSIF capability IN ('TASKS_MANAGE','TASK_TEMPLATES_MANAGE') THEN PERFORM lub.grant_task_permission(member,capability,committee,ends);
 ELSIF capability IN ('HOURS_APPROVE','HOURS_MANUAL_ADD','HOUR_RULES_MANAGE','RENEWALS_MANAGE') THEN PERFORM lub.grant_hours_permission(member,capability,committee,ends);
 ELSIF capability='REPORTS_GENERATE' THEN PERFORM lub.grant_report_permission(member,committee,ends);
 ELSIF capability IN ('EVENTS_MANAGE','EVENT_ATTENDANCE_MANAGE','EVENT_CONTRIBUTIONS_MANAGE') THEN
  IF committee IS NOT NULL THEN RAISE EXCEPTION 'Invalid scope'; END IF;
  PERFORM lub.grant_event_permission(member,capability,ends);
 ELSIF capability IN ('ORG_PROFILE_MANAGE','COMMITTEE_MANAGE','COMMITTEE_PROFILE_MANAGE','MEMBERS_VIEW','MEMBERS_MANAGE') THEN
  IF (capability IN ('ORG_PROFILE_MANAGE','COMMITTEE_MANAGE','MEMBERS_MANAGE') AND committee IS NOT NULL) OR (committee IS NOT NULL AND capability NOT IN ('COMMITTEE_PROFILE_MANAGE','MEMBERS_VIEW')) THEN RAISE EXCEPTION 'Invalid scope'; END IF;
  IF committee IS NOT NULL AND NOT EXISTS(SELECT 1 FROM lub.committee_memberships cm JOIN lub.committees c ON c.id=cm.committee_id WHERE cm.organization_membership_id=member AND cm.committee_id=committee AND c.organization_id=org AND c.status_code='Active' AND cm.status_code='Active' AND cm.start_date<=current_date AND (cm.end_date IS NULL OR cm.end_date>current_date)) THEN RAISE EXCEPTION 'Committee mismatch'; END IF;
  INSERT INTO lub.permission_grants(organization_membership_id,organization_id,committee_id,permission_code,end_at,granted_by_user_id) VALUES(member,org,committee,capability,ends,auth.uid()) RETURNING id INTO grant_id;
  INSERT INTO lub.audit_log(actor_user_id,action_code,entity_type,entity_id,organization_id,metadata) VALUES(auth.uid(),'ORGANIZATION_PERMISSION_GRANTED','permission_grant',grant_id,org,'{}'::jsonb);
 ELSE RAISE EXCEPTION 'Unsupported permission'; END IF;
END; $$;

CREATE FUNCTION lub.end_organization_permission(target uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE org uuid; capability text;
BEGIN
 SELECT organization_id,permission_code INTO org,capability FROM lub.permission_grants WHERE id=target AND permission_code<>'PERMISSIONS_GRANT' FOR UPDATE;
 IF org IS NULL OR NOT lub.has_org_permission(org,'PERMISSIONS_GRANT') THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 IF capability IN ('FORMS_MANAGE','REGISTRATION_ROUNDS_MANAGE','APPLICATIONS_VIEW','APPLICATIONS_REVIEW','APPLICATIONS_BULK_ACTION') THEN PERFORM lub.end_application_permission(target);
 ELSIF capability IN ('TASKS_MANAGE','TASK_TEMPLATES_MANAGE') THEN PERFORM lub.end_task_permission(target);
 ELSIF capability IN ('HOURS_APPROVE','HOURS_MANUAL_ADD','HOUR_RULES_MANAGE','RENEWALS_MANAGE') THEN PERFORM lub.end_hours_permission(target);
 ELSIF capability='REPORTS_GENERATE' THEN PERFORM lub.end_report_permission(target);
 ELSIF capability IN ('EVENTS_MANAGE','EVENT_ATTENDANCE_MANAGE','EVENT_CONTRIBUTIONS_MANAGE') THEN PERFORM lub.end_event_permission(target);
 ELSE
  UPDATE lub.permission_grants SET end_at=statement_timestamp() WHERE id=target AND start_at<=statement_timestamp() AND (end_at IS NULL OR end_at>statement_timestamp());
  INSERT INTO lub.audit_log(actor_user_id,action_code,entity_type,entity_id,organization_id,metadata) VALUES(auth.uid(),'ORGANIZATION_PERMISSION_ENDED','permission_grant',target,org,'{}'::jsonb);
 END IF;
END; $$;

CREATE FUNCTION lub.end_organization_membership(target uuid,reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE membership lub.organization_memberships;
BEGIN
 SELECT * INTO membership FROM lub.organization_memberships WHERE id=target FOR UPDATE;
 IF membership.id IS NULL OR membership.status_code<>'Active' OR membership.start_date>current_date OR (membership.end_date IS NOT NULL AND membership.end_date<=current_date) OR NOT lub.has_org_permission(membership.organization_id,'MEMBERS_MANAGE') OR reason IS NULL OR length(trim(reason)) NOT BETWEEN 3 AND 500 THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM lub.role_assignments r WHERE r.organization_membership_id=target AND r.role_code='OL' AND r.end_date IS NULL) THEN RAISE EXCEPTION 'Use primary leader appointment to end the active primary leader'; END IF;
 UPDATE lub.organization_memberships SET status_code='Ended',end_date=current_date,ended_reason=trim(reason),updated_at=statement_timestamp() WHERE id=target;
 UPDATE lub.committee_memberships SET status_code='Ended',end_date=current_date WHERE organization_membership_id=target AND status_code='Active' AND end_date IS NULL;
 UPDATE lub.role_assignments SET end_date=current_date WHERE organization_membership_id=target AND end_date IS NULL;
 UPDATE lub.permission_grants SET end_at=greatest(start_at+interval '1 microsecond',statement_timestamp()) WHERE organization_membership_id=target AND (end_at IS NULL OR end_at>statement_timestamp());
 INSERT INTO lub.audit_log(actor_user_id,action_code,entity_type,entity_id,organization_id,metadata) VALUES(auth.uid(),'ORGANIZATION_MEMBERSHIP_ENDED','organization_membership',target,membership.organization_id,'{}'::jsonb);
END; $$;

REVOKE ALL ON FUNCTION lub.organization_member_directory(uuid),lub.organization_permission_workspace(uuid),lub.grant_organization_permission(uuid,text,uuid,timestamptz),lub.end_organization_permission(uuid),lub.end_organization_membership(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lub.organization_member_directory(uuid),lub.organization_permission_workspace(uuid),lub.grant_organization_permission(uuid,text,uuid,timestamptz),lub.end_organization_permission(uuid),lub.end_organization_membership(uuid,text) TO authenticated;
