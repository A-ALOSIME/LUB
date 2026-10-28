// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TaskPagination } from "./task-list";

vi.mock("./task-panel-actions",()=>({loadTaskPanel:vi.fn()}));
vi.mock("./actions",()=>({mutateTask:async()=>({success:"تم الحفظ"})}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => <a href={href} {...props}>{children}</a>,
}));

afterEach(cleanup);

describe("task pagination", () => {
  it("hides the page number when there is no additional page", () => {
    render(<TaskPagination page={0} more={false} base="/applications" query={{ tab: "renewals" }} />);

    expect(screen.queryByRole("navigation", { name: "صفحات السجلات" })).toBeNull();
    expect(screen.queryByText("الصفحة 1")).toBeNull();
  });

  it("keeps the renewals tab in pagination links when another page exists", () => {
    render(<TaskPagination page={0} more base="/applications" query={{ tab: "renewals" }} />);

    expect(screen.getByText("الصفحة 1")).toBeTruthy();
    expect(screen.getByRole("link", { name: "التالي" }).getAttribute("href")).toBe("/applications?tab=renewals&page=1");
  });
});
