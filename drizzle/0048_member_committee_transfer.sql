CREATE FUNCTION lub.move_member_committee(target uuid,destination uuid,confirm_role_change boolean DEFAULT false) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE member lub.organization_memberships;
BEGIN
 SELECT * INTO member FROM lub.organization_memberships WHERE id=target FOR UPDATE;
 IF member.id IS NULL OR member.status_code<>'Active' OR member.start_date>current_date OR (member.end_date IS NOT NULL AND member.end_date<=current_date) OR NOT lub.has_org_permission(member.organization_id,'MEMBERS_MANAGE') THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
 IF destination IS NOT NULL AND NOT EXISTS(SELECT 1 FROM lub.committees c WHERE c.id=destination AND c.organization_id=member.organization_id AND c.status_code='Active') THEN RAISE EXCEPTION 'Active same-organization committee required'; END IF;
 IF EXISTS(SELECT 1 FROM lub.role_assignments r WHERE r.organization_membership_id=target AND r.committee_id IS NOT NULL AND r.committee_id IS DISTINCT FROM destination AND r.end_date IS NULL) AND NOT confirm_role_change THEN RAISE EXCEPTION 'Committee leadership change confirmation required'; END IF;
 UPDATE lub.role_assignments SET end_date=greatest(start_date,current_date) WHERE organization_membership_id=target AND committee_id IS NOT NULL AND committee_id IS DISTINCT FROM destination AND end_date IS NULL;
 UPDATE lub.permission_grants SET end_at=greatest(start_at+interval '1 microsecond',statement_timestamp()) WHERE organization_membership_id=target AND committee_id IS NOT NULL AND committee_id IS DISTINCT FROM destination AND (end_at IS NULL OR end_at>statement_timestamp());
 UPDATE lub.committee_memberships SET status_code='Ended',end_date=greatest(start_date,current_date) WHERE organization_membership_id=target AND committee_id IS DISTINCT FROM destination AND status_code='Active' AND end_date IS NULL;
 IF destination IS NOT NULL AND NOT EXISTS(SELECT 1 FROM lub.committee_memberships WHERE organization_membership_id=target AND committee_id=destination AND status_code='Active' AND end_date IS NULL) THEN
  INSERT INTO lub.committee_memberships(organization_id,organization_membership_id,committee_id) VALUES(member.organization_id,target,destination);
 END IF;
 PERFORM lub.application_audit(target,member.organization_id,'MEMBER_COMMITTEE_MOVED');
END; $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION lub.move_member_committee(uuid,uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION lub.move_member_committee(uuid,uuid,boolean) TO authenticated;
