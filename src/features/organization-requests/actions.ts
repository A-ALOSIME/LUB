"use server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { revalidatePath, updateTag } from "next/cache";
import { withUser } from "@/db/client";
import { requireUser } from "@/features/auth/session";
import {
  inspectAvatar,
  stripAvatarMetadata,
} from "@/features/profile/avatar-file";
import type { FormState } from "@/lib/validation";
export type OpeningRequestState = FormState & { redirectTo?: string };
const inputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  type: z.enum(["Club", "Council"]),
  summary: z.string().trim().min(1).max(1000),
  mission: z.string().trim().min(1).max(3000),
  interests: z.array(z.string().trim().min(1).max(40)).max(20),
});
export async function mutateOpeningRequest(
  _previous: OpeningRequestState,
  form: FormData,
): Promise<OpeningRequestState> {
  const user = await requireUser();
  let created = false;
  try {
    const operation = z
      .enum(["submit", "withdraw", "Accepted", "Rejected"])
      .parse(form.get("operation"));
    await withUser(user.id, async (tx) => {
      if (operation === "submit") {
        const input = inputSchema.parse({
          name: form.get("name"),
          type: form.get("type"),
          summary: form.get("summary"),
          mission: form.get("mission"),
          interests: [
            ...new Set(
              String(form.get("tagNames") ?? "")
                .split(/[,،\n]/u)
                .map((x) => x.trim())
                .filter(Boolean),
            ),
          ],
        });
        const file = form.get("logo");
        let logo: string | null = null;
        if (file instanceof File && file.size) {
          if (file.size > 73728) throw new Error("Invalid logo size");
          const bytes = stripAvatarMetadata(
            new Uint8Array(await file.arrayBuffer()),
          );
          inspectAvatar(bytes, file.type);
          logo = Buffer.from(bytes).toString("base64");
        } else if (form.get("source") && form.get("removeLogo") !== "on") {
          const source = z.uuid().parse(form.get("source"));
          const [row] = await tx.execute(
            sql`select lub.organization_request_logo(id) as logo from lub.organization_opening_requests where id=${source} and applicant_user_id=${user.id} and status_code in ('Rejected','Withdrawn')`,
          );
          logo = typeof row?.logo === "string" ? row.logo : null;
        }
        await tx.execute(
          sql`select lub.submit_organization_request(${input.name},${input.type},${input.summary},${input.mission},${JSON.stringify(input.interests)}::jsonb,${logo})`,
        );
        created = true;
      } else {
        const id = z.uuid().parse(form.get("request"));
        if (operation === "withdraw")
          await tx.execute(
            sql`select lub.withdraw_organization_request(${id})`,
          );
        else {
          const note = z
            .string()
            .trim()
            .max(1000)
            .min(operation === "Rejected" ? 1 : 0)
            .parse(form.get("note") ?? "");
          await tx.execute(
            sql`select lub.decide_organization_request(${id},${operation},${note})`,
          );
        }
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError)
      return {
        error: "راجع الحقول المطلوبة.",
        fieldErrors: Object.fromEntries(
          Object.keys(z.flattenError(error).fieldErrors).map((key) => [
            key,
            ["راجع هذا الحقل."],
          ]),
        ),
      };
    const cause =
      error instanceof Error && error.cause instanceof Error
        ? error.cause
        : error;
    if (
      cause instanceof Error &&
      cause.message.includes("OPENING_REQUEST_PENDING")
    )
      return {
        error: "لديك طلب قيد المراجعة بالفعل. يمكنك متابعته في طلباتك.",
      };
    if (
      cause instanceof Error &&
      cause.message.includes("ORGANIZATION_NAME_EXISTS")
    )
      return { error: "توجد جهة بهذا الاسم. اختر اسمًا مختلفًا." };
    return {
      error:
        "تعذّر حفظ الطلب. راجع البيانات والصلاحيات وحدّث الصفحة إذا تم اتخاذ قرار عليه.",
    };
  }
  updateTag("public-organizations");
  updateTag("public-talent");
  revalidatePath("/applications");
  revalidatePath("/manage", "layout");
  revalidatePath("/notifications");
  return {
    success: created ? "تم إرسال طلب فتح الجهة." : "تم حفظ القرار.",
    ...(created ? { redirectTo: "/applications?tab=organizations" } : {}),
  };
}
