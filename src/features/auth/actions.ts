"use server";

import { cookies } from "next/headers";
import { safeReturnPath } from "./return-path";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { emailSchema, otpSchema, type FormState } from "@/lib/validation";
import { getAuthConfig, getAppOrigin } from "@/lib/env";

export type CodeState = FormState & { email?: string };

export async function requestCode(_previous: CodeState, form: FormData): Promise<CodeState> {
  const email = emailSchema.safeParse(form.get("email"));
  const mode = form.get("mode");
  if (!email.success || (mode !== "login" && mode !== "signup")) return { error: "تأكد من البريد الإلكتروني وحاول مرة ثانية." };
  if (!getAuthConfig()) return { error: "تسجيل الدخول غير متاح الآن. حاول لاحقًا." };
  try {
    const client = await createClient(true);
    const returnTo = safeReturnPath(form.get("returnTo"));
    const cookie = await cookies();
    if (returnTo === "/me") cookie.delete("lub-return-to");
    else cookie.set("lub-return-to", returnTo, { httpOnly:true, sameSite:"lax", secure:getAppOrigin().startsWith("https:"), path:"/", maxAge:3600 });
    const { error } = await client.auth.signInWithOtp({ email: email.data, options: { shouldCreateUser: mode === "signup", emailRedirectTo: `${getAppOrigin()}/auth/callback` } });
    if (error?.status === 429) return { error: "وصلت حد طلب الرسائل. انتظر قليلًا قبل المحاولة مرة ثانية." };
    if (error?.code === "email_address_not_authorized") return { error: "تعذّر إرسال البريد لهذا العنوان. راجع إعداد مرسل البريد في المشروع." };
    if (error && error.status && error.status >= 500) return { error: "تعذّر إرسال الرسالة الآن. حاول بعد قليل." };
    // Return the same state for unknown and known accounts to avoid enumeration.
    return { email: email.data };
  } catch { return { error: "تعذّر إرسال الرسالة الآن. حاول بعد قليل." }; }
}

export async function verifyCode(_previous: FormState, form: FormData): Promise<FormState> {
  const email = emailSchema.safeParse(form.get("email"));
  const token = otpSchema.safeParse(form.get("token"));
  if (!email.success || !token.success) return { error: "أدخل رمز التحقق المكوّن من 8 أرقام." };
  if (!getAuthConfig()) return { error: "تسجيل الدخول غير متاح الآن. حاول لاحقًا." };
  try {
    const client = await createClient(true);
    const { error } = await client.auth.verifyOtp({ email: email.data, token: token.data, type: "email" });
    if (error) return { error: "الرمز غير صحيح أو انتهت صلاحيته. تحقق منه أو اطلب رمزًا جديدًا." };
  } catch { return { error: "تعذّر التحقق الآن. حاول بعد قليل." }; }
  (await cookies()).delete("lub-return-to");
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
