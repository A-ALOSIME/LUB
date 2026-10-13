import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => ({ exchangeCodeForSession: vi.fn(), getUser: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => ({ auth })) }));
const signup = vi.hoisted(() => ({ completeSignup: vi.fn() }));
vi.mock("@/features/auth/complete-signup", () => signup);
import { encryptSignupDraft } from "@/lib/identifiers";
import { GET } from "./route";
beforeEach(() => {
  vi.stubEnv("APP_URL", "http://127.0.0.1:3000");
  vi.stubEnv("IDENTIFIER_ENCRYPTION_KEY", Buffer.alloc(32, 1).toString("base64"));
  vi.stubEnv("IDENTIFIER_LOOKUP_KEY", Buffer.alloc(32, 2).toString("base64"));
  auth.exchangeCodeForSession.mockReset().mockResolvedValue({ error: null });
  auth.getUser.mockReset().mockResolvedValue({ data: { user: { id: "verified-user", email: "student@example.com", email_confirmed_at: "2026-10-12T10:00:00Z" } }, error: null });
  signup.completeSignup.mockReset().mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllEnvs());
it("exchanges PKCE once and redirects to a fixed destination without retaining credentials", async () => {
  const response = await GET(new NextRequest("https://attacker.example/auth/callback?code=one-time-code&next=https://attacker.example"));
  expect(auth.exchangeCodeForSession).toHaveBeenCalledExactlyOnceWith("one-time-code");
  expect(response.headers.get("location")).toBe("http://127.0.0.1:3000/me");
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(response.headers.get("referrer-policy")).toBe("no-referrer");
});
it("rejects missing, duplicate and oversized codes before calling the provider", async () => {
  for (const query of ["", "?code=", "?code=a&code=b", `?code=${"a".repeat(513)}`]) {
    const response = await GET(new NextRequest(`http://127.0.0.1:3000/auth/callback${query}`));
    expect(response.headers.get("location")).toBe("http://127.0.0.1:3000/login?notice=link-invalid");
  }
  expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
});
it("sanitizes expired links and provider/network failures", async () => {
  for (const failure of ["expired", "network"]) {
    if (failure === "expired") auth.exchangeCodeForSession.mockResolvedValue({ error: { message: "private provider details" } });
    else auth.exchangeCodeForSession.mockRejectedValue(new Error("private provider details"));
    const response = await GET(new NextRequest("http://127.0.0.1:3000/auth/callback?code=expired-secret"));
    expect(response.headers.get("location")).toBe("http://127.0.0.1:3000/login?notice=link-invalid");
    expect(await response.text()).not.toContain("private");
  }
});

it("returns to the validated saved application after exchange and consumes the cookie",async()=>{
 const path="/organizations/tech/apply/00000000-0000-4000-8000-000000000001";
 const request=new NextRequest("http://127.0.0.1:3000/auth/callback?code=valid");request.cookies.set("lub-return-to",path);
 const response=await GET(request);expect(response.headers.get("location")).toBe("http://127.0.0.1:3000"+path);expect(response.cookies.get("lub-return-to")?.value).toBe("");
 request.cookies.set("lub-return-to","//attacker.example");expect((await GET(request)).headers.get("location")).toBe("http://127.0.0.1:3000/me");
});

it("completes an encrypted pending signup when the user follows the email link", async () => {
  const profile = { fullName: "أحمد محمد", universityId: "202612345", major: "نظم المعلومات", academicLevel: "5", phone: "", publicProfileEnabled: false, showTotalHours: true };
  const request = new NextRequest("http://127.0.0.1:3000/auth/callback?code=valid");
  request.cookies.set("lub-signup-draft", encryptSignupDraft(JSON.stringify(profile), "student@example.com"));
  const response = await GET(request);
  expect(auth.getUser).toHaveBeenCalledOnce();
  expect(signup.completeSignup).toHaveBeenCalledWith({ id: "verified-user", email: "student@example.com", emailVerifiedAt: "2026-10-12T10:00:00Z" }, profile);
  expect(response.headers.get("location")).toBe("http://127.0.0.1:3000/me");
  expect(response.cookies.get("lub-signup-draft")?.value).toBe("");
});
