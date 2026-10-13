import type { MetadataRoute } from "next";
import { publicKnowledge } from "@/features/ai/knowledge";
import { listEvents } from "@/features/events/repository";
import { readPublicDirectory } from "@/features/organizations/public-data";
import { discoverySchema } from "@/features/organizations/validation";

export const dynamic = "force-dynamic";

const site = "https://lub.community";
const staticPaths = ["/", "/organizations", "/events", "/talent", "/ai"];

async function publicOrganizationPaths(): Promise<string[]> {
  const paths: string[] = [];
  try {
    for (let page = 1; page <= 10_000; page += 1) {
      const directory = await readPublicDirectory(discoverySchema.parse({ page }));
      paths.push(...directory.organizations.map(organization => `/organizations/${organization.slug}`));
      if (!directory.hasNext) break;
    }
  } catch {
    // Keep stable public routes available if the database is temporarily offline.
  }
  return paths;
}

async function publicEventPaths(): Promise<string[]> {
  const paths: string[] = [];
  try {
    for (let page = 0; page < 10_000; page += 1) {
      const events = await listEvents("", "all", page);
      paths.push(...events.slice(0, 24).map(event => `/events/${event.id}`));
      if (events.length <= 24) break;
    }
  } catch {
    // Keep stable public routes available if the database is temporarily offline.
  }
  return paths;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [organizations, events] = await Promise.all([publicOrganizationPaths(), publicEventPaths()]);
  const helpPages = publicKnowledge.map(source => source.url);
  const paths = [...staticPaths, ...helpPages, ...organizations, ...events];

  return [...new Set(paths)].map(path => ({ url: new URL(path, site).toString() }));
}
