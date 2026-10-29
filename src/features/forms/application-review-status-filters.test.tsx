// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { ApplicationReviewStatusFilters } from "./application-review-status-filters";

afterEach(() => { cleanup(); push.mockClear(); });

it("shows only nonzero status counts and navigates when a filter changes", () => {
  render(<ApplicationReviewStatusFilters value="" locale="ar" options={[
    { value: "", label: "الكل", count: 8, href: "?" },
    { value: "Submitted", label: "قيد المراجعة", count: 0, href: "?status=Submitted" },
    { value: "Accepted", label: "مقبول", count: 2, href: "?status=Accepted" },
  ]} />);

  expect(screen.getByText("٨")).toBeTruthy();
  expect(screen.getByText("٢")).toBeTruthy();
  expect(screen.queryByText("0")).toBeNull();
  fireEvent.click(screen.getByRole("tab", { name: /مقبول/ }));
  expect(push).toHaveBeenCalledWith("?status=Accepted");
});
