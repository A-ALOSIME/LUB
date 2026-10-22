import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("server-only", () => ({}));

import LegacyApplicationsPage from "./page";

const id = "00000000-0000-4000-8000-000000000002";

describe("legacy organization application route", () => {
  it("opens the join requests tab and preserves supported filters and selected request", async () => {
    await expect(LegacyApplicationsPage({
      params: Promise.resolve({ id }),
      searchParams: Promise.resolve({ status: "Submitted", q: "أحمد", application: "00000000-0000-4000-8000-000000000003", university: "123456" }),
    })).rejects.toThrow(`redirect:/manage/organizations/${id}/members?section=applications&q=%D8%A3%D8%AD%D9%85%D8%AF&status=Submitted&application=00000000-0000-4000-8000-000000000003`);
  });
});
