"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/features/auth/session";
import { updateAdminAccountName } from "./management-repository";
import type { FormState } from "@/lib/validation";

const adminNameSchema = z.object({
  fullName: z.string().trim().min(3, "أدخل الاسم الكامل.").max(120, "الاسم طويل جدًا."),
});

export async function saveAdminAccountName(_previous: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = adminNameSchema.safeParse({ fullName: form.get("fullName") });
  if (!parsed.success) return { error: "راجع الاسم المدخل.", fieldErrors: z.flattenError(parsed.error).fieldErrors };

  try {
    await updateAdminAccountName(user.id, parsed.data.fullName);
  } catch {
    return { error: "تعذّر حفظ الاسم. تأكد من صلاحيتك وحاول مرة أخرى." };
  }

  revalidatePath("/manage/account");
  revalidatePath("/manage/admins");
  redirect("/manage/account?saved=1");
}
