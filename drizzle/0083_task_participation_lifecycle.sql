-- Preserve existing participation, revisions and submission IDs across withdrawal/rejoining.
ALTER TABLE lub.task_participants ADD COLUMN withdrawn_at timestamptz;
ALTER TABLE lub.task_submissions ADD COLUMN withdrawn_at timestamptz, ADD COLUMN review_decision_code text CHECK(review_decision_code IS NULL OR review_decision_code IN('Approved','Changes_Requested','Rejected'));
ALTER TABLE lub.task_participants ALTER COLUMN status_code SET DEFAULT 'In_Progress';
ALTER TABLE lub.task_participants ADD CONSTRAINT task_withdrawal_state_check CHECK(withdrawn_at IS NULL OR status_code='Closed');
ALTER TABLE lub.task_submissions ADD CONSTRAINT submission_withdrawal_state_check CHECK(withdrawn_at IS NULL OR status_code='Submitted');
DROP INDEX lub.one_pending_task_submission_idx;
CREATE UNIQUE INDEX one_pending_task_submission_idx ON lub.task_submissions(task_participant_id) WHERE status_code='Submitted' AND withdrawn_at IS NULL;
-- Earlier user-initiated withdrawals are identified by their recorded closure audit only.
UPDATE lub.task_participants p SET withdrawn_at=p.closed_at WHERE p.status_code='Closed' AND (
 SELECT a.action_code FROM lub.audit_log a WHERE a.entity_id=p.id AND a.action_code IN('TASK_PARTICIPANT_WITHDREW','TASK_PARTICIPATION_CLOSED') ORDER BY a.created_at DESC,a.id DESC LIMIT 1
)='TASK_PARTICIPANT_WITHDREW';

--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.guard_task_submission() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Submissions are immutable'; END IF;
 IF OLD.status_code='Submitted' AND OLD.withdrawn_at IS NULL AND NEW.withdrawn_at IS NOT NULL
  AND lub.owns_task_participant(OLD.task_participant_id)
  AND (to_jsonb(OLD)-'withdrawn_at') IS NOT DISTINCT FROM (to_jsonb(NEW)-'withdrawn_at') THEN RETURN NEW; END IF;
 IF OLD.status_code<>'Submitted' OR OLD.withdrawn_at IS NOT NULL OR NEW.status_code NOT IN('Approved','Rejected')
  OR (to_jsonb(OLD)-'status_code'-'review_note'-'reviewed_at'-'reviewed_by_user_id'-'review_decision_code') IS DISTINCT FROM (to_jsonb(NEW)-'status_code'-'review_note'-'reviewed_at'-'reviewed_by_user_id'-'review_decision_code') THEN RAISE EXCEPTION 'Submission content and final reviews are immutable'; END IF;
 RETURN NEW;
END; $$;

--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.join_task(target uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t lub.tasks;member uuid;p lub.task_participants;result uuid;
BEGIN
 SELECT * INTO t FROM lub.tasks WHERE id=target FOR UPDATE;
 IF t.id IS NULL OR t.status_code<>'Open' OR (t.starts_at IS NOT NULL AND t.starts_at>now()) OR NOT(lub.task_scope_member(t.organization_id,t.committee_id) OR lub.can_manage_task(t.id)) THEN RAISE EXCEPTION 'Participation unavailable' USING ERRCODE='42501'; END IF;
 SELECT id INTO member FROM lub.organization_memberships WHERE organization_id=t.organization_id AND user_id=auth.uid() AND merged_into IS NULL AND status_code='Active' AND start_date<=current_date AND (end_date IS NULL OR end_date>current_date) FOR UPDATE;
 IF member IS NULL OR NOT EXISTS(SELECT 1 FROM lub.student_profiles WHERE user_id=auth.uid()) THEN RAISE EXCEPTION 'Active member required'; END IF;
 SELECT * INTO p FROM lub.task_participants WHERE task_id=target AND user_id=auth.uid() FOR UPDATE;
 IF p.id IS NULL THEN
  INSERT INTO lub.task_participants(task_id,organization_membership_id,user_id,status_code,joined_at) VALUES(target,member,auth.uid(),'In_Progress',clock_timestamp()) RETURNING id INTO result;
 ELSIF p.status_code='Closed' AND p.withdrawn_at IS NOT NULL THEN
  UPDATE lub.task_participants SET organization_membership_id=member,status_code='In_Progress',joined_at=clock_timestamp(),closed_at=NULL,withdrawn_at=NULL,reviewed_by_user_id=NULL WHERE id=p.id RETURNING id INTO result;
 ELSE RAISE EXCEPTION 'Participation unavailable'; END IF;
 PERFORM lub.task_audit(result,t.organization_id,'TASK_JOINED');RETURN result;
END; $$;

--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.withdraw_task_participation(target uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$

DECLARE task uuid; t lub.tasks; p lub.task_participants;

BEGIN

 SELECT task_id INTO task FROM lub.task_participants WHERE id=target;

 SELECT * INTO t FROM lub.tasks WHERE id=task FOR UPDATE;

 SELECT * INTO p FROM lub.task_participants WHERE id=target FOR UPDATE;

 IF t.id IS NULL OR t.status_code<>'Open' OR NOT lub.can_read_task(task) OR NOT lub.owns_task_participant(target) OR p.status_code NOT IN ('Joined','In_Progress','Submitted') THEN RAISE EXCEPTION 'Participation unavailable' USING ERRCODE='42501'; END IF;

 UPDATE lub.task_submissions SET withdrawn_at=clock_timestamp() WHERE task_participant_id=target AND status_code='Submitted' AND withdrawn_at IS NULL;
 UPDATE lub.task_participants SET status_code='Closed',closed_at=now(),withdrawn_at=clock_timestamp() WHERE id=target;

 PERFORM lub.task_audit(target,t.organization_id,'TASK_PARTICIPANT_WITHDREW');

END; $function$
;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.close_task_participant(target uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE task uuid; t lub.tasks; p lub.task_participants;
BEGIN
 SELECT task_id INTO task FROM lub.task_participants WHERE id=target;SELECT * INTO t FROM lub.tasks WHERE id=task FOR UPDATE;SELECT * INTO p FROM lub.task_participants WHERE id=target FOR UPDATE;
 IF t.id IS NULL OR t.status_code<>'Open' OR NOT lub.can_manage_task(task) OR p.status_code NOT IN ('Joined','In_Progress','Submitted') THEN RAISE EXCEPTION 'Participation unavailable'; END IF;
 UPDATE lub.task_participants SET status_code='Closed',closed_at=now(),withdrawn_at=NULL,reviewed_by_user_id=auth.uid() WHERE id=target;
 PERFORM lub.task_notify(task,p.user_id,'TASK_PARTICIPATION_CLOSED');PERFORM lub.task_audit(target,t.organization_id,'TASK_PARTICIPATION_CLOSED');
END; $function$
;
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
 UPDATE lub.task_participants SET status_code=CASE WHEN status='Approved' THEN 'Approved' WHEN decision='Rejected' THEN 'Closed' ELSE 'In_Progress' END,closed_at=CASE WHEN status='Approved' OR decision='Rejected' THEN now() END,reviewed_by_user_id=auth.uid(),approved_hours_override=CASE WHEN status='Approved' THEN hours END WHERE id=p.id;
 PERFORM lub.task_notify(task,p.user_id,'TASK_REVIEWED'); PERFORM lub.task_audit(target,t.organization_id,'TASK_REVIEWED');
END; $function$
;
--> statement-breakpoint
REVOKE ALL ON FUNCTION lub.review_task_submission_decision(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION lub.review_task_submission_decision(uuid,text,text) TO authenticated;
-- Retain the historical definition, but retire its public API: joining now starts work.
REVOKE ALL ON FUNCTION lub.start_task_participation(uuid) FROM authenticated,anon,PUBLIC;


--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.task_summary(target uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT CASE WHEN lub.can_read_task(target) THEN (SELECT jsonb_build_object('participants',count(*) FILTER(WHERE p.status_code<>'Closed'),'submitted',count(*) FILTER(WHERE p.status_code IN('Submitted','Approved'))) FROM lub.task_participants p WHERE p.task_id=target AND lub.is_counted_student(p.user_id)) END;
$$;
