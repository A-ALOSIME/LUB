CREATE FUNCTION lub.can_delete_form(target uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM lub.form_templates t WHERE t.id=target AND NOT t.is_system_template AND lub.has_org_permission(t.organization_id,'FORMS_MANAGE')
 AND EXISTS(SELECT 1 FROM lub.organization_memberships m JOIN lub.role_assignments r ON r.organization_membership_id=m.id WHERE m.organization_id=t.organization_id AND m.user_id=auth.uid() AND m.status_code='Active' AND m.start_date<=current_date AND (m.end_date IS NULL OR m.end_date>current_date) AND r.role_code IN ('OL','OD') AND r.start_date<=current_date AND (r.end_date IS NULL OR r.end_date>current_date))
 AND NOT EXISTS(SELECT 1 FROM lub.registration_rounds rr WHERE rr.form_template_id=t.id)
 AND NOT EXISTS(SELECT 1 FROM lub.events e WHERE e.registration_form_template_id=t.id));
$$;
--> statement-breakpoint
ALTER TABLE lub.form_templates DROP CONSTRAINT form_templates_source_template_id_form_templates_id_fk;
ALTER TABLE lub.form_templates ADD CONSTRAINT form_templates_source_template_id_form_templates_id_fk FOREIGN KEY(source_template_id) REFERENCES lub.form_templates(id) ON DELETE SET NULL;
ALTER TABLE lub.form_versions DROP CONSTRAINT form_versions_form_template_id_form_templates_id_fk;
ALTER TABLE lub.form_versions ADD CONSTRAINT form_versions_form_template_id_form_templates_id_fk FOREIGN KEY(form_template_id) REFERENCES lub.form_templates(id) ON DELETE CASCADE;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.guard_form_version() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  IF NOT EXISTS(SELECT 1 FROM lub.form_templates t WHERE t.id=OLD.form_template_id) THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'Immutable version';
 END IF;
 IF OLD.status_code<>'Draft' OR (NEW.id,NEW.form_template_id,NEW.version_number) IS DISTINCT FROM (OLD.id,OLD.form_template_id,OLD.version_number) THEN RAISE EXCEPTION 'Immutable version'; END IF;
 RETURN NEW;
END; $$;
--> statement-breakpoint
CREATE FUNCTION lub.delete_form(target uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE org uuid;
BEGIN
 SELECT organization_id INTO org FROM lub.form_templates WHERE id=target FOR UPDATE;
 IF org IS NULL OR NOT lub.can_delete_form(target) THEN RAISE EXCEPTION 'Unused owned form and leadership required' USING ERRCODE='42501'; END IF;
 DELETE FROM lub.form_templates WHERE id=target;
 PERFORM lub.application_audit(target,org,'FORM_DELETED');
END; $$;
--> statement-breakpoint
CREATE FUNCTION lub.duplicate_form(target uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE original lub.form_templates; definition jsonb; result uuid;
BEGIN
 SELECT * INTO original FROM lub.form_templates WHERE id=target AND NOT is_system_template FOR UPDATE;
 IF original.organization_id IS NULL OR NOT lub.has_org_permission(original.organization_id,'FORMS_MANAGE') THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 SELECT v.definition INTO definition FROM lub.form_versions v WHERE v.form_template_id=target ORDER BY v.version_number DESC LIMIT 1 FOR SHARE;
 IF definition IS NULL THEN RAISE EXCEPTION 'Form version required'; END IF;
 INSERT INTO lub.form_templates(organization_id,name,source_template_id) VALUES(original.organization_id,'نسخة من '||left(original.name,112),target) RETURNING id INTO result;
 INSERT INTO lub.form_versions(form_template_id,version_number,definition) VALUES(result,1,definition);
 PERFORM lub.application_audit(result,original.organization_id,'FORM_DUPLICATED');
 RETURN result;
END; $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION lub.can_delete_form(uuid),lub.delete_form(uuid),lub.duplicate_form(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION lub.can_delete_form(uuid),lub.delete_form(uuid),lub.duplicate_form(uuid) TO authenticated;
