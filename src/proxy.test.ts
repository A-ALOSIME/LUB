import { NextRequest } from "next/server";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const refresh = vi.hoisted(() => vi.fn());
vi.mock("@supabase/ssr", () => ({ createServerClient: refresh }));
import { proxy } from "./proxy";

beforeEach(() => { vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", ""); vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", ""); });
afterEach(() => vi.unstubAllEnvs());
describe("session proxy", () => {
  it("keeps generated document files script-free instead of replacing their CSP with the app policy",async()=>{
    const file=await proxy(new NextRequest('http://localhost/documents/00000000-0000-4000-8000-000000000001/file?view=print'));
    expect(file.headers.get('content-security-policy')).toContain("default-src 'none'");expect(file.headers.get('content-security-policy')).toContain('sandbox allow-modals');expect(file.headers.get('content-security-policy')).not.toContain('nonce-');
    const list=await proxy(new NextRequest('http://localhost/documents'));expect(list.headers.get('content-security-policy')).toContain('nonce-');
  });
  it("uses a fresh CSP nonce on each response and prevents HTML caching", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const first = await proxy(new NextRequest("http://localhost/me"));
    const second = await proxy(new NextRequest("http://localhost/me"));
    expect(first.headers.get("content-security-policy")).toContain("'nonce-");
    expect(first.headers.get("content-security-policy")).not.toContain("unsafe-eval");
    expect(first.headers.get("content-security-policy")).not.toEqual(second.headers.get("content-security-policy"));
    expect(first.headers.get("cache-control")).toBe("private, no-store");
  });
  it("passes refreshed cookies to both the server render and browser", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-key");
    const getClaims = vi.fn();
    const getUser = vi.fn();
    refresh.mockImplementation((_url, _key, options) => {
      getClaims.mockImplementation(async () => {
        options.cookies.setAll([{ name: "sb-session", value: "refreshed-test-session", options: { httpOnly: true, sameSite: "lax" } }], { "cache-control": "private, no-store" });
        return { data: { claims: {} }, error: null };
      });
      return { auth: { getClaims, getUser } };
    });
    const response = await proxy(new NextRequest("http://localhost/me", { headers: { cookie: "sb-session=old-test-session" } }));
    expect(response.cookies.get("sb-session")?.value).toBe("refreshed-test-session");
    expect(response.headers.get("x-middleware-request-cookie")).toContain("sb-session=refreshed-test-session");
    expect(response.headers.get("content-security-policy")).toContain("'nonce-");
    expect(getClaims).toHaveBeenCalledOnce();
    expect(getUser).not.toHaveBeenCalled();
  });
});
