import { expect, it } from "vitest";
import robots from "./robots";

function robotRules() {
  const rules = robots().rules;
  if (!Array.isArray(rules)) throw new Error("Expected explicit crawler rule groups");
  return rules;
}

it("allows public crawling and points crawlers to the sitemap", () => {
  const result = robots();
  const [general] = robotRules();

  expect(result.host).toBe("https://lub.community");
  expect(result.sitemap).toBe("https://lub.community/sitemap.xml");
  expect(general).toMatchObject({ userAgent: "*", allow: "/" });
  expect(general.disallow).toEqual(expect.arrayContaining(["/api/", "/manage", "/account", "/organizations/*/apply", "/events/*/register"]));
});

it("allows named AI discovery crawlers while keeping private routes disallowed", () => {
  const [general, aiCrawlers] = robotRules();

  expect(aiCrawlers.userAgent).toEqual(expect.arrayContaining(["GPTBot", "OAI-SearchBot", "ClaudeBot", "PerplexityBot"]));
  expect(aiCrawlers.allow).toBe("/");
  expect(aiCrawlers.disallow).toEqual(general.disallow);
});

it("lets Googlebot read noindex login pages while other crawlers stay blocked", () => {
  const [general, aiCrawlers, googlebot] = robotRules();

  expect(general.disallow).toEqual(expect.arrayContaining(["/login", "/signup"]));
  expect(googlebot).toMatchObject({ userAgent: "Googlebot", allow: "/" });
  expect(googlebot.disallow).not.toContain("/login");
  expect(googlebot.disallow).not.toContain("/signup");
  expect(googlebot.disallow).toEqual(expect.arrayContaining(["/account", "/api/"]));
  expect(aiCrawlers.disallow).toEqual(general.disallow);
});
