ALTER TABLE lub.events ADD COLUMN archived_from_status text CHECK(archived_from_status IN ('Draft','Published','Completed','Cancelled')),ADD COLUMN archived_from_published_at timestamptz;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.transition_campaign(kind text,target uuid,operation text,expected text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE org uuid; state text; closes timestamptz;
BEGIN
 IF kind='round' THEN SELECT organization_id INTO org FROM lub.registration_rounds WHERE id=target;
 ELSIF kind='renewal' THEN SELECT organization_id INTO org FROM lub.renewal_campaigns WHERE id=target;
 ELSE RAISE EXCEPTION 'Invalid campaign type'; END IF;
 IF org IS NULL OR NOT lub.has_org_permission(org,CASE WHEN kind='round' THEN 'REGISTRATION_ROUNDS_MANAGE' ELSE 'RENEWALS_MANAGE' END) THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM lub.organizations WHERE id=org FOR UPDATE;
 IF kind='round' THEN SELECT status_code,closes_at INTO state,closes FROM lub.registration_rounds WHERE id=target FOR UPDATE;
 ELSE SELECT status_code,closes_at INTO state,closes FROM lub.renewal_campaigns WHERE id=target FOR UPDATE; END IF;
 IF state IS DISTINCT FROM expected OR NOT (
   (state='Draft' AND operation IN('publish','delete')) OR
   (state='Open' AND operation IN('pause','close')) OR
   (state='Paused' AND operation IN('resume','close')) OR
   (state='Closed' AND operation='archive') OR (state='Archived' AND operation='restore')
 ) THEN RAISE EXCEPTION 'Refresh campaign'; END IF;
 IF operation='restore' THEN
  IF kind='round' THEN UPDATE lub.registration_rounds SET status_code='Closed' WHERE id=target;ELSE UPDATE lub.renewal_campaigns SET status_code='Closed' WHERE id=target;END IF;
 ELSIF operation='delete' THEN
  IF kind='round' THEN
   IF EXISTS(SELECT 1 FROM lub.membership_applications WHERE registration_round_id=target) THEN RAISE EXCEPTION 'Used draft cannot be deleted'; END IF;
   DELETE FROM lub.registration_rounds WHERE id=target;
  ELSE
   IF EXISTS(SELECT 1 FROM lub.membership_renewals WHERE renewal_campaign_id=target) THEN RAISE EXCEPTION 'Used draft cannot be deleted'; END IF;
   DELETE FROM lub.renewal_campaign_exclusions WHERE renewal_campaign_id=target;
   DELETE FROM lub.renewal_campaigns WHERE id=target;
  END IF;
 ELSIF operation IN('publish','resume') THEN
  IF closes IS NULL OR closes<=statement_timestamp() THEN RAISE EXCEPTION 'Campaign expired'; END IF;
  IF kind='round' THEN PERFORM lub.change_round_status(target,'Open');
  ELSIF operation='publish' THEN PERFORM lub.change_renewal_status(target,'Open');
  ELSE UPDATE lub.renewal_campaigns SET status_code='Open' WHERE id=target; END IF;
 ELSIF operation='pause' THEN
  IF kind='round' THEN UPDATE lub.registration_rounds SET status_code='Paused' WHERE id=target;
  ELSE UPDATE lub.renewal_campaigns SET status_code='Paused' WHERE id=target; END IF;
 ELSIF operation='close' THEN
  IF kind='round' THEN UPDATE lub.registration_rounds SET status_code='Closed' WHERE id=target;
  ELSE
   -- Reuse the existing close implementation so outstanding replies are finalized once.
   IF state='Paused' THEN UPDATE lub.renewal_campaigns SET status_code='Open' WHERE id=target; END IF;
   PERFORM lub.change_renewal_status(target,'Closed');
  END IF;
 ELSE
  IF kind='round' THEN UPDATE lub.registration_rounds SET status_code='Archived' WHERE id=target;
  ELSE PERFORM lub.change_renewal_status(target,'Archived'); END IF;
 END IF;
 PERFORM lub.task_audit(target,org,'CAMPAIGN_'||upper(operation));
END; $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.event_list_action(target uuid,operation text,expected int) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e lub.events;
BEGIN
 SELECT * INTO e FROM lub.events WHERE id=target FOR UPDATE;
 IF e.id IS NULL OR NOT lub.can_operate_event(target) THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 IF e.revision IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Refresh event'; END IF;
 IF operation='archive' AND e.status_code<>'Archived' THEN
  UPDATE lub.events SET archived_from_status=e.status_code,archived_from_published_at=e.published_at,status_code='Archived',published_at=null,revision=revision+1,updated_at=now(),is_featured=false WHERE id=target;
 ELSIF operation='restore' AND e.status_code='Archived' THEN
  UPDATE lub.events SET status_code=coalesce(e.archived_from_status,CASE WHEN e.completed_at IS NOT NULL THEN 'Completed' WHEN e.cancelled_at IS NOT NULL THEN 'Cancelled' ELSE 'Draft' END),published_at=e.archived_from_published_at,archived_from_status=NULL,archived_from_published_at=NULL,revision=revision+1,updated_at=now() WHERE id=target;
 ELSIF operation='delete' AND e.status_code='Draft' AND e.published_at IS NULL
   AND NOT EXISTS(SELECT 1 FROM lub.event_registrations WHERE event_id=target)
   AND NOT EXISTS(SELECT 1 FROM lub.tasks WHERE event_id=target)
   AND NOT EXISTS(SELECT 1 FROM lub.event_contributions WHERE event_id=target) THEN
  DELETE FROM lub.event_skill_tags WHERE event_id=target;
  DELETE FROM lub.event_assets WHERE event_id=target;
  DELETE FROM lub.events WHERE id=target;
 ELSE RAISE EXCEPTION 'Only unused drafts can be deleted'; END IF;
 PERFORM lub.task_audit(target,e.organization_id,'EVENT_'||upper(operation));
END; $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.change_announcement_state(target uuid,operation text,pinned boolean DEFAULT false) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE org uuid; a lub.announcements;
BEGIN
 SELECT organization_id INTO org FROM lub.announcements WHERE id=target;
 IF org IS NULL OR NOT lub.has_org_permission(org,'ANNOUNCEMENTS_MANAGE') THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM lub.organizations WHERE id=org FOR UPDATE;
 SELECT * INTO a FROM lub.announcements WHERE id=target AND deleted_at IS NULL FOR UPDATE;
 IF a.id IS NULL OR operation NOT IN ('pin','archive','restore','delete') THEN RAISE EXCEPTION 'Announcement unavailable'; END IF;
 IF operation='delete' AND (a.published_at IS NOT NULL OR a.archived_at IS NOT NULL) THEN RAISE EXCEPTION 'Only drafts can be deleted'; END IF;
 IF operation='restore' THEN
  IF a.archived_at IS NULL THEN RAISE EXCEPTION 'Archived announcement required';END IF;
  UPDATE lub.announcements SET archived_at=NULL,updated_at=now() WHERE id=target;
 ELSIF operation='pin' THEN
  IF a.published_at IS NULL OR a.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Published announcement required'; END IF;
  IF pinned THEN UPDATE lub.announcements SET pinned_at=NULL WHERE organization_id=org AND pinned_at IS NOT NULL; END IF;
  UPDATE lub.announcements SET pinned_at=CASE WHEN pinned THEN now() END,updated_at=now() WHERE id=target;
 ELSE
  UPDATE lub.announcements SET pinned_at=NULL,archived_at=coalesce(archived_at,now()),deleted_at=CASE WHEN operation='delete' THEN now() END,updated_at=now() WHERE id=target;
 END IF;
END; $$;
NOTIFY pgrst,'reload schema';

--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.save_announcement(target uuid,org uuid,heading text,content text,link text,published boolean,pinned boolean,asset uuid,replace_image boolean) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a lub.announcements;
BEGIN
 IF NOT lub.has_org_permission(org,'ANNOUNCEMENTS_MANAGE') THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM lub.organizations WHERE id=org FOR UPDATE;
 IF target IS NOT NULL THEN
  SELECT * INTO a FROM lub.announcements WHERE id=target AND organization_id=org AND deleted_at IS NULL AND archived_at IS NULL FOR UPDATE;
  IF a.id IS NULL THEN RAISE EXCEPTION 'Announcement unavailable'; END IF;
 END IF;
 IF pinned AND NOT published THEN RAISE EXCEPTION 'Publish before pinning'; END IF;
 IF pinned THEN UPDATE lub.announcements SET pinned_at=NULL WHERE organization_id=org AND pinned_at IS NOT NULL; END IF;
 IF target IS NULL THEN
  INSERT INTO lub.announcements(organization_id,title,body,external_url,image_asset_id,published_at,pinned_at) VALUES(org,heading,content,nullif(trim(link),''),CASE WHEN replace_image THEN asset END,CASE WHEN published THEN now() END,CASE WHEN pinned THEN now() END) RETURNING id INTO target;
 ELSE
  UPDATE lub.announcements SET title=heading,body=content,external_url=nullif(trim(link),''),image_asset_id=CASE WHEN replace_image THEN asset ELSE image_asset_id END,published_at=CASE WHEN published THEN coalesce(a.published_at,now()) END,pinned_at=CASE WHEN pinned THEN now() END,updated_at=now() WHERE id=target;
 END IF;
 RETURN target;
END; $$;

ALTER POLICY announcement_manager_read ON lub.announcements USING(lub.has_org_permission(organization_id,'ANNOUNCEMENTS_MANAGE'));

-- Imported archival information stays intact if restored as a draft; publication still requires complete event details.
ALTER TABLE lub.events DROP CONSTRAINT event_archival_source_check;
ALTER TABLE lub.events ADD CONSTRAINT event_archival_source_check CHECK(source_date_text IS NULL OR length(source_date_text)<=1000);
ALTER TABLE lub.events DROP CONSTRAINT event_location_check;
ALTER TABLE lub.events ADD CONSTRAINT event_location_check CHECK((status_code IN ('Draft','Archived') AND location_type_code='Unknown') OR (location_type_code IN ('In_Person','Online','Hybrid') AND (status_code='Draft' OR (status_code='Cancelled' AND published_at IS NULL) OR ((location_type_code='Online' OR coalesce(length(trim(location_text)),0)>0) AND (location_type_code='In_Person' OR coalesce(online_url,'')~'^https://[^[:space:]@]+$')))));
