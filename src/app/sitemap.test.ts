import { beforeEach, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/features/organizations/public-data", () => ({ readPublicDirectory: vi.fn() }));
vi.mock("@/features/events/repository", () => ({ listEvents: vi.fn() }));

import { readPublicDirectory } from "@/features/organizations/public-data";
import { listEvents } from "@/features/events/repository";
import sitemap, { dynamic } from "./sitemap";

const directory = vi.mocked(readPublicDirectory);
const events = vi.mocked(listEvents);

it("reads database-backed public URLs at request time rather than freezing build-time data", () => {
  expect(dynamic).toBe("force-dynamic");
});

beforeEach(() => {
  directory.mockReset();
  events.mockReset();
  directory.mockResolvedValue({ organizations: [{ slug: "cyber-club" }], hasNext: false } as never);
  events.mockResolvedValue([{ id: "event-123" }] as never);
});

it("lists public routes and published organization and event pages only", async () => {
  const urls = (await sitemap()).map(entry => entry.url);

  expect(urls).toEqual(expect.arrayContaining([
    "https://lub.community/",
    "https://lub.community/organizations",
    "https://lub.community/events",
    "https://lub.community/talent",
    "https://lub.community/ai",
    "https://lub.community/help/visitor",
    "https://lub.community/organizations/cyber-club",
    "https://lub.community/events/event-123",
  ]));
  expect(urls).not.toContain("https://lub.community/about");
  expect(urls).not.toContain("https://lub.community/talent/private-profile-id");
  expect(urls.some(url => /\/(manage|account|login|signup|applications)(\/|$)/.test(new URL(url).pathname))).toBe(false);
});

it("still serves static discoverable pages when public data is unavailable", async () => {
  directory.mockRejectedValueOnce(new Error("database unavailable"));
  events.mockRejectedValueOnce(new Error("database unavailable"));

  const urls = (await sitemap()).map(entry => entry.url);

  expect(urls).toContain("https://lub.community/");
  expect(urls).not.toContain("https://lub.community/about");
  expect(urls).toContain("https://lub.community/organizations");
  expect(urls).toContain("https://lub.community/events");
  expect(urls).not.toContain("https://lub.community/organizations/cyber-club");
  expect(urls).not.toContain("https://lub.community/events/event-123");
});
