CREATE FUNCTION lub.skill_key(value text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT CASE lub.arabic_search_key(trim(value)) WHEN 'بايثون' THEN 'python' WHEN 'اس كيو ال' THEN 'sql' WHEN 'جافاسكريبت' THEN 'javascript' WHEN 'جافا سكريبت' THEN 'javascript' WHEN 'تايب سكريبت' THEN 'typescript' WHEN 'رياكت' THEN 'react' WHEN 'فيجما' THEN 'figma' ELSE lub.arabic_search_key(trim(value)) END;
$$;
CREATE FUNCTION lub.skill_category_labels(code text) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT jsonb_build_object('key',code,'labelAr',CASE code WHEN 'programming' THEN 'برمجة' WHEN 'data' THEN 'بيانات وذكاء اصطناعي' WHEN 'design' THEN 'تصميم' WHEN 'networks' THEN 'شبكات وحوسبة سحابية' WHEN 'security' THEN 'أمن معلومات' WHEN 'management' THEN 'إدارة وتنظيم' WHEN 'communication' THEN 'تواصل ومحتوى' ELSE 'أخرى' END,
 'labelEn',CASE code WHEN 'programming' THEN 'Programming' WHEN 'data' THEN 'Data and AI' WHEN 'design' THEN 'Design' WHEN 'networks' THEN 'Networks and cloud' WHEN 'security' THEN 'Information security' WHEN 'management' THEN 'Management' WHEN 'communication' THEN 'Communication and content' ELSE 'Other' END);
$$;
CREATE FUNCTION lub.resolve_profile_skill_key(value text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result uuid;
BEGIN
 SELECT id INTO result FROM lub.skills WHERE canonical_key=value AND is_active FOR KEY SHARE;
 IF result IS NULL THEN RAISE EXCEPTION 'Unknown skill'; END IF; RETURN result;
END; $$;
CREATE FUNCTION lub.skill_catalog_rows(query text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF query IS NULL OR length(trim(query))<2 OR length(query)>80 OR NOT lub.is_student_account(auth.uid()) THEN RETURN '[]'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('key',s.canonical_key,'labelAr',s.name_ar,'labelEn',coalesce(s.name_en,s.name_ar),'category',lub.skill_category_labels(s.category_code),
  'featured',false,'order',0,'tasks',0,'events',0,'filterValue',coalesce(s.name_en,s.name_ar)) ORDER BY s.name_ar,s.id),'[]') INTO result
 FROM (SELECT * FROM lub.skills WHERE is_active AND position(lub.arabic_search_key(trim(query)) IN lub.arabic_search_key(name_ar||' '||coalesce(name_en,'')||' '||aliases::text))>0 ORDER BY name_ar,id LIMIT 20) s;
 RETURN result;
END; $$;
CREATE FUNCTION lub.profile_skill_details(owner_id uuid,public_only boolean) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH task_counts AS (
  SELECT (tag#>>'{}')::uuid skill_id,count(DISTINCT t.id)::int total FROM lub.task_participants p JOIN lub.tasks t ON t.id=p.task_id
  CROSS JOIN LATERAL jsonb_array_elements(t.skill_ids) tag WHERE p.user_id=owner_id AND t.deleted_at IS NULL
   AND EXISTS(SELECT 1 FROM jsonb_array_elements(p.submissions) s WHERE s->>'status_code'='Approved') GROUP BY 1
 ), event_counts AS (
  SELECT (tag#>>'{}')::uuid skill_id,count(DISTINCT e.id)::int total FROM lub.organization_content e JOIN lub.event_registrations r ON r.event_id=e.id
  CROSS JOIN LATERAL jsonb_array_elements(e.skill_ids) tag WHERE r.user_id=owner_id AND e.kind='Event' AND e.completed_at IS NOT NULL AND e.published_at IS NOT NULL AND e.deleted_at IS NULL
   AND r.status_code='Registered' AND r.review_status_code='Accepted' AND r.attendance='Present' GROUP BY 1
 ) SELECT coalesce(jsonb_agg(jsonb_build_object('key',s.canonical_key,'labelAr',s.name_ar,'labelEn',coalesce(s.name_en,s.name_ar),'category',lub.skill_category_labels(s.category_code),
  'featured',coalesce((entry->>'isFeatured')::boolean,false),'order',coalesce((entry->>'sortOrder')::int,0),'tasks',coalesce(t.total,0),'events',coalesce(e.total,0),'filterValue',coalesce(s.name_en,s.name_ar))
  ORDER BY coalesce((entry->>'sortOrder')::int,0),s.canonical_key),'[]') FROM lub.users u CROSS JOIN LATERAL jsonb_array_elements(u.skills) entry
 JOIN lub.skills s ON s.id=(entry->>'id')::uuid LEFT JOIN task_counts t ON t.skill_id=s.id LEFT JOIN event_counts e ON e.skill_id=s.id WHERE u.id=owner_id AND s.is_active;
$$;
CREATE FUNCTION lub.public_profile_skills(slug uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce((SELECT lub.profile_skill_details(u.id,true) FROM lub.users u WHERE u.public_slug=slug AND u.public_profile_enabled AND NOT u.is_test_account AND lub.is_student_account(u.id)),'[]');
$$;
CREATE FUNCTION lub.own_profile_skills(slug uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT lub.is_student_account(auth.uid()) OR NOT EXISTS(SELECT 1 FROM lub.users WHERE id=auth.uid() AND public_slug=slug) THEN RAISE EXCEPTION 'Owned profile required' USING ERRCODE='42501'; END IF;
 RETURN lub.profile_skill_details(auth.uid(),false);
END; $$;
CREATE FUNCTION lub.save_profile_skill_selection(slug uuid,selection jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE entry jsonb; selected uuid; chosen uuid[]:='{}'; records jsonb:='[]'; position int:=0;
BEGIN
 PERFORM 1 FROM lub.users WHERE id=auth.uid() AND public_slug=slug FOR UPDATE;
 IF NOT FOUND OR NOT lub.is_student_account(auth.uid()) THEN RAISE EXCEPTION 'Owned profile required' USING ERRCODE='42501'; END IF;
 IF selection IS NULL OR jsonb_typeof(selection)<>'array' OR jsonb_array_length(selection)>30 THEN RAISE EXCEPTION 'Invalid skill selection'; END IF;
 FOR entry IN SELECT value FROM jsonb_array_elements(selection) LOOP
  IF jsonb_typeof(entry)<>'object' OR jsonb_typeof(entry->'key') IS DISTINCT FROM 'string' OR jsonb_typeof(entry->'featured') IS DISTINCT FROM 'boolean'
   OR EXISTS(SELECT 1 FROM jsonb_object_keys(entry) k WHERE k NOT IN ('key','featured')) THEN RAISE EXCEPTION 'Invalid skill item'; END IF;
  selected:=lub.resolve_profile_skill_key(entry->>'key');
  IF selected=ANY(chosen) THEN RAISE EXCEPTION 'Duplicate skill'; END IF; chosen:=array_append(chosen,selected);
  records:=records||jsonb_build_array(jsonb_build_object('id',selected,'isFeatured',(entry->>'featured')::boolean,'sortOrder',position)); position:=position+1;
 END LOOP;
 IF (SELECT count(*) FROM jsonb_array_elements(records) r WHERE r->'isFeatured'='true'::jsonb)>5 THEN RAISE EXCEPTION 'At most five featured skills'; END IF;
 UPDATE lub.users SET skills=records,updated_at=now() WHERE id=auth.uid(); RETURN lub.profile_skill_details(auth.uid(),false);
END; $$;
CREATE FUNCTION lub.save_talent_skill(name text,visible boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE target uuid; entries jsonb;
BEGIN
 SELECT skills INTO entries FROM lub.users WHERE id=auth.uid() FOR UPDATE;
 IF NOT FOUND OR NOT lub.is_student_account(auth.uid()) THEN RAISE EXCEPTION 'Active student required' USING ERRCODE='42501'; END IF;
 IF name IS NULL OR length(trim(name)) NOT BETWEEN 2 AND 80 THEN RAISE EXCEPTION 'Invalid skill name'; END IF;
 -- Catalog writes are rare and serialized; profile batches cannot create custom names in conflicting orders.
 PERFORM pg_advisory_xact_lock(hashtextextended('lub:skill-catalog',0));
 SELECT s.id INTO target FROM lub.skills s WHERE s.is_active AND (lub.skill_key(s.name_ar)=lub.skill_key(name) OR lub.skill_key(s.name_en)=lub.skill_key(name)
  OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(s.aliases) a WHERE lub.skill_key(a)=lub.skill_key(name))) ORDER BY s.is_builtin DESC,s.canonical_key LIMIT 1;
 IF target IS NULL THEN
  INSERT INTO lub.skills(canonical_key,name_ar,name_en,aliases) VALUES('custom:'||lub.skill_key(name),trim(name),trim(name),jsonb_build_array(trim(name)))
  ON CONFLICT(canonical_key) DO NOTHING RETURNING id INTO target;
  IF target IS NULL THEN SELECT id INTO target FROM lub.skills WHERE canonical_key='custom:'||lub.skill_key(name) AND is_active; END IF;
 END IF;
 IF target IS NULL THEN RAISE EXCEPTION 'Skill unavailable'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(entries) e WHERE e->>'id'=target::text) THEN RETURN; END IF;
 IF jsonb_array_length(entries)>=30 THEN RAISE EXCEPTION 'At most thirty skills'; END IF;
 -- Visibility is controlled by the whole profile, not the legacy per-item boolean argument.
 UPDATE lub.users SET skills=skills||jsonb_build_array(jsonb_build_object('id',target,'isFeatured',false,'sortOrder',jsonb_array_length(entries))),updated_at=now() WHERE id=auth.uid();
END; $$;
CREATE FUNCTION lub.remove_talent_skill(name text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM 1 FROM lub.users WHERE id=auth.uid() FOR UPDATE;
 IF NOT FOUND OR NOT lub.is_student_account(auth.uid()) THEN RAISE EXCEPTION 'Active student required' USING ERRCODE='42501'; END IF;
 IF name IS NULL OR length(trim(name)) NOT BETWEEN 2 AND 120 THEN RAISE EXCEPTION 'Invalid skill name'; END IF;
 UPDATE lub.users SET skills=coalesce((SELECT jsonb_agg(e ORDER BY ordinal) FROM jsonb_array_elements(skills) WITH ORDINALITY x(e,ordinal)
  JOIN lub.skills s ON s.id=(e->>'id')::uuid WHERE s.canonical_key<>name AND lub.skill_key(s.name_ar)<>lub.skill_key(name) AND lub.skill_key(coalesce(s.name_en,s.name_ar))<>lub.skill_key(name)
  AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(s.aliases) a WHERE lub.skill_key(a)=lub.skill_key(name))),'[]'),updated_at=now() WHERE id=auth.uid();
END; $$;
CREATE FUNCTION lub.save_talent_catalog_skill(name text,english text,arabic text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE target uuid; entries jsonb;
BEGIN
 SELECT skills INTO entries FROM lub.users WHERE id=auth.uid() FOR UPDATE;
 IF NOT FOUND OR NOT lub.is_student_account(auth.uid()) THEN RAISE EXCEPTION 'Active student required' USING ERRCODE='42501'; END IF;
 IF name IS NULL OR english IS NULL OR arabic IS NULL OR length(trim(name)) NOT BETWEEN 2 AND 80 OR length(trim(english)) NOT BETWEEN 2 AND 80 OR length(trim(arabic)) NOT BETWEEN 2 AND 80 THEN RAISE EXCEPTION 'Invalid skill labels'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('lub:skill-catalog',0));
 SELECT s.id INTO target FROM lub.skills s WHERE s.is_active AND (lub.skill_key(s.name_ar)=lub.skill_key(name) OR lub.skill_key(s.name_en)=lub.skill_key(name)
  OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(s.aliases) a WHERE lub.skill_key(a)=lub.skill_key(name))) ORDER BY s.is_builtin DESC,s.canonical_key LIMIT 1;
 IF target IS NULL THEN
  INSERT INTO lub.skills(canonical_key,name_ar,name_en,aliases) VALUES('custom:'||lub.skill_key(name),trim(arabic),trim(english),jsonb_build_array(trim(name),trim(english),trim(arabic))) ON CONFLICT(canonical_key) DO NOTHING RETURNING id INTO target;
  IF target IS NULL THEN SELECT id INTO target FROM lub.skills WHERE canonical_key='custom:'||lub.skill_key(name) AND is_active; END IF;
 END IF;
 IF target IS NULL THEN RAISE EXCEPTION 'Skill unavailable'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(entries) e WHERE e->>'id'=target::text) THEN RETURN; END IF;
 IF jsonb_array_length(entries)>=30 THEN RAISE EXCEPTION 'At most thirty skills'; END IF;
 UPDATE lub.users SET skills=skills||jsonb_build_array(jsonb_build_object('id',target,'isFeatured',false,'sortOrder',jsonb_array_length(entries))),updated_at=now() WHERE id=auth.uid();
END; $$;
CREATE FUNCTION lub.set_activity_skill_tags(kind text,target uuid,keys jsonb,expected int) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE task lub.tasks; event lub.organization_content; selected uuid; chosen uuid[]:='{}'; entry jsonb; current_ids jsonb;
BEGIN
 IF kind='Task' THEN
  task:=lub.lock_task(target);
  IF NOT lub.can_manage_task(target) OR task.status_code NOT IN ('Draft','Open') OR task.revision IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Task permission required' USING ERRCODE='42501'; END IF;
  current_ids:=task.skill_ids;
 ELSIF kind='Event' THEN
  event:=lub.lock_event(target);
  IF NOT lub.can_operate_event(target) OR event.status_code NOT IN ('Draft','Published') OR event.revision IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Event permission required' USING ERRCODE='42501'; END IF;
  current_ids:=event.skill_ids;
 ELSE RAISE EXCEPTION 'Invalid activity'; END IF;
 IF keys IS NULL OR jsonb_typeof(keys)<>'array' OR jsonb_array_length(keys)>30 THEN RAISE EXCEPTION 'Invalid skill tags'; END IF;
 FOR entry IN SELECT value FROM jsonb_array_elements(keys) LOOP
  IF jsonb_typeof(entry)<>'string' THEN RAISE EXCEPTION 'Invalid skill key'; END IF;
  selected:=lub.resolve_profile_skill_key(entry#>>'{}'); IF selected=ANY(chosen) THEN RAISE EXCEPTION 'Duplicate skill'; END IF; chosen:=array_append(chosen,selected);
 END LOOP;
 IF to_jsonb(chosen)@>current_ids AND current_ids@>to_jsonb(chosen) THEN RETURN; END IF;
 IF kind='Task' THEN UPDATE lub.tasks SET skill_ids=to_jsonb(chosen),revision=revision+1,updated_at=now() WHERE id=target;
 ELSE UPDATE lub.organization_content SET skill_ids=to_jsonb(chosen),revision=revision+1,updated_at=now() WHERE id=target; END IF;
END; $$;
REVOKE ALL ON FUNCTION lub.skill_key(text),lub.skill_category_labels(text),lub.resolve_profile_skill_key(text),lub.skill_catalog_rows(text),lub.profile_skill_details(uuid,boolean),lub.public_profile_skills(uuid),lub.own_profile_skills(uuid),lub.save_profile_skill_selection(uuid,jsonb),lub.save_talent_skill(text,boolean),lub.save_talent_catalog_skill(text,text,text),lub.remove_talent_skill(text),lub.set_activity_skill_tags(text,uuid,jsonb,int) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION lub.skill_key(text),lub.skill_catalog_rows(text),lub.own_profile_skills(uuid),lub.save_profile_skill_selection(uuid,jsonb),lub.save_talent_skill(text,boolean),lub.save_talent_catalog_skill(text,text,text),lub.remove_talent_skill(text),lub.set_activity_skill_tags(text,uuid,jsonb,int) TO authenticated;
GRANT EXECUTE ON FUNCTION lub.public_profile_skills(uuid) TO anon,authenticated;

CREATE FUNCTION lub.activity_skill_items(ids jsonb) RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('key',s.canonical_key,'labelAr',s.name_ar,'labelEn',coalesce(s.name_en,s.name_ar),
  'category',lub.skill_category_labels(s.category_code),'featured',false,'order',ordinal-1,'tasks',0,'events',0,
  'filterValue',coalesce(s.name_en,s.name_ar)) ORDER BY ordinal),'[]')
 FROM jsonb_array_elements_text(ids) WITH ORDINALITY AS tags(skill_id,ordinal) JOIN lub.skills s ON s.id=skill_id::uuid;
$$;
REVOKE ALL ON FUNCTION lub.activity_skill_items(jsonb) FROM PUBLIC,anon,authenticated;
