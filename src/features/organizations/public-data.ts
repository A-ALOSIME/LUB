import "server-only";
import { unstable_cache } from "next/cache";
import { getPublicDirectory, getPublicOrganization } from "./public-repository";

// Only the anon projection is cached. Arguments are part of Next's cache key.
export const readPublicDirectory = unstable_cache(getPublicDirectory, ["public-directory-v6"], { revalidate: 120, tags: ["public-organizations"] });
export const readPublicOrganization = unstable_cache(getPublicOrganization, ["public-organization-v3"], { revalidate: 120, tags: ["public-organizations"] });
