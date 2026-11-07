CREATE FUNCTION lub.event_catalog(query text,period text,page int,org uuid,only_open boolean)
RETURNS TABLE(id uuid,title text,starts_at timestamptz,ends_at timestamptz,status_code text,source_date_text text,location_type_code text,location_text text,online_url text,org_name text,org_type_code text,org_logo_url text,slug text,organization_id uuid,has_poster boolean,open boolean,title_en text,org_name_en text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT e.id,e.title::text,e.starts_at,e.ends_at,e.status_code,e.source_date_text::text,e.location_type_code,e.location_text::text,e.online_url::text,
  o.name_ar::text,o.type_code,o.logo_url::text,o.slug::text,o.id,e.primary_image_id IS NOT NULL,lub.event_registration_open(e.id),e.title_en::text,o.name_en::text
 FROM lub.organization_content e JOIN lub.organizations o ON o.id=e.organization_id
 WHERE e.kind='Event' AND o.status_code='Active' AND e.published_at<=statement_timestamp() AND e.archived_at IS NULL AND e.deleted_at IS NULL
  AND e.status_code IN ('Published','Completed','Cancelled','Archived') AND (org IS NULL OR o.id=org)
  AND (strpos(lub.arabic_search_key(e.title),lub.arabic_search_key(query))>0 OR strpos(lub.arabic_search_key(e.title_en),lub.arabic_search_key(query))>0)
  AND (period='all' OR (period='upcoming' AND e.status_code='Published' AND e.ends_at>=statement_timestamp())
   OR (period='past' AND (e.ends_at<statement_timestamp() OR e.status_code='Archived')))
  AND (NOT only_open OR lub.event_registration_open(e.id))
 ORDER BY e.starts_at DESC NULLS LAST,e.id LIMIT 25 OFFSET greatest(page,0)::bigint*24;
$$;

CREATE FUNCTION lub.can_feature_event(target uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT lub.can_operate_event(target) AND EXISTS(
  SELECT 1 FROM lub.organization_content e JOIN lub.access_assignments a ON a.organization_id=e.organization_id
  JOIN lub.organization_memberships m ON m.id=a.organization_membership_id
  WHERE e.id=target AND a.user_id=auth.uid() AND a.role_code='OL' AND a.start_at<=statement_timestamp()
   AND (a.end_at IS NULL OR a.end_at>statement_timestamp()) AND m.status_code='Active'
   AND m.start_date<=lub.today_riyadh() AND (m.end_date IS NULL OR m.end_date>lub.today_riyadh()));
$$;

CREATE FUNCTION lub.set_featured_event(target uuid,featured boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e lub.organization_content;
BEGIN
 e:=lub.lock_event(target);
 IF featured IS NULL OR NOT lub.can_feature_event(target) THEN RAISE EXCEPTION 'Organization leader required' USING ERRCODE='42501'; END IF;
 IF featured THEN
  IF NOT lub.content_is_public(target) OR e.status_code NOT IN ('Published','Completed','Archived') THEN RAISE EXCEPTION 'Published event required'; END IF;
  UPDATE lub.organization_content SET is_featured=false,revision=revision+1,updated_at=now()
   WHERE organization_id=e.organization_id AND kind='Event' AND is_featured AND id<>target;
 END IF;
 UPDATE lub.organization_content SET is_featured=featured,revision=revision+1,updated_at=now() WHERE id=target AND is_featured<>featured;
END; $$;

CREATE FUNCTION lub.event_page(target uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object(
  'event',jsonb_build_object('id',e.id,'organization_id',e.organization_id,'title',e.title,'title_en',e.title_en,'description',e.body,'description_en',e.body_en,
   'source_date_text',e.source_date_text,'location_type_code',e.location_type_code,'location_text',e.location_text,'online_url',e.online_url,
   'starts_at',coalesce(e.starts_at::text,''),'ends_at',coalesce(e.ends_at::text,''),
   'registration_opens_at',coalesce(e.registration_opens_at::text,''),'registration_closes_at',coalesce(e.registration_closes_at::text,''),
   'capacity',CASE WHEN access.manage THEN e.capacity END,'attendance_hours',e.attendance_hours::text,'status_code',e.status_code,
   'is_featured',e.is_featured,'public_report',e.public_report,'public_photos',coalesce((SELECT jsonb_agg(p->>'url' ORDER BY ordinal)
    FROM jsonb_array_elements(e.public_photos) WITH ORDINALITY AS photos(p,ordinal) WHERE p?'url'),'[]'),
   'revision',CASE WHEN access.manage THEN e.revision ELSE 0 END,'registration_form_template_id',CASE WHEN access.manage THEN e.form_id END,
   'has_poster',e.primary_image_id IS NOT NULL,'requires_approval',e.requires_review)
   || CASE WHEN access.manage THEN jsonb_build_object('skills',lub.activity_skill_items(e.skill_ids)) ELSE '{}' END,
  'org_name',o.name_ar,'org_name_en',o.name_en,'org_logo',o.logo_url,'org_type_code',o.type_code,'slug',o.slug,
  'status',u.status_code,'onboarded',u.onboarded_at IS NOT NULL,
  'open',lub.event_registration_open(e.id),
  'remaining',CASE WHEN e.capacity IS NOT NULL THEN greatest(0,e.capacity-(SELECT count(*)::int FROM lub.event_registrations seat
   WHERE seat.event_id=e.id AND seat.status_code='Registered' AND seat.review_status_code<>'Rejected' AND lub.is_student_account(seat.user_id))) END,
  'own',CASE WHEN r.id IS NOT NULL THEN jsonb_build_object('id',r.id,'status_code',r.status_code,'attendance',r.attendance,
   'review_status_code',r.review_status_code,'review_note',r.review_note,'answers',r.answers,
   'version',r.form_snapshot->>'id','response_revision',CASE WHEN r.form_snapshot?'id' THEN r.response_revision END) END,
  'form',CASE WHEN r.form_snapshot?'id' THEN jsonb_build_object('id',r.form_snapshot->>'id','definition',r.form_snapshot->'definition')
   WHEN lub.content_is_public(e.id) OR access.manage THEN (SELECT jsonb_build_object('id',f->>'id','definition',f->'version'->'definition')
    FROM jsonb_array_elements(o.forms) f WHERE f->>'id'=e.form_id::text AND f->'version'->>'status_code'='Published') END,
  'committees',coalesce((SELECT jsonb_agg(c) FROM lub.form_committee_options(o.id) c),'[]'),
  'canManage',access.manage,'canFeature',lub.can_feature_event(e.id),'canAttend',lub.can_operate_event(e.id,'EVENT_ATTENDANCE_MANAGE'),
  'registrations','[]'::jsonb,
  'assets',CASE WHEN access.manage THEN coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.id,'file_name',a.file_name,'asset_type_code',f->>'type'))
    FROM jsonb_array_elements(e.attachments) f JOIN lub.assets a ON a.id::text=f->>'assetId'),'[]') ELSE '[]' END)
 FROM lub.organization_content e JOIN lub.organizations o ON o.id=e.organization_id
 LEFT JOIN lub.users u ON u.id=auth.uid()
 LEFT JOIN lub.event_registrations r ON r.event_id=e.id AND r.user_id=u.id AND u.status_code='Active'
 CROSS JOIN LATERAL (SELECT lub.can_operate_event(e.id) AS manage) access
 WHERE e.id=target AND e.kind='Event' AND e.deleted_at IS NULL AND lub.can_read_event(e.id);
$$;

CREATE FUNCTION lub.event_poster_for_viewer(target uuid) RETURNS TABLE(object_key text,mime_type text,thumbnail_png_base64 text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT a.object_key,a.mime_type::text,a.thumbnail_png_base64
 FROM lub.organization_content e JOIN lub.assets a ON a.id=e.primary_image_id
 WHERE e.id=target AND e.kind='Event' AND e.deleted_at IS NULL AND a.mime_type IN ('image/png','image/jpeg') AND lub.can_read_event(e.id);
$$;

CREATE FUNCTION lub.my_event_registrations(query text,filter text,ascending boolean,page int) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('status',u.status_code,'onboarded',u.onboarded_at IS NOT NULL,'events',coalesce((
  SELECT jsonb_agg(to_jsonb(items)-'sort_date' ORDER BY CASE WHEN ascending THEN sort_date END ASC NULLS LAST,
    CASE WHEN NOT ascending THEN sort_date END DESC NULLS LAST,id)
  FROM (
   SELECT e.id,r.id AS registration_id,e.attendance_hours::text AS attendance_hours,e.title,e.starts_at,e.starts_at AS sort_date,
    e.status_code,o.name_ar AS org_name,e.primary_image_id IS NOT NULL AS has_poster,r.status_code AS registration,
    r.review_status_code AS review_status,r.attendance,
    (r.status_code='Registered' AND r.review_status_code IN ('Pending','Accepted') AND e.status_code='Published'
     AND statement_timestamp()<e.starts_at) IS TRUE AS "canWithdraw",
    r.status_code='Cancelled' AND lub.event_registration_open(e.id) AS "canReapply"
   FROM lub.event_registrations r JOIN lub.organization_content e ON e.id=r.event_id JOIN lub.organizations o ON o.id=e.organization_id
   WHERE r.user_id=u.id AND lub.is_student_account(u.id) AND e.deleted_at IS NULL
    AND position(lub.arabic_search_key(query) IN lub.arabic_search_key(e.title||' '||o.name_ar))>0
    AND (filter='all' OR (filter='cancelled' AND r.status_code='Cancelled') OR (r.status_code='Registered'
     AND lower(r.review_status_code)=filter))
   ORDER BY CASE WHEN ascending THEN e.starts_at END ASC NULLS LAST,CASE WHEN NOT ascending THEN e.starts_at END DESC NULLS LAST,e.id
   LIMIT CASE WHEN page IS NULL THEN 51 ELSE 26 END OFFSET greatest(page,0)::bigint*25
  ) items
 ),'[]')) FROM lub.users u WHERE u.id=auth.uid();
$$;

REVOKE ALL ON FUNCTION lub.event_catalog(text,text,int,uuid,boolean),lub.event_page(uuid),lub.can_feature_event(uuid),lub.event_poster_for_viewer(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION lub.event_catalog(text,text,int,uuid,boolean),lub.event_page(uuid) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION lub.event_poster_for_viewer(uuid) TO authenticated;
REVOKE ALL ON FUNCTION lub.set_featured_event(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION lub.set_featured_event(uuid,boolean) TO authenticated;
REVOKE ALL ON FUNCTION lub.my_event_registrations(text,text,boolean,int) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION lub.my_event_registrations(text,text,boolean,int) TO authenticated;

CREATE FUNCTION lub.event_management_page(org uuid,page int,filters jsonb DEFAULT NULL) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('name',o.name_ar,'slug',o.slug,'status',u.status_code,'onboarded',u.onboarded_at IS NOT NULL,
  'canViewEvents',access.events,'canManage',access.manage,'canManageAnnouncements',access.announcements,
  'events',CASE WHEN access.events AND coalesce(filters->>'section','events')='events' THEN coalesce((
   SELECT jsonb_agg(to_jsonb(rows)-'sort_date'-'current' ORDER BY current DESC NULLS LAST,
    CASE WHEN filters->>'sort'='asc' THEN sort_date END ASC NULLS LAST,
    CASE WHEN filters->>'sort' IS DISTINCT FROM 'asc' THEN sort_date END DESC NULLS LAST,id)
   FROM (
    SELECT e.id,e.organization_id,e.title,coalesce(e.starts_at::text,'') AS starts_at,coalesce(e.ends_at::text,'') AS ends_at,
     e.status_code,e.revision,e.location_text,e.location_type_code,e.primary_image_id IS NOT NULL AS has_poster,e.starts_at AS sort_date,
     e.ends_at>=statement_timestamp() AS current,(SELECT count(*)::int FROM lub.event_registrations r JOIN lub.users student ON student.id=r.user_id
      WHERE r.event_id=e.id AND r.status_code='Registered' AND NOT student.is_test_account AND lub.is_student_account(student.id)) AS registrant_count
    FROM lub.organization_content e WHERE e.organization_id=o.id AND e.kind='Event' AND e.deleted_at IS NULL
     AND (access.manage OR lub.content_is_public(e.id))
     AND (filters IS NULL OR (coalesce(filters->>'eventStatus','all')='all' AND e.status_code<>'Archived') OR e.status_code=filters->>'eventStatus')
     AND position(lub.arabic_search_key(coalesce(filters->>'eventSearch','')) IN lub.arabic_search_key(e.title||' '||coalesce(e.location_text,'')))>0
    ORDER BY current DESC NULLS LAST,CASE WHEN filters->>'sort'='asc' THEN e.starts_at END ASC NULLS LAST,
     CASE WHEN filters->>'sort' IS DISTINCT FROM 'asc' THEN e.starts_at END DESC NULLS LAST,e.id
    LIMIT CASE WHEN page IS NULL THEN 51 ELSE 26 END OFFSET greatest(page,0)::bigint*25
   ) rows
  ),'[]') ELSE '[]' END,
  'templates',CASE WHEN access.manage THEN coalesce((SELECT jsonb_agg(t ORDER BY t.name,t.id) FROM (
    SELECT f->>'id' AS id,f->>'name' AS name FROM jsonb_array_elements(o.forms) f
    WHERE f->'version'->>'status_code'='Published' ORDER BY name,id LIMIT 100
   ) t),'[]') ELSE '[]' END,
  'announcements',CASE WHEN access.announcements AND coalesce(filters->>'section','announcements')='announcements' THEN coalesce((
   SELECT jsonb_agg(to_jsonb(rows)-'sort_date' ORDER BY
    CASE WHEN filters->>'announcementSort'='asc' THEN sort_date END ASC NULLS LAST,
    CASE WHEN filters->>'announcementSort' IS DISTINCT FROM 'asc' THEN sort_date END DESC NULLS LAST,id)
   FROM (
    SELECT a.id,a.title,a.body,a.published_at IS NOT NULL AS published,a.pinned_at IS NOT NULL AS pinned,
     a.created_at AS "createdAt",a.published_at AS "publishedAt",a.archived_at IS NOT NULL AS archived,
     a.external_url AS "externalUrl",a.primary_image_id AS "imageAssetId",coalesce(a.published_at,a.created_at) AS sort_date
    FROM lub.organization_content a WHERE a.organization_id=o.id AND a.kind='Announcement' AND a.deleted_at IS NULL
     AND (filters IS NULL OR (coalesce(filters->>'announcementStatus','all')='all' AND a.archived_at IS NULL)
      OR lower(a.status_code)=filters->>'announcementStatus')
     AND position(lub.arabic_search_key(coalesce(filters->>'announcementSearch','')) IN lub.arabic_search_key(a.title||' '||a.body))>0
    ORDER BY CASE WHEN filters->>'announcementSort'='asc' THEN coalesce(a.published_at,a.created_at) END ASC NULLS LAST,
     CASE WHEN filters->>'announcementSort' IS DISTINCT FROM 'asc' THEN coalesce(a.published_at,a.created_at) END DESC NULLS LAST,a.id
    LIMIT CASE WHEN page IS NULL THEN 51 ELSE 26 END OFFSET greatest((filters->>'announcementPage')::int,0)::bigint*25
   ) rows
  ),'[]') ELSE '[]' END)
 FROM lub.organizations o JOIN lub.users u ON u.id=auth.uid()
 CROSS JOIN LATERAL (SELECT lub.has_event_access(o.id) AS events,lub.has_org_permission(o.id,'EVENTS_MANAGE') AS manage,
  lub.has_org_permission(o.id,'ANNOUNCEMENTS_MANAGE') AS announcements) access
 WHERE o.id=org AND (access.events OR access.announcements);
$$;
REVOKE ALL ON FUNCTION lub.event_management_page(uuid,int,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION lub.event_management_page(uuid,int,jsonb) TO authenticated;

CREATE FUNCTION lub.event_registrant_page(org uuid,event_filter uuid,query text,filter text,page int,details boolean,registration uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH access AS (
  SELECT lub.has_org_permission(org,'EVENT_REGISTRATIONS_REVIEW') AS review,
   lub.has_org_permission(org,'EVENT_ATTENDANCE_MANAGE') AS attend,lub.has_org_permission(org,'EVENTS_MANAGE') AS manage
 ), matches AS MATERIALIZED (
  SELECT r.id,r.event_id,u.full_name_ar AS name,u.major_name AS major,u.academic_level AS level,e.title,r.registered_at AS created_at,
   r.review_status_code,r.review_note,r.status_code,u.is_test_account AS "isTest",r.attendance,
   e.status_code='Published' AND access.review AS "canReview",e.status_code='Published' AND access.manage AS "canRemove",
   access.attend AS "canAttend",(e.status_code='Published' AND statement_timestamp()>=e.ends_at) IS TRUE AS "attendanceOpen"
  FROM lub.event_registrations r JOIN lub.organization_content e ON e.id=r.event_id JOIN lub.users u ON u.id=r.user_id CROSS JOIN access
  WHERE r.organization_id=org AND r.status_code='Registered' AND e.deleted_at IS NULL AND lub.is_student_account(u.id)
   AND (access.review OR access.attend OR access.manage) AND (event_filter IS NULL OR r.event_id=event_filter)
   AND (registration IS NULL OR r.id=registration) AND position(lub.arabic_search_key(query) IN lub.arabic_search_key(u.full_name_ar))>0
 ), selected AS (
  SELECT * FROM matches WHERE filter='' OR review_status_code=filter ORDER BY created_at DESC,id
  LIMIT CASE WHEN page IS NULL THEN 51 ELSE 26 END OFFSET greatest(page,0)::bigint*25
 )
 SELECT jsonb_build_object('items',coalesce((SELECT jsonb_agg(to_jsonb(s)||jsonb_build_object(
   'answers',CASE WHEN details THEN r.answers END,'definition',CASE WHEN details THEN r.form_snapshot->'definition' END,
   'history',CASE WHEN details THEN coalesce((SELECT jsonb_agg(jsonb_build_object('status_code',h.to_status_code,'reason',h.reason,'created_at',h.occurred_at)
      ORDER BY h.occurred_at DESC,h.id) FROM lub.history_events h WHERE h.event_registration_id=s.id),'[]') ELSE '[]' END)
   ORDER BY s.created_at DESC,s.id) FROM selected s JOIN lub.event_registrations r ON r.id=s.id),'[]'),
  'pending',count(*) FILTER(WHERE NOT "isTest" AND review_status_code='Pending'),
  'accepted',count(*) FILTER(WHERE NOT "isTest" AND review_status_code='Accepted'),
  'rejected',count(*) FILTER(WHERE NOT "isTest" AND review_status_code='Rejected'),
  'canExport',lub.has_org_permission(org,'REPORTS_GENERATE') AND lub.has_event_access(org),
  'options',coalesce((SELECT jsonb_agg(e ORDER BY e.starts_at DESC NULLS LAST,e.id) FROM (
   SELECT id,title,status_code,starts_at FROM lub.organization_content
   WHERE organization_id=org AND kind='Event' AND deleted_at IS NULL AND lub.has_event_access(org)
    AND (lub.has_org_permission(org,'EVENTS_MANAGE') OR published_at IS NOT NULL)
   ORDER BY starts_at DESC NULLS LAST,id LIMIT 200
  ) e),'[]')) FROM matches;
$$;

CREATE FUNCTION lub.event_management_version(org uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT md5(concat_ws('|',o.name_ar,o.slug,o.forms::text,
  lub.has_event_access(o.id),lub.has_org_permission(o.id,'EVENTS_MANAGE'),lub.has_org_permission(o.id,'ANNOUNCEMENTS_MANAGE'),
  lub.has_org_permission(o.id,'EVENT_REGISTRATIONS_REVIEW'),lub.has_org_permission(o.id,'EVENT_ATTENDANCE_MANAGE'),lub.has_org_permission(o.id,'REPORTS_GENERATE'),
  (SELECT jsonb_agg(jsonb_build_array(e.id,e.revision,e.ends_at<=statement_timestamp()) ORDER BY e.id)::text
   FROM lub.organization_content e WHERE e.organization_id=o.id AND e.deleted_at IS NULL),
  (SELECT jsonb_agg(jsonb_build_array(r.id,r.status_code,r.review_status_code,r.attendance,r.response_revision,r.reviewed_at,
    u.full_name_ar,u.major_name,u.academic_level,u.is_test_account,u.status_code) ORDER BY r.id)::text
   FROM lub.event_registrations r JOIN lub.users u ON u.id=r.user_id WHERE r.organization_id=o.id AND lub.has_event_access(o.id))))
 FROM lub.organizations o WHERE o.id=org AND (lub.has_event_access(o.id) OR lub.has_org_permission(o.id,'ANNOUNCEMENTS_MANAGE'));
$$;
REVOKE ALL ON FUNCTION lub.event_registrant_page(uuid,uuid,text,text,int,boolean,uuid),lub.event_management_version(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION lub.event_registrant_page(uuid,uuid,text,text,int,boolean,uuid),lub.event_management_version(uuid) TO authenticated;
