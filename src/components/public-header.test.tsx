import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getVerifiedUser: vi.fn(),
  getVerifiedProxyIdentity: vi.fn(),
  isSuperAdminUser: vi.fn(),
  getPreferences: vi.fn(),
}));

vi.mock("next/link", () => ({ default: ({ href, children, prefetch, ...props }: { href: string; children: React.ReactNode; prefetch?: boolean }) => {
  void prefetch;
  return <a href={href} {...props}>{children}</a>;
} }));
vi.mock("./brand", () => ({ Brand: () => <span>لُبّ</span> }));
vi.mock("./lub-wordmark", () => ({ LubWordmark: () => <span>لُبّ</span> }));
vi.mock("./display-controls", () => ({ DisplayControls: () => null }));
vi.mock("@/features/auth/session", () => ({
  getVerifiedUser: mocks.getVerifiedUser,
  getVerifiedProxyIdentity: mocks.getVerifiedProxyIdentity,
}));
vi.mock("@/features/auth/authorization", () => ({ isSuperAdminUser: mocks.isSuperAdminUser }));
vi.mock("@/lib/preferences", () => ({ getPreferences: mocks.getPreferences }));

import { PublicHeader } from "./public-header";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getVerifiedProxyIdentity.mockResolvedValue({ id: "00000000-0000-4000-8000-000000000123" });
  mocks.getVerifiedUser.mockResolvedValue({ id: "00000000-0000-4000-8000-000000000123" });
  mocks.isSuperAdminUser.mockResolvedValue(true);
  mocks.getPreferences.mockResolvedValue({ locale: "ar", theme: "dark" });
});

describe("public header", () => {
  it("keeps public navigation and opens the unified workspace for a verified superadmin", async () => {
    const html = renderToStaticMarkup(await PublicHeader());

    expect(html).toContain('href="/organizations"');
    expect(html).toContain('href="/events"');
    expect(html).toContain('href="/talent"');
    expect(html).toContain('href="/ai"');
    expect(html).toContain('href="/manage"');
    expect(html).toContain(">مساحتي</a>");
    expect(html).not.toContain('href="/manage/account"');
    expect(mocks.getVerifiedUser).not.toHaveBeenCalled();
    expect(mocks.isSuperAdminUser).toHaveBeenCalledWith("00000000-0000-4000-8000-000000000123");
  });
});
