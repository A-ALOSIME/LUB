-- Private applicant information is scoped to one readable application and its organization.
CREATE FUNCTION lub.application_member_profile(org uuid,target uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM lub.membership_applications a JOIN lub.registration_rounds r ON r.id=a.registration_round_id WHERE a.id=target AND r.organization_id=org AND (lub.has_org_permission(org,'APPLICATIONS_VIEW') OR lub.has_org_permission(org,'APPLICATIONS_VIEW',a.requested_committee_id)) AND lub.can_read_application(a.id,'APPLICATIONS_VIEW')) THEN RAISE EXCEPTION 'Application permission required' USING ERRCODE='42501';END IF;
 SELECT jsonb_build_object('id',a.id,'userId',p.user_id,'name',p.full_name_ar,'major',p.major_name,'level',p.academic_level,'status',a.status_code,'startDate',a.created_at::date,'endDate',NULL,'universityCiphertext',p.university_id_ciphertext,'nationalCiphertext',n.national_id_ciphertext,'email',u.email,'phone',u.phone,'avatar',NULL,'hours',0,'organization',jsonb_build_object('name',o.name_ar,'slug',o.slug),'roles','[]'::jsonb,'committees','[]'::jsonb,'events','[]'::jsonb)
 INTO result FROM lub.membership_applications a JOIN lub.registration_rounds r ON r.id=a.registration_round_id JOIN lub.organizations o ON o.id=r.organization_id JOIN lub.student_profiles p ON p.user_id=a.applicant_user_id JOIN lub.users u ON u.id=p.user_id LEFT JOIN lub.private_student_identifiers n ON n.user_id=p.user_id WHERE a.id=target AND r.organization_id=org;
 RETURN result;
END;$$;
REVOKE ALL ON FUNCTION lub.application_member_profile(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION lub.application_member_profile(uuid,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
