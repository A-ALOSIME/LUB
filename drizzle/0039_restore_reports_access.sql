CREATE OR REPLACE FUNCTION lub.has_reports_access(org uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT lub.has_org_permission(org,'REPORTS_GENERATE')
 OR EXISTS(SELECT 1 FROM lub.committees c WHERE c.organization_id=org AND lub.has_org_permission(org,'REPORTS_GENERATE',c.id));
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION lub.has_reports_access(uuid) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION lub.has_reports_access(uuid) TO authenticated;
