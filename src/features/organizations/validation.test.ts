import { expect, it } from "vitest";
import { createOrganizationSchema, organizationProfileSchema, committeeSchema, discoverySchema } from "./validation";

const profile = { nameAr: "نادي التقنية", summary: "نلتقي لنتعلّم", mission: "مساحة طلابية", showLeadershipPublicly: false, tagNames: "تقني، تطوعي، تقني", contacts: JSON.stringify([{ kind: "Website", value: "https://example.com" }]) };
it("normalizes distinct Arabic interests and validates the public profile", () => {
  expect(organizationProfileSchema.parse(profile).tagNames).toEqual(["تقني", "تطوعي"]);
  const parsed = organizationProfileSchema.parse(profile);
  expect(parsed.showLeadershipPublicly).toBe(false);
  expect(parsed.contacts).toEqual([{ linkType: "Website", url: "https://example.com/" }]);
  expect(parsed.publicProfileContent.vision).toBe("");
});
it("validates optional public organization details and numeric figures", () => {
  const valid = { vision: "رؤية", values: "قيمة", annualEventCount: "12", participatingStudentCount: "400", offerings: "برامج", goals: "هدف", fields: "مجال", programs: "برنامج", achievements: "إنجاز", partners: "شريك", partnersImageUrl: "" };
  expect(organizationProfileSchema.safeParse({ ...profile, publicProfileContent: valid }).success).toBe(true);
  expect(organizationProfileSchema.safeParse({ ...profile, publicProfileContent: { ...valid, annualEventCount: "12 فعالية" } }).success).toBe(false);
  expect(organizationProfileSchema.safeParse({ ...profile, publicProfileContent: { ...valid, vision: "x".repeat(3001) } }).success).toBe(false);
});
it("rejects unsafe contact URLs, malformed social channels, and excessive tag input", () => {
  for (const value of ["javascript:alert(1)", "http://example.com", "https://secret@example.com", "https://example.com/\nsecret"]) {
    expect(organizationProfileSchema.safeParse({ ...profile, contacts: JSON.stringify([{ kind: "Website", value }]) }).success).toBe(false);
  }
  expect(organizationProfileSchema.safeParse({ ...profile, contacts: "not-json" }).success).toBe(false);
  expect(organizationProfileSchema.safeParse({ ...profile, contacts: JSON.stringify(Array.from({ length: 13 }, (_, index) => ({ kind: "X", value: `https://x.com/${index}` }))) }).success).toBe(false);
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
  expect(committeeSchema.parse({ name: "لجنة البرامج", description: "", isPublic: true }).parentCommitteeId).toBeNull();
});
