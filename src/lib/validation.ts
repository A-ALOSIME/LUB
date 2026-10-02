import { z } from "zod";

export function normalizeDigits(value: string) {
  return value.trim().replace(/[٠-٩۰-۹]/g, (digit) => {
    const code = digit.charCodeAt(0);
    return String(code - (code >= 0x06f0 ? 0x06f0 : 0x0660));
  });
}

export const emailSchema = z.string().trim().toLowerCase().max(254).pipe(z.email("أدخل بريدًا إلكترونيًا صحيحًا."));
export const otpSchema = z.string().transform(normalizeDigits).pipe(z.string().regex(/^\d{8}$/, "أدخل رمز التحقق المكوّن من 8 أرقام."));
export const universityIdSchema = z.string().transform(normalizeDigits).pipe(z.string().regex(/^\d{6,15}$/, "الرقم الجامعي يجب أن يحتوي على 6 إلى 15 رقمًا."));
export const profileSchema = z.object({
  fullName: z.string().trim().min(3, "أدخل اسمك الكامل.").max(120, "الاسم طويل جدًا."),
  universityId: universityIdSchema.optional(),
  major: z.string().trim().min(2, "أدخل تخصصك.").max(120, "اسم التخصص طويل جدًا."),
  academicLevel: z.enum(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "graduate"], { error: "اختر المستوى الدراسي." }),
  phone: z.string().transform(normalizeDigits).pipe(z.string().regex(/^(?:\+?[0-9]{8,15})?$/, "أدخل رقم هاتف صحيحًا أو اتركه فارغًا.")),
  publicProfileEnabled: z.boolean().default(false),
  showTotalHours: z.boolean().default(true),
});
export type ProfileInput = z.infer<typeof profileSchema>;

export type FormState = {
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  success?: string;
};
