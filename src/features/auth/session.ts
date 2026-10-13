import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
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

// Proxy overwrites this header only after Supabase verifies the JWT signature.
// Management pages then use the subject for database reads, where role and
// organization permissions are checked again. Keep this separate from
// getVerifiedUser: account-sensitive work still needs the fresh user record.
export const getVerifiedProxyIdentity = cache(async (): Promise<{ id: string } | null> => {
  const requestHeaders = await headers();
  const id = requestHeaders.get("x-lub-verified-user-id");
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return null;
  return { id };
});

export async function requireVerifiedProxyIdentity(): Promise<{ id: string }> {
  const identity = await getVerifiedProxyIdentity();
  if (!identity) redirect("/login");
  return identity;
}

export async function requireUser(): Promise<VerifiedUser> {
  const identity = await getVerifiedUser();
  if (!identity) redirect("/login");
  return identity;
}
