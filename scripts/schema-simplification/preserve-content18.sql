-- Copy retained organization and activity records while the legacy schema is isolated.
INSERT INTO lub.organizations(id,type_code,slug,name_ar,summary,mission,public_profile_content,logo_url,links_customized,
 status_code,show_leadership_publicly,self_report_hours_enabled,archived_at,is_test,links,interests,created_at,updated_at)
SELECT o.id,o.type_code,o.slug,o.name_ar,o.summary,o.mission,o.public_profile_content,o.logo_url,o.links_customized,
 o.status_code,o.show_leadership_publicly,o.self_report_hours_enabled,o.archived_at,o.slug LIKE 'demo-%',
 coalesce((SELECT jsonb_agg(jsonb_build_object('id',l.id,'kind',l.link_type,'value',regexp_replace(l.url,'^(mailto:|tel:)',''))
   ORDER BY l.sort_order,l.id) FROM lub_before_simplification.organization_links l WHERE l.organization_id=o.id),'[]'),
 coalesce((SELECT jsonb_agg(t.name_ar ORDER BY t.name_ar)
   FROM lub_before_simplification.organization_tags x JOIN lub_before_simplification.tags t ON t.id=x.tag_id
   WHERE x.organization_id=o.id AND t.is_active),'[]'),o.created_at,o.updated_at
FROM lub_before_simplification.organizations o;

INSERT INTO lub.committees(id,organization_id,parent_committee_id,copied_from_committee_id,name,description,status_code,is_public,archived_at,created_at,updated_at)
SELECT id,organization_id,parent_committee_id,copied_from_committee_id,name,description,status_code,is_public,archived_at,created_at,updated_at
FROM lub_before_simplification.committees;
INSERT INTO lub.academic_terms(id,academic_year,term_code,name_ar,start_date,end_date)
SELECT id,academic_year,term_code,name_ar,start_date,end_date FROM lub_before_simplification.academic_terms;
INSERT INTO lub.organization_memberships(id,organization_id,user_id,status_code,start_date,end_date,ended_reason,created_at,updated_at,hours)
SELECT m.id,m.organization_id,m.user_id,CASE WHEN m.status_code='Inactive' THEN 'Ended' ELSE m.status_code END,m.start_date,
 CASE WHEN m.status_code='Inactive' THEN coalesce(m.end_date,m.start_date) ELSE m.end_date END,m.ended_reason,m.created_at,m.updated_at,
 coalesce((SELECT jsonb_agg(jsonb_build_object(
  'id',h.id,'committee_id',h.committee_id,'academic_term_id',h.academic_term_id,
  'source_code',CASE WHEN h.source_code='EVENT' THEN 'EVENT_ATTENDANCE' ELSE h.source_code END,
  'source_id',coalesce(h.task_participant_id,ea.event_registration_id),'hours',h.hours,'activity_date',h.activity_date,
  'description',h.description,'status_code',h.status_code,'requested_by_user_id',h.requested_by_user_id,
  'reviewed_by_user_id',h.reviewed_by_user_id,'reviewed_at',h.reviewed_at,'review_note',h.review_note,
  'created_at',h.created_at,'updated_at',h.updated_at) ORDER BY h.created_at,h.id)
  FROM lub_before_simplification.hour_records h LEFT JOIN lub_before_simplification.event_attendance ea ON ea.id=h.event_attendance_id
  WHERE h.organization_membership_id=m.id),'[]')
FROM lub_before_simplification.organization_memberships m;
INSERT INTO lub.committee_memberships(id,organization_id,organization_membership_id,committee_id,status_code,start_date,end_date,created_at)
SELECT id,organization_id,organization_membership_id,committee_id,status_code,start_date,end_date,created_at
FROM lub_before_simplification.committee_memberships;
INSERT INTO lub.access_assignments(id,user_id,organization_id,organization_membership_id,committee_id,role_code,start_at,end_at,assigned_by_user_id)
SELECT r.id,m.user_id,r.organization_id,r.organization_membership_id,r.committee_id,r.role_code,
 r.start_date::timestamp AT TIME ZONE 'Asia/Riyadh',
 CASE WHEN r.end_date=r.start_date THEN (r.end_date::timestamp AT TIME ZONE 'Asia/Riyadh')+interval '1 microsecond'
  ELSE r.end_date::timestamp AT TIME ZONE 'Asia/Riyadh' END,r.assigned_by_user_id
FROM lub_before_simplification.role_assignments r JOIN lub.organization_memberships m ON m.id=r.organization_membership_id;
INSERT INTO lub.history_events(id,organization_id,organization_membership_id,event_code,to_status_code,actor_user_id,occurred_at)
SELECT h.id,m.organization_id,h.membership_id,h.event_code,h.status_code,h.actor_user_id,h.occurred_at
FROM lub_before_simplification.membership_events h JOIN lub.organization_memberships m ON m.id=h.membership_id;
INSERT INTO lub.organization_opening_requests(id,applicant_user_id,name_ar,type_code,summary,mission,interests,logo_webp_base64,
 status_code,decision_note,decided_by_user_id,organization_id,created_at,decided_at)
SELECT id,applicant_user_id,name_ar,type_code,summary,mission,interests,logo_webp_base64,
 status_code,decision_note,decided_by_user_id,organization_id,created_at,decided_at
FROM lub_before_simplification.organization_opening_requests;

INSERT INTO lub.assets(id,owner_user_id,object_key,file_name,mime_type,size_bytes,thumbnail_png_base64,image_width,image_height,created_at)
SELECT id,owner_user_id,object_key,file_name,mime_type,size_bytes,thumbnail_png_base64,image_width,image_height,created_at
FROM lub_before_simplification.application_assets;

-- Retain published definitions used by active workflows and the latest draft otherwise.
CREATE TEMP TABLE cutover_forms ON COMMIT DROP AS
WITH uses AS (
 SELECT f.id AS source_id,f.organization_id,f.id AS id FROM lub_before_simplification.form_templates f WHERE f.organization_id IS NOT NULL
 UNION ALL
 SELECT refs.form_id,refs.organization_id,gen_random_uuid() FROM (
  SELECT e.registration_form_template_id AS form_id,e.organization_id FROM lub_before_simplification.events e
  UNION SELECT c.form_template_id,c.organization_id FROM lub_before_simplification.registration_rounds c
 ) refs JOIN lub_before_simplification.form_templates f ON f.id=refs.form_id WHERE f.organization_id IS NULL
)
SELECT u.*,f.name,f.source_template_id,f.created_at,v.created_at AS updated_at,v.status_code,v.revision,v.definition
FROM uses u JOIN lub_before_simplification.form_templates f ON f.id=u.source_id
JOIN LATERAL (
 SELECT * FROM lub_before_simplification.form_versions v WHERE v.form_template_id=f.id AND v.status_code IN ('Published','Draft')
 ORDER BY (v.status_code='Published') DESC,v.version_number DESC LIMIT 1
) v ON true;
UPDATE lub.organizations o SET forms=(
 SELECT jsonb_agg(jsonb_build_object('id',f.id,'name',f.name,'sourceFormId',f.source_template_id,'createdAt',f.created_at,'updatedAt',f.updated_at,
  'version',jsonb_build_object('id',f.id,'status_code',f.status_code,'revision',f.revision,'definition',f.definition)) ORDER BY f.created_at,f.id)
 FROM cutover_forms f WHERE f.organization_id=o.id)
WHERE EXISTS(SELECT 1 FROM cutover_forms f WHERE f.organization_id=o.id);

INSERT INTO lub.membership_campaigns(id,organization_id,kind,title,form_id,opens_at,closes_at,status_code,minimum_hours,allow_withdrawal,allowed_majors,created_at)
SELECT r.id,r.organization_id,'Registration',r.title,f.id,r.opens_at,r.closes_at,r.status_code,
 r.minimum_approved_hours,r.allow_withdrawal,r.allowed_majors,r.created_at
FROM lub_before_simplification.registration_rounds r LEFT JOIN cutover_forms f ON f.source_id=r.form_template_id AND f.organization_id=r.organization_id;
INSERT INTO lub.membership_campaigns(id,organization_id,kind,academic_term_id,title,opens_at,closes_at,status_code,exclude_leadership,created_at)
SELECT c.id,c.organization_id,'Renewal',c.academic_term_id,t.name_ar,c.opens_at,c.closes_at,c.status_code,c.exclude_leadership,c.created_at
FROM lub_before_simplification.renewal_campaigns c JOIN lub.academic_terms t ON t.id=c.academic_term_id;

INSERT INTO lub.organization_content(id,organization_id,created_by_user_id,kind,title,body,status_code,primary_image_id,
 starts_at,ends_at,registration_opens_at,registration_closes_at,form_id,location_type_code,location_text,online_url,capacity,
 attendance_hours,requires_review,archived_from_status,archived_from_published_at,is_featured,source_date_text,public_report,
 public_photos,revision,published_at,completed_at,cancelled_at,created_at,updated_at)
SELECT e.id,e.organization_id,e.created_by_user_id,'Event',e.title,e.description,e.status_code,
 (SELECT a.asset_id FROM lub_before_simplification.event_assets a WHERE a.event_id=e.id AND a.asset_type_code='Poster' ORDER BY a.asset_id LIMIT 1),
 e.starts_at,e.ends_at,e.registration_opens_at,e.registration_closes_at,f.id,e.location_type_code,e.location_text,e.online_url,e.capacity,
 e.attendance_hours,e.requires_approval,e.archived_from_status,e.archived_from_published_at,e.is_featured,e.source_date_text,e.public_report,
 coalesce((SELECT jsonb_agg(jsonb_build_object('id',gen_random_uuid(),'url',url) ORDER BY position)
  FROM unnest(e.public_photos) WITH ORDINALITY AS photos(url,position) WHERE url ~ '^https://'), '[]'),
 e.revision,e.published_at,e.completed_at,e.cancelled_at,e.created_at,e.updated_at
FROM lub_before_simplification.events e LEFT JOIN cutover_forms f ON f.source_id=e.registration_form_template_id AND f.organization_id=e.organization_id;
UPDATE lub.organization_content e SET duplicated_from_content_id=original.id
FROM lub_before_simplification.events old JOIN lub.organization_content original ON original.id=old.duplicated_from_event_id
WHERE e.id=old.id AND e.kind='Event';
INSERT INTO lub.organization_content(id,organization_id,kind,title,body,status_code,primary_image_id,external_url,pinned_at,published_at,archived_at,deleted_at,created_at,updated_at)
SELECT id,organization_id,'Announcement',title,body,CASE WHEN archived_at IS NOT NULL THEN 'Archived' WHEN published_at IS NOT NULL THEN 'Published' ELSE 'Draft' END,
 image_asset_id,external_url,pinned_at,published_at,archived_at,deleted_at,created_at,updated_at
FROM lub_before_simplification.announcements;
INSERT INTO lub.tasks(id,organization_id,committee_id,event_id,created_by_user_id,title,description,starts_at,due_at,default_hours,
 status_code,image_asset_id,revision,closed_at,deleted_at,created_at,updated_at)
SELECT id,organization_id,committee_id,event_id,created_by_user_id,title,description,starts_at,due_at,default_hours,
 status_code,image_asset_id,revision,closed_at,deleted_at,created_at,updated_at
FROM lub_before_simplification.tasks;

-- Keep submitted question snapshots and attachment associations in each request.
CREATE TEMP TABLE cutover_responses ON COMMIT DROP AS
SELECT r.id,r.revision,r.updated_at AS last_edited_at,v.form_template_id,v.definition,r.answers,r.respondent_user_id
FROM lub_before_simplification.form_responses r
JOIN lub_before_simplification.form_versions v ON v.id=r.form_version_id;
-- Revalidate each historical answer as its recorded owner, including file ownership.
DO $$ DECLARE respondent uuid; BEGIN
 FOR respondent IN SELECT id FROM lub.users LOOP
  PERFORM set_config('request.jwt.claim.sub',respondent::text,true);
  UPDATE cutover_responses f SET answers=lub.validate_form_answers(f.definition,f.answers) WHERE f.respondent_user_id=respondent;
INSERT INTO lub.membership_cases(id,campaign_id,organization_id,kind,user_id,organization_membership_id,requested_committee_id,
 status_code,status_revision,form_snapshot,answers,attachments,response_revision,submitted_at,edited_at,decided_at,decided_by_user_id,decision_note)
SELECT a.id,c.id,c.organization_id,'Registration',a.applicant_user_id,a.accepted_membership_id,a.requested_committee_id,
 a.status_code,a.status_revision,jsonb_build_object('id',coalesce(c.form_id,r.form_template_id),'definition',r.definition),
 r.answers,lub.form_answer_attachments(r.definition,r.answers),r.revision,a.created_at,r.last_edited_at,a.decided_at,a.decided_by_user_id,
 coalesce((SELECT h.reason FROM lub_before_simplification.application_status_history h
  WHERE h.application_id=a.id AND h.to_status_code=a.status_code ORDER BY h.created_at DESC,h.id DESC LIMIT 1),'')
FROM lub_before_simplification.membership_applications a
JOIN lub.membership_campaigns c ON c.id=a.registration_round_id
JOIN cutover_responses r ON r.id=a.form_response_id WHERE a.applicant_user_id=respondent;
INSERT INTO lub.event_registrations(id,event_id,organization_id,user_id,status_code,review_status_code,review_note,reviewed_at,
 attendance,checked_in_at,marked_by_user_id,form_snapshot,answers,attachments,response_revision,registered_at,cancelled_at)
SELECT r.id,e.id,e.organization_id,r.user_id,r.status_code,r.review_status_code,r.review_note,r.reviewed_at,
 coalesce(a.status_code,'Pending'),a.checked_in_at,a.marked_by_user_id,
 CASE WHEN f.id IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('id',coalesce(e.form_id,f.form_template_id),'definition',f.definition) END,
 coalesce(f.answers,'{}'),coalesce(lub.form_answer_attachments(f.definition,f.answers),'[]'),coalesce(f.revision,1),r.registered_at,r.cancelled_at
FROM lub_before_simplification.event_registrations r JOIN lub.organization_content e ON e.id=r.event_id
LEFT JOIN lub_before_simplification.event_attendance a ON a.event_registration_id=r.id LEFT JOIN cutover_responses f ON f.id=r.form_response_id WHERE r.user_id=respondent;
 END LOOP;
 PERFORM set_config('request.jwt.claim.sub','',true);
END; $$;

INSERT INTO lub.membership_cases(id,campaign_id,organization_id,kind,user_id,organization_membership_id,status_code,submitted_at,edited_at,decided_at)
SELECT r.id,c.id,c.organization_id,'Renewal',m.user_id,m.id,r.response_code,c.created_at,coalesce(r.responded_at,c.created_at),r.responded_at
FROM lub_before_simplification.membership_renewals r JOIN lub.membership_campaigns c ON c.id=r.renewal_campaign_id
JOIN lub.organization_memberships m ON m.id=r.organization_membership_id;
INSERT INTO lub.history_events(id,organization_id,membership_case_id,event_code,from_status_code,to_status_code,reason,actor_user_id,occurred_at)
SELECT h.id,c.organization_id,c.id,'ApplicationStatus',h.from_status_code,h.to_status_code,coalesce(h.reason,''),h.changed_by_user_id,h.created_at
FROM lub_before_simplification.application_status_history h JOIN lub.membership_cases c ON c.id=h.application_id;

INSERT INTO lub.history_events(id,organization_id,event_registration_id,event_code,to_status_code,reason,actor_user_id,occurred_at)
SELECT h.id,r.organization_id,r.id,'EventRegistrationStatus',h.status_code,h.reason,h.actor_user_id,h.created_at
FROM lub_before_simplification.event_registration_history h JOIN lub.event_registrations r ON r.id=h.event_registration_id;

INSERT INTO lub.task_participants(id,task_id,organization_id,organization_membership_id,user_id,status_code,joined_at,withdrawn_at,closed_at,
 reviewed_by_user_id,approved_hours_override,submissions,show_in_portfolio,display_title,display_description,is_featured_work,portfolio_updated_at)
SELECT p.id,p.task_id,t.organization_id,p.organization_membership_id,p.user_id,p.status_code,p.joined_at,p.withdrawn_at,p.closed_at,
 p.reviewed_by_user_id,p.approved_hours_override,coalesce((
  SELECT jsonb_agg(jsonb_build_object('id',s.id,'revision_number',s.revision_number,'message',s.message,
   'status_code',CASE WHEN s.withdrawn_at IS NOT NULL THEN 'Withdrawn' ELSE s.status_code END,'submitted_at',s.submitted_at,
   'reviewed_at',s.reviewed_at,'reviewed_by_user_id',s.reviewed_by_user_id,'review_note',s.review_note,
   'review_decision_code',s.review_decision_code,'withdrawn_at',s.withdrawn_at,'task_snapshot',v.snapshot_json,
   'attachments',coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.asset_id,'assetId',a.asset_id) ORDER BY a.asset_id)
    FROM lub_before_simplification.task_submission_assets a WHERE a.task_submission_id=s.id),'[]'))
   ORDER BY s.revision_number,s.id)
  FROM lub_before_simplification.task_submissions s JOIN lub_before_simplification.task_revisions v ON v.id=s.task_revision_id
  WHERE s.task_participant_id=p.id),'[]'),
 w.id IS NOT NULL,w.display_title,coalesce(w.display_description,''),coalesce(w.is_featured,false),w.updated_at
FROM lub_before_simplification.task_participants p JOIN lub.tasks t ON t.id=p.task_id
LEFT JOIN lub_before_simplification.student_projects w ON w.task_participant_id=p.id;

UPDATE lub.users u SET
 links=coalesce((SELECT jsonb_agg(jsonb_build_object('id',l.id,'type',l.link_type,'label',l.label,'value',l.url_or_value) ORDER BY l.id)
  FROM lub_before_simplification.profile_links l WHERE l.user_id=u.id AND l.is_public),'[]'),
 notifications=coalesce((SELECT jsonb_agg(jsonb_build_object('id',n.id,'typeCode',n.type_code,'title',n.title,'body',n.body,
  'targetUrl',n.target_url,'createdAt',n.created_at,'readAt',n.read_at) ORDER BY n.created_at,n.id)
  FROM lub_before_simplification.notifications n WHERE n.recipient_user_id=u.id),'[]');

CREATE TEMP TABLE cutover_skills ON COMMIT DROP AS
SELECT id,coalesce(dictionary_key,lub.skill_key(name_ar)) AS key,name_ar,name_en,aliases
FROM lub_before_simplification.skills WHERE is_active;
INSERT INTO lub.skills(canonical_key,name_ar,name_en,aliases)
SELECT DISTINCT ON(key) key,name_ar,name_en,aliases FROM cutover_skills ORDER BY key,id
ON CONFLICT(canonical_key) DO NOTHING;
UPDATE lub.users u SET skills=coalesce((
 SELECT jsonb_agg(jsonb_build_object('id',s.id,'sortOrder',s.sort_order,'isFeatured',s.is_featured) ORDER BY s.sort_order,s.id)
 FROM (SELECT DISTINCT ON(ns.id) ns.id,old.sort_order,old.is_featured
  FROM lub_before_simplification.student_skills old JOIN cutover_skills m ON m.id=old.skill_id
  JOIN lub.skills ns ON ns.canonical_key=m.key WHERE old.user_id=u.id AND old.is_public
  ORDER BY ns.id,old.is_featured DESC,old.sort_order) s),'[]');
UPDATE lub.tasks t SET skill_ids=coalesce((
 SELECT jsonb_agg(DISTINCT ns.id) FROM lub_before_simplification.task_skill_tags old JOIN cutover_skills m ON m.id=old.skill_id
 JOIN lub.skills ns ON ns.canonical_key=m.key WHERE old.task_id=t.id),'[]');
UPDATE lub.organization_content e SET skill_ids=coalesce((
 SELECT jsonb_agg(DISTINCT ns.id) FROM lub_before_simplification.event_skill_tags old JOIN cutover_skills m ON m.id=old.skill_id
 JOIN lub.skills ns ON ns.canonical_key=m.key WHERE old.event_id=e.id),'[]') WHERE e.kind='Event';
