import {GET} from "./app/api/health/route";

// Liveness has no dependency on the page renderer or database.
export function workerLiveness(request: Request): Response | null {
  if (!["GET", "HEAD"].includes(request.method) || new URL(request.url).pathname !== "/api/health") return null;
  const response = GET();
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  return request.method === "HEAD" ? new Response(null, {headers:response.headers}) : response;
}
