CREATE TABLE lub.skill_categories(code text PRIMARY KEY,name_ar text NOT NULL,name_en text NOT NULL);
INSERT INTO lub.skill_categories VALUES('programming','برمجة','Programming'),('data','بيانات وذكاء اصطناعي','Data and AI'),('design','تصميم','Design'),('networks','شبكات وحوسبة سحابية','Networks and cloud'),('security','أمن معلومات','Information security'),('management','إدارة وتنظيم','Management'),('communication','تواصل ومحتوى','Communication and content'),('other','أخرى','Other');
CREATE TABLE lub.skill_dictionary(key text PRIMARY KEY,name_ar varchar(80) NOT NULL,name_en varchar(80) NOT NULL,category_code text NOT NULL REFERENCES lub.skill_categories(code),aliases jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(aliases)='array'));
INSERT INTO lub.skill_dictionary(key,name_ar,name_en,category_code,aliases) VALUES
('python','بايثون','Python','programming','["بايثون", "Python", "بايثون"]'::jsonb),
('sql','إس كيو إل','SQL','data','["إس كيو إل", "SQL", "اس كيو ال"]'::jsonb),
('javascript','جافاسكريبت','JavaScript','programming','["جافاسكريبت", "JavaScript", "جافا سكريبت"]'::jsonb),
('typescript','تايب سكريبت','TypeScript','programming','["تايب سكريبت", "TypeScript"]'::jsonb),
('react','رياكت','React','programming','["رياكت", "React"]'::jsonb),
('java','جافا','Java','programming','["جافا", "Java"]'::jsonb),
('cpp','سي بلس بلس','C++','programming','["سي بلس بلس", "C++", "cpp"]'::jsonb),
('csharp','سي شارب','C#','programming','["سي شارب", "C#", "csharp"]'::jsonb),
('html','إتش تي إم إل','HTML','programming','["إتش تي إم إل", "HTML"]'::jsonb),
('css','سي إس إس','CSS','design','["سي إس إس", "CSS"]'::jsonb),
('nodejs','نود جي إس','Node.js','programming','["نود جي إس", "Node.js", "nodejs", "node js"]'::jsonb),
('git','جِت','Git','programming','["جِت", "Git"]'::jsonb),
('data-analysis','تحليل البيانات','Data Analysis','data','["تحليل البيانات", "Data Analysis", "تحليل بيانات"]'::jsonb),
('data-science','علم البيانات','Data Science','data','["علم البيانات", "Data Science"]'::jsonb),
('machine-learning','تعلم الآلة','Machine Learning','data','["تعلم الآلة", "Machine Learning", "التعلم الآلي"]'::jsonb),
('artificial-intelligence','الذكاء الاصطناعي','Artificial Intelligence','data','["الذكاء الاصطناعي", "Artificial Intelligence", "AI"]'::jsonb),
('excel','إكسل','Excel','data','["إكسل", "Excel", "Microsoft Excel"]'::jsonb),
('power-bi','باور بي آي','Power BI','data','["باور بي آي", "Power BI"]'::jsonb),
('figma','فيجما','Figma','design','["فيجما", "Figma"]'::jsonb),
('ui-design','تصميم الواجهات','UI Design','design','["تصميم الواجهات", "UI Design", "UI"]'::jsonb),
('ux-design','تجربة المستخدم','UX Design','design','["تجربة المستخدم", "UX Design", "UX"]'::jsonb),
('graphic-design','التصميم الجرافيكي','Graphic Design','design','["التصميم الجرافيكي", "Graphic Design", "تصميم", "جرافيك"]'::jsonb),
('photoshop','فوتوشوب','Photoshop','design','["فوتوشوب", "Photoshop"]'::jsonb),
('illustrator','إليستريتور','Illustrator','design','["إليستريتور", "Illustrator"]'::jsonb),
('networking','الشبكات','Networking','networks','["الشبكات", "Networking", "شبكات"]'::jsonb),
('linux','لينكس','Linux','networks','["لينكس", "Linux"]'::jsonb),
('cloud-computing','الحوسبة السحابية','Cloud Computing','networks','["الحوسبة السحابية", "Cloud Computing"]'::jsonb),
('cybersecurity','الأمن السيبراني','Cybersecurity','security','["الأمن السيبراني", "Cybersecurity", "أمن سيبراني", "امن سيبراني"]'::jsonb),
('information-security','أمن المعلومات','Information Security','security','["أمن المعلومات", "Information Security", "امن المعلومات"]'::jsonb),
('penetration-testing','اختبار الاختراق','Penetration Testing','security','["اختبار الاختراق", "Penetration Testing"]'::jsonb),
('project-management','إدارة المشاريع','Project Management','management','["إدارة المشاريع", "Project Management"]'::jsonb),
('event-management','تنظيم الفعاليات','Event Management','management','["تنظيم الفعاليات", "Event Management", "تنظيم فعاليات"]'::jsonb),
('leadership','القيادة','Leadership','management','["القيادة", "Leadership"]'::jsonb),
('teamwork','العمل الجماعي','Teamwork','communication','["العمل الجماعي", "Teamwork"]'::jsonb),
('communication','التواصل','Communication','communication','["التواصل", "Communication"]'::jsonb),
('content-writing','كتابة المحتوى','Content Writing','communication','["كتابة المحتوى", "Content Writing"]'::jsonb),
('public-speaking','الإلقاء','Public Speaking','communication','["الإلقاء", "Public Speaking", "التحدث أمام الجمهور"]'::jsonb);
ALTER TABLE lub.skill_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE lub.skill_dictionary ENABLE ROW LEVEL SECURITY;
CREATE POLICY skill_category_read ON lub.skill_categories FOR SELECT TO anon,authenticated USING(true);
CREATE POLICY skill_dictionary_read ON lub.skill_dictionary FOR SELECT TO anon,authenticated USING(true);
GRANT SELECT ON lub.skill_categories,lub.skill_dictionary TO anon,authenticated;
ALTER TABLE lub.skills ADD COLUMN dictionary_key text REFERENCES lub.skill_dictionary(key);
CREATE FUNCTION lub.match_skill_dictionary() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 SELECT d.key INTO NEW.dictionary_key FROM lub.skill_dictionary d WHERE EXISTS(SELECT 1 FROM jsonb_array_elements_text(d.aliases) label WHERE lub.skill_key(label) IN(lub.skill_key(NEW.name_ar),lub.skill_key(NEW.name_en))) ORDER BY d.key LIMIT 1;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION lub.match_skill_dictionary() FROM PUBLIC;
CREATE TRIGGER zz_skill_dictionary_lookup BEFORE INSERT OR UPDATE OF name_ar,name_en,aliases ON lub.skills FOR EACH ROW EXECUTE FUNCTION lub.match_skill_dictionary();
UPDATE lub.skills SET name_ar=name_ar;
ALTER TABLE lub.student_skills ADD COLUMN sort_order smallint NOT NULL DEFAULT 0 CHECK(sort_order BETWEEN 0 AND 29),ADD COLUMN is_featured boolean NOT NULL DEFAULT false;
WITH ranked AS(SELECT user_id,skill_id,(row_number() OVER(PARTITION BY user_id ORDER BY skill_id)-1)::smallint AS position FROM lub.student_skills) UPDATE lub.student_skills s SET sort_order=r.position FROM ranked r WHERE r.user_id=s.user_id AND r.skill_id=s.skill_id;
CREATE TABLE lub.task_skill_tags(task_id uuid NOT NULL REFERENCES lub.tasks(id),skill_id uuid NOT NULL REFERENCES lub.skills(id),PRIMARY KEY(task_id,skill_id));
CREATE TABLE lub.event_skill_tags(event_id uuid NOT NULL REFERENCES lub.events(id),skill_id uuid NOT NULL REFERENCES lub.skills(id),PRIMARY KEY(event_id,skill_id));
ALTER TABLE lub.task_skill_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE lub.event_skill_tags ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON lub.task_skill_tags,lub.event_skill_tags TO authenticated;
CREATE POLICY task_skill_read ON lub.task_skill_tags FOR SELECT TO authenticated USING(lub.can_read_task(task_id));
CREATE POLICY event_skill_read ON lub.event_skill_tags FOR SELECT TO authenticated USING(lub.can_operate_event(event_id));
--> statement-breakpoint
CREATE FUNCTION lub.skill_catalog_rows(query text DEFAULT '') RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH catalog AS(
 SELECT d.key,d.name_ar,d.name_en,d.aliases,d.category_code FROM lub.skill_dictionary d
 UNION ALL SELECT 'custom:'||lub.skill_key(s.name_ar),s.name_ar,coalesce(s.name_en,s.name_ar),s.aliases,'other' FROM lub.skills s WHERE s.dictionary_key IS NULL AND s.is_active),
 distinct_rows AS(SELECT DISTINCT ON(key) * FROM catalog WHERE coalesce(trim(query),'')='' OR position(lub.arabic_search_key(left(query,80)) IN lub.arabic_search_key(name_ar||' '||name_en||' '||aliases::text))>0 ORDER BY key,name_ar)
 SELECT coalesce(jsonb_agg(jsonb_build_object('key',r.key,'labelAr',r.name_ar,'labelEn',r.name_en,'category',jsonb_build_object('key',c.code,'labelAr',c.name_ar,'labelEn',c.name_en),'featured',false,'order',0,'tasks',0,'events',0,'filterValue',r.name_en)),'[]') FROM(SELECT * FROM distinct_rows ORDER BY name_ar LIMIT 20) r JOIN lub.skill_categories c ON c.code=r.category_code;
$$;
REVOKE ALL ON FUNCTION lub.skill_catalog_rows(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lub.skill_catalog_rows(text) TO authenticated;
CREATE FUNCTION lub.profile_skill_details(owner_id uuid,public_only boolean) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH task_counts AS(SELECT coalesce(s.dictionary_key,'custom:'||lub.skill_key(s.name_ar)) AS key,count(DISTINCT t.id)::int AS total FROM lub.task_participants p JOIN lub.tasks t ON t.id=p.task_id JOIN lub.task_skill_tags tag ON tag.task_id=t.id JOIN lub.skills s ON s.id=tag.skill_id WHERE p.user_id=owner_id AND p.status_code='Approved' AND t.deleted_at IS NULL GROUP BY 1),
 event_counts AS(SELECT coalesce(s.dictionary_key,'custom:'||lub.skill_key(s.name_ar)) AS key,count(DISTINCT e.id)::int AS total FROM lub.events e JOIN lub.event_skill_tags tag ON tag.event_id=e.id JOIN lub.skills s ON s.id=tag.skill_id WHERE e.status_code='Completed' AND e.published_at IS NOT NULL AND (EXISTS(SELECT 1 FROM lub.event_registrations r JOIN lub.event_attendance a ON a.event_registration_id=r.id WHERE r.event_id=e.id AND r.user_id=owner_id AND r.status_code='Registered' AND a.status_code='Present') OR EXISTS(SELECT 1 FROM lub.event_contributions c WHERE c.event_id=e.id AND c.user_id=owner_id)) GROUP BY 1),
 selected AS(SELECT DISTINCT ON(coalesce(s.dictionary_key,'custom:'||lub.skill_key(s.name_ar))) coalesce(s.dictionary_key,'custom:'||lub.skill_key(s.name_ar)) AS key,coalesce(d.name_ar,s.name_ar) AS ar,coalesce(d.name_en,s.name_en,s.name_ar) AS en,coalesce(d.category_code,'other') AS category,s.name_ar AS filter,ss.sort_order,ss.is_featured FROM lub.student_skills ss JOIN lub.skills s ON s.id=ss.skill_id LEFT JOIN lub.skill_dictionary d ON d.key=s.dictionary_key WHERE ss.user_id=owner_id AND s.is_active AND (NOT public_only OR ss.is_public) ORDER BY coalesce(s.dictionary_key,'custom:'||lub.skill_key(s.name_ar)),ss.is_featured DESC,ss.sort_order,s.id)
 SELECT coalesce(jsonb_agg(jsonb_build_object('key',r.key,'labelAr',r.ar,'labelEn',r.en,'category',jsonb_build_object('key',c.code,'labelAr',c.name_ar,'labelEn',c.name_en),'featured',r.is_featured,'order',r.sort_order,'tasks',coalesce(t.total,0),'events',coalesce(e.total,0),'filterValue',r.filter) ORDER BY r.sort_order,r.key),'[]') FROM selected r JOIN lub.skill_categories c ON c.code=r.category LEFT JOIN task_counts t ON t.key=r.key LEFT JOIN event_counts e ON e.key=r.key;
$$;
REVOKE ALL ON FUNCTION lub.profile_skill_details(uuid,boolean) FROM PUBLIC;
CREATE FUNCTION lub.public_profile_skills(slug uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT coalesce((SELECT lub.profile_skill_details(s.user_id,true) FROM lub.profile_settings s WHERE s.public_slug=slug AND lub.public_talent_eligible(s.user_id)),'[]'); $$;
REVOKE ALL ON FUNCTION lub.public_profile_skills(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lub.public_profile_skills(uuid) TO anon,authenticated;
CREATE FUNCTION lub.own_profile_skills(slug uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE owner_id uuid:=lub.talent_owner();
BEGIN
 IF NOT EXISTS(SELECT 1 FROM lub.profile_settings WHERE user_id=owner_id AND public_slug=slug) THEN RAISE EXCEPTION 'Owned profile required' USING ERRCODE='42501';END IF;
 RETURN lub.profile_skill_details(owner_id,false);
END; $$;
REVOKE ALL ON FUNCTION lub.own_profile_skills(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lub.own_profile_skills(uuid) TO authenticated;
CREATE FUNCTION lub.resolve_profile_skill_key(value text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE target uuid;d lub.skill_dictionary;
BEGIN
 SELECT s.id INTO target FROM lub.skills s WHERE s.is_active AND coalesce(s.dictionary_key,'custom:'||lub.skill_key(s.name_ar))=value ORDER BY s.id LIMIT 1;
 IF target IS NOT NULL THEN RETURN target;END IF;
 SELECT * INTO d FROM lub.skill_dictionary WHERE key=value;
 IF d.key IS NULL THEN RAISE EXCEPTION 'Unknown skill';END IF;
 INSERT INTO lub.skills(name_ar,name_en) VALUES(d.name_en,d.name_en) ON CONFLICT(name_ar) DO UPDATE SET name_en=excluded.name_en RETURNING id INTO target;
 RETURN target;
END; $$;
REVOKE ALL ON FUNCTION lub.resolve_profile_skill_key(text) FROM PUBLIC;
CREATE FUNCTION lub.save_profile_skill_selection(slug uuid,selection jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE owner_id uuid:=lub.talent_owner();entry jsonb;target uuid;chosen uuid[]:='{}';position int:=0;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM lub.profile_settings WHERE user_id=owner_id AND public_slug=slug) THEN RAISE EXCEPTION 'Owned profile required' USING ERRCODE='42501';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(owner_id::text,0));
 IF jsonb_typeof(selection) IS DISTINCT FROM 'array' OR jsonb_array_length(selection)>30 THEN RAISE EXCEPTION 'Invalid skill selection';END IF;
 IF (SELECT count(*) FROM jsonb_array_elements(selection) x WHERE x->>'featured'='true')>5 OR (SELECT count(DISTINCT x->>'key') FROM jsonb_array_elements(selection) x)<>jsonb_array_length(selection) THEN RAISE EXCEPTION 'Invalid featured skills';END IF;
 UPDATE lub.student_skills SET is_featured=false WHERE user_id=owner_id;
 FOR entry IN SELECT value FROM jsonb_array_elements(selection) LOOP
  IF jsonb_typeof(entry) IS DISTINCT FROM 'object' OR jsonb_typeof(entry->'key') IS DISTINCT FROM 'string' OR jsonb_typeof(entry->'featured') IS DISTINCT FROM 'boolean' OR EXISTS(SELECT 1 FROM jsonb_object_keys(entry) k WHERE k NOT IN('key','featured')) THEN RAISE EXCEPTION 'Invalid skill item';END IF;
  target:=lub.resolve_profile_skill_key(entry->>'key');
  IF target=ANY(chosen) THEN RAISE EXCEPTION 'Duplicate skill';END IF;
  chosen:=array_append(chosen,target);
  INSERT INTO lub.student_skills(user_id,skill_id,is_public,sort_order,is_featured) VALUES(owner_id,target,true,position,(entry->>'featured')::boolean) ON CONFLICT(user_id,skill_id) DO UPDATE SET sort_order=excluded.sort_order,is_featured=excluded.is_featured,is_public=true;
  position:=position+1;
 END LOOP;
 DELETE FROM lub.student_skills WHERE user_id=owner_id AND NOT(skill_id=ANY(chosen));
 PERFORM lub.task_audit(owner_id,NULL,'TALENT_SKILLS_UPDATED');
 RETURN lub.profile_skill_details(owner_id,false);
END; $$;
REVOKE ALL ON FUNCTION lub.save_profile_skill_selection(uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lub.save_profile_skill_selection(uuid,jsonb) TO authenticated;
CREATE FUNCTION lub.set_activity_skill_tags(kind text,target uuid,keys jsonb,expected int) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE task lub.tasks;event lub.events;entry jsonb;skill uuid;
BEGIN
 IF kind='Task' THEN
  SELECT * INTO task FROM lub.tasks WHERE id=target FOR UPDATE;
  IF task.id IS NULL OR NOT lub.can_manage_task(target) OR task.status_code NOT IN('Draft','Open') OR task.revision IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Task permission required' USING ERRCODE='42501';END IF;
 ELSIF kind='Event' THEN
  SELECT * INTO event FROM lub.events WHERE id=target FOR UPDATE;
  IF event.id IS NULL OR NOT lub.has_org_permission(event.organization_id,'EVENTS_MANAGE') OR event.status_code NOT IN('Draft','Published') OR event.revision IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Event permission required' USING ERRCODE='42501';END IF;
 ELSE RAISE EXCEPTION 'Invalid activity';END IF;
 IF jsonb_typeof(keys) IS DISTINCT FROM 'array' OR jsonb_array_length(keys)>30 THEN RAISE EXCEPTION 'Invalid skill tags';END IF;
 IF kind='Task' THEN DELETE FROM lub.task_skill_tags WHERE task_id=target;ELSE DELETE FROM lub.event_skill_tags WHERE event_id=target;END IF;
 FOR entry IN SELECT value FROM jsonb_array_elements(keys) LOOP
  IF jsonb_typeof(entry) IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'Invalid skill key';END IF;
  skill:=lub.resolve_profile_skill_key(entry#>>'{}');
  IF kind='Task' THEN INSERT INTO lub.task_skill_tags VALUES(target,skill) ON CONFLICT DO NOTHING;ELSE INSERT INTO lub.event_skill_tags VALUES(target,skill) ON CONFLICT DO NOTHING;END IF;
 END LOOP;
 IF kind='Task' THEN UPDATE lub.tasks SET revision=revision+1,updated_at=now() WHERE id=target;ELSE UPDATE lub.events SET revision=revision+1,updated_at=now() WHERE id=target;END IF;
END; $$;
REVOKE ALL ON FUNCTION lub.set_activity_skill_tags(text,uuid,jsonb,int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lub.set_activity_skill_tags(text,uuid,jsonb,int) TO authenticated;
