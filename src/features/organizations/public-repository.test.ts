import { expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { normalizePublicTags } from "./public-repository";

it("normalizes JSONB tags from database/cache results to a safe string list", () => {
  expect(normalizePublicTags(["تقنية", 4, null])).toEqual(["تقنية"]);
  expect(normalizePublicTags('["تقنية","تصميم"]')).toEqual(["تقنية", "تصميم"]);
  expect(normalizePublicTags("not-json")).toEqual([]);
  expect(normalizePublicTags(null)).toEqual([]);
});
