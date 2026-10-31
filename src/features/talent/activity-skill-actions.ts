"use server";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { withUser } from "@/db/client";
import { requireUser } from "@/features/auth/session";
import type { ProfileSkill } from "./profile-skills-model";
export async function searchActivitySkills(
  query: string,
): Promise<ProfileSkill[]> {
  const user = await requireUser(),
    q = z.string().trim().min(2).max(80).safeParse(query);
  if (!q.success) return [];
  return withUser(user.id, async (tx) => {
    const [row] = await tx.execute(
      sql`select lub.skill_catalog_rows(${q.data}) as skills`,
    );
    return row.skills as ProfileSkill[];
  });
}
