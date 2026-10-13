import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { withUser } from "@/db/client";
import { users } from "@/db/schema";
import { requireUser } from "@/features/auth/session";

const studentAccountMessage = "هذا الحساب مخصص لإدارة النظام، وإجراءات الطلاب غير متاحة له.";

export const isSuperAdminUser = cache(async (userId: string) => {
  return withUser(userId, async tx => {
    const [row] = await tx.select({ allowed: sql<boolean>`lub.is_super_admin()` })
      .from(users).where(eq(users.id, userId)).limit(1);
    return Boolean(row?.allowed);
  });
});

export async function requireStudentUser() {
  const user = await requireUser();
  if (await isSuperAdminUser(user.id)) redirect("/manage");
  return user;
}

export async function studentOperationError(userId: string) {
  return await isSuperAdminUser(userId) ? studentAccountMessage : undefined;
}
