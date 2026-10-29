import "server-only";
import {localOrganizationContent} from "@/features/organizations/local-content";
import { sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { withUser, withVisitor } from "@/db/client";
import type { TalentFilters } from "./filters";
export function talentOrganizationLogo(name:string,logo:string|null|undefined){return logo??(localOrganizationContent(name,"Club")??localOrganizationContent(name,"Council"))?.logoSrc??null;}
export type TalentOrganization = {
  name: string;
  slug: string;
  logo: string | null;
};
export type TalentCard = {
  organizations?: TalentOrganization[];
  id: string;
  name: string;
  major: string;
  bio: string | null;
  skills: string[];
  level: string;
  total: string | null;
  avatar_version: string | null;
};
export type PublicTalent = Omit<TalentCard, "organizations"> & {
  indexable?: boolean;
  stats?: { organizations: number; events: number };
  links: Array<{ kind: string; label: string; value: string }>;
  organizations: Array<{
    id: string;
    name: string;
    slug: string;
    logo?: string | null;
    type?: string;
    archived: boolean;
    hours: string | null;
    memberships: Array<{
      hours?: string;
      start_date: string;
      end_date: string | null;
      status_code: string;
      roles: Array<{
        hours?: string;
        code: string;
        starts: string;
        ends: string | null;
      }>;
    }>;
  }>;
  events: Array<{
    href: string;
    title: string;
    starts_at: string;
    organization: string;
    archived: boolean;
    attendance: string | null;
    contributions: Array<{ kind: string; title: string }>;
  }>;
  projects: Array<{
    id: string;
    title: string;
    description: string;
    featured: boolean;
  }>;
};
export type TalentWorkspace = {
  status: string | null;
  onboarded: boolean;
  bio: string;
  settings: {
    public_profile_enabled: boolean;
    public_slug?: string;
    allow_indexing?: boolean;
  };
  links: Array<{
    id: string;
    link_type: string;
    label: string;
    url_or_value: string;
    is_public: boolean;
  }>;
  skills: Array<{ name: string; public: boolean }>;
  projects: Array<{
    id: string;
    task_participant_id: string | null;
    event_contribution_id: string | null;
    display_title: string;
    display_description: string;
    is_featured: boolean;
  }>;
  sources: Array<{ id: string; kind: string; title: string }>;
};
export type TalentPages = {
  organizations: number;
  events: number;
  projects: number;
  sources: number;
};
async function readTalentDirectory(
  q: string,
  skill: string | null,
  page: number,
) {
  return withVisitor(
    async (tx) =>
      (await tx.execute(
        sql`select * from lub.talent_directory(${q},${skill},${page * 24})`,
      )) as unknown as TalentCard[],
  );
}
const readPopularTalent = unstable_cache(
  async () => readTalentDirectory("", null, 0),
  ["public-talent-directory-first-page-v3"],
  { revalidate: 30, tags: ["public-talent"] },
);
export function talentDirectory(q: string, skill: string | null, page: number) {
  // Cache only the common first page; free-text and skill filters bypass shared caching.
  if (!q && !skill && page === 0) return readPopularTalent();
  return readTalentDirectory(q, skill, page);
}
class PublicTalentNotFound extends Error {}
async function queryPublicTalent(id: string, pages: TalentPages) {
  return withVisitor(async (tx) => {
    const rows = await tx.execute(
      sql`select lub.public_talent(${id},${pages.organizations * 25},${pages.events * 25},${pages.projects * 25}) as profile`,
    );
    const profile=rows[0]?.profile as PublicTalent|null;
    return profile?{...profile,organizations:profile.organizations.map(o=>({...o,logo:talentOrganizationLogo(o.name,o.logo)}))}:null;
  });
}
const readPublicTalent = unstable_cache(
  async (id: string) => {
    const profile = await queryPublicTalent(id, {
      organizations: 0,
      events: 0,
      projects: 0,
      sources: 0,
    });
    // Do not retain missing or private profiles in shared cache keys.
    if (!profile) throw new PublicTalentNotFound();
    return profile;
  },
  ["public-talent-profile-first-page-v5"],
  { revalidate: 30, tags: ["public-talent"] },
);
export async function publicTalent(id: string, pages: TalentPages) {
  if (pages.organizations || pages.events || pages.projects || pages.sources)
    return queryPublicTalent(id, pages);
  try {
    return await readPublicTalent(id);
  } catch (error) {
    if (error instanceof PublicTalentNotFound) return null;
    throw error;
  }
}
export async function talentWorkspace(user: string, pages: TalentPages) {
  return withUser(user, async (tx) => {
    const rows = await tx.execute(
      sql`select w.data || jsonb_build_object('settings',coalesce(w.data->'settings','{}'::jsonb)||coalesce((select jsonb_build_object('public_slug',public_slug,'allow_indexing',allow_indexing) from lub.profile_settings where user_id=${user}),'{}'::jsonb)) as workspace from (select lub.talent_workspace(${pages.projects * 25},${pages.sources * 25}) as data) w`,
    );
    return rows[0]?.workspace as TalentWorkspace | null;
  });
}
export function talentPages(
  s: Record<string, string | undefined>,
): TalentPages {
  const page = (key: string) =>
    Math.floor(Math.min(10000, Math.max(0, Number(s[key]) || 0)));
  return {
    organizations: page("organizations"),
    events: page("events"),
    projects: page("projects"),
    sources: page("sources"),
  };
}

export async function talentSkillOptions() {
  return withVisitor(async (tx) =>
    (await tx.execute(sql`select name from lub.talent_skill_options()`)).map(
      (row) => String(row.name),
    ),
  );
}

export type TalentResults = {
  items: TalentCard[];
  total: number;
  available: number;
  options: { skills: string[]; majors: string[] };
};
async function search(filters: TalentFilters) {
  return withVisitor(async (tx) => {
    const rows = await tx.execute(
      sql`select lub.search_talent(${JSON.stringify(filters)}::jsonb) as result`,
    );
    const result=rows[0].result as TalentResults;
    return {...result,items:result.items.map(item=>({...item,organizations:item.organizations?.map(o=>({...o,logo:talentOrganizationLogo(o.name,o.logo)}))}))};
  });
}
const popular = unstable_cache(
  async () =>
    search({
      q: "",
      skills: [],
      major: "",
      level: "",
      minHours: 0,
      sort: "relevance",
      page: 0,
    }),
  ["public-talent-search-v5"],
  { revalidate: 30, tags: ["public-talent"] },
);
export function searchTalent(filters: TalentFilters) {
  return !filters.q &&
    !filters.skills.length &&
    !filters.major &&
    !filters.level &&
    !filters.minHours &&
    filters.sort === "relevance" &&
    !filters.page
    ? popular()
    : search(filters);
}
export async function isTalentOwner(user: string, slug: string) {
  return withUser(user, async (tx) => {
    const rows = await tx.execute(
      sql`select public_slug=${slug}::uuid as owner from lub.profile_settings where user_id=${user}`,
    );
    return !!rows[0]?.owner;
  });
}
