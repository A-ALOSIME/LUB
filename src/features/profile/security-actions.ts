"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser, type VerifiedUser } from "@/features/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getAppOrigin } from "@/lib/env";
import { emailSchema, otpSchema, type FormState } from "@/lib/validation";
import { syncVerifiedAccountEmail } from "./repository";

export type EmailChangeState = FormState & {
  pendingEmail?: string;
  completed?: boolean;
};
async function pendingFor(user: VerifiedUser) {
  const raw = (await cookies()).get("lub-pending-email")?.value;
  if (!raw) return undefined;
  try {
    const pending = z
      .object({
        userId: z.string().max(36),
        email: emailSchema,
        returnTo: z.enum(["/account", "/manage/account"]).optional(),
      })
      .strict()
      .parse(JSON.parse(raw));
    return pending.userId === user.id &&
      pending.email !== user.email.toLowerCase()
      ? pending.email
      : undefined;
  } catch {
    return undefined;
  }
}
export async function getPendingEmailChange() {
  return pendingFor(await requireUser());
}
export async function changeAccountEmail(
  _previous: EmailChangeState,
  form: FormData,
): Promise<EmailChangeState> {
  const user = await requireUser();
  try {
    if (form.get("intent") === "edit") {
      const cookie = await cookies();
      cookie.delete("lub-pending-email");
      cookie.delete("lub-return-to");
      return {};
    }
    const operation = z
      .enum(["request", "confirm"])
      .parse(form.get("operation"));
    const client = await createClient(true),
      cookie = await cookies();
    if (operation === "request") {
      const email = emailSchema.parse(form.get("email"));
      if (email === user.email.toLowerCase())
        return { error: "هذا هو بريدك الحالي. أدخل بريدًا جديدًا." };
      const { error } = await client.auth.updateUser(
        { email },
        { emailRedirectTo: `${getAppOrigin()}/auth/callback` },
      );
      if (error)
        return {
          error:
            "تعذّر إرسال التأكيد. تحقق من البريد وانتظر قليلًا قبل إعادة المحاولة.",
        };
      const options = {
        httpOnly: true,
        sameSite: "lax" as const,
        secure: getAppOrigin().startsWith("https:"),
        path: "/",
        maxAge: 3600,
      };
      const returnTo =
        form.get("returnTo") === "/manage/account"
          ? "/manage/account"
          : "/account";
      cookie.set(
        "lub-pending-email",
        JSON.stringify({ userId: user.id, email, returnTo }),
        options,
      );
      cookie.set("lub-return-to", returnTo, options);
      return {
        pendingEmail: email,
        success:
          "أُرسل رمز التأكيد. يبقى بريدك الحالي فعالًا حتى اكتمال التأكيد.",
      };
    }
    const email = await pendingFor(user);
    if (!email) return { error: "انتهت جلسة تغيير البريد. اطلب رمزًا جديدًا." };
    const token = otpSchema.parse(form.get("token"));
    let { error } = await client.auth.verifyOtp({
      email,
      token,
      type: "email_change",
    });
    // Secure email change sends one code to each address. The provider validates
    // the old-inbox code against the current email, not the requested one.
    if (error?.code === "otp_expired") {
      ({ error } = await client.auth.verifyOtp({
        email: user.email,
        token,
        type: "email_change",
      }));
    }
    if (error)
      return {
        pendingEmail: email,
        error: "الرمز غير صحيح أو انتهت صلاحيته. تحقق منه وأعد المحاولة.",
      };
    // getUser checks the fresh provider identity after OTP; never trust form IDs or the returned session alone.
    const { data, error: identityError } = await client.auth.getUser();
    const updated = data.user;
    if (
      identityError ||
      updated?.id !== user.id ||
      !updated.email ||
      !updated.email_confirmed_at
    )
      return {
        pendingEmail: email,
        error: "تعذّر التحقق من تغيير البريد. أعد تسجيل الدخول وحاول مجددًا.",
      };
    if (updated.email.toLowerCase() !== email)
      return {
        pendingEmail: email,
        success: "تم تأكيد الرمز. أكمل التأكيد الإضافي المرسل إلى بريدك الآخر.",
      };
    await syncVerifiedAccountEmail({
      id: updated.id,
      email: updated.email,
      emailVerifiedAt: updated.email_confirmed_at,
    });
    cookie.delete("lub-pending-email");
    cookie.delete("lub-return-to");
    revalidatePath("/account");
    revalidatePath("/manage/account");
    revalidatePath("/manage", "layout");
    return { completed: true, success: "تم تحديث البريد الإلكتروني." };
  } catch {
    return {
      pendingEmail: await pendingFor(user),
      error: "تعذّر تحديث البريد. راجع الحقول وأعد المحاولة.",
    };
  }
}

export async function changeAccountPassword(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  await requireUser();
  const input = z
    .object({
      password: z.string().min(12).max(128),
      confirmation: z.string().max(128),
    })
    .refine((v) => v.password === v.confirmation)
    .safeParse({
      password: form.get("password"),
      confirmation: form.get("confirmation"),
    });
  if (!input.success)
    return {
      error: "اكتب كلمة مرور من 12 حرفًا على الأقل، وتأكد من تطابق التأكيد.",
    };
  try {
    const client = await createClient(true);
    const { error } = await client.auth.updateUser({
      password: input.data.password,
    });
    if (error)
      return {
        error: "تعذّر تغيير كلمة المرور. أعد تسجيل الدخول ثم حاول مجددًا.",
      };
    return { success: "تم تغيير كلمة المرور." };
  } catch {
    return { error: "تعذّر تغيير كلمة المرور. أعد المحاولة." };
  }
}
