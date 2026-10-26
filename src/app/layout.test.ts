import { expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";

const preferences = vi.hoisted(() => ({ locale: "ar" as "ar" | "en" }));
const account = vi.hoisted(() => ({ getVerifiedAccountAccess: vi.fn(async (): Promise<{ user: { id: string } | null; isSuperAdmin: boolean }> => ({ user: null, isSuperAdmin: false })) }));
const request = vi.hoisted(() => ({ headers: new Headers() }));
vi.mock("@/lib/preferences", () => ({ getPreferences: async () => ({ locale: preferences.locale, theme: "dark" }) }));
vi.mock("@/features/auth/verified-account", () => ({ getVerifiedAccountAccess: account.getVerifiedAccountAccess }));
vi.mock("@/features/ai/chat-widget", () => ({ ChatWidget: () => null }));
vi.mock("next/headers", () => ({ headers: async () => request.headers }));
vi.mock("next/font/local", () => ({ default: () => ({ variable: "font" }) }));

import {DeferredChatWidget,showAssistantLauncher} from "@/features/ai/deferred-chat-widget";
import RootLayout, { generateMetadata } from "./layout";

function findStudentChatWidget(node: ReactNode): ReactElement | undefined {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findStudentChatWidget(child);
      if (found) return found;
    }
    return undefined;
  }
  if (!node || typeof node !== "object" || !("props" in node) || !("type" in node)) return undefined;
  const element = node as ReactElement;
  if (typeof element.type === "function" && element.type === DeferredChatWidget) return element;
  return findStudentChatWidget((element.props as { children?: ReactNode }).children);
}

async function renderStudentChatWidget(area: "student" | "management"): Promise<ReactNode> {
  request.headers = new Headers({ "x-lub-area": area });
  const root = await RootLayout({ children: null });
  const element = findStudentChatWidget(root);
  if (!element || typeof element.type !== "function") throw new Error("Student chat widget not found in root layout.");
  return element;
}

it("returns the root shell without waiting for the account authorization checks", async () => {
  account.getVerifiedAccountAccess.mockClear();

  await RootLayout({ children: null });

  expect(account.getVerifiedAccountAccess).not.toHaveBeenCalled();
});

it("keeps the public assistant available to superadmins without fetching account access", async () => {
  account.getVerifiedAccountAccess.mockResolvedValue({ user: { id: "admin" }, isSuperAdmin: true });

  const widget = await renderStudentChatWidget("student");

  expect(widget).not.toBeNull();
  expect(account.getVerifiedAccountAccess).not.toHaveBeenCalled();
});

it("keeps the assistant out of management pages without checking account access", async () => {
  await renderStudentChatWidget("management");

  expect(showAssistantLauncher("/manage/organizations/abc")).toBe(false);
  expect(showAssistantLauncher("/account/talent")).toBe(false);
  expect(showAssistantLauncher("/ai")).toBe(false);
  for(const path of ["/","/organizations","/organizations/club","/events/discover","/talent","/talent/member"])expect(showAssistantLauncher(path)).toBe(true);
  expect(account.getVerifiedAccountAccess).not.toHaveBeenCalled();
});

it("describes LUB as a student clubs platform in Arabic metadata", async () => {
  preferences.locale = "ar";
  const metadata = await generateMetadata();

  expect(metadata.title).toEqual({ default: "لُبّ | منصة الأندية الطلابية", template: "%s | لُبّ" });
  expect(metadata.description).toContain("الأندية والمجالس الطلابية والفعاليات");
  expect(metadata.description).toContain("جامعة الإمام محمد بن سعود الإسلامية");
  expect(metadata.robots).toEqual({ index: true, follow: true });
});

it("describes LUB as a student clubs platform in English metadata", async () => {
  preferences.locale = "en";
  const metadata = await generateMetadata();

  expect(metadata.title).toEqual({ default: "LUB | Student Clubs and Events", template: "%s | LUB" });
  expect(metadata.description).toContain("student clubs, councils, and events");
  expect(metadata.description).toContain("Imam Mohammad Ibn Saud Islamic University");
});
