import "server-only";
import { sql } from "drizzle-orm";
import { withVisitor } from "@/db/client";
import { normalizeOrganizationContact } from "./contact-channels";
import type { PublicAnnouncement } from "./announcement-types";
import type { OrganizationPublicProfileContent } from "./organization-public-profile";
import type { OrganizationPublicEvent } from "./public-event-grid";
import type { PublicRound } from "@/features/forms/registration-presentation";
import { slugSchema, type DiscoveryFilters } from "./validation";

export type DirectoryOrganization = {
  id: string; slug: string; nameAr: string; nameEn?: string | null; typeCode: string;
  summary: string | null; logoUrl: string; statusCode: string; archivedAt: string | null; tags: string[];
};
type PublicOrganization = {
  organization: DirectoryOrganization & {
    summaryEn?: string; mission: string | null; missionEn?: string;
    publicProfileContent: OrganizationPublicProfileContent | null; memberCount: number; linksCustomized: boolean;
  };
  committees: Array<{
    id: string; name: string; nameEn?: string | null; description: string; descriptionEn?: string;
    parentCommitteeId: string | null; leaderName: string | null; leaderNameEn?: string | null;
  }>;
  contacts: Array<{ id: string; kind: string; value: string }>;
  leadership: Array<{ fullName: string; fullNameEn?: string | null; roleCode: string }>;
  rounds: PublicRound[];
  upcomingEvents: OrganizationPublicEvent[];
  announcements: PublicAnnouncement[];
};

export function normalizePublicTags(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((tag): tag is string => typeof tag === "string");
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter((tag): tag is string => typeof tag === "string");
    } catch {
      // Ignore malformed serialized data rather than failing the page.
    }
  }
  return [];
}

export async function getPublicDirectory(filters: DiscoveryFilters) {
  return withVisitor(async tx => {
    const [row] = await tx.execute<{ data: DirectoryOrganization[] }>(sql`
      select lub.public_organization_directory(${filters.q},${filters.type},${filters.tag},
        ${filters.inactive === "on"},${filters.open === "on"},${filters.upcoming === "on"},${filters.page}::int) as data`);
    const rows = row?.data ?? [];
    return { organizations: rows.slice(0, 24).map(item => ({ ...item, tags: normalizePublicTags(item.tags) })), hasNext: rows.length > 24 };
  });
}

export async function getPublicOrganization(slug: string) {
  if (!slugSchema.safeParse(slug).success) return undefined;
  return withVisitor(async tx => {
    const [row] = await tx.execute<{ data: PublicOrganization | null }>(sql`select lub.public_organization_detail(${slug}) as data`);
    if (!row?.data) return undefined;
    const { organization, contacts, ...detail } = row.data;
    return {
      ...detail,
      organization: { ...organization, tags: normalizePublicTags(organization.tags) },
      moreCommittees: false,
      contacts: contacts.flatMap(link => {
        const contact = normalizeOrganizationContact(link);
        return contact ? [{ id: link.id, label: contact.kind, ...contact }] : [];
      }),
    };
  });
}
