import "server-only";
import { and, eq, asc, ilike, sql } from "drizzle-orm";
import { withVisitor } from "@/db/client";
import { organizations } from "@/db/schema";
import { slugSchema, organizationProfileSchema, type DiscoveryFilters } from "./validation";

const publicFields = {
  id: organizations.id, slug: organizations.slug, nameAr: organizations.nameAr,
  typeCode: organizations.typeCode, summary: organizations.summary,
  statusCode: organizations.statusCode, archivedAt: organizations.archivedAt,
  // Qualify the outer reference: Drizzle removes field qualifiers in single-table selects.
  // JSONB has a stable driver representation; varchar[] may arrive as a raw
  // PostgreSQL array string when the driver has not loaded custom type parsers.
  tags: sql<string[]>`coalesce((select jsonb_agg(t.name_ar order by t.name_ar) from lub.tags t join lub.organization_tags ot on ot.tag_id=t.id where ot.organization_id=lub.organizations.id and t.is_active), '[]'::jsonb)`,
};

export function normalizePublicTags(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((tag): tag is string => typeof tag === "string");
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter((tag): tag is string => typeof tag === "string");
    } catch {
      // Ignore malformed serialized data rather than failing the whole page.
    }
  }
  return [];
}

export async function getPublicDirectory(filters: DiscoveryFilters) {
  return withVisitor(async tx => {
    const literalSearch = filters.q.replace(/[\\%_]/g, "\\$&");
    const rows = await tx.select(publicFields).from(organizations).where(and(
      filters.inactive ? undefined : eq(organizations.statusCode, "Active"),
      filters.type ? eq(organizations.typeCode, filters.type) : undefined,
      literalSearch ? ilike(organizations.nameAr, `%${literalSearch}%`) : undefined,
      filters.tag ? sql`exists(select 1 from lub.organization_tags ot where ot.organization_id=${organizations.id} and ot.tag_id=${filters.tag})` : undefined,
      filters.open ? sql`exists(select 1 from lub.registration_rounds r where r.organization_id=${organizations.id} and lub.round_is_open(r.id))` : undefined,
      filters.upcoming ? sql`exists(select 1 from lub.events e where e.organization_id=${organizations.id} and e.status_code='Published' and e.published_at is not null and e.ends_at>=statement_timestamp())` : undefined,
    )).orderBy(sql`case when ${organizations.typeCode} = 'Council' then 0 else 1 end`, asc(organizations.nameAr), asc(organizations.id)).limit(25).offset((filters.page - 1) * 24);
    return { organizations: rows.slice(0, 24).map(row => ({ ...row, tags: normalizePublicTags(row.tags) })), hasNext: rows.length > 24 };
  });
}
export type DirectoryOrganization = Awaited<ReturnType<typeof getPublicDirectory>>["organizations"][number];

export async function getPublicOrganization(slug: string,committeePage=0) {
  if (!slugSchema.safeParse(slug).success) return undefined;
  return withVisitor(async tx => {
    const [result] = await tx.select({ ...publicFields, mission: organizations.mission, logoUrl: organizations.logoUrl,
      committees:sql<Array<{id:string;name:string;description:string}>>`coalesce((select jsonb_agg(c) from(select c.id,c.name,c.description from lub.committees c where c.organization_id=lub.organizations.id and c.is_public and c.status_code='Active' order by c.name,c.id limit 26 offset ${committeePage*25}) c),'[]'::jsonb)`,
      contacts:sql<Array<{id:string;label:string;url:string}>>`coalesce((select jsonb_agg(l) from(select l.id,l.link_type as label,l.url from lub.organization_links l where l.organization_id=lub.organizations.id order by l.sort_order,l.id limit 20) l),'[]'::jsonb)`,
      leadership:sql<Array<{fullName:string;roleCode:string}>>`coalesce((select jsonb_agg(jsonb_build_object('fullName',p.full_name,'roleCode',p.role_code)) from lub.public_leadership(lub.organizations.id) p),'[]'::jsonb)`,
      rounds:sql<Array<{id:string;title:string;open:boolean}>>`coalesce((select jsonb_agg(r) from(select r.id,r.title,lub.round_is_open(r.id) as open from lub.registration_rounds r where r.organization_id=lub.organizations.id order by r.opens_at desc,r.id limit 50) r),'[]'::jsonb)`,
      upcomingEvents:sql<Array<{id:string;title:string;starts_at:string;featured:boolean}>>`coalesce((select jsonb_agg(e) from(select e.id,e.title,e.starts_at,e.is_featured as featured from lub.events e where e.organization_id=lub.organizations.id and e.published_at is not null and e.status_code='Published' and e.ends_at>=statement_timestamp() order by e.is_featured desc,e.starts_at,e.id limit 6) e),'[]'::jsonb)`,
      announcements:sql<Array<{id:string;title:string;body:string;pinned:boolean;published_at:string}>>`coalesce((select jsonb_agg(a) from(select a.id,a.title,a.body,a.pinned_at is not null as pinned,a.published_at from lub.announcements a where a.organization_id=lub.organizations.id and a.published_at is not null and a.published_at<=statement_timestamp() and a.archived_at is null order by a.pinned_at desc nulls last,a.published_at desc,a.id limit 6) a),'[]'::jsonb)`,
    }).from(organizations)
      .where(eq(organizations.slug, slug)).limit(1);
    if (!result) return undefined;
    const{committees,contacts,leadership,rounds,upcomingEvents,announcements,...organization}=result;
    organization.tags = normalizePublicTags(organization.tags);
    return { organization, committees:committees.slice(0,25),moreCommittees:committees.length>25, contacts: contacts.filter(link => organizationProfileSchema.shape.websiteUrl.safeParse(link.url).success), leadership,rounds,upcomingEvents,announcements };
  });
}
