ALTER TABLE "lub"."committees" ADD COLUMN "parent_committee_id" uuid;--> statement-breakpoint
ALTER TABLE "lub"."organizations" ADD COLUMN "public_profile_content" jsonb;--> statement-breakpoint
ALTER TABLE "lub"."committees" ADD CONSTRAINT "committees_parent_committee_id_organization_id_committees_id_organization_id_fk" FOREIGN KEY ("parent_committee_id","organization_id") REFERENCES "lub"."committees"("id","organization_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "committee_parent_idx" ON "lub"."committees" USING btree ("organization_id","parent_committee_id");--> statement-breakpoint
ALTER TABLE "lub"."committees" ADD CONSTRAINT "committee_parent_not_self_check" CHECK ("lub"."committees"."parent_committee_id" is null or "lub"."committees"."parent_committee_id" <> "lub"."committees"."id");
--> statement-breakpoint
GRANT UPDATE (public_profile_content) ON lub.organizations TO authenticated;
GRANT UPDATE (parent_committee_id) ON lub.committees TO authenticated;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.guard_org_update() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF (NEW.id,NEW.slug,NEW.type_code,NEW.created_at) IS DISTINCT FROM (OLD.id,OLD.slug,OLD.type_code,OLD.created_at) THEN
    RAISE EXCEPTION 'Organization identity is immutable' USING ERRCODE = '42501';
  END IF;
  IF (NEW.status_code,NEW.archived_at) IS DISTINCT FROM (OLD.status_code,OLD.archived_at) AND NOT lub.is_super_admin() THEN
    RAISE EXCEPTION 'Lifecycle requires Super Admin' USING ERRCODE = '42501';
  END IF;
  IF (NEW.name_ar,NEW.summary,NEW.mission,NEW.logo_url,NEW.show_leadership_publicly,NEW.links_customized,NEW.public_profile_content) IS DISTINCT FROM (OLD.name_ar,OLD.summary,OLD.mission,OLD.logo_url,OLD.show_leadership_publicly,OLD.links_customized,OLD.public_profile_content)
    AND NOT lub.has_org_permission(OLD.id,'ORG_PROFILE_MANAGE') THEN
    RAISE EXCEPTION 'Profile permission required' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.guard_committee_update() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE creates_cycle boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.copied_from_committee_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM lub.committees c WHERE c.id = NEW.copied_from_committee_id AND c.organization_id = NEW.organization_id) THEN
      RAISE EXCEPTION 'Committee copy must stay inside its organization' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.parent_committee_id IS DISTINCT FROM OLD.parent_committee_id THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(NEW.organization_id::text, 0));
    WITH RECURSIVE descendants(id) AS (
      SELECT c.id FROM lub.committees c WHERE c.organization_id = NEW.organization_id AND c.parent_committee_id = NEW.id
      UNION
      SELECT child.id FROM lub.committees child JOIN descendants parent ON child.parent_committee_id = parent.id WHERE child.organization_id = NEW.organization_id
    )
    SELECT EXISTS (SELECT 1 FROM descendants WHERE id = NEW.parent_committee_id) INTO creates_cycle;
    IF creates_cycle THEN RAISE EXCEPTION 'Committee hierarchy cannot contain a cycle' USING ERRCODE = '23514'; END IF;
  END IF;
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF (NEW.id,NEW.organization_id,NEW.copied_from_committee_id,NEW.created_at) IS DISTINCT FROM (OLD.id,OLD.organization_id,OLD.copied_from_committee_id,OLD.created_at) THEN
    RAISE EXCEPTION 'Committee identity is immutable' USING ERRCODE = '42501';
  END IF;
  IF (NEW.status_code,NEW.archived_at) IS DISTINCT FROM (OLD.status_code,OLD.archived_at) AND NOT lub.has_org_permission(OLD.organization_id,'COMMITTEE_MANAGE') THEN
    RAISE EXCEPTION 'Committee lifecycle permission required' USING ERRCODE = '42501';
  END IF;
  IF OLD.status_code = 'Archived' AND NEW.status_code = 'Archived' THEN
    RAISE EXCEPTION 'Restore archived committee before editing' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE FUNCTION lub.public_member_count(target_org uuid) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT count(m.id)::integer
  FROM lub.organizations o
  LEFT JOIN lub.organization_memberships m ON m.organization_id = o.id AND m.status_code = 'Active'
    AND m.start_date <= current_date AND (m.end_date IS NULL OR m.end_date > current_date)
  LEFT JOIN lub.users u ON u.id = m.user_id AND u.status_code = 'Active'
  WHERE o.id = target_org AND o.status_code = 'Active' AND u.id IS NOT NULL
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION lub.public_member_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lub.public_member_count(uuid) TO anon, authenticated;
