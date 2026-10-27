"use server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { revalidatePath, updateTag } from "next/cache";
import { requireUser } from "@/features/auth/session";
import { withUser } from "@/db/client";
import { slugSchema } from "./validation";
export async function organizationSlugAvailability(
  value: string,
  organizationId?: string,
) {
  const user = await requireUser();
  const slug = slugSchema.safeParse(value);
  if (!slug.success) return { available: false };
  return withUser(user.id, async (tx) => {
    const [row] = await tx.execute(
      sql`select lub.admin_organization_slug_available(${slug.data},${organizationId ? z.uuid().parse(organizationId) : null}) as available`,
    );
    return { available: Boolean(row?.available) };
  });
}
export async function findOrganizationLeader(
  search: string,
): Promise<Array<{ name: string; email: string }>> {
  const user = await requireUser();
  const text = z.string().trim().max(254).parse(search);
  return withUser(user.id, async (tx) => {
    const [row] = await tx.execute(
      sql`select lub.admin_leader_candidates(${text}) as candidates`,
    );
    return row.candidates as Array<{ name: string; email: string }>;
  });
}
export async function saveOrganizationIdentity(
  _previous: { error?: string; success?: string },
  form: FormData,
) {
  const user = await requireUser();
  try {
    const id = z.uuid().parse(form.get("organizationId")),
      slug = slugSchema.parse(form.get("slug")),
      kind = z.enum(["Club", "Council"]).parse(form.get("typeCode"));
    await withUser(user.id, (tx) =>
      tx.execute(
        sql`select lub.admin_update_organization_identity(${id},${slug},${kind})`,
      ),
    );
  } catch {
    return {
      error: "تعذّر حفظ إعدادات الجهة. تحقق من توفر اسم الرابط وصلاحياتك.",
    };
  }
  updateTag("public-organizations");
  updateTag("public-talent");
  revalidatePath("/manage", "layout");
  revalidatePath("/organizations", "layout");
  return { success: "تم حفظ إعدادات الجهة." };
}
