ALTER TABLE lub.registration_rounds ADD COLUMN minimum_approved_hours numeric(10,2) NOT NULL DEFAULT 0 CHECK(minimum_approved_hours>=0 AND minimum_approved_hours<=100000),ADD COLUMN allowed_majors jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(allowed_majors)='array' AND jsonb_array_length(allowed_majors)<=3);
CREATE FUNCTION lub.set_round_requirements(target uuid,hours numeric,majors jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r lub.registration_rounds;
BEGIN
 SELECT * INTO r FROM lub.registration_rounds WHERE id=target FOR UPDATE;
 IF r.id IS NULL OR NOT lub.has_org_permission(r.organization_id,'REGISTRATION_ROUNDS_MANAGE') OR r.status_code='Archived' THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501';END IF;
 IF hours IS NULL OR hours<0 OR hours>100000 OR jsonb_typeof(majors) IS DISTINCT FROM 'array' OR jsonb_array_length(majors)>3 OR EXISTS(SELECT 1 FROM jsonb_array_elements(majors) x WHERE jsonb_typeof(x)<>'string' OR x#>>'{}' NOT IN('نظم معلومات','تقنية معلومات','علوم حاسب')) OR (SELECT count(DISTINCT x) FROM jsonb_array_elements(majors) x)<>jsonb_array_length(majors) THEN RAISE EXCEPTION 'Invalid requirements';END IF;
 UPDATE lub.registration_rounds SET minimum_approved_hours=hours,allowed_majors=majors WHERE id=target;
 PERFORM lub.application_audit(target,r.organization_id,'ROUND_REQUIREMENTS_UPDATED');
END; $$;
CREATE FUNCTION lub.round_requirements_met(target uuid,owner uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM lub.registration_rounds r JOIN lub.student_profiles p ON p.user_id=owner WHERE r.id=target AND (r.allowed_majors='[]'::jsonb OR r.allowed_majors ? lub.canonical_student_major(p.major_name)) AND coalesce((SELECT sum(h.hours) FROM lub.hour_records h JOIN lub.organization_memberships m ON m.id=h.organization_membership_id WHERE m.user_id=owner AND h.status_code='Approved'),0)>=r.minimum_approved_hours);
$$;
CREATE FUNCTION lub.guard_round_requirements() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT lub.round_requirements_met(NEW.registration_round_id,NEW.applicant_user_id) THEN RAISE EXCEPTION 'ROUND_REQUIREMENTS_NOT_MET' USING ERRCODE='23514';END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER application_round_requirements BEFORE INSERT OR UPDATE OF registration_round_id,applicant_user_id ON lub.membership_applications FOR EACH ROW EXECUTE FUNCTION lub.guard_round_requirements();
REVOKE ALL ON FUNCTION lub.set_round_requirements(uuid,numeric,jsonb),lub.round_requirements_met(uuid,uuid),lub.guard_round_requirements() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION lub.set_round_requirements(uuid,numeric,jsonb) TO authenticated;

-- Closed and expired public rounds remain readable so their term and status can be shown.
CREATE OR REPLACE FUNCTION lub.can_read_round(target uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM lub.registration_rounds r JOIN lub.organizations o ON o.id=r.organization_id WHERE r.id=target AND ((r.status_code IN('Open','Closed') AND o.status_code='Active' AND EXISTS(SELECT 1 FROM lub.form_versions v WHERE v.form_template_id=r.form_template_id AND v.status_code='Published')) OR lub.has_org_permission(r.organization_id,'REGISTRATION_ROUNDS_MANAGE') OR EXISTS(SELECT 1 FROM lub.membership_applications a WHERE a.registration_round_id=r.id AND lub.can_read_application(a.id))));
$$;
