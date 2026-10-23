CREATE FUNCTION lub.public_committee_leader(target_org uuid, target_committee uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p.full_name_ar::text
  FROM lub.committees c
  JOIN lub.organizations o ON o.id = c.organization_id
  JOIN lub.role_assignments r ON r.organization_id = c.organization_id AND r.committee_id = c.id
  JOIN lub.organization_memberships m ON m.id = r.organization_membership_id AND m.organization_id = r.organization_id
  JOIN lub.users u ON u.id = m.user_id
  JOIN lub.student_profiles p ON p.user_id = u.id
  WHERE o.id = target_org AND c.id = target_committee
    AND o.status_code = 'Active' AND o.show_leadership_publicly
    AND c.is_public AND c.status_code = 'Active'
    AND u.status_code = 'Active' AND m.status_code = 'Active'
    AND m.start_date <= current_date AND (m.end_date IS NULL OR m.end_date > current_date)
    AND r.role_code = 'CL' AND r.start_date <= current_date AND (r.end_date IS NULL OR r.end_date > current_date)
  ORDER BY r.start_date DESC, r.id DESC LIMIT 1
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION lub.public_committee_leader(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lub.public_committee_leader(uuid,uuid) TO anon, authenticated;
