// @vitest-environment jsdom
import { cleanup, render as rtlRender, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import {PrivateQueryProvider} from "@/components/private-query-provider";
import type {ReactElement} from "react";
const render=(ui:ReactElement)=>rtlRender(<PrivateQueryProvider actorId="test-actor">{ui}</PrivateQueryProvider>);
import { ApplicationSelection } from "./application-selection";

vi.mock("./actions", () => ({ mutateWorkflow: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/manage/organizations/org/applications",
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(cleanup);

it("uses a compact empty state instead of an empty table", () => {
  render(<ApplicationSelection rows={[]} locale="ar" canBulk={false} organization="org" query="" />);

  expect(screen.queryByRole("table")).toBeNull();
  expect(screen.getByRole("status").textContent).toContain("لا توجد طلبات مطابقة");
});
