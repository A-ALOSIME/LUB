ALTER TABLE lub.events ADD COLUMN source_date_text text;
ALTER TABLE lub.application_assets ADD COLUMN image_width integer,ADD COLUMN image_height integer;
ALTER TABLE lub.application_assets ADD CONSTRAINT asset_image_dimensions_check CHECK((image_width IS NULL AND image_height IS NULL) OR (image_width IS NOT NULL AND image_height IS NOT NULL AND image_width BETWEEN 1 AND 100000 AND image_height BETWEEN 1 AND 100000));
ALTER TABLE lub.events DROP CONSTRAINT event_bounds_check,DROP CONSTRAINT event_state_check,DROP CONSTRAINT event_location_check;
ALTER TABLE lub.events ADD CONSTRAINT event_bounds_check CHECK(length(title)<=120 AND length(description)<=6000 AND (capacity IS NULL OR capacity BETWEEN 1 AND 10000) AND attendance_hours BETWEEN 0 AND 1000 AND revision>0 AND (status_code IN('Draft','Archived') OR (status_code='Cancelled' AND published_at IS NULL) OR (length(trim(title)) BETWEEN 2 AND 120 AND starts_at IS NOT NULL AND ends_at IS NOT NULL AND registration_opens_at IS NOT NULL AND registration_closes_at IS NOT NULL AND ends_at>starts_at AND registration_closes_at>registration_opens_at AND registration_closes_at<=starts_at))),ADD CONSTRAINT event_state_check CHECK(status_code IN('Draft','Published','Completed','Cancelled','Archived') AND (status_code='Completed')=(completed_at IS NOT NULL) AND (status_code='Cancelled')=(cancelled_at IS NOT NULL)),ADD CONSTRAINT event_location_check CHECK((status_code='Archived' AND location_type_code='Unknown') OR (location_type_code IN('In_Person','Online','Hybrid') AND (status_code='Draft' OR (status_code='Cancelled' AND published_at IS NULL) OR ((location_type_code='Online' OR coalesce(length(trim(location_text)),0)>0) AND (location_type_code='In_Person' OR coalesce(online_url,'')~'^https://[^[:space:]@]+$'))))),ADD CONSTRAINT event_archival_source_check CHECK(source_date_text IS NULL OR (status_code='Archived' AND length(source_date_text)<=1000));
CREATE FUNCTION lub.set_asset_image_dimensions(target uuid,w integer,h integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM lub.application_assets WHERE id=target AND (owner_user_id=auth.uid() OR lub.is_super_admin()) AND mime_type IN('image/png','image/jpeg')) THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501';END IF;
 IF w NOT BETWEEN 1 AND 100000 OR h NOT BETWEEN 1 AND 100000 OR w IS NULL OR h IS NULL THEN RAISE EXCEPTION 'Invalid dimensions';END IF;
 UPDATE lub.application_assets SET image_width=w,image_height=h WHERE id=target;
END; $$;
CREATE FUNCTION lub.public_event_poster_dimensions(target uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('width',a.image_width,'height',a.image_height) FROM lub.events e JOIN lub.event_assets ea ON ea.event_id=e.id AND ea.asset_type_code='Poster' JOIN lub.application_assets a ON a.id=ea.asset_id WHERE e.id=target AND e.published_at IS NOT NULL AND e.status_code<>'Draft' AND a.image_width IS NOT NULL AND a.image_height IS NOT NULL LIMIT 1;
$$;
CREATE FUNCTION lub.can_feature_event(target uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM lub.events e JOIN lub.organization_memberships m ON m.organization_id=e.organization_id JOIN lub.role_assignments r ON r.organization_membership_id=m.id WHERE e.id=target AND lub.can_operate_event(target,'EVENTS_MANAGE') AND m.user_id=auth.uid() AND m.status_code='Active' AND m.start_date<=current_date AND (m.end_date IS NULL OR m.end_date>current_date) AND r.role_code='OL' AND r.start_date<=current_date AND (r.end_date IS NULL OR r.end_date>current_date));
$$;
REVOKE ALL ON FUNCTION lub.can_feature_event(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION lub.can_feature_event(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION lub.set_featured_event(target uuid,featured boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE org uuid;BEGIN
 SELECT organization_id INTO org FROM lub.events WHERE id=target;
 IF featured IS NULL OR NOT lub.can_operate_event(target,'EVENTS_MANAGE') OR NOT EXISTS(SELECT 1 FROM lub.role_assignments r JOIN lub.organization_memberships m ON m.id=r.organization_membership_id WHERE m.organization_id=org AND m.user_id=auth.uid() AND m.status_code='Active' AND m.start_date<=current_date AND (m.end_date IS NULL OR m.end_date>current_date) AND r.role_code='OL' AND r.start_date<=current_date AND (r.end_date IS NULL OR r.end_date>current_date)) THEN RAISE EXCEPTION 'Organization leader required' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM lub.organizations WHERE id=org FOR UPDATE;
 IF featured THEN IF NOT EXISTS(SELECT 1 FROM lub.events WHERE id=target AND published_at IS NOT NULL AND status_code IN('Published','Completed','Archived')) THEN RAISE EXCEPTION 'Published event required';END IF;UPDATE lub.events SET is_featured=false WHERE organization_id=org AND is_featured;END IF;
 UPDATE lub.events SET is_featured=featured,updated_at=now() WHERE id=target;PERFORM lub.task_audit(target,org,'EVENT_FEATURE_CHANGED');END; $$;
REVOKE ALL ON FUNCTION lub.set_asset_image_dimensions(uuid,integer,integer),lub.public_event_poster_dimensions(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lub.set_asset_image_dimensions(uuid,integer,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION lub.public_event_poster_dimensions(uuid) TO anon,authenticated;

CREATE FUNCTION lub.guard_committee_source_depth() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(NEW.organization_id::text,0));
 IF NEW.parent_committee_id IS NOT NULL AND (EXISTS(SELECT 1 FROM lub.committees p WHERE p.id=NEW.parent_committee_id AND p.parent_committee_id IS NOT NULL) OR EXISTS(SELECT 1 FROM lub.committees c WHERE c.parent_committee_id=NEW.id)) THEN RAISE EXCEPTION 'Only one subcommittee level is supported';END IF;RETURN NEW;END; $$;
CREATE TRIGGER committee_source_depth BEFORE INSERT OR UPDATE OF parent_committee_id ON lub.committees FOR EACH ROW EXECUTE FUNCTION lub.guard_committee_source_depth();
REVOKE ALL ON FUNCTION lub.guard_committee_source_depth() FROM PUBLIC,anon,authenticated;
