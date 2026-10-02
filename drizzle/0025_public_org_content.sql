ALTER TABLE lub.organizations ADD COLUMN logo_url text NOT NULL DEFAULT '';
ALTER TABLE lub.organizations ADD CONSTRAINT org_logo_url_check CHECK (logo_url = '' OR (logo_url ~ '^https://[^[:space:]@]+$' AND char_length(logo_url) <= 2048));
GRANT UPDATE (logo_url) ON lub.organizations TO authenticated;
CREATE OR REPLACE FUNCTION lub.guard_org_update() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF (NEW.id,NEW.slug,NEW.type_code,NEW.created_at) IS DISTINCT FROM (OLD.id,OLD.slug,OLD.type_code,OLD.created_at) THEN
    RAISE EXCEPTION 'Organization identity is immutable' USING ERRCODE = '42501';
  END IF;
  IF (NEW.status_code,NEW.archived_at) IS DISTINCT FROM (OLD.status_code,OLD.archived_at) AND NOT lub.is_super_admin() THEN
    RAISE EXCEPTION 'Lifecycle requires Super Admin' USING ERRCODE = '42501';
  END IF;
  IF (NEW.name_ar,NEW.summary,NEW.mission,NEW.logo_url,NEW.show_leadership_publicly) IS DISTINCT FROM (OLD.name_ar,OLD.summary,OLD.mission,OLD.logo_url,OLD.show_leadership_publicly)
    AND NOT lub.has_org_permission(OLD.id,'ORG_PROFILE_MANAGE') THEN
    RAISE EXCEPTION 'Profile permission required' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TABLE lub.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES lub.organizations(id),
  title varchar(120) NOT NULL,
  body text NOT NULL,
  published_at timestamptz,
  pinned_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT announcement_content_check CHECK (char_length(trim(title)) BETWEEN 2 AND 120 AND char_length(body) BETWEEN 1 AND 5000),
  CONSTRAINT announcement_pin_check CHECK (pinned_at IS NULL OR (published_at IS NOT NULL AND archived_at IS NULL))
);
CREATE UNIQUE INDEX announcement_one_pin_idx ON lub.announcements(organization_id) WHERE pinned_at IS NOT NULL;
CREATE INDEX announcement_public_idx ON lub.announcements(organization_id,published_at DESC,id) WHERE published_at IS NOT NULL AND archived_at IS NULL;
ALTER TABLE lub.announcements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON lub.announcements FROM PUBLIC,anon,authenticated;
GRANT SELECT ON lub.announcements TO anon,authenticated;
GRANT INSERT,UPDATE ON lub.announcements TO authenticated;
CREATE POLICY announcement_public_read ON lub.announcements FOR SELECT TO anon,authenticated USING (published_at IS NOT NULL AND published_at<=statement_timestamp() AND archived_at IS NULL);
CREATE POLICY announcement_manager_read ON lub.announcements FOR SELECT TO authenticated USING (lub.has_org_permission(organization_id,'ORG_PROFILE_MANAGE'));
CREATE POLICY announcement_manager_insert ON lub.announcements FOR INSERT TO authenticated WITH CHECK (lub.has_org_permission(organization_id,'ORG_PROFILE_MANAGE'));
CREATE POLICY announcement_manager_update ON lub.announcements FOR UPDATE TO authenticated USING (lub.has_org_permission(organization_id,'ORG_PROFILE_MANAGE')) WITH CHECK (lub.has_org_permission(organization_id,'ORG_PROFILE_MANAGE'));
CREATE FUNCTION lub.guard_announcement_update() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF (NEW.id,NEW.organization_id,NEW.created_at) IS DISTINCT FROM (OLD.id,OLD.organization_id,OLD.created_at) THEN
    RAISE EXCEPTION 'Announcement identity is immutable' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER announcement_guard BEFORE UPDATE ON lub.announcements FOR EACH ROW EXECUTE FUNCTION lub.guard_announcement_update();
CREATE TRIGGER announcement_audit AFTER INSERT OR UPDATE ON lub.announcements FOR EACH ROW EXECUTE FUNCTION lub.record_org_change();
REVOKE ALL ON FUNCTION lub.guard_announcement_update() FROM PUBLIC;
--> statement-breakpoint
ALTER TABLE lub.events ADD COLUMN is_featured boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX event_one_featured_idx ON lub.events(organization_id) WHERE is_featured;
CREATE FUNCTION lub.set_featured_event(target uuid, featured boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE org uuid;
BEGIN
  SELECT organization_id INTO org FROM lub.events WHERE id=target;
  IF org IS NULL OR featured IS NULL OR NOT lub.can_operate_event(target,'EVENTS_MANAGE') THEN
    RAISE EXCEPTION 'Event permission required' USING ERRCODE='42501';
  END IF;
  PERFORM 1 FROM lub.organizations WHERE id=org FOR UPDATE;
  IF featured THEN
    IF NOT EXISTS(SELECT 1 FROM lub.events WHERE id=target AND status_code='Published' AND ends_at>=statement_timestamp()) THEN
      RAISE EXCEPTION 'Published upcoming event required';
    END IF;
    UPDATE lub.events SET is_featured=false WHERE organization_id=org AND is_featured;
  END IF;
  UPDATE lub.events SET is_featured=featured,updated_at=now() WHERE id=target;
  PERFORM lub.task_audit(target,org,'EVENT_FEATURE_CHANGED');
END;
$$;
REVOKE ALL ON FUNCTION lub.set_featured_event(uuid,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lub.set_featured_event(uuid,boolean) TO authenticated;
--> statement-breakpoint
ALTER TABLE lub.events ADD COLUMN public_report text NOT NULL DEFAULT '';
ALTER TABLE lub.events ADD COLUMN public_photos text[] NOT NULL DEFAULT '{}';
ALTER TABLE lub.events ADD CONSTRAINT event_public_content_check CHECK (char_length(public_report)<=5000 AND cardinality(public_photos)<=4);
CREATE FUNCTION lub.set_event_public_content(target uuid, report text, photos text[]) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE current_event lub.events;
BEGIN
  SELECT * INTO current_event FROM lub.events WHERE id=target FOR UPDATE;
  IF current_event.id IS NULL OR NOT lub.can_operate_event(target,'EVENTS_MANAGE') OR current_event.status_code NOT IN ('Published','Completed') THEN
    RAISE EXCEPTION 'Published event permission required' USING ERRCODE='42501';
  END IF;
  IF report IS NULL OR photos IS NULL OR char_length(report)>5000 OR cardinality(photos)>4 OR EXISTS(
    SELECT 1 FROM unnest(photos) AS link WHERE link IS NULL OR link !~ '^https://[^[:space:]@]+$' OR char_length(link)>2048
  ) THEN
    RAISE EXCEPTION 'Invalid public event content';
  END IF;
  UPDATE lub.events SET public_report=trim(report),public_photos=photos,updated_at=now() WHERE id=target;
  PERFORM lub.task_audit(target,current_event.organization_id,'EVENT_PUBLIC_CONTENT_CHANGED');
END;
$$;
REVOKE ALL ON FUNCTION lub.set_event_public_content(uuid,text,text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lub.set_event_public_content(uuid,text,text[]) TO authenticated;
