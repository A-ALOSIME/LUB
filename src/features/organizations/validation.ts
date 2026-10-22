import { z } from "zod";
import { normalizeOrganizationContact, organizationContactKinds } from "./contact-channels";

export const organizationTypes = { Club: "نادي", Council: "مجلس" } as const;
export const organizationStatuses = { Active: "نشطة", Inactive: "غير نشطة", Archived: "مؤرشفة" } as const;
export const slugSchema = z.string().min(1).max(80).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "استخدم حروفًا إنجليزية صغيرة وأرقامًا، وافصل الكلمات بشرطة.");
const nameAr = z.string().trim().min(2, "اكتب اسمًا من حرفين على الأقل.").max(120);
const summary = z.string().trim().max(1000, "النبذة بحد أقصى 1000 حرف.");
const mission = z.string().trim().max(3000, "الرسالة بحد أقصى 3000 حرف.");
const normalizeArabicDigits = (value: string) => value.replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 0x0660));
const tagNames = z.string().max(500).transform(value => [...new Set(value.split(/[,،\n]/).map(x => x.trim()).filter(Boolean))])
  .pipe(z.array(z.string().max(40, "اسم المجال بحد أقصى 40 حرفًا.")).max(10, "اختر عشرة مجالات على الأكثر."));
const contactChannel = z.object({ kind: z.enum(organizationContactKinds), value: z.string().trim().min(1).max(2048) }).transform((channel, context) => {
  const normalized = normalizeOrganizationContact(channel);
  if (!normalized) {
    context.addIssue({ code: "custom", message: "تحقق من رابط أو بيانات قناة التواصل." });
    return z.NEVER;
  }
  return { linkType: normalized.kind, url: normalized.url };
});
const contacts = z.string().max(32_000).transform((value, context) => {
  try { return JSON.parse(value) as unknown; }
  catch {
    context.addIssue({ code: "custom", message: "قنوات التواصل غير صالحة." });
    return z.NEVER;
  }
}).pipe(z.array(contactChannel).max(12, "أضف 12 قناة تواصل على الأكثر.")).superRefine((items, context) => {
  if (new Set(items.map(item => item.url)).size !== items.length) context.addIssue({ code: "custom", message: "احذف قنوات التواصل المكررة." });
});

export const createOrganizationSchema = z.object({ nameAr, summary, mission, slug: slugSchema, typeCode: z.enum(["Club", "Council"]) });
const publicProfileText = (max: number) => z.string().trim().max(max).optional().default("");
export const organizationPublicProfileContentSchema = z.object({
  vision: publicProfileText(3000),
  values: publicProfileText(4000),
  annualEventCount: z.string().trim().max(5).regex(/^[0-9٠-٩]*$/, "عدد الفعاليات يجب أن يكون رقمًا.").transform(normalizeArabicDigits).optional().default(""),
  participatingStudentCount: z.string().trim().max(6).regex(/^[0-9٠-٩]*$/, "عدد الطلاب يجب أن يكون رقمًا.").transform(normalizeArabicDigits).optional().default(""),
  offerings: publicProfileText(5000),
  goals: publicProfileText(5000),
  fields: publicProfileText(5000),
  programs: publicProfileText(5000),
  achievements: publicProfileText(5000),
  partners: publicProfileText(5000),
  partnersImageUrl: z.string().trim().max(2048).optional().default(""),
});
const emptyPublicProfileContent = { vision: "", values: "", annualEventCount: "", participatingStudentCount: "", offerings: "", goals: "", fields: "", programs: "", achievements: "", partners: "", partnersImageUrl: "" };
export const organizationPublicProfileContentJsonSchema = z.string().max(40_000).transform((value, context) => {
  try { return JSON.parse(value) as unknown; }
  catch {
    context.addIssue({ code: "custom", message: "تفاصيل الصفحة العامة غير صالحة." });
    return z.NEVER;
  }
}).pipe(organizationPublicProfileContentSchema);
export const organizationProfileSchema = z.object({ nameAr, summary, mission, showLeadershipPublicly: z.boolean(), tagNames, contacts, publicProfileContent: organizationPublicProfileContentSchema.default(emptyPublicProfileContent) });
export const announcementSchema = z.object({ title: z.string().trim().min(2).max(120), body: z.string().trim().min(1).max(5000), published: z.boolean(), pinned: z.boolean() }).refine(value => !value.pinned || value.published, { path: ["pinned"], message: "انشر الإعلان قبل تثبيته." });
export type AnnouncementInput = z.infer<typeof announcementSchema>;
export const committeeSchema = z.object({ name: nameAr, description: z.string().trim().max(2000), isPublic: z.boolean(), parentCommitteeId: z.union([z.literal(""), z.uuid()]).default("").transform(value => value || null) });
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
export type OrganizationPublicProfileContentInput = z.infer<typeof organizationPublicProfileContentSchema>;
export type CommitteeInput = z.infer<typeof committeeSchema>;
export type MutationState = { error?: string; success?: string; fieldErrors?: Record<string, string[] | undefined> };
export const mutationOperationSchema = z.enum(["create-org", "org-profile", "org-status", "appoint-leader", "grant-admin", "end-admin", "save-committee", "copy-committee", "committee-status", "save-announcement", "archive-announcement"]);
export type MutationOperation = z.infer<typeof mutationOperationSchema>;
