-- Hour rules retired by user authorization. Historical migrations are preserved.
-- Audit: 0 rule rows, 0 rule grants, no incoming foreign keys; task/hour history stays untouched.
--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.end_hours_permission(target uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$

DECLARE org uuid;

BEGIN

 SELECT organization_id INTO org FROM lub.permission_grants WHERE id=target AND permission_code IN ('HOURS_APPROVE','HOURS_MANUAL_ADD','RENEWALS_MANAGE') FOR UPDATE;

 IF org IS NULL OR NOT lub.has_org_permission(org,'PERMISSIONS_GRANT') THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;

 UPDATE lub.permission_grants SET end_at=clock_timestamp() WHERE id=target AND start_at<=statement_timestamp() AND (end_at IS NULL OR end_at>statement_timestamp());PERFORM lub.task_audit(target,org,'HOURS_PERMISSION_ENDED');

END; $function$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.end_organization_permission(target uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE org uuid; capability text;
BEGIN
 SELECT organization_id,permission_code INTO org,capability FROM lub.permission_grants WHERE id=target AND permission_code<>'PERMISSIONS_GRANT' FOR UPDATE;
 IF org IS NULL OR NOT lub.has_org_permission(org,'PERMISSIONS_GRANT') THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 IF capability IN ('FORMS_MANAGE','REGISTRATION_ROUNDS_MANAGE','APPLICATIONS_VIEW','APPLICATIONS_REVIEW','APPLICATIONS_BULK_ACTION') THEN PERFORM lub.end_application_permission(target);
 ELSIF capability IN ('TASKS_MANAGE','TASK_TEMPLATES_MANAGE') THEN PERFORM lub.end_task_permission(target);
 ELSIF capability IN ('HOURS_APPROVE','HOURS_MANUAL_ADD','RENEWALS_MANAGE') THEN PERFORM lub.end_hours_permission(target);
 ELSIF capability='REPORTS_GENERATE' THEN PERFORM lub.end_report_permission(target);
 ELSIF capability IN ('EVENTS_MANAGE','EVENT_ATTENDANCE_MANAGE','EVENT_CONTRIBUTIONS_MANAGE') THEN PERFORM lub.end_event_permission(target);
 ELSE
  UPDATE lub.permission_grants SET end_at=statement_timestamp() WHERE id=target AND start_at<=statement_timestamp() AND (end_at IS NULL OR end_at>statement_timestamp());
  INSERT INTO lub.audit_log(actor_user_id,action_code,entity_type,entity_id,organization_id,metadata) VALUES(auth.uid(),'ORGANIZATION_PERMISSION_ENDED','permission_grant',target,org,'{}'::jsonb);
 END IF;
END; $function$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.grant_hours_permission(member uuid, capability text, committee uuid, ends timestamp with time zone)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$

DECLARE org uuid;

BEGIN

 SELECT organization_id INTO org FROM lub.organization_memberships WHERE id=member AND status_code='Active' AND start_date<=current_date AND (end_date IS NULL OR end_date>current_date) FOR UPDATE;

 IF org IS NULL OR NOT lub.has_org_permission(org,'PERMISSIONS_GRANT') OR capability IS NULL OR capability NOT IN ('HOURS_APPROVE','HOURS_MANUAL_ADD','RENEWALS_MANAGE') OR (ends IS NOT NULL AND ends<=statement_timestamp()) OR (capability='RENEWALS_MANAGE' AND committee IS NOT NULL) THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;

 IF committee IS NOT NULL AND NOT EXISTS(SELECT 1 FROM lub.committees WHERE id=committee AND organization_id=org AND status_code='Active') THEN RAISE EXCEPTION 'Invalid scope'; END IF;

 INSERT INTO lub.permission_grants(organization_membership_id,organization_id,committee_id,permission_code,end_at,granted_by_user_id) VALUES(member,org,committee,capability,ends,auth.uid());PERFORM lub.task_audit(member,org,'HOURS_PERMISSION_GRANTED');

END; $function$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.grant_organization_permission(member uuid, capability text, committee uuid, ends timestamp with time zone)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE org uuid; grant_id uuid;
BEGIN
 SELECT organization_id INTO org FROM lub.organization_memberships WHERE id=member AND status_code='Active' AND start_date<=current_date AND (end_date IS NULL OR end_date>current_date) FOR UPDATE;
 IF org IS NULL OR NOT lub.has_org_permission(org,'PERMISSIONS_GRANT') OR (ends IS NOT NULL AND ends<=statement_timestamp()) THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 IF capability IN ('FORMS_MANAGE','REGISTRATION_ROUNDS_MANAGE','APPLICATIONS_VIEW','APPLICATIONS_REVIEW','APPLICATIONS_BULK_ACTION') THEN PERFORM lub.grant_application_permission(member,capability,committee,ends);
 ELSIF capability IN ('TASKS_MANAGE','TASK_TEMPLATES_MANAGE') THEN PERFORM lub.grant_task_permission(member,capability,committee,ends);
 ELSIF capability IN ('HOURS_APPROVE','HOURS_MANUAL_ADD','RENEWALS_MANAGE') THEN PERFORM lub.grant_hours_permission(member,capability,committee,ends);
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
END; $function$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.has_hours_access(org uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT lub.has_org_permission(org,'HOURS_APPROVE') OR lub.has_org_permission(org,'HOURS_MANUAL_ADD') OR lub.has_org_permission(org,'RENEWALS_MANAGE') OR EXISTS(SELECT 1 FROM lub.committees c WHERE c.organization_id=org AND (lub.has_org_permission(org,'HOURS_APPROVE',c.id) OR lub.has_org_permission(org,'HOURS_MANUAL_ADD',c.id)));
$function$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.has_org_permission(target_org uuid, capability text, target_committee uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$



 SELECT lub.is_student_account(auth.uid()) AND capability IN ('ORG_PROFILE_MANAGE','COMMITTEE_MANAGE','COMMITTEE_PROFILE_MANAGE','MEMBERS_VIEW','MEMBERS_MANAGE','FORMS_MANAGE','REGISTRATION_ROUNDS_MANAGE','APPLICATIONS_VIEW','APPLICATIONS_REVIEW','APPLICATIONS_BULK_ACTION','PERMISSIONS_GRANT','TASKS_MANAGE','TASK_TEMPLATES_MANAGE','HOURS_APPROVE','HOURS_MANUAL_ADD','RENEWALS_MANAGE','REPORTS_GENERATE','EVENTS_MANAGE','EVENT_ATTENDANCE_MANAGE','EVENT_CONTRIBUTIONS_MANAGE')



 AND EXISTS(SELECT 1 FROM lub.organizations WHERE id=target_org AND status_code='Active')



 AND (target_committee IS NULL OR EXISTS(SELECT 1 FROM lub.committees WHERE id=target_committee AND organization_id=target_org AND status_code='Active'))



 AND EXISTS(SELECT 1 FROM lub.organization_memberships m JOIN lub.users u ON u.id=m.user_id WHERE u.id=auth.uid() AND u.status_code='Active' AND m.organization_id=target_org AND EXISTS(SELECT 1 FROM lub.organization_memberships canonical WHERE canonical.user_id=m.user_id AND canonical.organization_id=m.organization_id AND canonical.merged_into IS NULL AND canonical.status_code='Active' AND canonical.start_date<=current_date AND (canonical.end_date IS NULL OR canonical.end_date>current_date)) AND m.status_code='Active' AND m.start_date<=current_date AND (m.end_date IS NULL OR m.end_date>current_date)



 AND (EXISTS(SELECT 1 FROM lub.role_assignments r WHERE r.organization_membership_id=m.id AND r.start_date<=current_date AND (r.end_date IS NULL OR r.end_date>current_date) AND ((r.role_code='OL' OR (r.role_code='OD' AND capability NOT IN ('MEMBERS_VIEW','MEMBERS_MANAGE','PERMISSIONS_GRANT'))) OR ((r.role_code='CL' OR (r.role_code='CD' AND capability<>'MEMBERS_VIEW')) AND r.committee_id=target_committee AND capability IN ('COMMITTEE_PROFILE_MANAGE','MEMBERS_VIEW','TASKS_MANAGE','TASK_TEMPLATES_MANAGE','HOURS_APPROVE','HOURS_MANUAL_ADD'))))



 OR EXISTS(SELECT 1 FROM lub.permission_grants g WHERE capability<>'PERMISSIONS_GRANT' AND g.organization_membership_id=m.id AND g.permission_code=capability AND g.start_at<=statement_timestamp() AND (g.end_at IS NULL OR g.end_at>statement_timestamp()) AND (g.committee_id IS NULL OR g.committee_id=target_committee))));



$function$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.hour_grants(org uuid, skip integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$

 SELECT coalesce(jsonb_agg(g),'[]') FROM (SELECT g.id,p.full_name_ar as name,g.permission_code,g.committee_id,g.end_at FROM lub.permission_grants g JOIN lub.organization_memberships m ON m.id=g.organization_membership_id JOIN lub.student_profiles p ON p.user_id=m.user_id WHERE lub.is_student_account(m.user_id) AND g.organization_id=org AND lub.has_org_permission(org,'PERMISSIONS_GRANT') AND g.permission_code IN ('HOURS_APPROVE','HOURS_MANUAL_ADD','RENEWALS_MANAGE') AND g.start_at<=statement_timestamp() AND (g.end_at IS NULL OR g.end_at>statement_timestamp()) ORDER BY p.full_name_ar,g.id LIMIT 26 OFFSET greatest(0,least(skip,250000))) g;

$function$;
--> statement-breakpoint
DELETE FROM lub.permission_grants WHERE permission_code='HOUR_RULES_MANAGE';
ALTER TABLE lub.permission_grants DROP CONSTRAINT grant_code_check;
ALTER TABLE lub.permission_grants ADD CONSTRAINT grant_code_check CHECK(permission_code IN ('ORG_PROFILE_MANAGE','COMMITTEE_MANAGE','COMMITTEE_PROFILE_MANAGE','MEMBERS_VIEW','MEMBERS_MANAGE','FORMS_MANAGE','REGISTRATION_ROUNDS_MANAGE','APPLICATIONS_VIEW','APPLICATIONS_REVIEW','APPLICATIONS_BULK_ACTION','PERMISSIONS_GRANT','TASKS_MANAGE','TASK_TEMPLATES_MANAGE','HOURS_APPROVE','HOURS_MANUAL_ADD','RENEWALS_MANAGE','REPORTS_GENERATE','EVENTS_MANAGE','EVENT_ATTENDANCE_MANAGE','EVENT_CONTRIBUTIONS_MANAGE'));
ALTER TABLE lub.permission_grants DROP CONSTRAINT grant_scope_check;
ALTER TABLE lub.permission_grants ADD CONSTRAINT grant_scope_check CHECK(committee_id IS NULL OR permission_code IN ('COMMITTEE_PROFILE_MANAGE','MEMBERS_VIEW','APPLICATIONS_VIEW','APPLICATIONS_REVIEW','APPLICATIONS_BULK_ACTION','TASKS_MANAGE','TASK_TEMPLATES_MANAGE','HOURS_APPROVE','HOURS_MANUAL_ADD','REPORTS_GENERATE'));
DROP FUNCTION lub.save_task_with_rule(uuid,uuid,uuid,text,text,timestamptz,timestamptz,uuid);
DROP FUNCTION lub.save_hour_rule(uuid,uuid,uuid,uuid,text,numeric,date,date,boolean,int);
DROP FUNCTION lub.hour_template_options(uuid);
DROP TABLE lub.hour_rules;
