import "server-only";
import { unstable_cache } from "next/cache";
import { getPublicDirectory, getPublicOrganization } from "./public-repository";
import { slugSchema, type DiscoveryFilters } from "./validation";

const cachedPublicDirectory = unstable_cache(getPublicDirectory, ["public-directory-v7"], { revalidate: 120, tags: ["public-organizations"] });
export function readPublicDirectory(filters: DiscoveryFilters) {
  const isCommonBrowse = !filters.q && !filters.type && !filters.tag && !filters.inactive && !filters.open && !filters.upcoming;
  // Keep free-form filters and unusually deep pagination out of shared cache keys.
  return isCommonBrowse && filters.page <= 10 ? cachedPublicDirectory(filters) : getPublicDirectory(filters);
}

class PublicOrganizationNotFound extends Error {}
const cachedPublicOrganization = unstable_cache(async (slug: string) => {
  const organization = await getPublicOrganization(slug, 0);
  // Do not store arbitrary slug misses in the shared cache.
  if (!organization) throw new PublicOrganizationNotFound();
  return organization;
}, ["public-organization-v5"], { revalidate: 120, tags: ["public-organizations"] });

export async function readPublicOrganization(slug: string, committeePage = 0) {
  if (committeePage !== 0 || !slugSchema.safeParse(slug).success) return getPublicOrganization(slug, committeePage);
  try { return await cachedPublicOrganization(slug); }
  catch (error) { if (error instanceof PublicOrganizationNotFound) return undefined; throw error; }
}
