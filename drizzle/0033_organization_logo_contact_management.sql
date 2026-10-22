ALTER TABLE "lub"."organization_links" DROP CONSTRAINT "org_link_https_check";--> statement-breakpoint
ALTER TABLE "lub"."organizations" ADD COLUMN "links_customized" boolean DEFAULT false NOT NULL;--> statement-breakpoint
GRANT UPDATE (links_customized) ON lub.organizations TO authenticated;--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.guard_org_update() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF (NEW.id,NEW.slug,NEW.type_code,NEW.created_at) IS DISTINCT FROM (OLD.id,OLD.slug,OLD.type_code,OLD.created_at) THEN
    RAISE EXCEPTION 'Organization identity is immutable' USING ERRCODE = '42501';
  END IF;
  IF (NEW.status_code,NEW.archived_at) IS DISTINCT FROM (OLD.status_code,OLD.archived_at) AND NOT lub.is_super_admin() THEN
    RAISE EXCEPTION 'Lifecycle requires Super Admin' USING ERRCODE = '42501';
  END IF;
  IF (NEW.name_ar,NEW.summary,NEW.mission,NEW.logo_url,NEW.show_leadership_publicly,NEW.links_customized) IS DISTINCT FROM (OLD.name_ar,OLD.summary,OLD.mission,OLD.logo_url,OLD.show_leadership_publicly,OLD.links_customized)
    AND NOT lub.has_org_permission(OLD.id,'ORG_PROFILE_MANAGE') THEN
    RAISE EXCEPTION 'Profile permission required' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
ALTER TABLE "lub"."organization_links" ADD CONSTRAINT "org_link_https_check" CHECK (("lub"."organization_links"."url" ~ '^https://[^[:space:]@]+$' or "lub"."organization_links"."url" ~ '^mailto:[^[:space:]@]+@[^[:space:]@]+$' or "lub"."organization_links"."url" ~ '^tel:\+?[0-9().-]+$') and char_length("lub"."organization_links"."url") <= 2048);--> statement-breakpoint
INSERT INTO storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
VALUES ('lub-organization-logos', 'lub-organization-logos', true, 2097152, ARRAY['image/png', 'image/svg+xml'])
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;--> statement-breakpoint
CREATE POLICY organization_logos_manager_upload ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'lub-organization-logos'
  AND CASE WHEN name ~* '^organizations/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(png|svg)$'
    THEN lub.has_org_permission(split_part(name, '/', 2)::uuid, 'ORG_PROFILE_MANAGE')
    ELSE false END
);--> statement-breakpoint
CREATE POLICY organization_logos_manager_delete ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'lub-organization-logos'
  AND CASE WHEN name ~* '^organizations/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(png|svg)$'
    THEN lub.has_org_permission(split_part(name, '/', 2)::uuid, 'ORG_PROFILE_MANAGE')
    ELSE false END
);
