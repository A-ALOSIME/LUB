-- Isolated storage contract. Not a live migration; repositories must be ported before cutover.
CREATE SCHEMA lub;

CREATE FUNCTION lub.today_riyadh() RETURNS date LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT (statement_timestamp() AT TIME ZONE 'Asia/Riyadh')::date;
$$;
CREATE FUNCTION lub.valid_records(value jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT CASE WHEN jsonb_typeof(value)<>'array' THEN false ELSE
   octet_length(value::text)<=4194304 AND NOT EXISTS(
    SELECT 1 FROM jsonb_array_elements(value) e WHERE jsonb_typeof(e)<>'object'
      OR coalesce(e->>'id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
   AND (SELECT count(*)=count(DISTINCT lower(e->>'id')) FROM jsonb_array_elements(value) e) END;
$$;
CREATE FUNCTION lub.valid_ids(value jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT CASE WHEN jsonb_typeof(value)<>'array' THEN false ELSE
   jsonb_array_length(value)<=100 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(value) e
    WHERE jsonb_typeof(e)<>'string' OR (e#>>'{}') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
   AND (SELECT count(*)=count(DISTINCT lower(e#>>'{}')) FROM jsonb_array_elements(value) e) END;
$$;
CREATE FUNCTION lub.valid_profile_skills(value jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT CASE WHEN NOT lub.valid_records(value) THEN false ELSE
  jsonb_array_length(value)<=100 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(value) e
   WHERE (e?'isFeatured' AND jsonb_typeof(e->'isFeatured')<>'boolean')
    OR (e?'sortOrder' AND coalesce(e->>'sortOrder','') !~ '^[0-9]{1,3}$')
    OR EXISTS(SELECT 1 FROM jsonb_object_keys(e) k WHERE k NOT IN ('id','sortOrder','isFeatured')))
  AND (SELECT count(*) FROM jsonb_array_elements(value) e WHERE e->'isFeatured'='true'::jsonb)<=5 END;
$$;

CREATE TABLE lub.users (
 id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
 email varchar(254) NOT NULL UNIQUE CHECK(email=lower(email)), phone varchar(16) UNIQUE,
 status_code text NOT NULL DEFAULT 'Active' CHECK(status_code IN ('Active','Inactive')),
 email_verified_at timestamptz NOT NULL, is_test_account boolean NOT NULL DEFAULT false,
 full_name_ar varchar(120), full_name_en varchar(120), university_id_ciphertext text,
 university_id_lookup_hash varchar(64) UNIQUE, major_name varchar(120), academic_level varchar(20),
 bio varchar(1000) NOT NULL DEFAULT '', bio_en varchar(1000) NOT NULL DEFAULT '', onboarded_at timestamptz,
 public_slug uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
 public_profile_enabled boolean NOT NULL DEFAULT false, allow_indexing boolean NOT NULL DEFAULT false,
 completion_prompt_seen_at timestamptz,
 links jsonb NOT NULL DEFAULT '[]' CHECK(lub.valid_records(links)),
 skills jsonb NOT NULL DEFAULT '[]' CHECK(lub.valid_profile_skills(skills)),
 notifications jsonb NOT NULL DEFAULT '[]' CHECK(lub.valid_records(notifications)),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(NOT allow_indexing OR public_profile_enabled),
 CHECK(onboarded_at IS NULL OR (full_name_ar IS NOT NULL AND length(trim(full_name_ar)) BETWEEN 2 AND 120 AND university_id_ciphertext IS NOT NULL
  AND university_id_lookup_hash IS NOT NULL AND university_id_lookup_hash ~ '^[0-9a-f]{64}$'
  AND major_name IS NOT NULL AND length(trim(major_name))>0
  AND academic_level IS NOT NULL AND CASE WHEN academic_level='graduate' THEN true
   WHEN academic_level ~ '^[0-9]{1,2}$' THEN academic_level::int BETWEEN 1 AND 12 ELSE false END))
);
CREATE TABLE lub.private_student_identifiers (
 user_id uuid PRIMARY KEY REFERENCES lub.users(id), national_id_ciphertext text NOT NULL,
 national_id_lookup_hash varchar(64) NOT NULL UNIQUE CHECK(national_id_lookup_hash ~ '^[0-9a-f]{64}$'),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE lub.organizations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), type_code text NOT NULL CHECK(type_code IN ('Club','Council')),
 slug varchar(80) NOT NULL UNIQUE CHECK(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 name_ar varchar(120) NOT NULL CHECK(length(trim(name_ar)) BETWEEN 2 AND 120), name_en varchar(120),
 summary varchar(1000) NOT NULL DEFAULT '', summary_en varchar(1000) NOT NULL DEFAULT '',
 mission varchar(3000) NOT NULL DEFAULT '', mission_en varchar(3000) NOT NULL DEFAULT '',
 public_profile_content jsonb, logo_url text NOT NULL DEFAULT '',
 status_code text NOT NULL DEFAULT 'Active' CHECK(status_code IN ('Active','Inactive','Archived')),
 is_test boolean NOT NULL DEFAULT false, show_leadership_publicly boolean NOT NULL DEFAULT true,
 self_report_hours_enabled boolean NOT NULL DEFAULT false, archived_at timestamptz,
 links jsonb NOT NULL DEFAULT '[]' CHECK(lub.valid_records(links)),
 interests jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(interests)='array' AND jsonb_array_length(interests)<=20),
 forms jsonb NOT NULL DEFAULT '[]' CHECK(lub.valid_records(forms)),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK((status_code='Archived')=(archived_at IS NOT NULL))
);
CREATE TABLE lub.committees (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES lub.organizations(id),
 parent_committee_id uuid, copied_from_committee_id uuid REFERENCES lub.committees(id),
 name varchar(120) NOT NULL CHECK(length(trim(name)) BETWEEN 2 AND 120), name_en varchar(120),
 description varchar(6000) NOT NULL DEFAULT '', description_en varchar(6000) NOT NULL DEFAULT '',
 status_code text NOT NULL DEFAULT 'Active' CHECK(status_code IN ('Active','Archived')),
 is_public boolean NOT NULL DEFAULT true, archived_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,organization_id),
 FOREIGN KEY(parent_committee_id,organization_id) REFERENCES lub.committees(id,organization_id),
 CHECK(parent_committee_id IS NULL OR parent_committee_id<>id),
 CHECK((status_code='Archived')=(archived_at IS NOT NULL))
);
CREATE TABLE lub.organization_memberships (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES lub.organizations(id),
 user_id uuid NOT NULL REFERENCES lub.users(id), status_code text NOT NULL DEFAULT 'Active' CHECK(status_code IN ('Active','Ended')),
 start_date date NOT NULL DEFAULT lub.today_riyadh(), end_date date, ended_reason text,
 hours jsonb NOT NULL DEFAULT '[]' CHECK(lub.valid_records(hours)),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,organization_id), UNIQUE(id,organization_id,user_id),
 CHECK(end_date IS NULL OR end_date>=start_date), CHECK(status_code<>'Ended' OR end_date IS NOT NULL)
);
CREATE UNIQUE INDEX one_active_membership ON lub.organization_memberships(organization_id,user_id) WHERE status_code='Active' AND end_date IS NULL;
CREATE TABLE lub.committee_memberships (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL,
 organization_membership_id uuid NOT NULL, committee_id uuid NOT NULL,
 status_code text NOT NULL DEFAULT 'Active' CHECK(status_code IN ('Active','Ended')),
 start_date date NOT NULL DEFAULT lub.today_riyadh(), end_date date, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(organization_membership_id,organization_id) REFERENCES lub.organization_memberships(id,organization_id),
 FOREIGN KEY(committee_id,organization_id) REFERENCES lub.committees(id,organization_id),
 CHECK(end_date IS NULL OR end_date>=start_date), CHECK(status_code<>'Ended' OR end_date IS NOT NULL)
);
CREATE UNIQUE INDEX one_active_committee_membership ON lub.committee_memberships(organization_membership_id,committee_id) WHERE status_code='Active' AND end_date IS NULL;
CREATE TABLE lub.access_assignments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES lub.users(id),
 organization_id uuid REFERENCES lub.organizations(id), organization_membership_id uuid, committee_id uuid,
 role_code text NOT NULL CHECK(role_code IN ('SA','OL','OD','CL','CD','HRL','HRD')),
 start_at timestamptz NOT NULL DEFAULT now(), end_at timestamptz,
 assigned_by_user_id uuid NOT NULL REFERENCES lub.users(id),
 FOREIGN KEY(organization_membership_id,organization_id,user_id) REFERENCES lub.organization_memberships(id,organization_id,user_id),
 FOREIGN KEY(committee_id,organization_id) REFERENCES lub.committees(id,organization_id),
 CHECK(end_at IS NULL OR end_at>start_at),
 CHECK((role_code='SA' AND organization_id IS NULL AND organization_membership_id IS NULL AND committee_id IS NULL)
  OR (role_code IN ('OL','OD','HRL','HRD') AND organization_id IS NOT NULL AND organization_membership_id IS NOT NULL AND committee_id IS NULL)
  OR (role_code IN ('CL','CD') AND organization_id IS NOT NULL AND organization_membership_id IS NOT NULL AND committee_id IS NOT NULL))
);
CREATE UNIQUE INDEX active_super_admin ON lub.access_assignments(user_id) WHERE role_code='SA' AND end_at IS NULL;
CREATE UNIQUE INDEX active_primary_leader ON lub.access_assignments(organization_id) WHERE role_code='OL' AND end_at IS NULL;
CREATE TABLE lub.academic_terms (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), academic_year varchar(20) NOT NULL, term_code varchar(20) NOT NULL,
 name_ar varchar(120) NOT NULL, name_en varchar(120), start_date date NOT NULL, end_date date NOT NULL,
 UNIQUE(academic_year,term_code), CHECK(end_date>=start_date)
);
CREATE TABLE lub.organization_opening_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), applicant_user_id uuid NOT NULL REFERENCES lub.users(id),
 name_ar varchar(120) NOT NULL, name_en varchar(120), type_code text NOT NULL CHECK(type_code IN ('Club','Council')),
 summary varchar(1000) NOT NULL, mission varchar(3000) NOT NULL, interests jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(interests)='array'),
 logo_webp_base64 text, status_code text NOT NULL DEFAULT 'Pending' CHECK(status_code IN ('Pending','Accepted','Rejected','Withdrawn')),
 decision_note varchar(1000) NOT NULL DEFAULT '', decided_by_user_id uuid REFERENCES lub.users(id), organization_id uuid REFERENCES lub.organizations(id),
 created_at timestamptz NOT NULL DEFAULT now(), decided_at timestamptz,
 CHECK((status_code='Accepted')=(organization_id IS NOT NULL)),
 CHECK(status_code<>'Rejected' OR length(trim(decision_note))>0)
);
CREATE UNIQUE INDEX opening_request_pending_owner ON lub.organization_opening_requests(applicant_user_id) WHERE status_code='Pending';
CREATE TABLE lub.skills (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), canonical_key text NOT NULL UNIQUE,
 name_ar varchar(80) NOT NULL, name_en varchar(80), aliases jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(aliases)='array'),
 category_code text NOT NULL DEFAULT 'other' CHECK(category_code IN ('programming','data','design','networks','security','management','communication','other')),
 is_active boolean NOT NULL DEFAULT true, is_builtin boolean NOT NULL DEFAULT false,
 CHECK(length(trim(name_ar)) BETWEEN 2 AND 80)
);
CREATE TABLE lub.assets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_user_id uuid NOT NULL REFERENCES lub.users(id),
 object_key text NOT NULL UNIQUE CHECK(object_key ~ '^[A-Za-z0-9_./-]+$'),
 file_name varchar(120) NOT NULL, mime_type varchar(100) NOT NULL, size_bytes integer NOT NULL CHECK(size_bytes BETWEEN 1 AND 10485760),
 thumbnail_png_base64 text, image_width integer, image_height integer, created_at timestamptz NOT NULL DEFAULT now(),
 CHECK((image_width IS NULL AND image_height IS NULL) OR (image_width BETWEEN 1 AND 20000 AND image_height BETWEEN 1 AND 20000))
);
CREATE TABLE lub.membership_campaigns (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES lub.organizations(id),
 kind text NOT NULL CHECK(kind IN ('Registration','Renewal')), academic_term_id uuid NOT NULL REFERENCES lub.academic_terms(id),
 title varchar(120) NOT NULL, title_en varchar(120), form_id uuid,
 opens_at timestamptz NOT NULL, closes_at timestamptz NOT NULL,
 status_code text NOT NULL DEFAULT 'Draft' CHECK(status_code IN ('Draft','Open','Paused','Closed','Archived')),
 minimum_hours numeric(8,2) NOT NULL DEFAULT 0 CHECK(minimum_hours>=0),
 allowed_majors jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(allowed_majors)='array'), exclude_leadership boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,organization_id,kind), CHECK(closes_at>opens_at), CHECK(kind='Registration' OR form_id IS NULL)
);
CREATE TABLE lub.membership_cases (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), campaign_id uuid NOT NULL, organization_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('Registration','Renewal')), user_id uuid NOT NULL REFERENCES lub.users(id),
 organization_membership_id uuid, requested_committee_id uuid,
 status_code text NOT NULL, status_revision integer NOT NULL DEFAULT 1 CHECK(status_revision>0),
 form_snapshot jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(form_snapshot)='object'),
 answers jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(answers)='object' AND octet_length(answers::text)<=256000),
 attachments jsonb NOT NULL DEFAULT '[]' CHECK(lub.valid_records(attachments)), response_revision integer NOT NULL DEFAULT 1,
 submitted_at timestamptz NOT NULL DEFAULT now(), edited_at timestamptz NOT NULL DEFAULT now(), decided_at timestamptz,
 decided_by_user_id uuid REFERENCES lub.users(id), decision_note varchar(3000) NOT NULL DEFAULT '',
 FOREIGN KEY(campaign_id,organization_id,kind) REFERENCES lub.membership_campaigns(id,organization_id,kind),
 FOREIGN KEY(organization_membership_id,organization_id,user_id) REFERENCES lub.organization_memberships(id,organization_id,user_id),
 FOREIGN KEY(requested_committee_id,organization_id) REFERENCES lub.committees(id,organization_id),
 UNIQUE(id,organization_id),
 CHECK((kind='Registration' AND status_code IN ('Submitted','Interview','Accepted','Rejected','Withdrawn'))
  OR (kind='Renewal' AND organization_membership_id IS NOT NULL AND status_code IN ('Pending','Renewed','Declined','No_Response')))
);
CREATE UNIQUE INDEX one_live_membership_case ON lub.membership_cases(campaign_id,user_id) WHERE status_code<>'Withdrawn';
CREATE TABLE lub.organization_content (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES lub.organizations(id),
 kind text NOT NULL CHECK(kind IN ('Event','Announcement')), title varchar(120) NOT NULL, title_en varchar(120),
 body varchar(6000) NOT NULL DEFAULT '', body_en varchar(6000) NOT NULL DEFAULT '',
 status_code text NOT NULL DEFAULT 'Draft' CHECK(status_code IN ('Draft','Published','Completed','Cancelled','Archived')),
 primary_image_id uuid REFERENCES lub.assets(id), external_url varchar(2048),
 starts_at timestamptz, ends_at timestamptz, registration_opens_at timestamptz, registration_closes_at timestamptz,
 form_id uuid, location_type_code text NOT NULL DEFAULT 'Unknown' CHECK(location_type_code IN ('Unknown','In_Person','Online','Hybrid')),
 location_text varchar(500), online_url varchar(2048), capacity integer CHECK(capacity BETWEEN 1 AND 10000),
 attendance_hours numeric(6,2) NOT NULL DEFAULT 0 CHECK(attendance_hours BETWEEN 0 AND 1000),
 requires_review boolean NOT NULL DEFAULT true, registration_paused boolean NOT NULL DEFAULT false,
 pinned_at timestamptz, is_featured boolean NOT NULL DEFAULT false, source_date_text varchar(1000),
 public_report varchar(5000) NOT NULL DEFAULT '', public_photos jsonb NOT NULL DEFAULT '[]' CHECK(lub.valid_records(public_photos)),
 skill_ids jsonb NOT NULL DEFAULT '[]' CHECK(lub.valid_ids(skill_ids)),
 attachments jsonb NOT NULL DEFAULT '[]' CHECK(lub.valid_records(attachments)),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0), published_at timestamptz, completed_at timestamptz, cancelled_at timestamptz,
 archived_at timestamptz, deleted_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,organization_id,kind),
 CHECK(kind='Event' OR (starts_at IS NULL AND ends_at IS NULL AND form_id IS NULL AND status_code NOT IN ('Completed','Cancelled'))),
 CHECK(pinned_at IS NULL OR (kind='Announcement' AND status_code='Published')),
 CHECK(NOT is_featured OR kind='Event'),
 CHECK(kind<>'Event' OR status_code IN ('Draft','Archived') OR
  (starts_at IS NOT NULL AND ends_at IS NOT NULL AND ends_at>starts_at AND registration_opens_at IS NOT NULL
   AND registration_closes_at IS NOT NULL AND registration_closes_at>registration_opens_at AND registration_closes_at<=starts_at))
);
CREATE UNIQUE INDEX one_pinned_announcement ON lub.organization_content(organization_id) WHERE kind='Announcement' AND pinned_at IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX one_featured_event ON lub.organization_content(organization_id) WHERE kind='Event' AND is_featured AND deleted_at IS NULL;
CREATE TABLE lub.event_registrations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_id uuid NOT NULL, organization_id uuid NOT NULL,
 content_kind text NOT NULL DEFAULT 'Event' CHECK(content_kind='Event'), user_id uuid NOT NULL REFERENCES lub.users(id),
 status_code text NOT NULL DEFAULT 'Registered' CHECK(status_code IN ('Registered','Cancelled')),
 review_status_code text NOT NULL DEFAULT 'Pending' CHECK(review_status_code IN ('Pending','Accepted','Rejected')),
 review_note varchar(3000) NOT NULL DEFAULT '', reviewed_at timestamptz, reviewed_by_user_id uuid REFERENCES lub.users(id),
 attendance text NOT NULL DEFAULT 'Pending' CHECK(attendance IN ('Pending','Present','Absent','Excused')),
 checked_in_at timestamptz, marked_by_user_id uuid REFERENCES lub.users(id),
 form_snapshot jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(form_snapshot)='object'),
 answers jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(answers)='object' AND octet_length(answers::text)<=256000),
 attachments jsonb NOT NULL DEFAULT '[]' CHECK(lub.valid_records(attachments)), response_revision integer NOT NULL DEFAULT 1,
 registered_at timestamptz NOT NULL DEFAULT now(), cancelled_at timestamptz,
 UNIQUE(event_id,user_id), UNIQUE(id,organization_id),
 FOREIGN KEY(event_id,organization_id,content_kind) REFERENCES lub.organization_content(id,organization_id,kind),
 CHECK((status_code='Cancelled')=(cancelled_at IS NOT NULL)), CHECK((attendance='Present')=(checked_in_at IS NOT NULL))
);
CREATE TABLE lub.tasks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES lub.organizations(id), committee_id uuid,
 event_id uuid, event_kind text GENERATED ALWAYS AS (CASE WHEN event_id IS NOT NULL THEN 'Event' END) STORED,
 created_by_user_id uuid NOT NULL REFERENCES lub.users(id), title varchar(120) NOT NULL, title_en varchar(120),
 description varchar(6000) NOT NULL, description_en varchar(6000) NOT NULL DEFAULT '',
 starts_at timestamptz, due_at timestamptz, default_hours numeric(6,2) NOT NULL DEFAULT 0 CHECK(default_hours BETWEEN 0 AND 1000),
 status_code text NOT NULL DEFAULT 'Draft' CHECK(status_code IN ('Draft','Open','Completed','Cancelled')),
 image_asset_id uuid REFERENCES lub.assets(id), skill_ids jsonb NOT NULL DEFAULT '[]' CHECK(lub.valid_ids(skill_ids)),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0), closed_at timestamptz, deleted_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,organization_id),
 FOREIGN KEY(committee_id,organization_id) REFERENCES lub.committees(id,organization_id),
 FOREIGN KEY(event_id,organization_id,event_kind) REFERENCES lub.organization_content(id,organization_id,kind),
 CHECK(starts_at IS NULL OR due_at IS NULL OR due_at>starts_at)
);
CREATE TABLE lub.task_participants (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), task_id uuid NOT NULL, organization_id uuid NOT NULL,
 organization_membership_id uuid NOT NULL, user_id uuid NOT NULL REFERENCES lub.users(id),
 status_code text NOT NULL DEFAULT 'Joined' CHECK(status_code IN ('Joined','In_Progress','Submitted','Approved','Closed')),
 joined_at timestamptz NOT NULL DEFAULT now(), withdrawn_at timestamptz, closed_at timestamptz,
 reviewed_by_user_id uuid REFERENCES lub.users(id), approved_hours_override numeric(6,2) CHECK(approved_hours_override BETWEEN 0 AND 1000),
 submissions jsonb NOT NULL DEFAULT '[]' CHECK(lub.valid_records(submissions)),
 show_in_portfolio boolean NOT NULL DEFAULT false, display_title varchar(120), display_description varchar(1000) NOT NULL DEFAULT '',
 is_featured_work boolean NOT NULL DEFAULT false, portfolio_updated_at timestamptz,
 UNIQUE(task_id,user_id), UNIQUE(id,organization_id,user_id),
 FOREIGN KEY(task_id,organization_id) REFERENCES lub.tasks(id,organization_id),
 FOREIGN KEY(organization_membership_id,organization_id,user_id) REFERENCES lub.organization_memberships(id,organization_id,user_id),
 CHECK(NOT show_in_portfolio OR length(trim(display_title)) BETWEEN 2 AND 120),
 CHECK(withdrawn_at IS NULL OR status_code='Closed')
);
CREATE TABLE lub.history_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES lub.organizations(id),
 membership_case_id uuid, event_registration_id uuid, organization_membership_id uuid,
 event_code text NOT NULL, from_status_code text, to_status_code text NOT NULL, reason varchar(3000) NOT NULL DEFAULT '',
 actor_user_id uuid REFERENCES lub.users(id), occurred_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(membership_case_id,organization_id) REFERENCES lub.membership_cases(id,organization_id),
 FOREIGN KEY(event_registration_id,organization_id) REFERENCES lub.event_registrations(id,organization_id),
 FOREIGN KEY(organization_membership_id,organization_id) REFERENCES lub.organization_memberships(id,organization_id),
 CHECK(num_nonnulls(membership_case_id,event_registration_id,organization_membership_id)=1)
);

CREATE FUNCTION lub.arabic_search_key(value text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT regexp_replace(translate(lower(coalesce(value,'')),'أإآٱىة','اااايه'),'[ًٌٍَُِّْـ]','','g');
$$;
CREATE FUNCTION lub.is_super_admin(owner_id uuid DEFAULT auth.uid()) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM lub.access_assignments a JOIN lub.users u ON u.id=a.user_id
  WHERE a.user_id=owner_id AND a.role_code='SA' AND u.status_code='Active'
   AND a.start_at<=statement_timestamp() AND (a.end_at IS NULL OR a.end_at>statement_timestamp()));
$$;
CREATE FUNCTION lub.is_student_account(owner_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM lub.users u WHERE u.id=owner_id AND u.status_code='Active' AND u.onboarded_at IS NOT NULL)
  AND NOT lub.is_super_admin(owner_id);
$$;
CREATE FUNCTION lub.is_hr_committee(target uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM lub.committees c WHERE c.id=target AND lub.arabic_search_key(c.name)
  IN (lub.arabic_search_key('الموارد البشرية'),lub.arabic_search_key('المواردالبشرية'),'human resources','hr'));
$$;
CREATE FUNCTION lub.has_org_permission(target_org uuid,capability text,target_committee uuid DEFAULT NULL) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT lub.is_student_account(auth.uid())
 AND capability IN ('ORG_PROFILE_MANAGE','ANNOUNCEMENTS_MANAGE','COMMITTEE_MANAGE','COMMITTEE_PROFILE_MANAGE','MEMBERS_VIEW','MEMBERS_MANAGE','FORMS_MANAGE','REGISTRATION_ROUNDS_MANAGE','APPLICATIONS_VIEW','APPLICATIONS_REVIEW','APPLICATIONS_BULK_ACTION','PERMISSIONS_GRANT','TASKS_MANAGE','TASKS_REVIEW','HOURS_APPROVE','HOURS_MANUAL_ADD','RENEWALS_MANAGE','REPORTS_GENERATE','EVENTS_MANAGE','EVENT_REGISTRATIONS_REVIEW','EVENT_ATTENDANCE_MANAGE')
 AND EXISTS(SELECT 1 FROM lub.organizations o WHERE o.id=target_org AND o.status_code='Active')
 AND (target_committee IS NULL OR EXISTS(SELECT 1 FROM lub.committees c WHERE c.id=target_committee AND c.organization_id=target_org AND c.status_code='Active'))
 AND EXISTS(SELECT 1 FROM lub.access_assignments a JOIN lub.organization_memberships m ON m.id=a.organization_membership_id
  WHERE a.user_id=auth.uid() AND a.organization_id=target_org AND m.status_code='Active'
   AND m.start_date<=lub.today_riyadh() AND (m.end_date IS NULL OR m.end_date>lub.today_riyadh())
   AND a.start_at<=statement_timestamp() AND (a.end_at IS NULL OR a.end_at>statement_timestamp())
   AND (a.committee_id IS NULL OR EXISTS(SELECT 1 FROM lub.committees own WHERE own.id=a.committee_id AND own.status_code='Active'))
   AND (a.role_code='OL'
    OR (a.role_code='OD' AND capability NOT IN ('ORG_PROFILE_MANAGE','COMMITTEE_MANAGE','COMMITTEE_PROFILE_MANAGE'))
    OR (a.role_code IN ('CL','CD','HRL','HRD') AND capability='TASKS_MANAGE')
    OR (a.role_code IN ('CL','CD') AND a.committee_id=target_committee AND capability IN ('MEMBERS_VIEW','TASKS_REVIEW','HOURS_MANUAL_ADD'))
    OR (a.role_code='CL' AND a.committee_id=target_committee AND capability IN ('HOURS_APPROVE','REPORTS_GENERATE'))
    OR (a.role_code IN ('HRL','HRD') AND target_committee IS NULL AND capability='TASKS_REVIEW')
    OR ((a.role_code IN ('HRL','HRD') OR (a.role_code IN ('CL','CD') AND lub.is_hr_committee(a.committee_id))) AND capability IN ('MEMBERS_VIEW','APPLICATIONS_VIEW','APPLICATIONS_REVIEW','APPLICATIONS_BULK_ACTION','HOURS_APPROVE','HOURS_MANUAL_ADD','EVENT_REGISTRATIONS_REVIEW','EVENT_ATTENDANCE_MANAGE'))
    OR ((a.role_code='HRL' OR (a.role_code='CL' AND lub.is_hr_committee(a.committee_id))) AND capability IN ('EVENTS_MANAGE','RENEWALS_MANAGE','REPORTS_GENERATE'))));
$$;
CREATE FUNCTION lub.owns_membership(target uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM lub.organization_memberships m WHERE m.id=target AND m.user_id=auth.uid());
$$;
CREATE FUNCTION lub.public_profile(target_slug uuid,locale text DEFAULT 'ar') RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('slug',u.public_slug,'name',CASE WHEN locale='en' THEN coalesce(nullif(u.full_name_en,''),u.full_name_ar) ELSE u.full_name_ar END,
  'major',u.major_name,'level',u.academic_level,'bio',CASE WHEN locale='en' THEN coalesce(nullif(u.bio_en,''),u.bio) ELSE u.bio END,
  'allowIndexing',u.allow_indexing,
  'links',coalesce((SELECT jsonb_agg(jsonb_build_object('type',l->>'type','label',l->>'label','value',l->>'value')) FROM jsonb_array_elements(u.links) l),'[]'),
  'skills',coalesce((SELECT jsonb_agg(jsonb_build_object('key',s.canonical_key,'name',CASE WHEN locale='en' THEN coalesce(s.name_en,s.name_ar) ELSE s.name_ar END,
    'featured',coalesce((e->>'isFeatured')::boolean,false),'order',coalesce((e->>'sortOrder')::integer,0),'category',s.category_code))
   FROM jsonb_array_elements(u.skills) e JOIN lub.skills s ON s.id=(e->>'id')::uuid),'[]'))
 FROM lub.users u WHERE u.public_slug=target_slug AND u.public_profile_enabled AND NOT u.is_test_account AND lub.is_student_account(u.id);
$$;
CREATE FUNCTION lub.check_profile_skill_references() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE selected uuid;
BEGIN
 IF NOT lub.valid_profile_skills(NEW.skills) THEN RAISE EXCEPTION 'Invalid profile skill selection' USING ERRCODE='23514'; END IF;
 FOR selected IN SELECT (e->>'id')::uuid FROM jsonb_array_elements(NEW.skills) e ORDER BY 1 LOOP
  PERFORM 1 FROM lub.skills s WHERE s.id=selected FOR KEY SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown skill selection' USING ERRCODE='23514'; END IF;
 END LOOP;
 RETURN NEW;
END;
$$;
CREATE TRIGGER profile_skill_references BEFORE INSERT OR UPDATE OF skills ON lub.users FOR EACH ROW EXECUTE FUNCTION lub.check_profile_skill_references();
CREATE FUNCTION lub.check_activity_skill_references() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE selected uuid;
BEGIN
 FOR selected IN SELECT (e#>>'{}')::uuid FROM jsonb_array_elements(NEW.skill_ids) e ORDER BY 1 LOOP
  PERFORM 1 FROM lub.skills s WHERE s.id=selected FOR KEY SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown activity skill selection' USING ERRCODE='23514'; END IF;
 END LOOP;
 RETURN NEW;
END;
$$;
CREATE TRIGGER task_skill_references BEFORE INSERT OR UPDATE OF skill_ids ON lub.tasks FOR EACH ROW EXECUTE FUNCTION lub.check_activity_skill_references();
CREATE TRIGGER content_skill_references BEFORE INSERT OR UPDATE OF skill_ids ON lub.organization_content FOR EACH ROW EXECUTE FUNCTION lub.check_activity_skill_references();
CREATE FUNCTION lub.guard_skill_delete() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM lub.users u CROSS JOIN LATERAL jsonb_array_elements(u.skills) e WHERE (e->>'id')::uuid=OLD.id)
  OR EXISTS(SELECT 1 FROM lub.tasks t CROSS JOIN LATERAL jsonb_array_elements(t.skill_ids) e WHERE (e#>>'{}')::uuid=OLD.id)
  OR EXISTS(SELECT 1 FROM lub.organization_content c CROSS JOIN LATERAL jsonb_array_elements(c.skill_ids) e WHERE (e#>>'{}')::uuid=OLD.id)
 THEN RAISE EXCEPTION 'Referenced skill cannot be deleted' USING ERRCODE='23503'; END IF;
 RETURN OLD;
END;
$$;
CREATE TRIGGER referenced_skill_delete BEFORE DELETE ON lub.skills FOR EACH ROW EXECUTE FUNCTION lub.guard_skill_delete();

-- No client-role table writes: scoped security-definer mutation functions own writes.
REVOKE ALL ON SCHEMA lub FROM PUBLIC;
GRANT USAGE ON SCHEMA lub TO anon,authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA lub FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA lub FROM PUBLIC;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA lub TO authenticated;
GRANT EXECUTE ON FUNCTION lub.public_profile(uuid,text) TO anon;

ALTER TABLE lub.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE lub.private_student_identifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE lub.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE lub.committees ENABLE ROW LEVEL SECURITY;
ALTER TABLE lub.organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE lub.committee_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE lub.access_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE lub.academic_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE lub.organization_opening_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE lub.skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE lub.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE lub.membership_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE lub.membership_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE lub.organization_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE lub.event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE lub.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE lub.task_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE lub.history_events ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON lub.users,lub.organizations,lub.committees,lub.organization_memberships,lub.committee_memberships,lub.access_assignments,lub.academic_terms,lub.organization_opening_requests,lub.skills,lub.assets,lub.membership_campaigns,lub.membership_cases,lub.organization_content,lub.event_registrations,lub.tasks,lub.task_participants,lub.history_events TO authenticated;
REVOKE SELECT ON lub.organizations FROM authenticated;
GRANT SELECT(id,type_code,slug,name_ar,name_en,summary,summary_en,mission,mission_en,public_profile_content,logo_url,status_code,is_test,show_leadership_publicly,self_report_hours_enabled,archived_at,links,interests,created_at,updated_at) ON lub.organizations TO authenticated;
CREATE POLICY own_account ON lub.users FOR SELECT TO authenticated USING(id=auth.uid());
CREATE POLICY organization_read ON lub.organizations FOR SELECT TO authenticated USING(status_code='Active' OR lub.is_super_admin());
CREATE POLICY committee_read ON lub.committees FOR SELECT TO authenticated USING(is_public OR lub.is_super_admin() OR lub.has_org_permission(organization_id,'MEMBERS_VIEW',id));
CREATE POLICY membership_read ON lub.organization_memberships FOR SELECT TO authenticated USING(user_id=auth.uid() OR lub.is_super_admin() OR lub.has_org_permission(organization_id,'MEMBERS_VIEW'));
CREATE POLICY committee_membership_read ON lub.committee_memberships FOR SELECT TO authenticated USING(lub.owns_membership(organization_membership_id) OR lub.is_super_admin() OR lub.has_org_permission(organization_id,'MEMBERS_VIEW',committee_id));
CREATE POLICY role_read ON lub.access_assignments FOR SELECT TO authenticated USING(user_id=auth.uid() OR lub.is_super_admin() OR lub.has_org_permission(organization_id,'MEMBERS_VIEW',committee_id));
CREATE POLICY term_read ON lub.academic_terms FOR SELECT TO authenticated USING(true);
CREATE POLICY opening_read ON lub.organization_opening_requests FOR SELECT TO authenticated USING(applicant_user_id=auth.uid() OR lub.is_super_admin());
CREATE POLICY skill_read ON lub.skills FOR SELECT TO authenticated USING(is_active OR lub.is_super_admin());
CREATE POLICY own_asset ON lub.assets FOR SELECT TO authenticated USING(owner_user_id=auth.uid() OR lub.is_super_admin());
CREATE POLICY campaign_read ON lub.membership_campaigns FOR SELECT TO authenticated USING(status_code='Open' OR lub.is_super_admin() OR lub.has_org_permission(organization_id,'REGISTRATION_ROUNDS_MANAGE') OR lub.has_org_permission(organization_id,'RENEWALS_MANAGE'));
CREATE POLICY case_read ON lub.membership_cases FOR SELECT TO authenticated USING(user_id=auth.uid() OR lub.is_super_admin() OR lub.has_org_permission(organization_id,'APPLICATIONS_VIEW'));
CREATE POLICY content_read ON lub.organization_content FOR SELECT TO authenticated USING((status_code IN ('Published','Completed','Archived') AND deleted_at IS NULL) OR lub.is_super_admin() OR lub.has_org_permission(organization_id,CASE WHEN kind='Event' THEN 'EVENTS_MANAGE' ELSE 'ANNOUNCEMENTS_MANAGE' END));
CREATE POLICY registration_read ON lub.event_registrations FOR SELECT TO authenticated USING(user_id=auth.uid() OR lub.is_super_admin() OR lub.has_org_permission(organization_id,'EVENT_REGISTRATIONS_REVIEW'));
CREATE POLICY task_read ON lub.tasks FOR SELECT TO authenticated USING(lub.is_super_admin() OR lub.has_org_permission(organization_id,'TASKS_MANAGE',committee_id) OR (status_code='Open' AND deleted_at IS NULL AND EXISTS(SELECT 1 FROM lub.organization_memberships m WHERE m.organization_id=tasks.organization_id AND m.user_id=auth.uid() AND m.status_code='Active')));
CREATE POLICY participant_read ON lub.task_participants FOR SELECT TO authenticated USING(user_id=auth.uid() OR lub.is_super_admin() OR EXISTS(SELECT 1 FROM lub.tasks t WHERE t.id=task_id AND lub.has_org_permission(t.organization_id,'TASKS_REVIEW',t.committee_id)));
CREATE POLICY history_read ON lub.history_events FOR SELECT TO authenticated USING(lub.is_super_admin() OR lub.has_org_permission(organization_id,'MEMBERS_VIEW') OR (membership_case_id IS NOT NULL AND EXISTS(SELECT 1 FROM lub.membership_cases c WHERE c.id=membership_case_id AND c.user_id=auth.uid())) OR (event_registration_id IS NOT NULL AND EXISTS(SELECT 1 FROM lub.event_registrations r WHERE r.id=event_registration_id AND r.user_id=auth.uid())) OR (organization_membership_id IS NOT NULL AND lub.owns_membership(organization_membership_id)));
