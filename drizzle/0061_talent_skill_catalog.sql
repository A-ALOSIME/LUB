-- Existing private items stay private until their owner explicitly saves the new whole-profile settings.
CREATE OR REPLACE FUNCTION lub.save_talent_link(target uuid,kind text,label text,value text,visible boolean) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE owner uuid:=lub.talent_owner();result uuid;
BEGIN
 IF kind NOT IN ('Email','Phone','Website','LinkedIn','GitHub','X','TikTok','Instagram','Behance') OR value IS NULL OR length(value)>2048 OR (kind='Email' AND value!~'^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$') OR (kind='Phone' AND value!~'^[+]?[0-9]{8,15}$') OR (kind NOT IN ('Email','Phone') AND value!~'^https://[^[:space:]@]+$') THEN RAISE EXCEPTION 'Invalid link'; END IF;
 IF target IS NULL THEN
  IF (SELECT count(*) FROM lub.profile_links WHERE user_id=owner)>=10 THEN RAISE EXCEPTION 'Link limit';END IF;
  INSERT INTO lub.profile_links(user_id,link_type,label,url_or_value,is_public) VALUES(owner,kind,trim(label),trim(value),visible) RETURNING id INTO result;
 ELSE UPDATE lub.profile_links SET link_type=kind,label=trim(save_talent_link.label),url_or_value=trim(value),is_public=visible WHERE id=target AND user_id=owner RETURNING id INTO result;IF NOT FOUND THEN RAISE EXCEPTION 'Owned link required';END IF;END IF;
 PERFORM lub.task_audit(result,NULL,'TALENT_LINK_SAVED');RETURN result;
END; $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.public_talent(target uuid,org_skip int DEFAULT 0,event_skip int DEFAULT 0,project_skip int DEFAULT 0) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH person AS (SELECT p.user_id,s.public_slug,s.allow_indexing FROM lub.student_profiles p JOIN lub.profile_settings s ON s.user_id=p.user_id WHERE s.public_slug=target AND lub.public_talent_eligible(p.user_id)), source AS (SELECT person.*,lub.talent_profile_source(person.user_id,org_skip,event_skip,project_skip) AS data FROM person)
 SELECT jsonb_build_object('id',public_slug,'name',data->'name','major',data->'major','level',data->'level','bio',data->'bio','total',data->'total','avatar_version',data->'avatar_version','indexable',allow_indexing,
 'skills',coalesce((SELECT jsonb_agg(label ORDER BY key) FROM(SELECT DISTINCT ON(lub.skill_key(x)) x AS label,lub.skill_key(x) AS key FROM jsonb_array_elements_text(data->'skills') x ORDER BY lub.skill_key(x),x) names),'[]'),
 'links',coalesce((SELECT jsonb_agg(x) FROM jsonb_array_elements(data->'links') x),'[]'),
 'organizations',coalesce((SELECT jsonb_agg((x-'id')||jsonb_build_object('id',x->'slug','logo',o.logo_url,'type',o.type_code,'memberships',coalesce((SELECT jsonb_agg(m||jsonb_build_object('hours',(SELECT coalesce(sum(h.hours),0)::text FROM lub.hour_records h JOIN lub.organization_memberships om ON om.id=h.organization_membership_id WHERE om.user_id=source.user_id AND om.organization_id=o.id AND h.status_code='Approved' AND h.activity_date>=(m->>'start_date')::date AND (m->>'end_date' IS NULL OR h.activity_date<(m->>'end_date')::date)),'roles',coalesce((SELECT jsonb_agg(r||jsonb_build_object('hours',(SELECT coalesce(sum(h.hours),0)::text FROM lub.hour_records h JOIN lub.organization_memberships om ON om.id=h.organization_membership_id WHERE om.user_id=source.user_id AND om.organization_id=o.id AND h.status_code='Approved' AND h.activity_date>=(r->>'starts')::date AND (r->>'ends' IS NULL OR h.activity_date<(r->>'ends')::date) AND EXISTS(SELECT 1 FROM lub.role_assignments ra WHERE ra.organization_membership_id=om.id AND ra.role_code=r->>'code' AND ra.start_date=(r->>'starts')::date AND ra.end_date IS NOT DISTINCT FROM (r->>'ends')::date AND (ra.committee_id IS NULL OR ra.committee_id=h.committee_id))))) FROM jsonb_array_elements(m->'roles') r),'[]'))) FROM jsonb_array_elements(x->'memberships') m),'[]'))) FROM jsonb_array_elements(data->'organizations') x JOIN lub.organizations o ON o.slug=x->>'slug'),'[]'),
 'events',coalesce((SELECT jsonb_agg((x-'id')||jsonb_build_object('href','/events/'||(x->>'id'))) FROM jsonb_array_elements(data->'events') x WHERE x->>'attendance'='Present' OR jsonb_array_length(x->'contributions')>0),'[]'),
 'projects',coalesce((SELECT jsonb_agg((x-'id')||jsonb_build_object('id',md5(x->>'id'))) FROM jsonb_array_elements(data->'projects') x),'[]'),
 'stats',jsonb_build_object('organizations',(SELECT count(DISTINCT m.organization_id) FROM lub.organization_memberships m WHERE m.user_id=source.user_id),'events',(SELECT count(DISTINCT e.id) FROM lub.events e LEFT JOIN lub.event_registrations er ON er.event_id=e.id AND er.user_id=source.user_id AND er.status_code='Registered' LEFT JOIN lub.event_attendance a ON a.event_registration_id=er.id WHERE e.status_code='Completed' AND e.published_at IS NOT NULL AND (a.status_code='Present' OR EXISTS(SELECT 1 FROM lub.event_contributions c WHERE c.event_id=e.id AND c.user_id=source.user_id))))) FROM source;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.save_talent_skill(name text,visible boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE owner uuid:=lub.talent_owner();skill uuid;normalized text:=lub.skill_key(trim(name));
BEGIN
 IF name IS NULL OR length(trim(name)) NOT BETWEEN 2 AND 80 THEN RAISE EXCEPTION 'Invalid skill';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(normalized,0));
 SELECT s.id INTO skill FROM lub.skills s WHERE s.is_active AND (lub.skill_key(s.name_ar)=normalized OR lub.skill_key(s.name_en)=normalized OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(s.aliases) a WHERE lub.skill_key(a)=normalized)) ORDER BY (s.name_ar=trim(name)) DESC,s.id LIMIT 1;
 IF (SELECT count(*) FROM lub.student_skills WHERE user_id=owner)>=30 AND NOT EXISTS(SELECT 1 FROM lub.student_skills WHERE user_id=owner AND skill_id=skill) THEN RAISE EXCEPTION 'Skill limit';END IF;
 IF skill IS NULL THEN INSERT INTO lub.skills(name_ar) VALUES(trim(name)) ON CONFLICT(name_ar) DO UPDATE SET name_ar=excluded.name_ar RETURNING id INTO skill;END IF;
 INSERT INTO lub.student_skills(user_id,skill_id,is_public) VALUES(owner,skill,visible) ON CONFLICT(user_id,skill_id) DO UPDATE SET is_public=excluded.is_public;
 PERFORM lub.task_audit(skill,NULL,'TALENT_SKILL_SAVED');
END; $$;
CREATE FUNCTION lub.save_talent_catalog_skill(name text,english text,arabic text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE owner uuid:=lub.talent_owner();target uuid;
BEGIN
 IF name IS NULL OR english IS NULL OR arabic IS NULL OR length(trim(name)) NOT BETWEEN 2 AND 80 OR length(trim(english)) NOT BETWEEN 2 AND 80 OR length(trim(arabic)) NOT BETWEEN 2 AND 80 THEN RAISE EXCEPTION 'Invalid skill labels';END IF;
 PERFORM lub.save_talent_skill(name,true);
 SELECT s.id INTO target FROM lub.skills s JOIN lub.student_skills ss ON ss.skill_id=s.id AND ss.user_id=owner WHERE lub.skill_key(s.name_ar)=lub.skill_key(name) OR lub.skill_key(s.name_en)=lub.skill_key(name) OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(s.aliases) a WHERE lub.skill_key(a)=lub.skill_key(name)) ORDER BY s.id LIMIT 1;
 IF target IS NULL THEN RAISE EXCEPTION 'Owned skill required';END IF;
 UPDATE lub.skills s SET name_en=trim(english),aliases=(SELECT coalesce(jsonb_agg(x),'[]') FROM (SELECT DISTINCT x FROM jsonb_array_elements_text(s.aliases||jsonb_build_array(trim(name),trim(english),trim(arabic))) x ORDER BY x LIMIT 30) a) WHERE id=target;
END; $$;
REVOKE ALL ON FUNCTION lub.save_talent_catalog_skill(text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lub.save_talent_catalog_skill(text,text,text) TO authenticated;
