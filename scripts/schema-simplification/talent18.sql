-- Public profiles are keyed by their separate public slug. Owner identifiers never enter the public DTO.
CREATE FUNCTION lub.public_talent_eligible(target uuid) RETURNS boolean
LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT lub.is_student_account(target) AND EXISTS(SELECT 1 FROM lub.users u WHERE u.id=target AND u.public_profile_enabled AND NOT u.is_test_account);
$$;
CREATE FUNCTION lub.public_avatar_version(target uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT o.updated_at::text FROM storage.objects o WHERE o.bucket_id='lub-avatars' AND o.name=target::text||'/avatar.webp'
 AND lub.public_talent_eligible(target) LIMIT 1;
$$;
CREATE FUNCTION lub.public_talent_avatar(target uuid) RETURNS TABLE(object_key text,version text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT u.id::text||'/avatar.webp',lub.public_avatar_version(u.id)
 FROM lub.users u WHERE u.public_slug=target AND lub.public_avatar_version(u.id) IS NOT NULL;
$$;
DROP POLICY IF EXISTS published_account_avatar_select ON storage.objects;
CREATE POLICY published_account_avatar_select ON storage.objects FOR SELECT TO anon,authenticated USING(
 bucket_id='lub-avatars' AND storage.allow_any_operation(ARRAY['object.get_authenticated','object.get_authenticated_info'])
 AND CASE WHEN name~'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/avatar[.]webp$'
  THEN lub.public_avatar_version(left(name,36)::uuid) IS NOT NULL ELSE false END
);

CREATE FUNCTION lub.talent_skill_labels(owner_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(s.name_ar ORDER BY s.name_ar,s.id),'[]') FROM lub.users u
 CROSS JOIN LATERAL jsonb_array_elements(u.skills) item JOIN lub.skills s ON s.id=(item->>'id')::uuid
 WHERE u.id=owner_id AND s.is_active;
$$;

CREATE FUNCTION lub.talent_visible_events(owner_id uuid) RETURNS SETOF lub.organization_content
LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT e.* FROM lub.event_registrations r JOIN lub.organization_content e ON e.id=r.event_id JOIN lub.organizations o ON o.id=e.organization_id
 WHERE r.user_id=owner_id AND r.status_code='Registered' AND r.review_status_code='Accepted' AND r.attendance='Present'
 AND NOT o.is_test AND e.deleted_at IS NULL AND (e.status_code='Completed' OR (e.status_code='Archived' AND e.archived_from_status='Completed'))
 AND coalesce(e.published_at,e.archived_from_published_at) IS NOT NULL;
$$;

CREATE FUNCTION lub.public_talent(target uuid,org_skip int,event_skip int,project_skip int) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH person AS MATERIALIZED (SELECT u.* FROM lub.users u WHERE u.public_slug=target AND lub.public_talent_eligible(u.id)),
 organization_list AS MATERIALIZED (
  SELECT o.id,o.slug,o.name_ar,o.name_en,o.logo_url,o.type_code,o.status_code FROM lub.organizations o CROSS JOIN person u
  WHERE NOT o.is_test AND EXISTS(SELECT 1 FROM lub.organization_memberships m WHERE m.organization_id=o.id AND m.user_id=u.id)
 ), event_list AS MATERIALIZED (SELECT e.* FROM person u CROSS JOIN LATERAL lub.talent_visible_events(u.id) e)
 SELECT jsonb_build_object('id',u.public_slug,'name',u.full_name_ar,'nameEn',u.full_name_en,'major',u.major_name,'level',u.academic_level,
  'bio',nullif(trim(u.bio),''),'bioEn',nullif(trim(u.bio_en),''),'indexable',u.allow_indexing,'avatar_version',lub.public_avatar_version(u.id),
  'total',(SELECT coalesce(sum((h->>'hours')::numeric),0)::text FROM lub.organization_memberships m JOIN organization_list o ON o.id=m.organization_id
   CROSS JOIN LATERAL jsonb_array_elements(m.hours) h WHERE m.user_id=u.id AND h->>'status_code'='Approved'),
  'skills',lub.talent_skill_labels(u.id),
  'links',coalesce((SELECT jsonb_agg(jsonb_build_object('kind',l->>'type','label',l->>'label','value',l->>'value') ORDER BY ordinal)
    FROM jsonb_array_elements(u.links) WITH ORDINALITY AS links(l,ordinal)),'[]'),
  'stats',jsonb_build_object('organizations',(SELECT count(*) FROM organization_list),'events',(SELECT count(*) FROM event_list)),
  'organizations',coalesce((SELECT jsonb_agg(jsonb_build_object('id',o.slug,'slug',o.slug,'name',o.name_ar,'nameEn',o.name_en,'logo',o.logo_url,
    'type',o.type_code,'archived',o.status_code='Archived','hours',lub.member_approved_hours(o.id,u.id,NULL)::text,'memberships',
    coalesce((SELECT jsonb_agg(jsonb_build_object('start_date',m.start_date,'end_date',m.end_date,'status_code',m.status_code,
      'hours',(SELECT coalesce(sum((h->>'hours')::numeric),0)::text FROM jsonb_array_elements(m.hours) h WHERE h->>'status_code'='Approved'),
      'roles',coalesce((SELECT jsonb_agg(jsonb_build_object('code',a.role_code,'starts',d.starts,'ends',d.ends,'hours',
       (SELECT coalesce(sum((h->>'hours')::numeric),0)::text FROM jsonb_array_elements(m.hours) h WHERE h->>'status_code'='Approved'
        AND (h->>'activity_date')::date>=d.starts AND (d.ends IS NULL OR (h->>'activity_date')::date<d.ends)
        AND (a.committee_id IS NULL OR h->>'committee_id'=a.committee_id::text))) ORDER BY a.start_at,a.id)
       FROM lub.access_assignments a CROSS JOIN LATERAL (SELECT (a.start_at AT TIME ZONE 'Asia/Riyadh')::date starts,
        (a.end_at AT TIME ZONE 'Asia/Riyadh')::date ends) d WHERE a.organization_membership_id=m.id),'[]'))
       ORDER BY m.start_date,m.id) FROM lub.organization_memberships m WHERE m.user_id=u.id AND m.organization_id=o.id),'[]'))
       ORDER BY o.name_ar,o.id)
   FROM (SELECT * FROM organization_list ORDER BY name_ar,id LIMIT 26 OFFSET greatest(0,least(org_skip,250000))) o),'[]'),
  'events',coalesce((SELECT jsonb_agg(jsonb_build_object('href','/events/'||e.id,'title',e.title,'titleEn',e.title_en,'starts_at',e.starts_at,
   'organization',o.name_ar,'organizationEn',o.name_en,'archived',e.status_code='Archived','attendance','Present','contributions','[]'::jsonb)
   ORDER BY e.starts_at DESC NULLS LAST,e.id)
   FROM (SELECT * FROM event_list ORDER BY starts_at DESC NULLS LAST,id LIMIT 26 OFFSET greatest(0,least(event_skip,250000))) e
   JOIN lub.organizations o ON o.id=e.organization_id),'[]'),
  'projects',coalesce((SELECT jsonb_agg(jsonb_build_object('id',md5(p.id::text),'title',p.display_title,'description',p.display_description,'featured',p.is_featured_work)
   ORDER BY p.is_featured_work DESC,p.portfolio_updated_at DESC NULLS LAST,p.id)
   FROM (SELECT tp.* FROM lub.task_participants tp JOIN lub.organizations o ON o.id=tp.organization_id
    WHERE tp.user_id=u.id AND tp.status_code='Approved' AND tp.show_in_portfolio AND NOT o.is_test
    ORDER BY tp.is_featured_work DESC,tp.portfolio_updated_at DESC NULLS LAST,tp.id LIMIT 26 OFFSET greatest(0,least(project_skip,250000))) p),'[]'))
 FROM person u;
$$;

CREATE FUNCTION lub.talent_workspace(project_skip int,source_skip int) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('status',u.status_code,'onboarded',u.onboarded_at IS NOT NULL,'bio',u.bio,'bioEn',u.bio_en,'nameEn',u.full_name_en,
  'settings',jsonb_build_object('public_profile_enabled',u.public_profile_enabled,'public_slug',u.public_slug,'allow_indexing',u.allow_indexing),
  'links',coalesce((SELECT jsonb_agg(jsonb_build_object('id',l->>'id','link_type',l->>'type','label',l->>'label','url_or_value',l->>'value','is_public',true)
    ORDER BY ordinal) FROM jsonb_array_elements(u.links) WITH ORDINALITY AS links(l,ordinal)),'[]'),
  'skills',coalesce((SELECT jsonb_agg(jsonb_build_object('name',v,'public',true)) FROM jsonb_array_elements_text(lub.talent_skill_labels(u.id)) v),'[]'),
  'projects',coalesce((SELECT jsonb_agg(p) FROM (
   SELECT p.id,p.id AS task_participant_id,NULL::uuid AS event_contribution_id,p.display_title,p.display_description,p.is_featured_work AS is_featured
   FROM lub.task_participants p WHERE p.user_id=u.id AND p.show_in_portfolio AND p.status_code='Approved'
   ORDER BY p.portfolio_updated_at DESC NULLS LAST,p.id LIMIT 26 OFFSET greatest(0,least(project_skip,250000))) p),'[]'),
  'sources',coalesce((SELECT jsonb_agg(p) FROM (
   SELECT p.id,'Task'::text AS kind,t.title FROM lub.task_participants p JOIN lub.tasks t ON t.id=p.task_id
   JOIN lub.organizations o ON o.id=p.organization_id WHERE p.user_id=u.id AND NOT p.show_in_portfolio AND p.status_code='Approved' AND NOT o.is_test
   ORDER BY p.joined_at DESC,p.id LIMIT 26 OFFSET greatest(0,least(source_skip,250000))) p),'[]'))
 FROM lub.users u WHERE u.id=auth.uid() AND NOT lub.is_super_admin();
$$;

CREATE FUNCTION lub.search_talent(filters jsonb) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE query text:=lub.arabic_search_key(left(filters->>'q',120));
 min_hours numeric:=CASE WHEN filters->>'minHours'~'^[0-9]{1,6}$' THEN least((filters->>'minHours')::numeric,100000) ELSE 0 END;
 skip integer:=CASE WHEN filters->>'page'~'^[0-9]{1,5}$' THEN least((filters->>'page')::integer,10000)*24 ELSE 0 END;
BEGIN
 IF jsonb_typeof(filters) IS DISTINCT FROM 'object' OR length(filters::text)>4096 THEN RAISE EXCEPTION 'Invalid talent filters'; END IF;
 RETURN (WITH selected_skills AS MATERIALIZED (
  SELECT DISTINCT lub.skill_key(value) AS key FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(filters->'skills')='array' THEN filters->'skills' ELSE '[]' END) LIMIT 20
 ), people AS MATERIALIZED (
  SELECT u.public_slug AS id,u.full_name_ar AS name,u.full_name_en AS "nameEn",u.major_name AS major,u.academic_level AS level,
    nullif(trim(u.bio),'') AS bio,nullif(trim(u.bio_en),'') AS "bioEn",lub.public_avatar_version(u.id) AS avatar_version,
    (SELECT coalesce(sum((h->>'hours')::numeric),0) FROM lub.organization_memberships m JOIN lub.organizations o ON o.id=m.organization_id
      CROSS JOIN LATERAL jsonb_array_elements(m.hours) h WHERE m.user_id=u.id AND NOT o.is_test AND h->>'status_code'='Approved') AS hours,
    coalesce(skills.labels,'[]') AS skills,skills.keys,
    coalesce(orgs.items,'[]') AS organizations,lub.arabic_search_key(concat_ws(' ',u.full_name_ar,u.full_name_en,u.major_name,skills.searchable,orgs.searchable)) AS searchable
  FROM lub.users u
  LEFT JOIN LATERAL (
   SELECT jsonb_agg(s.name_ar ORDER BY s.name_ar,s.id) labels,
    array_agg(s.canonical_key) keys,
    string_agg(concat_ws(' ',s.name_ar,s.name_en,s.canonical_key,s.aliases::text),' ') searchable
   FROM jsonb_array_elements(u.skills) item JOIN lub.skills s ON s.id=(item->>'id')::uuid WHERE s.is_active
  ) skills ON true
  LEFT JOIN LATERAL (
   SELECT jsonb_agg(jsonb_build_object('name',o.name_ar,'nameEn',o.name_en,'slug',o.slug,'logo',o.logo_url) ORDER BY o.name_ar,o.id) items,
    string_agg(concat_ws(' ',o.name_ar,o.name_en),' ') searchable
   FROM lub.organizations o WHERE NOT o.is_test AND EXISTS(
    SELECT 1 FROM lub.organization_memberships m WHERE m.organization_id=o.id AND m.user_id=u.id)
  ) orgs ON true
  WHERE lub.public_talent_eligible(u.id)
 ), filtered AS MATERIALIZED (
  SELECT p.* FROM people p WHERE (query='' OR strpos(p.searchable,query)>0 OR lub.skill_key(query)=ANY(p.keys))
   AND p.hours>=min_hours AND (nullif(filters->>'major','') IS NULL OR lub.arabic_search_key(p.major)=lub.arabic_search_key(filters->>'major'))
   AND (nullif(filters->>'level','') IS NULL OR p.level=filters->>'level')
   AND NOT EXISTS(SELECT 1 FROM selected_skills s WHERE NOT coalesce(s.key=ANY(p.keys),false))
 ), page AS (
  SELECT p.*,row_number() OVER (ORDER BY CASE WHEN filters->>'sort'='hours' THEN p.hours END DESC,
   CASE WHEN coalesce(filters->>'sort','relevance')='relevance' THEN (lub.arabic_search_key(p.name)=query OR lub.arabic_search_key(p."nameEn")=query)::int END DESC,p.name,p.id) pos
  FROM filtered p ORDER BY pos LIMIT 24 OFFSET skip
 )
 SELECT jsonb_build_object('items',coalesce((SELECT jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'nameEn',p."nameEn",'major',p.major,
  'level',p.level,'bio',p.bio,'bioEn',p."bioEn",'avatar_version',p.avatar_version,'total',p.hours::text,'skills',p.skills,'organizations',p.organizations)
  ORDER BY p.pos) FROM page p),'[]'),'total',(SELECT count(*) FROM filtered),'available',(SELECT count(*) FROM people),
  'options',jsonb_build_object('skills',coalesce((SELECT jsonb_agg(v ORDER BY v) FROM(SELECT DISTINCT jsonb_array_elements_text(p.skills) AS v FROM people p) s),'[]'),
    'majors',coalesce((SELECT jsonb_agg(v ORDER BY v) FROM(SELECT DISTINCT major AS v FROM people) m),'[]'))));
END; $$;

CREATE FUNCTION lub.talent_directory(query text,skill text,skip int) RETURNS TABLE(id uuid,name text,major text,bio text,skills jsonb,level text,total text,avatar_version text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT (x->>'id')::uuid,x->>'name',x->>'major',x->>'bio',x->'skills',x->>'level',x->>'total',x->>'avatar_version'
 FROM jsonb_array_elements(lub.search_talent(jsonb_build_object('q',query,'skills',CASE WHEN nullif(trim(skill),'') IS NULL THEN '[]'::jsonb
  ELSE jsonb_build_array(skill) END,'page',greatest(0,skip)/24))->'items') x;
$$;
CREATE FUNCTION lub.talent_skill_options() RETURNS TABLE(name text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT v FROM jsonb_array_elements_text(lub.search_talent('{}')->'options'->'skills') v;
$$;
CREATE FUNCTION lub.save_talent_bio(bio text,english_bio text DEFAULT NULL,english_name text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT lub.is_student_account(auth.uid()) THEN RAISE EXCEPTION 'Student account required' USING ERRCODE='42501'; END IF;
 UPDATE lub.users u SET bio=trim(save_talent_bio.bio),bio_en=coalesce(trim(english_bio),u.bio_en),
 full_name_en=CASE WHEN english_name IS NULL THEN u.full_name_en ELSE nullif(trim(english_name),'') END,updated_at=now() WHERE u.id=auth.uid();
END; $$;
CREATE FUNCTION lub.save_talent_settings(bio text,enabled boolean,indexable boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM lub.save_talent_bio(bio);
 PERFORM lub.save_talent_privacy(enabled,indexable);
END; $$;

CREATE FUNCTION lub.save_talent_link(target uuid,kind text,label text,value text,visible boolean) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE current_links jsonb; new_id uuid:=coalesce(target,gen_random_uuid()); item jsonb;
BEGIN
 IF NOT lub.is_student_account(auth.uid()) THEN RAISE EXCEPTION 'Student account required' USING ERRCODE='42501'; END IF;
 SELECT u.links INTO current_links FROM lub.users u WHERE u.id=auth.uid() FOR UPDATE;
 IF visible IS DISTINCT FROM true OR label IS NULL OR length(trim(label)) NOT BETWEEN 1 AND 80
  OR value IS NULL OR length(trim(value)) NOT BETWEEN 1 AND 2048 OR trim(value)~'[[:space:][:cntrl:]]'
  OR NOT coalesce(CASE kind WHEN 'Email' THEN trim(value)~'^[^@]+@[^@]+[.][^@]+$'
   WHEN 'Phone' THEN trim(value)~'^[+]?[0-9]{7,15}$'
   ELSE kind IN ('Website','LinkedIn','GitHub','X','TikTok','Instagram','Behance')
    AND trim(value)~'^https://[^/@?#]+([/?#]|$)' END,false) THEN RAISE EXCEPTION 'Invalid public contact'; END IF;
 item:=jsonb_build_object('id',new_id,'type',kind,'label',trim(label),'value',trim(value));
 IF target IS NULL THEN
  IF jsonb_array_length(current_links)>=10 THEN RAISE EXCEPTION 'Profile link limit'; END IF;
  current_links:=current_links||jsonb_build_array(item);
 ELSE
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(current_links) l WHERE l->>'id'=target::text)
  THEN RAISE EXCEPTION 'Owned link required' USING ERRCODE='42501'; END IF;
  current_links:=(SELECT jsonb_agg(CASE WHEN l->>'id'=target::text THEN item ELSE l END ORDER BY ordinal)
   FROM jsonb_array_elements(current_links) WITH ORDINALITY AS entries(l,ordinal));
 END IF;
 UPDATE lub.users SET links=current_links,updated_at=now() WHERE id=auth.uid();
 RETURN new_id;
END; $$;
CREATE FUNCTION lub.remove_talent_link(target uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT lub.is_student_account(auth.uid()) THEN RAISE EXCEPTION 'Student account required' USING ERRCODE='42501'; END IF;
 UPDATE lub.users u SET links=coalesce((SELECT jsonb_agg(l ORDER BY ordinal) FROM jsonb_array_elements(u.links) WITH ORDINALITY AS entries(l,ordinal)
  WHERE l->>'id'<>target::text),'[]'),updated_at=now()
 WHERE u.id=auth.uid() AND target IS NOT NULL AND EXISTS(SELECT 1 FROM jsonb_array_elements(u.links) l WHERE l->>'id'=target::text);
 IF NOT FOUND THEN RAISE EXCEPTION 'Owned link required' USING ERRCODE='42501'; END IF;
END; $$;

CREATE FUNCTION lub.save_talent_project(target uuid,participant uuid,contribution uuid,title text,description text,featured boolean) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE saved uuid;
BEGIN
 IF NOT lub.is_student_account(auth.uid()) OR participant IS NULL OR contribution IS NOT NULL OR (target IS NOT NULL AND target<>participant)
 THEN RAISE EXCEPTION 'Owned verified activity required' USING ERRCODE='42501'; END IF;
 IF title IS NULL OR length(trim(title)) NOT BETWEEN 2 AND 120 OR description IS NULL OR length(trim(description))>1000 OR featured IS NULL
 THEN RAISE EXCEPTION 'Invalid portfolio project'; END IF;
 UPDATE lub.task_participants p SET display_title=trim(title),display_description=trim(description),is_featured_work=featured,
  show_in_portfolio=true,portfolio_updated_at=now()
 WHERE p.id=participant AND p.user_id=auth.uid() AND p.status_code='Approved'
 AND EXISTS(SELECT 1 FROM lub.organizations o WHERE o.id=p.organization_id AND NOT o.is_test)
 RETURNING id INTO saved;
 IF saved IS NULL THEN RAISE EXCEPTION 'Owned verified activity required' USING ERRCODE='42501'; END IF;
 RETURN saved;
END; $$;

REVOKE ALL ON FUNCTION lub.public_talent_eligible(uuid),lub.public_avatar_version(uuid),lub.public_talent_avatar(uuid),
 lub.talent_skill_labels(uuid),lub.talent_visible_events(uuid),lub.public_talent(uuid,int,int,int),lub.talent_workspace(int,int),
 lub.search_talent(jsonb),lub.talent_directory(text,text,int),lub.talent_skill_options(),lub.save_talent_bio(text,text,text),
 lub.save_talent_settings(text,boolean,boolean),lub.save_talent_link(uuid,text,text,text,boolean),lub.remove_talent_link(uuid),
 lub.save_talent_project(uuid,uuid,uuid,text,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION lub.public_talent_avatar(uuid) TO lub_runtime;
GRANT EXECUTE ON FUNCTION lub.public_avatar_version(uuid),lub.public_talent(uuid,int,int,int),
 lub.search_talent(jsonb),lub.talent_directory(text,text,int),lub.talent_skill_options() TO anon,authenticated;
GRANT EXECUTE ON FUNCTION lub.talent_workspace(int,int),lub.save_talent_bio(text,text,text),lub.save_talent_settings(text,boolean,boolean),
 lub.save_talent_link(uuid,text,text,text,boolean),lub.remove_talent_link(uuid),lub.save_talent_project(uuid,uuid,uuid,text,text,boolean) TO authenticated;
