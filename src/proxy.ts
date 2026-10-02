import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getAuthConfig } from "@/lib/env";
import {documentFileCsp,isDocumentFile} from "@/features/documents/security";

export async function proxy(request: NextRequest) {
  const nonce = randomBytes(16).toString("base64");
  const csp = isDocumentFile(request.nextUrl.pathname)?documentFileCsp:[
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${process.env.NODE_ENV !== "production" ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'", "img-src 'self' data:", "font-src 'self'",
    `connect-src 'self'${process.env.NODE_ENV !== "production" ? " ws: wss:" : ""}`,
    "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'",
  ].join("; ");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  let response = NextResponse.next({ request: { headers: requestHeaders } });
  const config = request.nextUrl.pathname==="/api/health"?null:getAuthConfig();
  if (config) {
    const supabase = createServerClient(config.url, config.key, {
      cookieOptions: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (updates, headers) => {
          for (const { name, value } of updates) request.cookies.set(name, value);
          // Forward refreshed cookies as well as the nonce to Server Components.
          requestHeaders.set("cookie", request.headers.get("cookie") ?? "");
          response = NextResponse.next({ request: { headers: requestHeaders } });
          for (const { name, value, options } of updates) response.cookies.set(name, value, options);
          if (headers) for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
        },
      },
    });
    // Refresh expired tokens without fetching the full user on every request.
    // Protected pages still call getUser() for a fresh server-side identity check.
    try { await supabase.auth.getClaims(); }
    catch { console.error("Session refresh unavailable."); }
  }
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.svg$|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.gif$|.*\\.webp$|.*\\.woff2?$).*)"] };
