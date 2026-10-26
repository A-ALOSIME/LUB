ALTER TABLE lub.users ADD COLUMN is_test_account boolean NOT NULL DEFAULT false;
ALTER TABLE lub.profile_settings ADD COLUMN public_slug uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE, ADD COLUMN allow_indexing boolean NOT NULL DEFAULT false;
ALTER TABLE lub.skills ADD COLUMN name_en varchar(80), ADD COLUMN aliases jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(aliases)='array' AND jsonb_array_length(aliases)<=30);
--> statement-breakpoint
CREATE FUNCTION lub.arabic_search_key(value text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT translate(regexp_replace(lower(coalesce(value,'')),'[ـًٌٍَُِّْٰٕٔ]','','g'),'أإآٱىة','اااايه');
$$;
CREATE OR REPLACE FUNCTION lub.skill_key(value text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT CASE lub.arabic_search_key(trim(value)) WHEN 'بايثون' THEN 'python' WHEN 'اس كيو ال' THEN 'sql' WHEN 'جافاسكريبت' THEN 'javascript' WHEN 'جافا سكريبت' THEN 'javascript' WHEN 'تايب سكريبت' THEN 'typescript' WHEN 'رياكت' THEN 'react' WHEN 'فيجما' THEN 'figma' ELSE lub.arabic_search_key(trim(value)) END;
$$;
CREATE FUNCTION lub.public_talent_eligible(target uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM lub.users u JOIN lub.student_profiles p ON p.user_id=u.id JOIN lub.profile_settings s ON s.user_id=u.id WHERE u.id=target AND u.status_code='Active' AND NOT u.is_test_account AND s.public_profile_enabled AND NOT EXISTS(SELECT 1 FROM lub.global_role_assignments r WHERE r.user_id=u.id AND r.role_code='SA' AND r.start_at<=now() AND (r.end_at IS NULL OR r.end_at>now())));
$$;
CREATE OR REPLACE FUNCTION lub.public_avatar_version(target uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT o.updated_at::text FROM storage.objects o WHERE o.bucket_id='lub-avatars' AND o.name=target::text||'/avatar.webp' AND lub.public_talent_eligible(target) LIMIT 1;
$$;
--> statement-breakpoint
-- Legacy UUID projection becomes private implementation data, never a public response.
ALTER FUNCTION lub.public_talent(uuid,int,int,int) RENAME TO talent_profile_source;
REVOKE ALL ON FUNCTION lub.talent_profile_source(uuid,int,int,int) FROM PUBLIC,anon,authenticated;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='lub_runtime') THEN EXECUTE 'REVOKE ALL ON FUNCTION lub.talent_profile_source(uuid,int,int,int) FROM lub_runtime';END IF;END $$;
CREATE FUNCTION lub.public_talent(target uuid,org_skip int DEFAULT 0,event_skip int DEFAULT 0,project_skip int DEFAULT 0) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH person AS (SELECT p.user_id,s.public_slug,s.allow_indexing FROM lub.student_profiles p JOIN lub.profile_settings s ON s.user_id=p.user_id WHERE s.public_slug=target AND lub.public_talent_eligible(p.user_id)), source AS (SELECT person.*,lub.talent_profile_source(person.user_id,org_skip,event_skip,project_skip) AS data FROM person)
 SELECT jsonb_build_object('id',public_slug,'name',data->'name','major',data->'major','level',data->'level','bio',data->'bio','total',data->'total','avatar_version',data->'avatar_version','indexable',allow_indexing,
 'skills',coalesce((SELECT jsonb_agg(label ORDER BY key) FROM(SELECT DISTINCT ON(lub.skill_key(x)) x AS label,lub.skill_key(x) AS key FROM jsonb_array_elements_text(data->'skills') x ORDER BY lub.skill_key(x),x) names),'[]'),
 'links',coalesce((SELECT jsonb_agg(x) FROM jsonb_array_elements(data->'links') x WHERE x->>'kind'<>'Phone'),'[]'),
 'organizations',coalesce((SELECT jsonb_agg((x-'id')||jsonb_build_object('id',x->'slug','logo',o.logo_url,'type',o.type_code,'memberships',coalesce((SELECT jsonb_agg(m||jsonb_build_object('hours',(SELECT coalesce(sum(h.hours),0)::text FROM lub.hour_records h JOIN lub.organization_memberships om ON om.id=h.organization_membership_id WHERE om.user_id=source.user_id AND om.organization_id=o.id AND h.status_code='Approved' AND h.activity_date>=(m->>'start_date')::date AND (m->>'end_date' IS NULL OR h.activity_date<(m->>'end_date')::date)),'roles',coalesce((SELECT jsonb_agg(r||jsonb_build_object('hours',(SELECT coalesce(sum(h.hours),0)::text FROM lub.hour_records h JOIN lub.organization_memberships om ON om.id=h.organization_membership_id WHERE om.user_id=source.user_id AND om.organization_id=o.id AND h.status_code='Approved' AND h.activity_date>=(r->>'starts')::date AND (r->>'ends' IS NULL OR h.activity_date<(r->>'ends')::date) AND EXISTS(SELECT 1 FROM lub.role_assignments ra WHERE ra.organization_membership_id=om.id AND ra.role_code=r->>'code' AND ra.start_date=(r->>'starts')::date AND ra.end_date IS NOT DISTINCT FROM (r->>'ends')::date AND (ra.committee_id IS NULL OR ra.committee_id=h.committee_id))))) FROM jsonb_array_elements(m->'roles') r),'[]'))) FROM jsonb_array_elements(x->'memberships') m),'[]'))) FROM jsonb_array_elements(data->'organizations') x JOIN lub.organizations o ON o.slug=x->>'slug'),'[]'),
 'events',coalesce((SELECT jsonb_agg((x-'id')||jsonb_build_object('href','/events/'||(x->>'id'))) FROM jsonb_array_elements(data->'events') x WHERE x->>'attendance'='Present' OR jsonb_array_length(x->'contributions')>0),'[]'),
 'projects',coalesce((SELECT jsonb_agg((x-'id')||jsonb_build_object('id',md5(x->>'id'))) FROM jsonb_array_elements(data->'projects') x),'[]'),
 'stats',jsonb_build_object('organizations',(SELECT count(DISTINCT m.organization_id) FROM lub.organization_memberships m WHERE m.user_id=source.user_id),'events',(SELECT count(DISTINCT e.id) FROM lub.events e LEFT JOIN lub.event_registrations er ON er.event_id=e.id AND er.user_id=source.user_id AND er.status_code='Registered' LEFT JOIN lub.event_attendance a ON a.event_registration_id=er.id WHERE e.status_code='Completed' AND e.published_at IS NOT NULL AND (a.status_code='Present' OR EXISTS(SELECT 1 FROM lub.event_contributions c WHERE c.event_id=e.id AND c.user_id=source.user_id))))) FROM source;
$$;
--> statement-breakpoint
CREATE FUNCTION lub.search_talent(filters jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE q text:=lub.arabic_search_key(left(trim(filters->>'q'),120)); min_hours numeric:=CASE WHEN filters->>'minHours'~'^[0-9]{1,6}$' THEN least((filters->>'minHours')::numeric,100000) ELSE 0 END; skip int:=CASE WHEN filters->>'page'~'^[0-9]{1,5}$' THEN least((filters->>'page')::int,10000)*24 ELSE 0 END; result jsonb;
BEGIN
 IF length(filters::text)>4096 OR jsonb_typeof(filters)<>'object' THEN RAISE EXCEPTION 'Invalid talent filters';END IF;
 WITH skills_filter AS MATERIALIZED(SELECT DISTINCT lub.skill_key(value) AS key FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(filters->'skills')='array' THEN filters->'skills' ELSE '[]' END) LIMIT 20),
 people AS MATERIALIZED(SELECT p.user_id,s.public_slug AS id,p.full_name_ar AS name,p.major_name AS major,p.academic_level AS level,nullif(trim(p.bio),'') AS bio,lub.public_avatar_version(p.user_id) AS avatar_version,
 coalesce((SELECT sum(h.hours) FROM lub.hour_records h JOIN lub.organization_memberships m ON m.id=h.organization_membership_id WHERE m.user_id=p.user_id AND h.status_code='Approved'),0) AS hours,
 coalesce((SELECT jsonb_agg(DISTINCT lub.skill_key(sk.name_ar)) FROM lub.student_skills ss JOIN lub.skills sk ON sk.id=ss.skill_id WHERE ss.user_id=p.user_id AND ss.is_public AND sk.is_active),'[]') AS skills,
 coalesce((SELECT jsonb_agg(label ORDER BY key) FROM(SELECT DISTINCT ON(lub.skill_key(sk.name_ar)) sk.name_ar AS label,lub.skill_key(sk.name_ar) AS key FROM lub.student_skills ss JOIN lub.skills sk ON sk.id=ss.skill_id WHERE ss.user_id=p.user_id AND ss.is_public AND sk.is_active ORDER BY lub.skill_key(sk.name_ar),sk.name_ar) labels),'[]') AS public_skills,
 coalesce((SELECT jsonb_agg(jsonb_build_object('name',o.name_ar,'slug',o.slug,'logo',o.logo_url) ORDER BY o.name_ar) FROM lub.organizations o WHERE EXISTS(SELECT 1 FROM lub.organization_memberships m WHERE m.organization_id=o.id AND m.user_id=p.user_id)),'[]') AS organizations,
 lub.arabic_search_key(p.full_name_ar||' '||p.major_name||' '||coalesce((SELECT string_agg(sk.name_ar||' '||coalesce(sk.name_en,'')||' '||sk.aliases::text||' '||lub.skill_key(sk.name_ar),' ') FROM lub.student_skills ss JOIN lub.skills sk ON sk.id=ss.skill_id WHERE ss.user_id=p.user_id AND ss.is_public AND sk.is_active),'')||' '||coalesce((SELECT string_agg(o.name_ar,' ') FROM lub.organizations o WHERE EXISTS(SELECT 1 FROM lub.organization_memberships m WHERE m.organization_id=o.id AND m.user_id=p.user_id)),'')) AS searchable
 FROM lub.student_profiles p JOIN lub.profile_settings s ON s.user_id=p.user_id WHERE lub.public_talent_eligible(p.user_id)),
 filtered AS MATERIALIZED(SELECT * FROM people p WHERE (coalesce(q,'')='' OR position(q IN p.searchable)>0 OR p.skills ? lub.skill_key(q)) AND hours>=min_hours AND (nullif(filters->>'major','') IS NULL OR lub.arabic_search_key(p.major)=lub.arabic_search_key(filters->>'major')) AND (nullif(filters->>'level','') IS NULL OR p.level=filters->>'level') AND NOT EXISTS(SELECT 1 FROM skills_filter f WHERE NOT p.skills ? f.key)),
 page AS(SELECT id,name,major,level,bio,avatar_version,hours::text AS total,public_skills AS skills,organizations FROM filtered ORDER BY CASE WHEN filters->>'sort'='hours' THEN hours END DESC,CASE WHEN coalesce(filters->>'sort','relevance')='relevance' THEN (lub.arabic_search_key(name)=q)::int END DESC,name,id LIMIT 24 OFFSET skip)
 SELECT jsonb_build_object('items',coalesce((SELECT jsonb_agg(page) FROM page),'[]'),'total',(SELECT count(*) FROM filtered),'available',(SELECT count(*) FROM people),'options',jsonb_build_object('skills',coalesce((SELECT jsonb_agg(v ORDER BY v) FROM(SELECT DISTINCT jsonb_array_elements_text(public_skills) AS v FROM people) s),'[]'),'majors',coalesce((SELECT jsonb_agg(v ORDER BY v) FROM(SELECT DISTINCT major AS v FROM people) m),'[]'))) INTO result;RETURN result;
END; $$;
--> statement-breakpoint
DROP FUNCTION lub.talent_directory(text,text,int);
CREATE FUNCTION lub.talent_directory(query text,skill text,skip int DEFAULT 0) RETURNS TABLE(id uuid,name text,major text,bio text,skills jsonb,level text,total text,avatar_version text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT (x->>'id')::uuid,x->>'name',x->>'major',x->>'bio',x->'skills',x->>'level',x->>'total',x->>'avatar_version' FROM jsonb_array_elements(lub.search_talent(jsonb_build_object('q',query,'skills',CASE WHEN nullif(trim(skill),'') IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(skill) END,'page',greatest(0,skip)/24))->'items') x;
$$;
CREATE OR REPLACE FUNCTION lub.talent_skill_options() RETURNS TABLE(name text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT CASE v WHEN 'python' THEN 'Python' WHEN 'sql' THEN 'SQL' ELSE v END FROM jsonb_array_elements_text(lub.search_talent('{}')->'options'->'skills') v; $$;
CREATE FUNCTION lub.public_talent_avatar(target uuid) RETURNS TABLE(object_key text,version text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT p.user_id::text||'/avatar.webp',lub.public_avatar_version(p.user_id) FROM lub.profile_settings p WHERE p.public_slug=target AND lub.public_talent_eligible(p.user_id) AND lub.public_avatar_version(p.user_id) IS NOT NULL; $$;
CREATE FUNCTION lub.save_talent_settings(bio text,enabled boolean,indexable boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN PERFORM lub.save_talent_settings(bio,enabled);UPDATE lub.profile_settings SET allow_indexing=indexable WHERE user_id=auth.uid();END; $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION lub.arabic_search_key(text),lub.public_talent_eligible(uuid),lub.public_talent(uuid,int,int,int),lub.search_talent(jsonb),lub.talent_directory(text,text,int),lub.public_talent_avatar(uuid),lub.save_talent_settings(text,boolean,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lub.arabic_search_key(text),lub.public_talent_eligible(uuid),lub.public_talent(uuid,int,int,int),lub.search_talent(jsonb),lub.talent_directory(text,text,int) TO anon,authenticated;
REVOKE ALL ON FUNCTION lub.public_talent_avatar(uuid) FROM anon,authenticated;
GRANT EXECUTE ON FUNCTION lub.save_talent_settings(text,boolean,boolean) TO authenticated;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='lub_runtime') THEN EXECUTE 'GRANT EXECUTE ON FUNCTION lub.public_talent(uuid,int,int,int),lub.search_talent(jsonb),lub.talent_directory(text,text,int),lub.public_talent_avatar(uuid) TO lub_runtime';END IF;END $$;

--> statement-breakpoint
ALTER TABLE lub.profile_links DROP CONSTRAINT talent_link_check;
ALTER TABLE lub.profile_links ADD CONSTRAINT talent_link_check CHECK(link_type IN ('Email','Phone','Website','LinkedIn','GitHub','X','TikTok','Instagram','Behance') AND length(trim(label)) BETWEEN 1 AND 80 AND length(trim(url_or_value)) BETWEEN 1 AND 2048);
CREATE OR REPLACE FUNCTION lub.save_talent_link(target uuid,kind text,label text,value text,visible boolean) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE owner uuid:=lub.talent_owner();result uuid;
BEGIN
 IF kind NOT IN ('Email','Phone','Website','LinkedIn','GitHub','X','TikTok','Instagram','Behance') OR value IS NULL OR length(value)>2048 OR (kind='Email' AND value!~'^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$') OR (kind='Phone' AND value!~'^[+]?[0-9]{8,15}$') OR (kind NOT IN ('Email','Phone') AND value!~'^https://[^[:space:]@]+$') THEN RAISE EXCEPTION 'Invalid link'; END IF;
 IF target IS NULL THEN
  IF (SELECT count(*) FROM lub.profile_links WHERE user_id=owner)>=10 THEN RAISE EXCEPTION 'Link limit';END IF;
  INSERT INTO lub.profile_links(user_id,link_type,label,url_or_value,is_public) VALUES(owner,kind,trim(label),trim(value),visible AND kind<>'Phone') RETURNING id INTO result;
 ELSE UPDATE lub.profile_links SET link_type=kind,label=trim(save_talent_link.label),url_or_value=trim(value),is_public=visible AND kind<>'Phone' WHERE id=target AND user_id=owner RETURNING id INTO result;IF NOT FOUND THEN RAISE EXCEPTION 'Owned link required';END IF;END IF;
 PERFORM lub.task_audit(result,NULL,'TALENT_LINK_SAVED');RETURN result;
END; $$;

--> statement-breakpoint
-- A public avatar may be downloaded, but bucket listing must never expose account-key paths.
DROP POLICY published_account_avatar_select ON storage.objects;
CREATE POLICY published_account_avatar_select ON storage.objects FOR SELECT TO anon,authenticated USING(
 bucket_id='lub-avatars' AND storage.allow_any_operation(ARRAY['object.get_authenticated','object.get_authenticated_info'])
 AND CASE WHEN name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/avatar[.]webp$'
 THEN lub.public_avatar_version(substring(name from 1 for 36)::uuid) IS NOT NULL ELSE false END);

--> statement-breakpoint
-- Enrich canonical search metadata without replacing any spelling entered by students.
CREATE FUNCTION lub.talent_skill_metadata() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE canonical jsonb;
BEGIN
 canonical := ('{"python":["Python","بايثون"],"sql":["SQL","إس كيو إل"],"javascript":["JavaScript","جافاسكريبت","جافا سكريبت"],"typescript":["TypeScript","تايب سكريبت"],"react":["React","رياكت"],"figma":["Figma","فيجما"]}'::jsonb)->lub.skill_key(NEW.name_ar);
 IF canonical IS NOT NULL THEN NEW.name_en:=canonical->>0;NEW.aliases:=canonical;END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION lub.talent_skill_metadata() FROM PUBLIC;
CREATE TRIGGER talent_skill_metadata BEFORE INSERT OR UPDATE OF name_ar ON lub.skills FOR EACH ROW EXECUTE FUNCTION lub.talent_skill_metadata();
UPDATE lub.skills SET name_ar=name_ar WHERE lub.skill_key(name_ar) IN ('python','sql','javascript','typescript','react','figma');
