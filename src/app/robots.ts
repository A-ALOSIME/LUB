import type { MetadataRoute } from "next";

const privatePaths = [
  "/account",
  "/account-unavailable",
  "/applications",
  "/auth/",
  "/documents",
  "/events/mine",
  "/events/*/register",
  "/files/",
  "/hours",
  "/manage",
  "/me",
  "/notifications",
  "/onboarding",
  "/organizations/*/apply",
  "/renewals",
  "/tasks",
  "/api/",
];

const privatePathsIncludingAuth = [...privatePaths, "/login", "/signup"];

export default function robots(): MetadataRoute.Robots {
  return {
    host: "https://lub.community",
    sitemap: "https://lub.community/sitemap.xml",
    rules: [
      { userAgent: "*", allow: "/", disallow: privatePathsIncludingAuth },
      {
        userAgent: ["GPTBot", "OAI-SearchBot", "ClaudeBot", "PerplexityBot"],
        allow: "/",
        disallow: privatePathsIncludingAuth,
      },
      { userAgent: "Googlebot", allow: "/", disallow: privatePaths },
    ],
  };
}
