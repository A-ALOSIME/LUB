"use server";

import { safeReturnPath } from "@/features/auth/return-path";
import { z } from "zod";
import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/features/auth/session";
import { studentOperationError } from "@/features/auth/authorization";
import { profileSchema, type FormState } from "@/lib/validation";
import { isProfileStorageConfigured } from "@/lib/env";
import { saveStudentProfile } from "./repository";
import { inspectAvatar, avatarMaxBytes } from "./avatar-file";
import { storeAccountAvatar } from "./avatar-storage";

export async function saveProfile(_previous: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const adminError = await studentOperationError(user.id);
  if (adminError) return { error: adminError };
  if (!isProfileStorageConfigured()) return { error: "حفظ البيانات غير متاح الآن. حاول لاحقًا." };
  const input = profileSchema.safeParse({
    fullName: form.get("fullName"), universityId: form.get("universityId") || undefined,
    nationalId:form.get("nationalId"), major: form.get("major"), academicLevel: form.get("academicLevel"), phone: form.get("phone") ?? "",
  });
  if (!input.success) return { error: "راجع الحقول الموضحة وأكمل البيانات.", fieldErrors: z.flattenError(input.error).fieldErrors };
  const avatarAction = form.get("avatarAction");
  let avatarBytes: Uint8Array | undefined;
  if (avatarAction && avatarAction !== "replace" && avatarAction !== "remove") return {error:"تعذّر حفظ صورة الحساب."};
  if (avatarAction === "replace") {
    const file = form.get("avatar");
    try {
      if (!file || typeof file === "string" || file.size > avatarMaxBytes) throw new Error("Invalid avatar");
      avatarBytes = new Uint8Array(await file.arrayBuffer()); inspectAvatar(avatarBytes,file.type);
    } catch { return {error:"تعذّر حفظ صورة الحساب. اختر صورة JPG أو PNG صالحة حتى 2MB.",fieldErrors:{avatar:["تعذّر معالجة صورة الحساب."]}}; }
  }
  try { await saveStudentProfile(user, input.data); }
  catch(error) {
    const cause=error instanceof Error&&"cause" in error?error.cause:error;
    const constraint=cause&&typeof cause==='object'?('constraint_name' in cause?String(cause.constraint_name):'constraint' in cause?String(cause.constraint):''):'';
    if(constraint.includes('university_id_lookup_hash'))return {error:'الرقم الجامعي مستخدم في حساب آخر.',fieldErrors:{universityId:['الرقم الجامعي مستخدم في حساب آخر.']}};
    if(constraint.includes('national_id_lookup_hash'))return {error:'رقم الهوية مستخدم في حساب آخر.',fieldErrors:{nationalId:['رقم الهوية مستخدم في حساب آخر.']}};
    return {error:'تعذّر حفظ البيانات. تأكد من صحة بياناتك وحاول بعد قليل.'};
  }
  if (avatarAction === "replace" || avatarAction === "remove") {
    try { await storeAccountAvatar(user.id,avatarAction,avatarBytes); }
    catch { revalidatePath("/account"); return {error:"تم حفظ البيانات، لكن تعذّر حفظ الصورة. أعد المحاولة.",fieldErrors:{avatar:["تعذّر حفظ الصورة. أعد المحاولة."]}}; }
  }
  updateTag("public-organizations");
  updateTag("public-talent");
  revalidatePath("/me");
  revalidatePath("/account");
  redirect(safeReturnPath(form.get("returnTo"), "/me?notice=profile-saved"));
}
