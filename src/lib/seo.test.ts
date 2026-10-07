import { expect, it } from "vitest";
import { toMetaDescription } from "./seo";

it("uses concise plain metadata descriptions and a fallback for empty content", () => {
  expect(toMetaDescription("  نادي   التقنية  ", "fallback")).toBe("نادي التقنية");
  expect(toMetaDescription("  ", "fallback")).toBe("fallback");
});

it("truncates long descriptions at a word boundary", () => {
  const result = toMetaDescription("كلمة ".repeat(80), "fallback");

  expect(result.length).toBeLessThanOrEqual(160);
  expect(result.endsWith("…")).toBe(true);
  expect(result.endsWith(" ")).toBe(false);
});
