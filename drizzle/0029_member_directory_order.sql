-- Keep one set of sort columns in the member directory projection.
CREATE OR REPLACE FUNCTION lub.organization_member_directory(org uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF NOT lub.has_org_permission(org,'MEMBERS_VIEW') AND NOT lub.has_org_permission(org,'MEMBERS_MANAGE') AND NOT EXISTS(SELECT 1 FROM lub.committees c WHERE c.organization_id=org AND lub.has_org_permission(org,'MEMBERS_VIEW',c.id)) THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 SELECT jsonb_build_object(
  'canManage',lub.has_org_permission(org,'MEMBERS_MANAGE'),
  'canGrant',lub.has_org_permission(org,'PERMISSIONS_GRANT'),
  'canAddHours',lub.has_org_permission(org,'HOURS_MANUAL_ADD'),
  'terms',coalesce((SELECT jsonb_agg(jsonb_build_object('id',t.id,'name',t.name_ar,'year',t.academic_year,'termCode',t.term_code,'startDate',t.start_date,'endDate',t.end_date) ORDER BY t.start_date DESC,t.id) FROM (SELECT id,name_ar,academic_year,term_code,start_date,end_date FROM lub.academic_terms ORDER BY start_date DESC,id LIMIT 30) t),'[]'::jsonb),
  'committees',coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'name',c.name) ORDER BY c.name,c.id) FROM lub.committees c WHERE c.organization_id=org AND c.status_code='Active' AND (lub.has_org_permission(org,'MEMBERS_VIEW') OR lub.has_org_permission(org,'MEMBERS_MANAGE') OR lub.has_org_permission(org,'MEMBERS_VIEW',c.id))),'[]'::jsonb),
  'members',coalesce((SELECT jsonb_agg(row_data ORDER BY member_name,member_id) FROM (
   SELECT jsonb_build_object(
    'id',m.id,'name',p.full_name_ar,'major',p.major_name,'level',p.academic_level,'status',m.status_code,'startDate',m.start_date,'endDate',m.end_date,
    'canManage',m.status_code='Active' AND lub.has_org_permission(org,'MEMBERS_MANAGE'),
    'hours',coalesce((SELECT sum(h.hours) FROM lub.hour_records h WHERE h.organization_membership_id=m.id AND h.organization_id=org AND h.status_code='Approved' AND (lub.has_org_permission(org,'MEMBERS_VIEW') OR (h.committee_id IS NOT NULL AND lub.has_org_permission(org,'MEMBERS_VIEW',h.committee_id)))),0),
    'roles',coalesce((SELECT jsonb_agg(jsonb_build_object('code',r.role_code,'committee',c.name) ORDER BY r.role_code,c.name) FROM lub.role_assignments r LEFT JOIN lub.committees c ON c.id=r.committee_id WHERE r.organization_membership_id=m.id AND r.start_date<=current_date AND (r.end_date IS NULL OR r.end_date>current_date) AND (lub.has_org_permission(org,'MEMBERS_VIEW') OR lub.has_org_permission(org,'MEMBERS_MANAGE') OR (r.committee_id IS NOT NULL AND lub.has_org_permission(org,'MEMBERS_VIEW',r.committee_id)))),'[]'::jsonb),
    'committees',coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'name',c.name) ORDER BY c.name,c.id) FROM lub.committee_memberships cm JOIN lub.committees c ON c.id=cm.committee_id WHERE cm.organization_membership_id=m.id AND cm.status_code='Active' AND cm.start_date<=current_date AND (cm.end_date IS NULL OR cm.end_date>current_date) AND (lub.has_org_permission(org,'MEMBERS_VIEW') OR lub.has_org_permission(org,'MEMBERS_VIEW',c.id))),'[]'::jsonb),
    'hourScopes',coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'name',c.name) ORDER BY c.name,c.id) FROM lub.committee_memberships cm JOIN lub.committees c ON c.id=cm.committee_id WHERE cm.organization_membership_id=m.id AND cm.status_code='Active' AND cm.start_date<=current_date AND (cm.end_date IS NULL OR cm.end_date>current_date) AND c.status_code='Active' AND lub.has_org_permission(org,'HOURS_MANUAL_ADD',c.id)),'[]'::jsonb)
   ) AS row_data,m.id AS member_id,p.full_name_ar AS member_name
   FROM lub.organization_memberships m JOIN lub.student_profiles p ON p.user_id=m.user_id JOIN lub.users u ON u.id=m.user_id
   WHERE m.organization_id=org AND u.status_code='Active' AND (((lub.has_org_permission(org,'MEMBERS_VIEW') OR lub.has_org_permission(org,'MEMBERS_MANAGE')) AND m.status_code IN ('Active','Ended','Inactive')) OR (m.status_code='Active' AND EXISTS(SELECT 1 FROM lub.committee_memberships cm JOIN lub.committees c ON c.id=cm.committee_id WHERE cm.organization_membership_id=m.id AND cm.status_code='Active' AND cm.start_date<=current_date AND (cm.end_date IS NULL OR cm.end_date>current_date) AND lub.has_org_permission(org,'MEMBERS_VIEW',c.id))))
   ORDER BY p.full_name_ar,m.id LIMIT 500
  ) members_page),'[]'::jsonb)
 ) INTO result;
 RETURN result;
END; $$;

