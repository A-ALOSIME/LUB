# Hosted authentication email configuration

The hosted Supabase **Confirm sign up** template uses `confirm-signup.html`,
with subject `رمز تأكيد حسابك في لُبّ`. The **Magic link or OTP** template is
separate and must also contain `{{ .Token }}`. Updating one does not update the
other. Keep email confirmation enabled and the current six-digit OTP setting.

The optional `ConfirmationURL` uses the existing PKCE callback; open it in the
browser where registration began. The numeric code works without following
the link. Both consume the same one-time confirmation. The encrypted signup
draft and safe return path are consumed after verification; absent drafts go
through normal onboarding. Never log tokens or email-link query parameters.

Google is disabled in the hosted project as of this repair. It cannot be
tested until its legitimate OAuth client configuration is supplied; do not
enable an unconfigured provider or bypass verification.
