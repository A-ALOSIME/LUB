import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { getAuthConfig } from "@/lib/env";
import { getCachedSupabaseJwks } from "@/lib/supabase-jwks-cache";

export async function proxy(request: NextRequest) {
  const nonce = randomBytes(16).toString("base64");
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${process.env.NODE_ENV !== "production" ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:", "font-src 'self'",
    `connect-src 'self'${process.env.NODE_ENV !== "production" ? " ws: wss:" : ""}`,
    "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'",
  ].join("; ");
  const requestHeaders = new Headers(request.headers);
  // Never accept an identity forwarded by the browser. Only set this after
  // Supabase has verified the session token below.
  requestHeaders.delete("x-lub-verified-user-id");
  requestHeaders.set("x-lub-area", request.nextUrl.pathname === "/manage" || request.nextUrl.pathname.startsWith("/manage/") ? "management" : "student");
  requestHeaders.set("x-lub-management-view", request.nextUrl.pathname === "/manage/organizations" ? "organizations" : request.nextUrl.pathname === "/manage" ? "dashboard" : request.nextUrl.pathname === "/manage/account" ? "account" : "other");
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const refreshedCookies = new Map<string,{value:string;options:CookieOptions}>();
  let forwardedAuthHeaders: Record<string, string> = {};
  const config = request.nextUrl.pathname==="/api/health"?null:getAuthConfig();
  const sessionCookie = config ? `sb-${new URL(config.url).hostname.split(".")[0]}-auth-token` : "";
  const hasSession = sessionCookie && request.cookies.getAll().some(({name})=>name === sessionCookie || name.startsWith(`${sessionCookie}.`));
  if (config && hasSession) {
    const supabase = createServerClient(config.url, config.key, {
      cookieOptions: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (updates, headers) => {
          for (const { name, value } of updates) request.cookies.set(name, value);
          // Forward refreshed cookies as well as the nonce to Server Components.
          requestHeaders.set("cookie", request.headers.get("cookie") ?? "");
          for (const { name, value, options } of updates) refreshedCookies.set(name,{value,options});
          if (headers) {
            forwardedAuthHeaders = { ...forwardedAuthHeaders, ...headers };
          }
        },
      },
    });
    // Refresh expired tokens without fetching the full user on every request.
    // Server-rendered management pages reuse this verified subject; permissions
    // still come from the database, and mutations keep their fresh user check.
    try {
      const jwks = await getCachedSupabaseJwks(config.url, request.nextUrl.origin);
      const { data, error } = jwks
        ? await supabase.auth.getClaims(undefined, { jwks })
        : await supabase.auth.getClaims();
      const claims = data?.claims;
      const audience = claims?.aud;
      const isAuthenticated = audience === "authenticated" || (Array.isArray(audience) && audience.includes("authenticated"));
      const subject = claims?.sub;
      const validSubject = typeof subject === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(subject);
      if (!error && claims?.role === "authenticated" && claims.is_anonymous !== true && isAuthenticated && validSubject) {
        requestHeaders.set("x-lub-verified-user-id", subject);
      }
    }
    catch { console.error("Session refresh unavailable."); }
  }
  // Rebuild the forwarded request after claims verification so the server
  // render receives the verified subject along with any refreshed cookies.
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  for (const [name,{value,options}] of refreshedCookies) response.cookies.set(name,value,options);
  for (const [name, value] of Object.entries(forwardedAuthHeaders)) response.headers.set(name, value);
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.svg$|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.gif$|.*\\.webp$|.*\\.woff2?$).*)"] };
