-- Only the owner may withdraw a pending submission; keep original content and attachments.
CREATE FUNCTION lub.withdraw_task_submission(target uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE task uuid;t lub.tasks;p lub.task_participants;s lub.task_submissions;
BEGIN
 SELECT part.task_id INTO task FROM lub.task_submissions sub JOIN lub.task_participants part ON part.id=sub.task_participant_id WHERE sub.id=target;
 SELECT * INTO t FROM lub.tasks WHERE id=task FOR UPDATE;
 SELECT part.* INTO p FROM lub.task_participants part JOIN lub.task_submissions sub ON sub.task_participant_id=part.id WHERE sub.id=target FOR UPDATE OF part;
 SELECT * INTO s FROM lub.task_submissions WHERE id=target FOR UPDATE;
 IF t.id IS NULL OR t.status_code<>'Open' OR NOT lub.can_read_task(task) OR NOT lub.owns_task_participant(p.id)
 OR p.status_code<>'Submitted' OR s.status_code<>'Submitted' OR s.withdrawn_at IS NOT NULL
 THEN RAISE EXCEPTION 'Own pending submission required' USING ERRCODE='42501';END IF;
 UPDATE lub.task_submissions SET withdrawn_at=clock_timestamp() WHERE id=target;
 UPDATE lub.task_participants SET status_code='In_Progress',closed_at=NULL WHERE id=p.id;
 PERFORM lub.task_audit(target,t.organization_id,'TASK_SUBMISSION_WITHDRAWN');
END;$$;
REVOKE ALL ON FUNCTION lub.withdraw_task_submission(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION lub.withdraw_task_submission(uuid) TO authenticated;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.review_task_submission_decision(target uuid, decision text, note text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE status text:=CASE WHEN decision='Approved' THEN 'Approved' ELSE 'Rejected' END;hours numeric;task uuid; t lub.tasks; p lub.task_participants; s lub.task_submissions;
BEGIN
 IF decision IS NULL OR decision NOT IN('Approved','Changes_Requested','Rejected') THEN RAISE EXCEPTION 'Invalid decision'; END IF;
 SELECT part.task_id INTO task FROM lub.task_submissions sub JOIN lub.task_participants part ON part.id=sub.task_participant_id WHERE sub.id=target;
 SELECT * INTO t FROM lub.tasks WHERE id=task FOR UPDATE;
 SELECT part.* INTO p FROM lub.task_participants part JOIN lub.task_submissions sub ON sub.task_participant_id=part.id WHERE sub.id=target FOR UPDATE OF part;
 hours:=p.approved_hours_override;
 SELECT * INTO s FROM lub.task_submissions WHERE id=target FOR UPDATE;
 IF t.id IS NULL OR t.status_code<>'Open' OR NOT lub.can_manage_task(task) THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 IF p.status_code<>'Submitted' OR s.status_code<>'Submitted' OR status NOT IN ('Approved','Rejected') OR status IS NULL OR note IS NULL OR length(note)>3000 OR (status='Rejected' AND length(trim(note))=0) OR (hours IS NOT NULL AND (status<>'Approved' OR hours<0 OR hours>1000 OR hours::text IN ('NaN','Infinity','-Infinity'))) THEN RAISE EXCEPTION 'Invalid review'; END IF;
 UPDATE lub.task_submissions SET status_code=status,review_decision_code=decision,review_note=trim(note),reviewed_at=now(),reviewed_by_user_id=auth.uid() WHERE id=target;
 UPDATE lub.task_participants SET status_code=CASE WHEN status='Approved' THEN 'Approved' ELSE 'In_Progress' END,closed_at=CASE WHEN status='Approved' THEN now() END,reviewed_by_user_id=auth.uid(),approved_hours_override=CASE WHEN status='Approved' THEN hours END WHERE id=p.id;
 PERFORM lub.task_notify(task,p.user_id,'TASK_REVIEWED'); PERFORM lub.task_audit(target,t.organization_id,'TASK_REVIEWED');
END; $function$
;

NOTIFY pgrst,'reload schema';
