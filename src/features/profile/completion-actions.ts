"use server";
import { sql } from "drizzle-orm";
import { withUser } from "@/db/client";
import { getVerifiedUser } from "@/features/auth/session";
export async function claimProfileCompletionNotice() {
  const user = await getVerifiedUser();
  if (!user) return false;
  try {
    return await withUser(user.id, async (tx) => {
      const rows = await tx.execute(
        sql`select lub.claim_profile_completion_notice() as show`,
      );
      return rows[0]?.show === true;
    });
  } catch {
    return false;
  }
}
