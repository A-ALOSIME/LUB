-- List actions are rechecked under a row lock; UI availability is not authorization.
ALTER TABLE lub.registration_rounds DROP CONSTRAINT round_status_check;
ALTER TABLE lub.registration_rounds ADD CONSTRAINT round_status_check CHECK(status_code IN('Draft','Open','Paused','Closed','Archived'));
ALTER TABLE lub.renewal_campaigns DROP CONSTRAINT renewal_bounds_check;
ALTER TABLE lub.renewal_campaigns ADD CONSTRAINT renewal_bounds_check CHECK(closes_at>opens_at AND status_code IN('Draft','Open','Paused','Closed','Archived'));
--> statement-breakpoint
CREATE FUNCTION lub.transition_campaign(kind text,target uuid,operation text,expected text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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
   (state='Closed' AND operation='archive')
 ) THEN RAISE EXCEPTION 'Refresh campaign'; END IF;
 IF operation='delete' THEN
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
CREATE FUNCTION lub.save_renewal_draft(target uuid,term uuid,opens timestamptz,closes timestamptz,leaders boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c lub.renewal_campaigns;
BEGIN
 SELECT * INTO c FROM lub.renewal_campaigns WHERE id=target FOR UPDATE;
 IF c.id IS NULL OR NOT lub.has_org_permission(c.organization_id,'RENEWALS_MANAGE') THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 IF c.status_code<>'Draft' OR opens IS NULL OR closes IS NULL OR closes<=opens THEN RAISE EXCEPTION 'Invalid draft'; END IF;
 UPDATE lub.renewal_campaigns SET academic_term_id=term,opens_at=opens,closes_at=closes,exclude_leadership=leaders WHERE id=target;
 PERFORM lub.task_audit(target,c.organization_id,'RENEWAL_SAVED');
END; $$;
--> statement-breakpoint
-- Preserve prior completion/cancellation timestamps when archiving; never rewrite history.
ALTER TABLE lub.events DROP CONSTRAINT event_state_check;
ALTER TABLE lub.events ADD CONSTRAINT event_state_check CHECK(status_code IN('Draft','Published','Completed','Cancelled','Archived') AND (status_code='Archived' OR ((status_code='Completed')=(completed_at IS NOT NULL) AND (status_code='Cancelled')=(cancelled_at IS NOT NULL))));
CREATE FUNCTION lub.event_list_action(target uuid,operation text,expected int) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e lub.events;
BEGIN
 SELECT * INTO e FROM lub.events WHERE id=target FOR UPDATE;
 IF e.id IS NULL OR NOT lub.can_operate_event(target) THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 IF e.revision IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Refresh event'; END IF;
 IF operation='archive' AND e.status_code<>'Archived' THEN
  UPDATE lub.events SET status_code='Archived',published_at=null,revision=revision+1,updated_at=now(),is_featured=false WHERE id=target;
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
REVOKE ALL ON FUNCTION lub.transition_campaign(text,uuid,text,text),lub.save_renewal_draft(uuid,uuid,timestamptz,timestamptz,boolean),lub.event_list_action(uuid,text,int) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION lub.transition_campaign(text,uuid,text,text),lub.save_renewal_draft(uuid,uuid,timestamptz,timestamptz,boolean),lub.event_list_action(uuid,text,int) TO authenticated;
--> statement-breakpoint
CREATE FUNCTION lub.export_hours_rows(org uuid,committee uuid,term uuid,state text,query text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF NOT (lub.has_org_permission(org,'REPORTS_GENERATE') OR (committee IS NOT NULL AND lub.has_org_permission(org,'REPORTS_GENERATE',committee))) THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 IF length(query)>120 OR (state IS NOT NULL AND state NOT IN('Approved','Pending','Rejected')) OR (committee IS NOT NULL AND NOT EXISTS(SELECT 1 FROM lub.committees WHERE id=committee AND organization_id=org)) THEN RAISE EXCEPTION 'Invalid filters'; END IF;
 SELECT jsonb_build_object('organization',o.name_ar,'slug',o.slug,'records',coalesce((SELECT jsonb_agg(row ORDER BY row.activity_date DESC,row.id) FROM (
  SELECT h.id,p.full_name_ar AS name,c.name AS committee,h.description,h.hours,h.activity_date,t.name_ar AS term,h.status_code,h.source_code,actor.full_name_ar AS added_by
  FROM lub.hour_records h JOIN lub.organization_memberships m ON m.id=h.organization_membership_id
  JOIN lub.users u ON u.id=m.user_id JOIN lub.student_profiles p ON p.user_id=u.id
  LEFT JOIN lub.committees c ON c.id=h.committee_id JOIN lub.academic_terms t ON t.id=h.academic_term_id
  LEFT JOIN lub.student_profiles actor ON actor.user_id=h.requested_by_user_id
  WHERE h.organization_id=org AND lub.is_student_membership(m.id) AND NOT u.is_test_account
    AND (committee IS NULL OR h.committee_id=committee) AND (term IS NULL OR h.academic_term_id=term)
    AND (state IS NULL OR h.status_code=state) AND position(lub.arabic_search_key(query) IN lub.arabic_search_key(p.full_name_ar))>0
  ORDER BY h.activity_date DESC,h.id LIMIT 5001
 ) row),'[]'::jsonb)) INTO result FROM lub.organizations o WHERE o.id=org;
 IF jsonb_array_length(result->'records')>5000 THEN RAISE EXCEPTION 'Export too large'; END IF;
 INSERT INTO lub.audit_log(actor_user_id,action_code,entity_type,entity_id,organization_id) VALUES(auth.uid(),'HOURS_XLSX_EXPORTED','hours_export',org,org);
 RETURN result;
END; $$;
REVOKE ALL ON FUNCTION lub.export_hours_rows(uuid,uuid,uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION lub.export_hours_rows(uuid,uuid,uuid,text,text) TO authenticated;
--> statement-breakpoint
ALTER TABLE lub.application_assets ADD COLUMN thumbnail_png_base64 text CHECK(thumbnail_png_base64 IS NULL OR length(thumbnail_png_base64)<=87384);
CREATE FUNCTION lub.set_asset_thumbnail(target uuid,thumbnail text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM lub.application_assets WHERE id=target AND owner_user_id=auth.uid() AND mime_type IN('image/png','image/jpeg')) THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 IF thumbnail IS NULL OR length(thumbnail)>87384 OR substring(decode(thumbnail,'base64') FROM 1 FOR 8)<>decode('89504e470d0a1a0a','hex') THEN RAISE EXCEPTION 'Invalid thumbnail'; END IF;
 UPDATE lub.application_assets SET thumbnail_png_base64=thumbnail WHERE id=target;
END; $$;
CREATE FUNCTION lub.public_event_thumbnail(target uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT a.thumbnail_png_base64 FROM lub.event_assets ea JOIN lub.application_assets a ON a.id=ea.asset_id WHERE ea.event_id=target AND ea.asset_type_code='Poster' AND lub.can_read_published_event_poster(a.object_key) LIMIT 1;
$$;
REVOKE ALL ON FUNCTION lub.set_asset_thumbnail(uuid,text),lub.public_event_thumbnail(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION lub.set_asset_thumbnail(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION lub.public_event_thumbnail(uuid) TO anon,authenticated;

--> statement-breakpoint
create function lub.organization_member_directory(org uuid,query text,status text,committee uuid,skip integer) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; wide boolean; allowed_committees uuid[];
begin
 wide:=lub.has_org_permission(org,'MEMBERS_VIEW') or lub.has_org_permission(org,'MEMBERS_MANAGE');
 select array_agg(c.id) into allowed_committees from lub.committees c where c.organization_id=org and lub.has_org_permission(org,'MEMBERS_VIEW',c.id);
 if not wide and coalesce(cardinality(allowed_committees),0)=0 then raise exception 'Permission required' using errcode='42501';end if;
 if status not in ('all','Active','Ended','Inactive') or char_length(coalesce(query,''))>120 then raise exception 'Invalid member filters';end if;
 if committee is not null and (not exists(select 1 from lub.committees c where c.id=committee and c.organization_id=org) or not (lub.has_org_permission(org,'MEMBERS_VIEW') or lub.has_org_permission(org,'MEMBERS_MANAGE') or lub.has_org_permission(org,'MEMBERS_VIEW',committee))) then raise exception 'Committee permission required' using errcode='42501';end if;
 with visible as(
  select m.*,p.full_name_ar,p.major_name,p.academic_level,p.university_id_ciphertext
  from lub.organization_memberships m join lub.student_profiles p on p.user_id=m.user_id join lub.users u on u.id=m.user_id
  where m.organization_id=org and m.merged_into is null and u.status_code='Active' and lub.is_student_account(m.user_id) and (wide or exists(select 1 from lub.organization_memberships history left join lub.committee_memberships cm on cm.organization_membership_id=history.id left join lub.role_assignments r on r.organization_membership_id=history.id where history.organization_id=org and history.user_id=m.user_id and (cm.committee_id=any(allowed_committees) or r.committee_id=any(allowed_committees))))
 ),matches as(
  select m.* from visible m where
  (coalesce(trim(query),'')='' or position(lub.arabic_search_key(query) in lub.arabic_search_key(m.full_name_ar||' '||m.major_name))>0 or exists(select 1 from lub.committee_memberships cm join lub.organization_memberships history on history.id=cm.organization_membership_id join lub.committees c on c.id=cm.committee_id where history.user_id=m.user_id and history.organization_id=org and position(lub.arabic_search_key(query) in lub.arabic_search_key(c.name))>0))
  and (committee is null or exists(select 1 from lub.committee_memberships cm join lub.organization_memberships history on history.id=cm.organization_membership_id where history.user_id=m.user_id and history.organization_id=org and cm.committee_id=committee))
 ),filtered as(select * from matches where status='all' or status_code=status)
 select jsonb_build_object(
  'canManage',lub.has_org_permission(org,'MEMBERS_MANAGE'),'canGrant',lub.has_org_permission(org,'PERMISSIONS_GRANT'),'canAddHours',lub.has_org_permission(org,'HOURS_MANUAL_ADD'),
  'counts',(select jsonb_build_object('total',count(*),'active',count(*) filter(where status_code='Active'),'ended',count(*) filter(where status_code='Ended'),'inactive',count(*) filter(where status_code='Inactive')) from filtered),
  'statusCounts',(select jsonb_build_object('all',count(*),'Active',count(*) filter(where status_code='Active'),'Ended',count(*) filter(where status_code='Ended'),'Inactive',count(*) filter(where status_code='Inactive')) from matches),
  'terms',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'name',t.name_ar,'year',t.academic_year,'termCode',t.term_code,'startDate',t.start_date,'endDate',t.end_date) order by t.start_date desc,t.id) from (select * from lub.academic_terms order by start_date desc,id limit 30)t),'[]'::jsonb),
  'committees',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name) order by c.name,c.id) from lub.committees c where c.organization_id=org and c.status_code='Active' and (lub.has_org_permission(org,'MEMBERS_VIEW') or lub.has_org_permission(org,'MEMBERS_MANAGE') or lub.has_org_permission(org,'MEMBERS_VIEW',c.id))),'[]'::jsonb),
  'members',coalesce((select jsonb_agg(row_data order by member_name,member_id) from (
   select jsonb_build_object('id',m.id,'userId',m.user_id,'universityCiphertext',m.university_id_ciphertext,'name',m.full_name_ar,'major',m.major_name,'level',m.academic_level,'status',m.status_code,
   'startDate',coalesce((select (e.occurred_at at time zone 'Asia/Riyadh')::date from lub.membership_events e where e.membership_id=m.id and e.event_code in ('Joined','Rejoined') order by e.occurred_at desc,e.id limit 1),m.start_date),'endDate',m.end_date,
   'canManage',m.status_code='Active' and lub.has_org_permission(org,'MEMBERS_MANAGE'),
   'hours',coalesce((select sum(h.hours) from lub.hour_records h join lub.organization_memberships history on history.id=h.organization_membership_id where history.user_id=m.user_id and history.organization_id=org and h.status_code='Approved'),0),
   'roles',coalesce((select jsonb_agg(jsonb_build_object('code',r.role_code,'committee',c.name) order by r.role_code,c.name) from lub.role_assignments r join lub.organization_memberships history on history.id=r.organization_membership_id left join lub.committees c on c.id=r.committee_id where history.user_id=m.user_id and history.organization_id=org and r.start_date<=current_date and (r.end_date is null or r.end_date>current_date)),'[]'::jsonb),
   'committees',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name) order by c.name,c.id) from lub.committees c where c.organization_id=org and exists(select 1 from lub.committee_memberships cm join lub.organization_memberships history on history.id=cm.organization_membership_id where history.user_id=m.user_id and history.organization_id=org and cm.committee_id=c.id and cm.status_code='Active' and cm.start_date<=current_date and (cm.end_date is null or cm.end_date>current_date))),'[]'::jsonb),
   'hourScopes',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name) order by c.name,c.id) from lub.committees c where c.organization_id=org and c.status_code='Active' and lub.has_org_permission(org,'HOURS_MANUAL_ADD',c.id) and exists(select 1 from lub.committee_memberships cm join lub.organization_memberships history on history.id=cm.organization_membership_id where history.user_id=m.user_id and history.organization_id=org and cm.committee_id=c.id and cm.status_code='Active' and cm.start_date<=current_date and (cm.end_date is null or cm.end_date>current_date))),'[]'::jsonb)
   ) row_data,m.id member_id,m.full_name_ar member_name from filtered m order by m.full_name_ar,m.id limit 25 offset greatest(0,least(skip,250000))
  ) rows),'[]'::jsonb)
 ) into result;
 return result;
end;$$;
revoke all on function lub.organization_member_directory(uuid,text,text,uuid,integer) from public,anon;
grant execute on function lub.organization_member_directory(uuid,text,text,uuid,integer) to authenticated;

--> statement-breakpoint
-- The source tables deliberately do not grant broad SELECT to authenticated users.
-- This owner-only read exposes exactly the list projection, never contact/identifier fields.
CREATE FUNCTION lub.own_request_page(kind text,query text,state text,ordering text,skip integer) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF NOT lub.is_student_account(auth.uid()) OR NOT EXISTS(SELECT 1 FROM lub.users WHERE id=auth.uid() AND status_code='Active' AND email_verified_at IS NOT NULL) THEN RAISE EXCEPTION 'Student access required' USING ERRCODE='42501'; END IF;
 IF kind IS NULL OR query IS NULL OR state IS NULL OR ordering IS NULL OR skip IS NULL OR kind NOT IN('applications','renewals','organizations') OR length(query)>120 OR ordering NOT IN('asc','desc') OR skip<0 OR skip>250000 OR state NOT IN('all','Submitted','Interview','Accepted','Rejected','Withdrawn','Pending','Renewed','Declined','No_Response') THEN RAISE EXCEPTION 'Invalid filters'; END IF;
 WITH source AS MATERIALIZED(

  select a.id,o.name_ar as name,r.title,a.status_code as status,a.created_at,
   coalesce((select h.reason from lub.application_status_history h where h.application_id=a.id and h.to_status_code='Rejected' order by h.created_at desc,h.id desc limit 1),'') as reason,
   o.slug,o.logo_url as logo,r.id as round,(a.status_code='Submitted' and r.allow_withdrawal and lub.round_is_open(r.id)) as "canWithdraw",false as "canRespond",''::text as summary,''::text as mission,'[]'::jsonb as interests,r.opens_at as opens,r.closes_at as closes
  from lub.membership_applications a join lub.registration_rounds r on r.id=a.registration_round_id join lub.organizations o on o.id=r.organization_id where kind='applications' and a.applicant_user_id=auth.uid()
UNION ALL

  select r.id,o.name_ar as name,t.name_ar as title,case when r.response_code='Pending' and c.closes_at<=statement_timestamp() then 'No_Response' else r.response_code end as status,c.created_at,
   ''::text as reason,o.slug,o.logo_url as logo,null::uuid as round,false as "canWithdraw",
   (r.response_code='Pending' and c.status_code='Open' and c.opens_at<=statement_timestamp() and c.closes_at>statement_timestamp() and m.status_code='Active' and m.start_date<=current_date and (m.end_date is null or m.end_date>current_date) and lub.task_scope_member(c.organization_id,null)) as "canRespond",
   ''::text as summary,''::text as mission,'[]'::jsonb as interests,c.opens_at as opens,c.closes_at as closes
  from lub.membership_renewals r join lub.organization_memberships m on m.id=r.organization_membership_id join lub.renewal_campaigns c on c.id=r.renewal_campaign_id join lub.academic_terms t on t.id=c.academic_term_id join lub.organizations o on o.id=c.organization_id where kind='renewals' and m.user_id=auth.uid()
UNION ALL

  select r.id,r.name_ar as name,case when r.type_code='Club' then 'نادي' else 'مجلس' end as title,r.status_code as status,r.created_at,r.decision_note as reason,o.slug,
   case when r.logo_webp_base64 is not null then '/organization-requests/'||r.id||'/logo' end as logo,null::uuid as round,r.status_code='Pending' as "canWithdraw",false as "canRespond",r.summary,r.mission,r.interests,null::timestamptz as opens,null::timestamptz as closes
  from lub.organization_opening_requests r left join lub.organizations o on o.id=r.organization_id where kind='organizations' and r.applicant_user_id=auth.uid()
 ),searched AS(SELECT * FROM source WHERE position(lub.arabic_search_key(query) IN lub.arabic_search_key(name||' '||title))>0),filtered AS(SELECT * FROM searched WHERE state='all' OR status=state)
 SELECT jsonb_build_object('items',coalesce((SELECT jsonb_agg(row) FROM(SELECT * FROM filtered ORDER BY CASE WHEN ordering='asc' THEN created_at END ASC,CASE WHEN ordering='desc' THEN created_at END DESC,id LIMIT 26 OFFSET skip)row),'[]'::jsonb),
 'counts',coalesce((SELECT jsonb_object_agg(status,total) FROM(SELECT status,count(*)::int total FROM searched GROUP BY status)counts),'{}'::jsonb),'total',(SELECT count(*)::int FROM filtered)) INTO result;
 RETURN result;
END; $$;
REVOKE ALL ON FUNCTION lub.own_request_page(text,text,text,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION lub.own_request_page(text,text,text,text,integer) TO authenticated;

--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.change_announcement_state(target uuid,operation text,pinned boolean DEFAULT false) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE org uuid; a lub.announcements;
BEGIN
 SELECT organization_id INTO org FROM lub.announcements WHERE id=target;
 IF org IS NULL OR NOT lub.has_org_permission(org,'ORG_PROFILE_MANAGE') THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM lub.organizations WHERE id=org FOR UPDATE;
 SELECT * INTO a FROM lub.announcements WHERE id=target AND deleted_at IS NULL FOR UPDATE;
 IF a.id IS NULL OR operation NOT IN ('pin','archive','delete') THEN RAISE EXCEPTION 'Announcement unavailable'; END IF;
 IF operation='delete' AND (a.published_at IS NOT NULL OR a.archived_at IS NOT NULL) THEN RAISE EXCEPTION 'Only drafts can be deleted'; END IF;
 IF operation='pin' THEN
  IF a.published_at IS NULL OR a.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Published announcement required'; END IF;
  IF pinned THEN UPDATE lub.announcements SET pinned_at=NULL WHERE organization_id=org AND pinned_at IS NOT NULL; END IF;
  UPDATE lub.announcements SET pinned_at=CASE WHEN pinned THEN now() END,updated_at=now() WHERE id=target;
 ELSE
  UPDATE lub.announcements SET pinned_at=NULL,archived_at=coalesce(archived_at,now()),deleted_at=CASE WHEN operation='delete' THEN now() END,updated_at=now() WHERE id=target;
 END IF;
END; $$;

--> statement-breakpoint
-- Preserve the legacy RPC entry point, with the same strict draft-only boundary.
CREATE OR REPLACE FUNCTION lub.delete_registration_round(target uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM lub.transition_campaign('round',target,'delete','Draft');
END; $$;
REVOKE ALL ON FUNCTION lub.delete_registration_round(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION lub.delete_registration_round(uuid) TO authenticated;

--> statement-breakpoint
CREATE FUNCTION public.export_hours_rows(org uuid,committee uuid,term uuid,state text,query text) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT lub.export_hours_rows(org,committee,term,state,query); $$;
REVOKE ALL ON FUNCTION public.export_hours_rows(uuid,uuid,uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.export_hours_rows(uuid,uuid,uuid,text,text) TO authenticated;

NOTIFY pgrst, 'reload schema';
