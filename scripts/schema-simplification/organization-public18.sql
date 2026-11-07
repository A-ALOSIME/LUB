-- Public organization responses intentionally omit form definitions, account identifiers and private relations.
CREATE FUNCTION lub.public_organization_card(o lub.organizations) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT jsonb_build_object('id',o.id,'slug',o.slug,'nameAr',o.name_ar,'nameEn',o.name_en,'typeCode',o.type_code,
  'summary',o.summary,'logoUrl',o.logo_url,'statusCode',o.status_code,'archivedAt',o.archived_at,
  'tags',coalesce((SELECT jsonb_agg(tag ORDER BY tag) FROM (
   SELECT DISTINCT trim(value #>> '{}') AS tag FROM jsonb_array_elements(o.interests)
   WHERE jsonb_typeof(value)='string' AND length(trim(value #>> '{}')) BETWEEN 1 AND 40
  ) interests),'[]'));
$$;

CREATE FUNCTION lub.organization_public_rounds(org uuid) RETURNS SETOF lub.membership_campaigns
LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT c.* FROM lub.membership_campaigns c JOIN lub.organizations o ON o.id=c.organization_id
 WHERE c.organization_id=org AND o.status_code='Active' AND c.kind='Registration' AND c.status_code IN ('Open','Closed')
  AND EXISTS(SELECT 1 FROM jsonb_array_elements(o.forms) f WHERE f->>'id'=c.form_id::text AND f->'version'->>'status_code'='Published');
$$;

CREATE FUNCTION lub.public_organization_directory(query text,kind text,interest text,include_inactive boolean,only_open boolean,upcoming boolean,page integer) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(lub.public_organization_card(o) ORDER BY o.type_code DESC,o.name_ar,o.id),'[]')
 FROM (
  SELECT o.* FROM lub.organizations o
  WHERE (include_inactive OR o.status_code='Active') AND (kind='' OR o.type_code=kind)
   AND (strpos(lower(o.name_ar),lower(left(query,80)))>0 OR strpos(lower(coalesce(o.name_en,'')),lower(left(query,80)))>0)
   AND (interest='' OR EXISTS(SELECT 1 FROM jsonb_array_elements(o.interests) t WHERE jsonb_typeof(t)='string'
    AND lower(trim(t #>> '{}'))=lower(left(interest,40))))
   AND (NOT only_open OR EXISTS(SELECT 1 FROM lub.organization_public_rounds(o.id) c WHERE lub.round_is_open(c.id)))
   AND (NOT upcoming OR EXISTS(SELECT 1 FROM lub.organization_content e WHERE e.organization_id=o.id AND e.kind='Event'
    AND e.status_code='Published' AND e.ends_at>=statement_timestamp() AND lub.content_is_public(e.id)))
  ORDER BY o.type_code DESC,o.name_ar,o.id LIMIT 25 OFFSET ((least(greatest(page,1),10000)-1)*24)
 ) o;
$$;

CREATE FUNCTION lub.public_organization_detail(target_slug text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH organization AS MATERIALIZED (
  SELECT * FROM lub.organizations WHERE slug=target_slug
 ), current_roles AS MATERIALIZED (
  SELECT a.id,a.committee_id,a.role_code,a.start_at,u.full_name_ar,u.full_name_en
  FROM organization o JOIN lub.access_assignments a ON a.organization_id=o.id
  JOIN lub.organization_memberships m ON m.id=a.organization_membership_id
  JOIN lub.users u ON u.id=a.user_id
  WHERE o.show_leadership_publicly AND a.role_code IN ('OL','OD','CL') AND lub.is_student_account(u.id)
   AND a.start_at<=statement_timestamp() AND (a.end_at IS NULL OR a.end_at>statement_timestamp())
   AND m.status_code='Active' AND m.start_date<=lub.today_riyadh() AND (m.end_date IS NULL OR m.end_date>lub.today_riyadh())
 )
 SELECT jsonb_build_object(
  'organization',lub.public_organization_card(o)||jsonb_build_object('summaryEn',o.summary_en,'mission',o.mission,'missionEn',o.mission_en,
   'publicProfileContent',(SELECT jsonb_object_agg(key,value) FROM jsonb_each(CASE WHEN jsonb_typeof(o.public_profile_content)='object' THEN o.public_profile_content ELSE '{}' END)
    WHERE key IN ('vision','values','annualEventCount','participatingStudentCount','offerings','goals','fields','programs','achievements','partners','partnersImageUrl') AND jsonb_typeof(value)='string'),'linksCustomized',o.links_customized,'memberCount',
   (SELECT count(*)::int FROM lub.organization_memberships m WHERE m.organization_id=o.id AND o.status_code='Active'
     AND m.status_code='Active' AND m.start_date<=lub.today_riyadh() AND (m.end_date IS NULL OR m.end_date>lub.today_riyadh())
     AND lub.is_student_account(m.user_id))),
  'committees',coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'nameEn',c.name_en,'description',c.description,
    'descriptionEn',c.description_en,'parentCommitteeId',p.id,'leaderName',r.full_name_ar,'leaderNameEn',r.full_name_en) ORDER BY c.name,c.id)
    FROM lub.committees c LEFT JOIN lub.committees p ON p.id=c.parent_committee_id AND p.is_public AND p.status_code='Active'
    LEFT JOIN LATERAL (SELECT full_name_ar,full_name_en FROM current_roles WHERE role_code='CL' AND committee_id=c.id
      ORDER BY start_at DESC,id DESC LIMIT 1) r ON true
    WHERE c.organization_id=o.id AND o.status_code='Active' AND c.is_public AND c.status_code='Active'),'[]'),
  'contacts',coalesce((SELECT jsonb_agg(jsonb_build_object('id',link->>'id','kind',link->>'kind','value',link->>'value') ORDER BY ordinal)
    FROM jsonb_array_elements(o.links) WITH ORDINALITY AS links(link,ordinal) WHERE ordinal<=20),'[]'),
  'leadership',coalesce((SELECT jsonb_agg(jsonb_build_object('fullName',r.full_name_ar,'fullNameEn',r.full_name_en,'roleCode',r.role_code)
    ORDER BY r.role_code DESC,r.full_name_ar,r.id) FROM current_roles r WHERE r.role_code IN ('OL','OD')),'[]'),
  'rounds',coalesce((SELECT jsonb_agg(r.item) FROM (
   SELECT jsonb_build_object('id',c.id,'title',c.title,'title_en',c.title_en,'status_code',c.status_code,'minimum_approved_hours',c.minimum_hours,
    'allowed_majors',c.allowed_majors,'opens_at',c.opens_at,'closes_at',c.closes_at,'open',lub.round_is_open(c.id)) AS item
   FROM lub.organization_public_rounds(o.id) c
   ORDER BY CASE WHEN lub.round_is_open(c.id) THEN 0 WHEN c.status_code='Open' AND c.opens_at>statement_timestamp() THEN 1 ELSE 2 END,
    CASE WHEN c.opens_at>statement_timestamp() THEN c.opens_at END,c.closes_at DESC,c.id LIMIT 1
  ) r),'[]'),
  'upcomingEvents',coalesce((SELECT jsonb_agg(e ORDER BY e.featured DESC,e.starts_at DESC NULLS LAST,e.id) FROM (
   SELECT e.id,e.title,e.title_en,e.starts_at,e.ends_at,e.status_code,e.source_date_text,e.is_featured AS featured,
    EXISTS(SELECT 1 FROM lub.public_event_poster(e.id)) AS has_poster,lub.public_event_poster_dimensions(e.id) AS poster_dimensions
   FROM lub.organization_content e WHERE e.organization_id=o.id AND e.kind='Event' AND lub.content_is_public(e.id)
    AND e.status_code IN ('Published','Completed','Archived') ORDER BY e.is_featured DESC,e.starts_at DESC NULLS LAST,e.id LIMIT 200
  ) e),'[]'),
  'announcements',coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.id,'title',a.title,'title_en',a.title_en,'body',a.body,
    'body_en',a.body_en,'pinned',a.pinned_at IS NOT NULL,'published_at',a.published_at,'external_url',a.external_url,'has_image',a.primary_image_id IS NOT NULL)
    ORDER BY a.pinned_at DESC NULLS LAST,a.published_at DESC,a.id)
    FROM (SELECT * FROM lub.organization_content c WHERE c.organization_id=o.id AND c.kind='Announcement'
     AND lub.content_is_public(c.id) ORDER BY c.pinned_at DESC NULLS LAST,c.published_at DESC,c.id LIMIT 50) a),'[]')
 )
 FROM organization o;
$$;

REVOKE ALL ON FUNCTION lub.public_organization_card(lub.organizations),lub.organization_public_rounds(uuid),
 lub.public_organization_directory(text,text,text,boolean,boolean,boolean,integer),lub.public_organization_detail(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION lub.public_organization_directory(text,text,text,boolean,boolean,boolean,integer),lub.public_organization_detail(text) TO anon,authenticated;
