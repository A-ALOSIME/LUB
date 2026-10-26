ALTER TABLE lub.registration_rounds ALTER COLUMN form_template_id DROP NOT NULL,ALTER COLUMN opens_at DROP NOT NULL,ALTER COLUMN closes_at DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE lub.registration_rounds DROP CONSTRAINT round_title_check;
ALTER TABLE lub.registration_rounds ADD CONSTRAINT round_title_check CHECK(length(title)<=120 AND (status_code='Draft' OR length(trim(title))>=2));
ALTER TABLE lub.registration_rounds ADD CONSTRAINT round_publication_check CHECK(status_code='Draft' OR (form_template_id IS NOT NULL AND opens_at IS NOT NULL AND closes_at IS NOT NULL));
--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.change_round_status(target uuid,status text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r lub.registration_rounds;
BEGIN
 SELECT * INTO r FROM lub.registration_rounds WHERE id=target;
 IF r.id IS NULL OR NOT lub.has_org_permission(r.organization_id,'REGISTRATION_ROUNDS_MANAGE') THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM lub.organizations WHERE id=r.organization_id FOR UPDATE;
 SELECT * INTO r FROM lub.registration_rounds WHERE id=target FOR UPDATE;
 IF status NOT IN ('Open','Closed') OR r.status_code='Archived' THEN RAISE EXCEPTION 'Invalid transition'; END IF;
 IF status='Open' THEN
  IF r.form_template_id IS NULL OR r.opens_at IS NULL OR r.closes_at IS NULL OR length(trim(r.title))<2 THEN RAISE EXCEPTION 'ROUND_REQUIRED_FIELDS'; END IF;
  IF r.closes_at<=now() THEN RAISE EXCEPTION 'ROUND_EXPIRED'; END IF;
  IF EXISTS(SELECT 1 FROM lub.registration_rounds rr WHERE rr.organization_id=r.organization_id AND rr.id<>r.id AND rr.status_code='Open' AND rr.closes_at>now()) THEN RAISE EXCEPTION 'ROUND_ACTIVE_EXISTS'; END IF;
  IF NOT EXISTS(SELECT 1 FROM lub.form_versions v WHERE v.form_template_id=r.form_template_id AND v.status_code='Published') THEN RAISE EXCEPTION 'Published form required'; END IF;
 ELSIF r.status_code<>'Open' THEN RAISE EXCEPTION 'Invalid transition'; END IF;
 UPDATE lub.registration_rounds SET status_code=status WHERE id=target;
 PERFORM lub.application_audit(target,r.organization_id,'ROUND_'||upper(status));
END; $$;
--> statement-breakpoint
CREATE FUNCTION lub.save_registration_round(target uuid,org uuid,template uuid,title text,opens timestamptz,closes timestamptz,withdrawal boolean,publish boolean) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r lub.registration_rounds; result uuid;
BEGIN
 IF NOT lub.has_org_permission(org,'REGISTRATION_ROUNDS_MANAGE') THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM lub.organizations WHERE id=org FOR UPDATE;
 IF (opens IS NOT NULL AND closes IS NOT NULL AND closes<=opens) OR length(title)>120 THEN RAISE EXCEPTION 'Invalid fields'; END IF;
 IF template IS NOT NULL AND NOT EXISTS(SELECT 1 FROM lub.form_templates t JOIN lub.form_versions v ON v.form_template_id=t.id WHERE t.id=template AND t.organization_id=org AND v.status_code='Published') THEN RAISE EXCEPTION 'Published form required'; END IF;
 IF target IS NULL THEN
  INSERT INTO lub.registration_rounds(organization_id,form_template_id,title,opens_at,closes_at,allow_withdrawal) VALUES(org,template,trim(title),opens,closes,withdrawal) RETURNING id INTO result;
 ELSE
  SELECT * INTO r FROM lub.registration_rounds WHERE id=target AND organization_id=org FOR UPDATE;
  IF r.id IS NULL OR r.status_code='Archived' THEN RAISE EXCEPTION 'Invalid round'; END IF;
  IF template IS DISTINCT FROM r.form_template_id AND EXISTS(SELECT 1 FROM lub.membership_applications a WHERE a.registration_round_id=target) THEN RAISE EXCEPTION 'ROUND_FORM_LOCKED'; END IF;
  UPDATE lub.registration_rounds SET title=trim(save_registration_round.title),form_template_id=template,opens_at=opens,closes_at=closes,allow_withdrawal=withdrawal WHERE id=target;
  result:=target;
 END IF;
 IF publish OR r.status_code='Open' THEN PERFORM lub.change_round_status(result,'Open'); END IF;
 PERFORM lub.application_audit(result,org,'ROUND_SAVED');RETURN result;
END; $$;
--> statement-breakpoint
-- Deleting a round removes its requests, never the memberships accepted from them.
DO $$ DECLARE constraint_row record;
BEGIN
 FOR constraint_row IN SELECT conname,conrelid::regclass AS tbl,pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE contype='f' AND confrelid='lub.membership_applications'::regclass LOOP
  EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I',constraint_row.tbl,constraint_row.conname);
  EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I %s ON DELETE %s',constraint_row.tbl,constraint_row.conname,regexp_replace(constraint_row.definition,' ON DELETE (NO ACTION|RESTRICT|CASCADE|SET NULL|SET DEFAULT)',''),CASE WHEN constraint_row.tbl='lub.organization_memberships'::regclass THEN 'SET NULL' ELSE 'CASCADE' END);
 END LOOP;
END $$;
--> statement-breakpoint
CREATE FUNCTION lub.delete_registration_round(target uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE org uuid; responses uuid[];
BEGIN
 SELECT organization_id INTO org FROM lub.registration_rounds WHERE id=target;
 IF org IS NULL OR NOT lub.has_org_permission(org,'REGISTRATION_ROUNDS_MANAGE') THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM lub.organizations WHERE id=org FOR UPDATE;
 PERFORM 1 FROM lub.registration_rounds WHERE id=target FOR UPDATE;
 SELECT array_agg(form_response_id) INTO responses FROM lub.membership_applications WHERE registration_round_id=target;
 DELETE FROM lub.membership_applications WHERE registration_round_id=target;
 DELETE FROM lub.form_response_assets WHERE form_response_id=ANY(responses);
 DELETE FROM lub.form_responses WHERE id=ANY(responses) AND NOT EXISTS(SELECT 1 FROM lub.event_registrations er WHERE er.form_response_id=lub.form_responses.id);
 DELETE FROM lub.registration_rounds WHERE id=target;
 PERFORM lub.application_audit(target,org,'ROUND_DELETED');
END; $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION lub.save_registration_round(uuid,uuid,uuid,text,timestamptz,timestamptz,boolean,boolean),lub.delete_registration_round(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION lub.save_registration_round(uuid,uuid,uuid,text,timestamptz,timestamptz,boolean,boolean),lub.delete_registration_round(uuid) TO authenticated;

--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.can_read_round(target uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT EXISTS(SELECT 1 FROM lub.registration_rounds r JOIN lub.organizations o ON o.id=r.organization_id WHERE r.id=target AND ((r.status_code='Open' AND r.closes_at>now() AND o.status_code='Active') OR lub.has_org_permission(r.organization_id,'REGISTRATION_ROUNDS_MANAGE') OR EXISTS(SELECT 1 FROM lub.membership_applications a WHERE a.registration_round_id=r.id AND lub.can_read_application(a.id)))); $$;
--> statement-breakpoint
CREATE FUNCTION lub.round_application_count(target uuid) RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT CASE WHEN EXISTS(SELECT 1 FROM lub.registration_rounds r WHERE r.id=target AND lub.has_org_permission(r.organization_id,'REGISTRATION_ROUNDS_MANAGE')) THEN (SELECT count(*)::int FROM lub.membership_applications WHERE registration_round_id=target) ELSE 0 END; $$;
REVOKE ALL ON FUNCTION lub.round_application_count(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION lub.round_application_count(uuid) TO authenticated;
