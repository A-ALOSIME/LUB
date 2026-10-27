import {z} from "zod";
import {syncVerifiedAccountEmail} from "@/features/profile/repository";
import { safeReturnPath } from "@/features/auth/return-path";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAppOrigin } from "@/lib/env";
import { decryptSignupDraft } from "@/lib/identifiers";
import { signupProfileSchema } from "@/lib/validation";
import { completeSignup } from "@/features/auth/complete-signup";

// Supabase's default ConfirmationURL returns a PKCE code to emailRedirectTo.
// https://supabase.com/docs/guides/auth/sessions/pkce-flow
export async function GET(request: NextRequest) {
  const origin = getAppOrigin();
  const codes = request.nextUrl.searchParams.getAll("code");
  let destination = "/login?notice=link-invalid";
  let emailChangeComplete=false;
  const pendingEmail=request.cookies.get("lub-pending-email")?.value;
  const signupDraft = request.cookies.get("lub-signup-draft")?.value;
  if (codes.length === 1 && codes[0].length > 0 && codes[0].length <= 512) {
    try {
      const client = await createClient(true);
      const { error } = await client.auth.exchangeCodeForSession(codes[0]);
      if(!error&&pendingEmail){
        const pending=z.object({userId:z.string().max(36),email:z.email(),returnTo:z.enum(['/account','/manage/account']).optional()}).strict().parse(JSON.parse(pendingEmail));
        const {data:{user},error:userError}=await client.auth.getUser();
        if(!userError&&user?.id===pending.userId&&user.email&&user.email_confirmed_at){
          destination=pending.returnTo??'/account';
          if(user.email.toLowerCase()===pending.email.toLowerCase()){
            await syncVerifiedAccountEmail({id:user.id,email:user.email,emailVerifiedAt:user.email_confirmed_at});emailChangeComplete=true;
          }
        }
      } else if (!error && signupDraft) {
        try {
          const { data: { user }, error: userError } = await client.auth.getUser();
          if (!userError && user?.email && user.email_confirmed_at) {
            const profile = signupProfileSchema.safeParse(JSON.parse(decryptSignupDraft(signupDraft, user.email)));
            if (profile.success) {
              const accountDestination = await completeSignup({ id: user.id, email: user.email, emailVerifiedAt: user.email_confirmed_at }, profile.data);
              destination = accountDestination ?? safeReturnPath(request.cookies.get("lub-return-to")?.value);
            } else destination = "/onboarding";
          } else destination = "/onboarding";
        } catch { destination = "/onboarding"; }
      } else if (!error) destination = safeReturnPath(request.cookies.get("lub-return-to")?.value);
    } catch { /* Expired links, missing verifier and provider errors fail closed. */ }
  }
  const response = NextResponse.redirect(new URL(destination, origin), 303);
  if(!pendingEmail||emailChangeComplete)response.cookies.delete("lub-return-to");
  if(emailChangeComplete)response.cookies.delete("lub-pending-email");
  if (signupDraft) response.cookies.delete("lub-signup-draft");
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
