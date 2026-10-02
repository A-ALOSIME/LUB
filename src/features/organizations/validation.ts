import { z } from "zod";

export const organizationTypes = { Club: "نادي", Council: "مجلس" } as const;
export const organizationStatuses = { Active: "نشطة", Inactive: "غير نشطة", Archived: "مؤرشفة" } as const;
export const slugSchema = z.string().min(1).max(80).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "استخدم حروفًا إنجليزية صغيرة وأرقامًا، وافصل الكلمات بشرطة.");
const nameAr = z.string().trim().min(2, "اكتب اسمًا من حرفين على الأقل.").max(120);
const summary = z.string().trim().max(1000, "النبذة بحد أقصى 1000 حرف.");
const mission = z.string().trim().max(3000, "الرسالة بحد أقصى 3000 حرف.");
const websiteUrl = z.string().max(2048).refine(value => {
  if (!value) return true;
  if (/\s/.test(value)) return false;
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; }
  catch { return false; }
}, "اكتب رابط HTTPS صالحًا بدون بيانات دخول.");
const tagNames = z.string().max(500).transform(value => [...new Set(value.split(/[,،\n]/).map(x => x.trim()).filter(Boolean))])
  .pipe(z.array(z.string().max(40, "اسم المجال بحد أقصى 40 حرفًا.")).max(10, "اختر عشرة مجالات على الأكثر."));

export const createOrganizationSchema = z.object({ nameAr, summary, mission, slug: slugSchema, typeCode: z.enum(["Club", "Council"]) });
export const organizationProfileSchema = z.object({ nameAr, summary, mission, logoUrl: websiteUrl, showLeadershipPublicly: z.boolean(), tagNames, websiteUrl });
export const announcementSchema = z.object({ title: z.string().trim().min(2).max(120), body: z.string().trim().min(1).max(5000), published: z.boolean(), pinned: z.boolean() }).refine(value => !value.pinned || value.published, { path: ["pinned"], message: "انشر الإعلان قبل تثبيته." });
export type AnnouncementInput = z.infer<typeof announcementSchema>;
export const committeeSchema = z.object({ name: nameAr, description: z.string().trim().max(2000), isPublic: z.boolean() });
export const discoverySchema = z.object({
  q: z.string().trim().max(80).default(""),
  type: z.enum(["", "Club", "Council"]).default(""),
  tag: z.union([z.literal(""), z.uuid()]).default(""),
  inactive: z.enum(["", "on"]).default(""),
  open: z.enum(["", "on"]).default(""),
  upcoming: z.enum(["", "on"]).default(""),
  page: z.coerce.number().int().min(1).max(10000).default(1),
});
export type DiscoveryFilters = z.infer<typeof discoverySchema>;
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type OrganizationProfileInput = z.infer<typeof organizationProfileSchema>;
export type CommitteeInput = z.infer<typeof committeeSchema>;
export type MutationState = { error?: string; success?: string; fieldErrors?: Record<string, string[] | undefined> };
export const mutationOperationSchema = z.enum(["create-org", "org-profile", "org-status", "appoint-leader", "grant-admin", "end-admin", "save-committee", "copy-committee", "committee-status", "save-announcement", "archive-announcement"]);
export type MutationOperation = z.infer<typeof mutationOperationSchema>;
