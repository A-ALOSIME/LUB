"use server";

import { z } from "zod";
import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/features/auth/session";
import { getAccountStatus } from "@/features/profile/repository";
import { createOrganizationSchema, organizationProfileSchema, organizationPublicProfileContentJsonSchema, committeeSchema, announcementSchema, mutationOperationSchema, type MutationOperation, type MutationState } from "./validation";
import { createOrganization, saveOrganizationProfile, appointPrimaryLeader, setOrganizationStatus, grantSuperAdmin, endSuperAdmin, saveCommittee, copyCommittee, setCommitteeStatus, saveAnnouncement, archiveAnnouncement } from "./management-repository";
import { getAuthConfig } from "@/lib/env";
import { isOrganizationImageUrl } from "./logo-file";

const emailSchema = z.email("اكتب بريدًا صحيحًا للحساب المتحقق.").transform(value => value.toLowerCase());
const confirmation = z.literal("on", { error: "أكّد الإجراء قبل المتابعة." });
export async function mutateOrganization(_previous: MutationState, form: FormData): Promise<MutationState> {
  const user = await requireUser();
  let createdId: string | undefined;
  let operation: MutationOperation | "unknown" = "unknown";
  let success = "تم حفظ التغيير.";
  try {
    if (await getAccountStatus(user.id) !== "Active") return { error: "أكمل بيانات حسابك وتأكد من أنه نشط قبل المتابعة." };
    operation = mutationOperationSchema.parse(form.get("operation"));
    const organizationId = () => z.uuid().parse(form.get("organizationId"));
    const texts = { nameAr: form.get("nameAr"), summary: form.get("summary") ?? "", mission: form.get("mission") ?? "" };
    switch (operation) {
      case "create-org":
        {const email=String(form.get("email")??"").trim();const created=await createOrganization(user.id,createOrganizationSchema.parse({...texts,slug:form.get("slug"),typeCode:form.get("typeCode")}),email?emailSchema.parse(email):undefined);createdId=created.id;}
        break;
      case "org-profile":
        {
          const id = organizationId();
          const publicProfileContent = organizationPublicProfileContentJsonSchema.parse(String(form.get("publicProfileContent") ?? "{}"));
          const authConfig = getAuthConfig();
          if (publicProfileContent.partnersImageUrl && (!authConfig || !isOrganizationImageUrl(publicProfileContent.partnersImageUrl, id, authConfig.url))) {
            return { error: "صورة الشركاء يجب أن تكون مرفوعة إلى مساحة الجهة." };
          }
          await saveOrganizationProfile(user.id, id, organizationProfileSchema.parse({ ...texts, showLeadershipPublicly: form.get("showLeadershipPublicly") === "on", tagNames: form.get("tagNames") ?? "", contacts: form.get("contacts") ?? "[]", publicProfileContent }));
        }
        success = "تم حفظ بيانات الجهة.";
        break;
      case "org-status":
        confirmation.parse(form.get("confirmed"));
        await setOrganizationStatus(user.id, organizationId(), z.enum(["Active", "Inactive", "Archived"]).parse(form.get("status")));
        success = "تم تحديث حالة الجهة.";
        break;
      case "appoint-leader":
        confirmation.parse(form.get("confirmed"));
        await appointPrimaryLeader(user.id, organizationId(), emailSchema.parse(String(form.get("email") ?? "").trim()));
        success = "تم تعيين القائد الأساسي وحفظ تاريخ الأدوار.";
        break;
      case "grant-admin":
        confirmation.parse(form.get("confirmed"));
        await grantSuperAdmin(user.id, emailSchema.parse(String(form.get("email") ?? "").trim()));
        success = "تم منح صلاحية المشرف العام.";
        break;
      case "end-admin":
        confirmation.parse(form.get("confirmed"));
        await endSuperAdmin(user.id, z.uuid().parse(form.get("targetUserId")));
        success = "تم إنهاء صلاحية المشرف العام.";
        break;
      case "save-committee":
        await saveCommittee(user.id, organizationId(), committeeSchema.parse({ name: form.get("name"), description: form.get("description") ?? "", isPublic: form.get("isPublic") === "on", parentCommitteeId: form.get("parentCommitteeId") ?? "" }), form.get("committeeId") ? z.uuid().parse(form.get("committeeId")) : undefined);
        success = "تم حفظ اللجنة.";
        break;
      case "copy-committee":
        await copyCommittee(user.id, organizationId(), z.uuid().parse(form.get("committeeId")));
        success = "تم نسخ بيانات اللجنة بدون أعضاء أو أدوار.";
        break;
      case "committee-status":
        confirmation.parse(form.get("confirmed"));
        await setCommitteeStatus(user.id, organizationId(), z.uuid().parse(form.get("committeeId")), z.enum(["Active", "Archived"]).parse(form.get("status")));
        success = "تم تحديث حالة اللجنة.";
        break;
      case "save-announcement":
        await saveAnnouncement(user.id, organizationId(), announcementSchema.parse({ title: form.get("title"), body: form.get("body"), published: form.get("published") === "on", pinned: form.get("pinned") === "on" }), form.get("announcementId") ? z.uuid().parse(form.get("announcementId")) : undefined);
        success = "تم حفظ الإعلان.";
        break;
      case "archive-announcement":
        confirmation.parse(form.get("confirmed"));
        await archiveAnnouncement(user.id, organizationId(), z.uuid().parse(form.get("announcementId")));
        success = "تمت أرشفة الإعلان.";
        break;
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of error.issues) {
        const key = String(issue.path[0] ?? "form");
        (fieldErrors[key] ??= []).push(/[\u0600-\u06ff]/.test(issue.message) ? issue.message : "راجع هذا الحقل.");
      }
      return { error: "راجع بيانات النموذج وأكّد الإجراء إذا طُلب منك.", fieldErrors };
    }
    const cause = error instanceof Error && error.cause instanceof Error ? error.cause : error;
    if (operation === "org-profile") {
      const details = cause && typeof cause === "object" ? cause as Record<string, unknown> : {};
      console.error("Organization profile save failed", {
        name: cause instanceof Error ? cause.name : typeof cause,
        code: typeof details.code === "string" ? details.code : undefined,
        constraint: typeof details.constraint_name === "string" ? details.constraint_name : undefined,
        table: typeof details.table_name === "string" ? details.table_name : undefined,
        column: typeof details.column_name === "string" ? details.column_name : undefined,
      });
    }
    if(cause&&typeof cause==="object"&&"code" in cause&&cause.code==="23505"&&(("constraint_name" in cause&&String(cause.constraint_name).includes("slug"))||("constraint" in cause&&String(cause.constraint).includes("slug"))))return {error:"اسم الرابط مستخدم بالفعل. اختر اسمًا آخر.",fieldErrors:{slug:["اسم الرابط مستخدم بالفعل. اختر اسمًا آخر."]}};
    if(cause instanceof Error&&cause.message.includes("ORGANIZATION_NAME_EXISTS"))return {error:"توجد جهة بهذا الاسم. اختر اسمًا مختلفًا."};
    if (cause instanceof Error && cause.message === "Last active Super Admin cannot be ended") return { error: "لا يمكن إنهاء صلاحية آخر مشرف عام نشط." };
    if (cause instanceof Error && cause.message === "Verified onboarded candidate required") return { error: "الحساب المحدد يحتاج التحقق من بريده وإكمال بياناته أولًا." };
    return { error: "تعذّر تنفيذ الإجراء. تحقق من صلاحياتك وصحة البيانات. عند تعيين حساب، يجب أن يكون متحققًا ومكتمل البيانات." };
  }
  updateTag("public-organizations");
  updateTag("public-talent");
  revalidatePath("/organizations", "layout");
  revalidatePath("/manage", "layout");
  revalidatePath("/me");
  if (createdId) redirect(`/manage/organizations/${createdId}/edit`);
  return { success };
}
