import { safeReturnPath } from "@/features/auth/return-path";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAppOrigin } from "@/lib/env";

// Supabase's default ConfirmationURL returns a PKCE code to emailRedirectTo.
// https://supabase.com/docs/guides/auth/sessions/pkce-flow
export async function GET(request: NextRequest) {
  const origin = getAppOrigin();
  const codes = request.nextUrl.searchParams.getAll("code");
  let destination = "/login?notice=link-invalid";
  if (codes.length === 1 && codes[0].length > 0 && codes[0].length <= 512) {
    try {
      const client = await createClient(true);
      const { error } = await client.auth.exchangeCodeForSession(codes[0]);
      if (!error) destination = safeReturnPath(request.cookies.get("lub-return-to")?.value);
    } catch { /* Expired links, missing verifier and provider errors fail closed. */ }
  }
  const response = NextResponse.redirect(new URL(destination, origin), 303);
  response.cookies.delete("lub-return-to");
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
