CREATE FUNCTION lub.link_task_event(target uuid,event uuid,expected int) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE task lub.tasks%ROWTYPE;activity lub.events%ROWTYPE;
BEGIN
 SELECT * INTO task FROM lub.tasks WHERE id=target FOR UPDATE;
 IF task.id IS NULL OR NOT lub.can_manage_task(target) OR task.status_code NOT IN ('Draft','Open') OR task.revision IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Editable scoped task required' USING ERRCODE='42501';END IF;
 IF event IS NOT NULL THEN
  SELECT * INTO activity FROM lub.events WHERE id=event FOR SHARE;
  IF activity.id IS NULL OR activity.organization_id<>task.organization_id OR activity.status_code='Cancelled' OR (activity.published_at IS NULL AND NOT lub.can_operate_event(activity.id)) THEN RAISE EXCEPTION 'Visible same-organization event required' USING ERRCODE='42501';END IF;
 END IF;
 IF task.event_id IS DISTINCT FROM event THEN UPDATE lub.tasks SET event_id=event,revision=revision+1,updated_at=now() WHERE id=target;END IF;
END; $$;
REVOKE ALL ON FUNCTION lub.link_task_event(uuid,uuid,int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lub.link_task_event(uuid,uuid,int) TO authenticated;
