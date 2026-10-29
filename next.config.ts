import type { NextConfig } from "next";

const config: NextConfig = {
  ...(process.env.LUB_VINEXT_BUILD === "true" ? {} : { output: "standalone" }),
  poweredByHeader: false,
  turbopack: { root: process.cwd() },
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ...(process.env.NODE_ENV === "production" ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : []),
    ] }, { source: "/files/:path*", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] }, { source: "/documents/:path*", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] }, { source: "/talent/:path*", headers: [{ key: "Referrer-Policy", value: "no-referrer" }, { key: "X-Robots-Tag", value: "noindex, nofollow" }] }, { source: "/auth/callback", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] }];
  },
};
export default config;
