CREATE TABLE "lub"."hour_adjustments" (

	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,

	"hour_record_id" uuid NOT NULL,

	"before_hours" numeric(6, 2) NOT NULL,

	"after_hours" numeric(6, 2) NOT NULL,

	"actor_user_id" uuid NOT NULL,

	"actor_name" text NOT NULL,

	"note" text NOT NULL,

	"transaction_id" text NOT NULL,

	"created_at" timestamp with time zone DEFAULT now() NOT NULL,

	CONSTRAINT "hour_adjustment_bounds" CHECK ("lub"."hour_adjustments"."before_hours" between 0 and 1000 and "lub"."hour_adjustments"."after_hours" between 0 and 1000 and "lub"."hour_adjustments"."before_hours"<>"lub"."hour_adjustments"."after_hours" and length("lub"."hour_adjustments"."note")<=1000)

);

--> statement-breakpoint

ALTER TABLE "lub"."hour_adjustments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

ALTER TABLE "lub"."hour_adjustments" ADD CONSTRAINT "hour_adjustments_hour_record_id_hour_records_id_fk" FOREIGN KEY ("hour_record_id") REFERENCES "lub"."hour_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "lub"."hour_adjustments" ADD CONSTRAINT "hour_adjustments_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "lub"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

CREATE INDEX "hour_adjustment_record_idx" ON "lub"."hour_adjustments" USING btree ("hour_record_id","created_at");

--> statement-breakpoint

GRANT SELECT ON lub.hour_adjustments TO authenticated;

CREATE POLICY hour_adjustments_read ON lub.hour_adjustments FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM lub.hour_records h WHERE h.id=hour_record_id));

CREATE TRIGGER hour_adjustments_immutable BEFORE UPDATE OR DELETE ON lub.hour_adjustments FOR EACH ROW EXECUTE FUNCTION lub.guard_task_revision();

CREATE OR REPLACE FUNCTION lub.guard_hour_record() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$

BEGIN

 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Hours history is immutable'; END IF;

 IF NEW.hours IS DISTINCT FROM OLD.hours THEN

  IF (to_jsonb(NEW)-ARRAY['hours','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['hours','updated_at']) OR NOT EXISTS(

   SELECT 1 FROM lub.hour_adjustments a WHERE a.hour_record_id=OLD.id AND a.before_hours=OLD.hours AND a.after_hours=NEW.hours AND a.actor_user_id=auth.uid() AND a.transaction_id=pg_catalog.pg_current_xact_id()::text

  ) THEN RAISE EXCEPTION 'Documented adjustment required'; END IF;

  RETURN NEW;

 END IF;

 IF (to_jsonb(NEW)-ARRAY['status_code','reviewed_by_user_id','reviewed_at','review_note','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status_code','reviewed_by_user_id','reviewed_at','review_note','updated_at']) OR NOT ((OLD.status_code='Pending' AND NEW.status_code IN ('Approved','Rejected')) OR (OLD.status_code='Approved' AND NEW.status_code='Voided')) THEN RAISE EXCEPTION 'Invalid hours transition'; END IF;

 RETURN NEW;

END; $$;

CREATE OR REPLACE FUNCTION lub.hour_record_event() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$

DECLARE recipient uuid;

BEGIN

 IF NEW.status_code<>'Pending' AND (TG_OP='INSERT' OR NEW.status_code IS DISTINCT FROM OLD.status_code) THEN

  INSERT INTO lub.hour_decisions(hour_record_id,status_code,actor_user_id,note) VALUES(NEW.id,NEW.status_code,NEW.reviewed_by_user_id,coalesce(NEW.review_note,''));

 END IF;

 SELECT user_id INTO recipient FROM lub.organization_memberships WHERE id=NEW.organization_membership_id;

 PERFORM lub.workflow_notify(recipient,'HOURS_CHANGED','/hours');

 PERFORM lub.task_audit(NEW.id,NEW.organization_id,CASE WHEN TG_OP='UPDATE' AND NEW.hours IS DISTINCT FROM OLD.hours THEN 'HOURS_ADJUSTED' ELSE 'HOURS_'||NEW.status_code END);

 RETURN NEW;

END; $$;

CREATE FUNCTION lub.adjust_hours(target uuid,delta numeric,expected numeric,reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$

DECLARE h lub.hour_records; actor text;

BEGIN

 SELECT * INTO h FROM lub.hour_records WHERE id=target FOR UPDATE;

 IF h.id IS NULL OR NOT lub.can_approve_hours(h.organization_id,h.committee_id) THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;

 IF h.status_code NOT IN ('Pending','Approved') OR h.hours IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Record changed'; END IF;

 IF delta IS NULL OR delta=0 OR delta::text IN ('NaN','Infinity','-Infinity') OR delta<>round(delta,2) OR h.hours+delta<0 OR h.hours+delta>1000 OR reason IS NULL OR length(reason)>1000 THEN RAISE EXCEPTION 'Invalid adjustment'; END IF;

 SELECT full_name_ar INTO actor FROM lub.student_profiles WHERE user_id=auth.uid();

 INSERT INTO lub.hour_adjustments(hour_record_id,before_hours,after_hours,actor_user_id,actor_name,note,transaction_id) VALUES(h.id,h.hours,h.hours+delta,auth.uid(),coalesce(actor,'عضو'),trim(reason),pg_catalog.pg_current_xact_id()::text);

 UPDATE lub.hour_records SET hours=h.hours+delta,updated_at=clock_timestamp() WHERE id=h.id;

END; $$;

REVOKE ALL ON FUNCTION lub.adjust_hours(uuid,numeric,numeric,text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION lub.adjust_hours(uuid,numeric,numeric,text) TO authenticated;

CREATE FUNCTION lub.hour_record_context(target uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$

 SELECT jsonb_build_object('major',p.major_name,'level',p.academic_level,'committee_name',c.name,'added_by',a.full_name_ar) FROM lub.hour_records h

 JOIN lub.organization_memberships m ON m.id=h.organization_membership_id JOIN lub.student_profiles p ON p.user_id=m.user_id

 LEFT JOIN lub.committees c ON c.id=h.committee_id LEFT JOIN lub.student_profiles a ON a.user_id=h.requested_by_user_id

 WHERE h.id=target AND (lub.owns_membership(m.id) OR lub.can_approve_hours(h.organization_id,h.committee_id) OR lub.has_org_permission(h.organization_id,'HOURS_MANUAL_ADD',h.committee_id));

$$;

REVOKE ALL ON FUNCTION lub.hour_record_context(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION lub.hour_record_context(uuid) TO authenticated;



CREATE FUNCTION lub.add_hours(member uuid,committee uuid,term uuid,amount numeric,day date,reason text,self_report boolean,confirm_duplicate boolean) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$

DECLARE m lub.organization_memberships; result uuid; approved boolean;

BEGIN

 SELECT * INTO m FROM lub.organization_memberships WHERE id=member FOR UPDATE;

 IF m.id IS NULL OR m.status_code<>'Active' OR m.start_date>current_date OR (m.end_date IS NOT NULL AND m.end_date<=current_date) OR NOT EXISTS(SELECT 1 FROM lub.users WHERE id=m.user_id AND status_code='Active') THEN RAISE EXCEPTION 'Active member required'; END IF;

 IF NOT EXISTS(SELECT 1 FROM lub.academic_terms WHERE id=term AND day BETWEEN start_date AND end_date) OR day> (statement_timestamp() AT TIME ZONE 'Asia/Riyadh')::date OR day<m.start_date THEN RAISE EXCEPTION 'Invalid activity date'; END IF;

 IF committee IS NOT NULL AND NOT EXISTS(SELECT 1 FROM lub.committee_memberships cm JOIN lub.committees c ON c.id=cm.committee_id WHERE cm.organization_membership_id=member AND cm.committee_id=committee AND c.organization_id=m.organization_id AND c.status_code='Active' AND cm.status_code='Active' AND cm.start_date<=current_date AND (cm.end_date IS NULL OR cm.end_date>current_date)) THEN RAISE EXCEPTION 'Committee mismatch'; END IF;

 IF self_report THEN

  IF NOT lub.owns_membership(member) OR NOT lub.task_scope_member(m.organization_id,committee) OR NOT EXISTS(SELECT 1 FROM lub.organizations WHERE id=m.organization_id AND self_report_hours_enabled) THEN RAISE EXCEPTION 'Self report unavailable' USING ERRCODE='42501'; END IF;

  approved:=false;

 ELSE

  IF NOT lub.has_org_permission(m.organization_id,'HOURS_MANUAL_ADD',committee) THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;

  approved:=lub.can_approve_hours(m.organization_id,committee);

 END IF;

 IF amount IS NULL OR amount<0 OR amount>1000 OR amount::text IN ('NaN','Infinity','-Infinity') OR amount<>round(amount,2) THEN RAISE EXCEPTION 'Invalid amount'; END IF;

 IF NOT confirm_duplicate AND EXISTS(SELECT 1 FROM lub.hour_records h WHERE h.organization_membership_id=member AND h.activity_date=day AND h.hours=amount AND trim(h.description)=trim(reason) AND h.status_code<>'Voided') THEN RAISE EXCEPTION 'Duplicate hours' USING ERRCODE='P0003'; END IF;

 INSERT INTO lub.hour_records(organization_id,organization_membership_id,committee_id,academic_term_id,source_code,hours,activity_date,description,status_code,requested_by_user_id,reviewed_by_user_id,reviewed_at,review_note)

 VALUES(m.organization_id,member,committee,term,CASE WHEN self_report THEN 'SELF_REPORTED' ELSE 'MANUAL' END,amount,day,trim(reason),CASE WHEN approved THEN 'Approved' ELSE 'Pending' END,auth.uid(),CASE WHEN approved THEN auth.uid() END,CASE WHEN approved THEN now() END,CASE WHEN approved THEN trim(reason) END) RETURNING id INTO result;

 RETURN result;

END; $$;

REVOKE ALL ON FUNCTION lub.add_hours(uuid,uuid,uuid,numeric,date,text,boolean,boolean) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION lub.add_hours(uuid,uuid,uuid,numeric,date,text,boolean,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION lub.add_hours(member uuid,committee uuid,term uuid,amount numeric,day date,reason text,self_report boolean DEFAULT false) RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT lub.add_hours(member,committee,term,amount,day,reason,self_report,false); $$;


--> statement-breakpoint
CREATE FUNCTION lub.export_hours_csv(org uuid, committee uuid, term uuid,status text,query text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE organization_name text; scope_name text; period_label text; record_count integer; total text; table_rows text; content text;
BEGIN
 IF NOT(lub.has_org_permission(org,'REPORTS_GENERATE') OR (committee IS NOT NULL AND lub.has_org_permission(org,'REPORTS_GENERATE',committee)))
   OR NOT EXISTS(SELECT 1 FROM lub.student_profiles WHERE user_id=auth.uid()) THEN
  RAISE EXCEPTION 'Hours export permission required' USING ERRCODE='42501';
 END IF;
 IF status IS NOT NULL AND status NOT IN ('Approved','Pending','Rejected') THEN RAISE EXCEPTION 'Invalid status'; END IF;
 IF length(query)>120 THEN RAISE EXCEPTION 'Invalid search'; END IF;
 IF committee IS NOT NULL AND NOT EXISTS(SELECT 1 FROM lub.committees WHERE id=committee AND organization_id=org AND status_code='Active') THEN
  RAISE EXCEPTION 'Invalid committee';
 END IF;
 SELECT name_ar INTO organization_name FROM lub.organizations WHERE id=org;
 IF organization_name IS NULL THEN RAISE EXCEPTION 'Organization unavailable' USING ERRCODE='42501'; END IF;
 scope_name:='الجهة بالكامل';
 IF committee IS NOT NULL THEN SELECT name INTO scope_name FROM lub.committees WHERE id=committee; END IF;
 period_label:='كل التاريخ';
 IF term IS NOT NULL THEN
  SELECT name_ar||' · '||academic_year INTO period_label FROM lub.academic_terms WHERE id=term;
  IF period_label IS NULL THEN RAISE EXCEPTION 'Unknown academic term'; END IF;
 END IF;
 WITH selected AS MATERIALIZED(
  SELECT h.id,h.organization_membership_id,h.hours,h.activity_date,p.full_name_ar AS name
  FROM lub.hour_records h
  JOIN lub.organization_memberships m ON m.id=h.organization_membership_id
  JOIN lub.student_profiles p ON p.user_id=m.user_id
  WHERE h.organization_id=org AND (status IS NULL OR h.status_code=status) AND (query='' OR position(lower(query) in lower(p.full_name_ar))>0)
    AND (committee IS NULL OR h.committee_id=committee)
    AND (term IS NULL OR h.academic_term_id=term)
  ORDER BY h.activity_date,h.id LIMIT 5001
 ), grouped AS(
  SELECT organization_membership_id,name,sum(hours)::text AS hours,count(*)::int AS records,
    min(activity_date)::text AS first_date,max(activity_date)::text AS last_date
  FROM selected GROUP BY organization_membership_id,name
 )
 SELECT (SELECT count(*)::int FROM selected),
   coalesce((SELECT sum(hours)::text FROM selected),'0'),
   coalesce((SELECT string_agg(
     lub.export_csv(organization_name)||','||lub.export_csv(scope_name)||','||lub.export_csv(period_label)||','||
     lub.export_csv(g.name)||','||lub.export_csv(g.hours)||','||lub.export_csv(g.records::text)||','||
     lub.export_csv(g.first_date)||','||lub.export_csv(g.last_date),chr(13)||chr(10)
     ORDER BY g.name,g.organization_membership_id) FROM grouped g),'')
 INTO record_count,total,table_rows;
 IF record_count>5000 THEN RAISE EXCEPTION 'Export too large; select a term'; END IF;
 content:='"الجهة","النطاق","الفترة","الاسم","الساعات","عدد السجلات","أول نشاط","آخر نشاط"'||chr(13)||chr(10)||
   table_rows||chr(13)||chr(10)||lub.export_csv(organization_name)||','||lub.export_csv(scope_name)||','||
   lub.export_csv(period_label)||',"الإجمالي",'||lub.export_csv(total)||','||lub.export_csv(record_count::text)||',"",""'||chr(13)||chr(10);
 INSERT INTO lub.audit_log(actor_user_id,action_code,entity_type,entity_id,organization_id)
 VALUES(auth.uid(),'HOURS_CSV_EXPORTED','hours_export',org,org);
 RETURN content;
END; $$;--> statement-breakpoint
REVOKE ALL ON FUNCTION lub.export_hours_csv(uuid,uuid,uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lub.export_hours_csv(uuid,uuid,uuid,text,text) TO authenticated;

--> statement-breakpoint
CREATE FUNCTION lub.form_last_updated(target uuid) RETURNS timestamptz LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT greatest(t.created_at,coalesce((select max(a.created_at) from lub.audit_log a where a.action_code like 'FORM_%' and (a.entity_id=t.id or a.entity_id in (select v.id from lub.form_versions v where v.form_template_id=t.id))),t.created_at)) FROM lub.form_templates t WHERE t.id=target AND lub.can_read_template(t.id);
$$;
REVOKE ALL ON FUNCTION lub.form_last_updated(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lub.form_last_updated(uuid) TO authenticated;
