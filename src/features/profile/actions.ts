"use server";

import { safeReturnPath } from "@/features/auth/return-path";
import { z } from "zod";
import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/features/auth/session";
import { profileSchema, type FormState } from "@/lib/validation";
import { isProfileStorageConfigured } from "@/lib/env";
import { saveStudentProfile } from "./repository";

export async function saveProfile(_previous: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!isProfileStorageConfigured()) return { error: "حفظ البيانات غير متاح الآن. حاول لاحقًا." };
  const input = profileSchema.safeParse({
    fullName: form.get("fullName"), universityId: form.get("universityId") || undefined,
    major: form.get("major"), academicLevel: form.get("academicLevel"), phone: form.get("phone") ?? "",
    publicProfileEnabled: form.get("publicProfileEnabled") === "on", showTotalHours: form.get("showTotalHours") === "on",
  });
  if (!input.success) return { error: "راجع الحقول الموضحة وأكمل البيانات.", fieldErrors: z.flattenError(input.error).fieldErrors };
  try { await saveStudentProfile(user, input.data); }
  catch { return { error: "تعذّر حفظ البيانات. تأكد من صحة بياناتك وحاول بعد قليل." }; }
  updateTag("public-organizations");
  updateTag("public-talent");
  revalidatePath("/me");
  revalidatePath("/account");
  redirect(safeReturnPath(form.get("returnTo"), "/me?notice=profile-saved"));
}
