ALTER TABLE lub.event_assets DROP CONSTRAINT event_asset_type_check;
ALTER TABLE lub.event_assets ADD CONSTRAINT event_asset_type_check CHECK (asset_type_code IN ('Approval','Attendance','Report','Photo','Poster'));
CREATE UNIQUE INDEX event_poster_one_per_event ON lub.event_assets(event_id) WHERE asset_type_code='Poster';

CREATE FUNCTION lub.set_event_poster(target_event uuid, asset uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE org uuid;
BEGIN
 SELECT organization_id INTO org FROM lub.events WHERE id=target_event FOR UPDATE;
 IF org IS NULL OR NOT lub.has_org_permission(org,'EVENTS_MANAGE') OR NOT EXISTS(SELECT 1 FROM lub.application_assets WHERE id=asset AND owner_user_id=auth.uid() AND mime_type IN ('image/jpeg','image/png')) THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 DELETE FROM lub.event_assets WHERE event_id=target_event AND asset_type_code='Poster';
 INSERT INTO lub.event_assets(event_id,asset_id,asset_type_code) VALUES(target_event,asset,'Poster');
 PERFORM lub.task_audit(target_event,org,'EVENT_POSTER_UPDATED');
END; $$;

CREATE FUNCTION lub.save_event_with_poster(target uuid,org uuid,title text,description text,location_type text,location text,url text,starts timestamptz,ends timestamptz,opens timestamptz,closes timestamptz,capacity int,template uuid,hours numeric,expected int,poster uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE saved_event uuid;
BEGIN
 saved_event:=lub.save_event(target,org,title,description,location_type,location,url,starts,ends,opens,closes,capacity,template,hours,expected);
 IF poster IS NOT NULL THEN PERFORM lub.set_event_poster(saved_event,poster); END IF;
 RETURN saved_event;
END; $$;

CREATE FUNCTION lub.public_event_poster(target uuid) RETURNS TABLE(object_key text,mime_type text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT a.object_key,a.mime_type
 FROM lub.events e
 JOIN lub.event_assets ea ON ea.event_id=e.id AND ea.asset_type_code='Poster'
 JOIN lub.application_assets a ON a.id=ea.asset_id
 WHERE e.id=target AND e.published_at IS NOT NULL AND a.mime_type IN ('image/jpeg','image/png')
 LIMIT 1;
$$;

CREATE FUNCTION lub.can_read_published_event_poster(target text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(
  SELECT 1 FROM lub.application_assets a
  JOIN lub.event_assets ea ON ea.asset_id=a.id AND ea.asset_type_code='Poster'
  JOIN lub.events e ON e.id=ea.event_id
  WHERE a.object_key=target AND a.mime_type IN ('image/jpeg','image/png') AND e.published_at IS NOT NULL
 );
$$;

REVOKE ALL ON FUNCTION lub.set_event_poster(uuid,uuid),lub.save_event_with_poster(uuid,uuid,text,text,text,text,text,timestamptz,timestamptz,timestamptz,timestamptz,int,uuid,numeric,int,uuid),lub.public_event_poster(uuid),lub.can_read_published_event_poster(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lub.set_event_poster(uuid,uuid),lub.save_event_with_poster(uuid,uuid,text,text,text,text,text,timestamptz,timestamptz,timestamptz,timestamptz,int,uuid,numeric,int,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION lub.public_event_poster(uuid),lub.can_read_published_event_poster(text) TO anon,authenticated;

CREATE POLICY public_event_posters ON storage.objects FOR SELECT TO anon,authenticated USING (bucket_id='lub-application-files' AND lub.can_read_published_event_poster(name));
