-- Audit the operation without copying the private note body.
CREATE FUNCTION lub.record_application_note() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE org uuid;
BEGIN
 IF auth.uid() IS NULL THEN RETURN NULL; END IF;
 SELECT r.organization_id INTO org FROM lub.membership_applications a
 JOIN lub.registration_rounds r ON r.id=a.registration_round_id WHERE a.id=NEW.application_id;
 PERFORM lub.application_audit(NEW.id,org,'APPLICATION_NOTE_CREATED');
 RETURN NULL;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION lub.record_application_note() FROM PUBLIC;
CREATE TRIGGER application_note_audit AFTER INSERT ON lub.application_internal_notes
FOR EACH ROW EXECUTE FUNCTION lub.record_application_note();
