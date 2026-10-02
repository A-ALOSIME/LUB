import { expect, it } from "vitest";
import { createOrganizationSchema, organizationProfileSchema, committeeSchema, discoverySchema } from "./validation";

const profile = { nameAr: "نادي التقنية", summary: "نلتقي لنتعلّم", mission: "مساحة طلابية", logoUrl: "", showLeadershipPublicly: false, tagNames: "تقني، تطوعي، تقني", websiteUrl: "https://example.com" };
it("normalizes distinct Arabic interests and validates the public profile", () => {
  expect(organizationProfileSchema.parse(profile).tagNames).toEqual(["تقني", "تطوعي"]);
  expect(organizationProfileSchema.parse(profile).showLeadershipPublicly).toBe(false);
});
it("rejects script URLs, embedded credentials and excessive tag input", () => {
  for (const websiteUrl of ["javascript:alert(1)", "http://example.com", "https://secret@example.com", "https://example.com/\nsecret"]) expect(organizationProfileSchema.safeParse({ ...profile, websiteUrl }).success).toBe(false);
  for (const logoUrl of ["javascript:alert(1)", "http://example.com/logo.png", "https://secret@example.com/logo.png"]) expect(organizationProfileSchema.safeParse({ ...profile, logoUrl }).success).toBe(false);
  expect(organizationProfileSchema.safeParse({ ...profile, tagNames: Array.from({ length: 11 }, (_, i) => `مجال${i}`).join(",") }).success).toBe(false);
});
it("bounds discovery input and does not silently accept arbitrary filter types", () => {
  expect(discoverySchema.parse({}).page).toBe(1);
  expect(discoverySchema.safeParse({ q: "x".repeat(81) }).success).toBe(false);
  expect(discoverySchema.safeParse({ type: "Admin", page: 0 }).success).toBe(false);
  expect(discoverySchema.safeParse({ tag: "not-a-uuid" }).success).toBe(false);
});
it("requires stable slugs, known organization types and meaningful committee names", () => {
  expect(createOrganizationSchema.safeParse({ nameAr: "نادي الحاسب", typeCode: "Club", slug: "tech-club", summary: "", mission: "" }).success).toBe(true);
  expect(createOrganizationSchema.safeParse({ nameAr: "نادي الحاسب", typeCode: "Club", slug: "../me", summary: "", mission: "" }).success).toBe(false);
  expect(committeeSchema.safeParse({ name: "x", description: "", isPublic: true }).success).toBe(false);
});
