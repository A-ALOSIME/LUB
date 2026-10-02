import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthConfig } from "@/lib/env";

export type VerifiedUser = { id: string; email: string; emailVerifiedAt: string };

export const getVerifiedUser = cache(async (): Promise<VerifiedUser | null> => {
  if (!getAuthConfig()) return null;
  let identity: VerifiedUser | null = null;
  try {
    const client = await createClient();
    // Fresh provider check; never trust user_metadata, form IDs, or getSession().
    const { data: { user }, error } = await client.auth.getUser();
    if (!error && user?.email && user.email_confirmed_at) {
      identity = { id: user.id, email: user.email, emailVerifiedAt: user.email_confirmed_at };
    }
  } catch { identity = null; }
  return identity;
});

export async function requireUser(): Promise<VerifiedUser> {
  const identity = await getVerifiedUser();
  if (!identity) redirect("/login");
  return identity;
}
