// @vitest-environment jsdom
import { cleanup, fireEvent, render as rtlRender, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { ApplicationRowActions } from "./application-row-actions";

import {PrivateQueryProvider} from "@/components/private-query-provider";
import type {ReactElement} from "react";
const render=(ui:ReactElement)=>rtlRender(<PrivateQueryProvider actorId="test-actor">{ui}</PrivateQueryProvider>);

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => <a href={href} {...props}>{children}</a>,
}));
vi.mock("./application-panel-actions",()=>({loadOwnApplicationPanel:vi.fn().mockResolvedValue({error:true})}));
vi.mock("./mutation-form", () => ({
  WorkflowForm: ({ label }: { label: string }) => <button type="button">{label}</button>,
}));

afterEach(()=>{cleanup();vi.unstubAllGlobals();});

const baseProps = {
  applicationId: "00000000-0000-4000-8000-000000000001",
  organization: "نادي الأمن السيبراني",
  detailsHref: "/organizations/cybersecurity/apply/round",
  canWithdraw: true,
  locale: "ar" as const,
  preview: false,
};

it("offers details and asks for confirmation before withdrawal", async () => {
  render(<ApplicationRowActions {...baseProps} />);


  const url=window.location.href;
  fireEvent.click(await screen.findByRole("button", {name:/عرض التفاصيل/}));
  expect(await screen.findByRole("dialog")).toBeTruthy();
  expect(window.location.href).toBe(url);
  fireEvent.click(screen.getByRole("button",{name:/إغلاق/}));

  fireEvent.click(await screen.findByRole("button", { name: /سحب الطلب/ }));
  expect(await screen.findByRole("alertdialog")).toBeTruthy();
  expect(screen.getByRole("heading", { name: "سحب طلب الانضمام لـنادي الأمن السيبراني؟" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "اسحب الطلب" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "إبقاء الطلب" })).toBeTruthy();
});

it("does not show withdrawal when the request is not eligible", async () => {
  render(<ApplicationRowActions {...baseProps} canWithdraw={false} />);


  expect(await screen.findByRole("button", { name: /عرض التفاصيل/ })).toBeTruthy();
  expect(screen.queryByRole("button", { name: /سحب الطلب/ })).toBeNull();
});


beforeEach(()=>vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response("{}",{status:403}))));
