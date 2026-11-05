-- Withdrawal is a retained owner action, never an administrative review.
ALTER TABLE lub.hour_records DROP CONSTRAINT hour_record_state_check;
ALTER TABLE lub.hour_records ADD CONSTRAINT hour_record_state_check CHECK (
 status_code IN ('Pending','Approved','Rejected','Voided','Withdrawn')
 AND (status_code='Pending')=(reviewed_at IS NULL)
 AND (reviewed_at IS NULL)=(reviewed_by_user_id IS NULL)
 AND (status_code NOT IN ('Rejected','Voided') OR length(trim(review_note))>0)
 AND (status_code<>'Withdrawn' OR source_code='SELF_REPORTED')
);
ALTER TABLE lub.hour_decisions DROP CONSTRAINT hour_decision_state_check;
ALTER TABLE lub.hour_decisions ADD CONSTRAINT hour_decision_state_check CHECK(status_code IN ('Approved','Rejected','Voided','Withdrawn') AND length(note)<=3000);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.guard_hour_record() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$

BEGIN

 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Hours history is immutable'; END IF;

 IF NEW.hours IS DISTINCT FROM OLD.hours THEN

  IF (to_jsonb(NEW)-ARRAY['hours','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['hours','updated_at']) OR NOT EXISTS(

   SELECT 1 FROM lub.hour_adjustments a WHERE a.hour_record_id=OLD.id AND a.before_hours=OLD.hours AND a.after_hours=NEW.hours AND a.actor_user_id=auth.uid() AND a.transaction_id=pg_catalog.pg_current_xact_id()::text

  ) THEN RAISE EXCEPTION 'Documented adjustment required'; END IF;

  RETURN NEW;

 END IF;

 IF (to_jsonb(NEW)-ARRAY['status_code','reviewed_by_user_id','reviewed_at','review_note','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status_code','reviewed_by_user_id','reviewed_at','review_note','updated_at']) OR NOT ((OLD.status_code='Pending' AND (NEW.status_code IN ('Approved','Rejected') OR (NEW.status_code='Withdrawn' AND OLD.source_code='SELF_REPORTED' AND OLD.requested_by_user_id=auth.uid() AND lub.owns_membership(OLD.organization_membership_id)))) OR (OLD.status_code='Approved' AND NEW.status_code='Voided')) THEN RAISE EXCEPTION 'Invalid hours transition'; END IF;

 RETURN NEW;

END; $$;


--> statement-breakpoint
CREATE FUNCTION lub.withdraw_self_report_hours(target uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE h lub.hour_records;
BEGIN
 SELECT * INTO h FROM lub.hour_records WHERE id=target FOR UPDATE;
 IF h.id IS NULL OR h.source_code<>'SELF_REPORTED' OR h.status_code<>'Pending'
  OR h.requested_by_user_id IS DISTINCT FROM auth.uid() OR NOT lub.owns_membership(h.organization_membership_id)
 THEN RAISE EXCEPTION 'Pending own self-report required' USING ERRCODE='42501'; END IF;
 UPDATE lub.hour_records SET status_code='Withdrawn',reviewed_by_user_id=auth.uid(),reviewed_at=now(),review_note='',updated_at=now() WHERE id=target;
END; $$;
REVOKE ALL ON FUNCTION lub.withdraw_self_report_hours(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION lub.withdraw_self_report_hours(uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
