"use server";

import { cookies } from "next/headers";
import { safeReturnPath } from "./return-path";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { emailSchema, otpSchema, signupProfileSchema, type FormState } from "@/lib/validation";
import { getAuthConfig, getAppOrigin, isProfileStorageConfigured } from "@/lib/env";
import { completeSignup } from "./complete-signup";
import { decryptSignupDraft, encryptSignupDraft } from "@/lib/identifiers";
import { z } from "zod";

export type CodeState = FormState & { email?: string };

function signupProfileFromForm(form: FormData) {
  return {
    fullName: form.get("fullName"),
    universityId: form.get("universityId"),
    nationalId:form.get("nationalId"),
    major: form.get("major"),
    academicLevel: form.get("academicLevel"),
    phone: form.get("phone") ?? "",
  };
}

export async function requestCode(_previous: CodeState, form: FormData): Promise<CodeState> {
  const email = emailSchema.safeParse(form.get("email"));
  const mode = form.get("mode");
  if (!email.success || (mode !== "login" && mode !== "signup")) return { error: "تأكد من البريد الإلكتروني وحاول مرة ثانية." };
  const profile = mode === "signup" ? signupProfileSchema.safeParse(signupProfileFromForm(form)) : undefined;
  if (profile && !profile.success) return { error: "راجع الحقول الموضحة وأكمل البيانات.", fieldErrors: z.flattenError(profile.error).fieldErrors };
  if (!getAuthConfig()) return { error: "تسجيل الدخول غير متاح الآن. حاول لاحقًا." };
  if (mode === "signup" && !isProfileStorageConfigured()) return { error: "حفظ البيانات غير متاح الآن. حاول لاحقًا." };
  try {
    const encryptedDraft = mode === "signup" && profile?.success ? encryptSignupDraft(JSON.stringify(profile.data), email.data) : undefined;
    const client = await createClient(true);
    const returnTo = safeReturnPath(form.get("returnTo"));
    const appOrigin = getAppOrigin();
    const cookie = await cookies();
    const { error } = await client.auth.signInWithOtp({ email: email.data, options: { shouldCreateUser: mode === "signup", emailRedirectTo: `${appOrigin}/auth/callback` } });
    if (error?.status === 429) return { error: "وصلت حد طلب الرسائل. انتظر قليلًا قبل المحاولة مرة ثانية." };
    if (error?.code === "email_address_not_authorized") return { error: "تعذّر إرسال البريد لهذا العنوان. راجع إعداد مرسل البريد في المشروع." };
    if (error && (mode === "signup" || (error.status && error.status >= 500))) return { error: "تعذّر إرسال الرسالة الآن. حاول بعد قليل." };
    if (returnTo === "/me") cookie.delete("lub-return-to");
    else cookie.set("lub-return-to", returnTo, { httpOnly:true, sameSite:"lax", secure:appOrigin.startsWith("https:"), path:"/", maxAge:3600 });
    if (encryptedDraft) {
      cookie.set("lub-signup-draft", encryptedDraft, { httpOnly:true, sameSite:"lax", secure:appOrigin.startsWith("https:"), path:"/", maxAge:3600 });
    } else cookie.delete("lub-signup-draft");
    // Return the same state for unknown and known accounts to avoid enumeration.
    return { email: email.data };
  } catch { return { error: "تعذّر إرسال الرسالة الآن. حاول بعد قليل." }; }
}

export async function verifyCode(_previous: FormState, form: FormData): Promise<FormState> {
  const email = emailSchema.safeParse(form.get("email"));
  const token = otpSchema.safeParse(form.get("token"));
  const mode = form.get("mode");
  if (mode !== "login" && mode !== "signup") return { error: "تأكد من البريد الإلكتروني وحاول مرة ثانية." };
  if (!email.success || !token.success) return { error: "أدخل رمز التحقق المكوّن من 6 أرقام." };
  if (!getAuthConfig()) return { error: "تسجيل الدخول غير متاح الآن. حاول لاحقًا." };
  let profile: z.infer<typeof signupProfileSchema> | undefined;
  if (mode === "signup") {
    if (!isProfileStorageConfigured()) return { error: "حفظ البيانات غير متاح الآن. حاول لاحقًا." };
    try {
      const encryptedDraft = (await cookies()).get("lub-signup-draft")?.value;
      if (!encryptedDraft) return { error: "راجع الحقول الموضحة وأكمل البيانات." };
      const parsed = signupProfileSchema.safeParse(JSON.parse(decryptSignupDraft(encryptedDraft, email.data)));
      if (!parsed.success) return { error: "راجع الحقول الموضحة وأكمل البيانات.", fieldErrors: z.flattenError(parsed.error).fieldErrors };
      profile = parsed.data;
    } catch { return { error: "راجع الحقول الموضحة وأكمل البيانات." }; }
  }
  let verifiedUser: { id: string; email: string; emailVerifiedAt: string } | undefined;
  try {
    const client = await createClient(true);
    const { data, error } = await client.auth.verifyOtp({ email: email.data, token: token.data, type: "email" });
    if (error) return { error: "الرمز غير صحيح أو انتهت صلاحيته. تحقق منه أو اطلب رمزًا جديدًا." };
    if (mode === "signup") {
      const user = data.user;
      if (!user?.email || !user.email_confirmed_at) return { error: "تعذّر التحقق الآن. حاول بعد قليل." };
      verifiedUser = { id: user.id, email: user.email, emailVerifiedAt: user.email_confirmed_at };
    }
  } catch { return { error: "تعذّر التحقق الآن. حاول بعد قليل." }; }
  let nextPath: string | undefined;
  if (mode === "signup" && verifiedUser && profile) {
    try {
      nextPath = await completeSignup(verifiedUser, profile);
    } catch { return { error: "تعذّر حفظ البيانات. تأكد من صحة بياناتك وحاول بعد قليل." }; }
  }
  const cookie = await cookies();
  cookie.delete("lub-return-to");
  if (mode === "signup") cookie.delete("lub-signup-draft");
  if (nextPath) redirect(nextPath);
  redirect(safeReturnPath(form.get("returnTo")));
}

export async function signOut() {
  let failed = false;
  try {
    const client = await createClient(true);
    const { error } = await client.auth.signOut({ scope: "local" });
    failed = Boolean(error);
  } catch { failed = true; }
  redirect(failed ? "/me?notice=signout-failed" : "/login");
}
