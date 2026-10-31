CREATE FUNCTION lub.activity_skill_selection(kind text,target uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH selected AS(
 SELECT tag.skill_id FROM lub.task_skill_tags tag WHERE kind='Task' AND tag.task_id=target AND lub.can_manage_task(target)
 UNION SELECT tag.skill_id FROM lub.event_skill_tags tag WHERE kind='Event' AND tag.event_id=target AND lub.can_operate_event(target)
 )
 SELECT coalesce(jsonb_agg(jsonb_build_object('key',coalesce(s.dictionary_key,'custom:'||lub.skill_key(s.name_ar)),'labelAr',coalesce(d.name_ar,s.name_ar),'labelEn',coalesce(d.name_en,s.name_en,s.name_ar),'category',jsonb_build_object('key',c.code,'labelAr',c.name_ar,'labelEn',c.name_en),'featured',false,'order',0,'tasks',0,'events',0,'filterValue',s.name_ar) ORDER BY coalesce(d.name_en,s.name_en,s.name_ar)),'[]') FROM selected x JOIN lub.skills s ON s.id=x.skill_id LEFT JOIN lub.skill_dictionary d ON d.key=s.dictionary_key JOIN lub.skill_categories c ON c.code=coalesce(d.category_code,'other');
$$;
REVOKE ALL ON FUNCTION lub.activity_skill_selection(text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lub.activity_skill_selection(text,uuid) TO authenticated;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.set_activity_skill_tags(kind text,target uuid,keys jsonb,expected int) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE task lub.tasks;event lub.events;entry jsonb;skill uuid;chosen uuid[]:='{}';current_keys uuid[];
BEGIN
 IF kind='Task' THEN
  SELECT * INTO task FROM lub.tasks WHERE id=target FOR UPDATE;
  IF task.id IS NULL OR NOT lub.can_manage_task(target) OR task.status_code NOT IN('Draft','Open') OR task.revision IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Task permission required' USING ERRCODE='42501';END IF;
 ELSIF kind='Event' THEN
  SELECT * INTO event FROM lub.events WHERE id=target FOR UPDATE;
  IF event.id IS NULL OR NOT lub.has_org_permission(event.organization_id,'EVENTS_MANAGE') OR event.status_code NOT IN('Draft','Published') OR event.revision IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Event permission required' USING ERRCODE='42501';END IF;
 ELSE RAISE EXCEPTION 'Invalid activity';END IF;
 IF jsonb_typeof(keys) IS DISTINCT FROM 'array' OR jsonb_array_length(keys)>30 THEN RAISE EXCEPTION 'Invalid skill tags';END IF;
 FOR entry IN SELECT value FROM jsonb_array_elements(keys) LOOP
  IF jsonb_typeof(entry) IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'Invalid skill key';END IF;
  skill:=lub.resolve_profile_skill_key(entry#>>'{}');
  IF skill=ANY(chosen) THEN RAISE EXCEPTION 'Duplicate skill key';END IF;
  chosen:=array_append(chosen,skill);
 END LOOP;
 IF kind='Task' THEN SELECT coalesce(array_agg(skill_id),'{}') INTO current_keys FROM lub.task_skill_tags WHERE task_id=target;
 ELSE SELECT coalesce(array_agg(skill_id),'{}') INTO current_keys FROM lub.event_skill_tags WHERE event_id=target;END IF;
 IF chosen@>current_keys AND current_keys@>chosen THEN RETURN;END IF;
 IF kind='Task' THEN
  DELETE FROM lub.task_skill_tags WHERE task_id=target;
  INSERT INTO lub.task_skill_tags SELECT target,unnest(chosen);
 ELSE
  DELETE FROM lub.event_skill_tags WHERE event_id=target;
  INSERT INTO lub.event_skill_tags SELECT target,unnest(chosen);
 END IF;
 PERFORM lub.task_audit(target,coalesce(task.organization_id,event.organization_id),'ACTIVITY_SKILLS_CHANGED');
 IF kind='Task' THEN UPDATE lub.tasks SET revision=revision+1,updated_at=now() WHERE id=target;ELSE UPDATE lub.events SET revision=revision+1,updated_at=now() WHERE id=target;END IF;
END; $$;
