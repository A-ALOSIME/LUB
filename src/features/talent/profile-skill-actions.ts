"use server";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { updateTag, revalidatePath } from "next/cache";
import { withUser } from "@/db/client";
import { requireStudentUser } from "@/features/auth/authorization";
import type { ProfileSkill } from "./profile-skills-model";
const selectionSchema = z
  .array(
    z
      .object({ key: z.string().min(1).max(120), featured: z.boolean() })
      .strict(),
  )
  .max(30)
  .refine(
    (rows) =>
      new Set(rows.map((r) => r.key)).size === rows.length &&
      rows.filter((r) => r.featured).length <= 5,
  );
export async function searchProfileSkillCatalog(
  query: string,
): Promise<ProfileSkill[]> {
  const user = await requireStudentUser(),
    q = z.string().trim().min(2).max(80).safeParse(query);
  if (!q.success) return [];
  return withUser(user.id, async (tx) => {
    const [row] = await tx.execute(
      sql`select lub.skill_catalog_rows(${q.data}) as skills`,
    );
    return (row?.skills as ProfileSkill[]) ?? [];
  });
}
export async function loadProfileSkills(
  slug: string,
): Promise<{ skills?: ProfileSkill[]; error?: true }> {
  const user = await requireStudentUser();
  try {
    return await withUser(user.id, async (tx) => {
      const [row] = await tx.execute(
        sql`select lub.own_profile_skills(${z.uuid().parse(slug)}) as skills`,
      );
      return { skills: row.skills as ProfileSkill[] };
    });
  } catch {
    return { error: true };
  }
}
export async function saveProfileSkills(
  slug: string,
  selection: unknown,
): Promise<{ skills?: ProfileSkill[]; error?: true }> {
  const user = await requireStudentUser();
  try {
    const profile = z.uuid().parse(slug),
      data = selectionSchema.parse(selection);
    const skills = await withUser(user.id, async (tx) => {
      const [row] = await tx.execute(
        sql`select lub.save_profile_skill_selection(${profile},${JSON.stringify(data)}::jsonb) as skills`,
      );
      return row.skills as ProfileSkill[];
    });
    updateTag("public-talent");
    revalidatePath(`/talent/${profile}`);
    revalidatePath("/account/talent");
    return { skills };
  } catch {
    return { error: true };
  }
}
