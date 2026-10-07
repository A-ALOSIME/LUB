import { beforeEach, describe, expect, it, vi } from "vitest";

const cookie=vi.hoisted(()=>({set:vi.fn(),delete:vi.fn()}));
vi.mock("next/headers",()=>({cookies:async()=>cookie}));
const auth = vi.hoisted(() => ({ signInWithOtp: vi.fn(), verifyOtp: vi.fn(), signOut: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth }) }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
import { requestCode, verifyCode, signOut } from "./actions";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-publishable-key");
  vi.stubEnv("APP_URL", "http://127.0.0.1:3000");
  auth.signInWithOtp.mockResolvedValue({ error: null });
  auth.verifyOtp.mockResolvedValue({ error: null });
  auth.signOut.mockResolvedValue({ error: null });
});
function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}
describe("OTP server actions", () => {
  it("does not call the provider for invalid input", async () => {
    const result = await requestCode({}, form({ email: "not-email", mode: "login" }));
    expect(result.error).toBeTruthy();
    expect(auth.signInWithOtp).not.toHaveBeenCalled();
  });
  it("creates accounts only in signup mode", async () => {
    await requestCode({}, form({ email: " Student@Example.com ", mode: "login" }));
    expect(auth.signInWithOtp).toHaveBeenLastCalledWith({ email: "student@example.com", options: { shouldCreateUser: false, emailRedirectTo: "http://127.0.0.1:3000/auth/callback" } });
    await requestCode({}, form({ email: "student@example.com", mode: "signup" }));
    expect(auth.signInWithOtp).toHaveBeenLastCalledWith({ email: "student@example.com", options: { shouldCreateUser: true, emailRedirectTo: "http://127.0.0.1:3000/auth/callback" } });
  });
  it("rejects an unknown mode", async () => {
    const result = await requestCode({}, form({ email: "student@example.com", mode: "admin" }));
    expect(result.error).toBeTruthy();
    expect(auth.signInWithOtp).not.toHaveBeenCalled();
  });
  it("fails closed when Supabase is not configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    const result = await requestCode({}, form({ email: "student@example.com", mode: "signup" }));
    expect(result.error).toBeTruthy();
    expect(auth.signInWithOtp).not.toHaveBeenCalled();
  });
  it("does not reveal whether an email exists or expose provider error details", async () => {
    auth.signInWithOtp.mockResolvedValue({ error: { status: 400, message: "User not found: student@example.com" } });
    const failed = await requestCode({}, form({ email: "student@example.com", mode: "login" }));
    auth.signInWithOtp.mockResolvedValue({ error: null });
    const success = await requestCode({}, form({ email: "student@example.com", mode: "login" }));
    expect(failed).toEqual(success);
  });
  it("handles rate limiting without exposing provider internals", async () => {
    auth.signInWithOtp.mockResolvedValue({ error: { status: 429, message: "internal provider details" } });
    const result = await requestCode({}, form({ email: "student@example.com", mode: "signup" }));
    expect(result.error).toContain("انتظر");
    expect(JSON.stringify(result)).not.toContain("internal");
  });
  it("fails closed for unsafe callback configuration", async () => {
    vi.stubEnv("APP_URL", "http://attacker.example");
    const result = await requestCode({}, form({ email: "student@example.com", mode: "signup" }));
    expect(result.error).toBeTruthy();
    expect(auth.signInWithOtp).not.toHaveBeenCalled();
  });
  it("reports sender restrictions without exposing provider details", async () => {
    auth.signInWithOtp.mockResolvedValue({ error: { status: 400, code: "email_address_not_authorized", message: "private project details" } });
    const result = await requestCode({}, form({ email: "student@example.com", mode: "signup" }));
    expect(result.error).toContain("مرسل البريد");
    expect(JSON.stringify(result)).not.toContain("private");
  });
  it("validates OTP before the provider and redirects only on successful verification", async () => {
    const invalid = await verifyCode({}, form({ email: "student@example.com", token: "123" }));
    expect(invalid.error).toBeTruthy();
    expect(auth.verifyOtp).not.toHaveBeenCalled();
    auth.verifyOtp.mockResolvedValue({ error: { message: "secret provider payload" } });
    const failure = await verifyCode({}, form({ email: "student@example.com", token: "123456" }));
    expect(failure.error).toBeTruthy();
    expect(failure.error).not.toContain("secret");
    auth.verifyOtp.mockResolvedValue({ error: null });
    await expect(verifyCode({}, form({ email: "student@example.com", token: "١٢٣٤٥٦" }))).rejects.toThrow("redirect:/me");
    expect(auth.verifyOtp).toHaveBeenLastCalledWith({ email: "student@example.com", token: "123456", type: "email" });
  });
  it("redirects after signout and handles a failed logout explicitly", async () => {
    await expect(signOut()).rejects.toThrow("redirect:/login");
    auth.signOut.mockResolvedValue({ error: { message: "internal" } });
    await expect(signOut()).rejects.toThrow("redirect:/me?notice=signout-failed");
  });
});

it("stores only a safe HttpOnly application return and clears stale returns on ordinary login",async()=>{
 const path="/organizations/tech/apply/00000000-0000-4000-8000-000000000001";
 await requestCode({},form({email:"student@example.com",mode:"login",returnTo:path}));
 expect(cookie.set).toHaveBeenCalledWith("lub-return-to",path,expect.objectContaining({httpOnly:true,sameSite:"lax",maxAge:3600}));
 await requestCode({},form({email:"student@example.com",mode:"login",returnTo:"https://evil.test"}));expect(cookie.delete).toHaveBeenCalledWith("lub-return-to");
 await expect(verifyCode({},form({email:"student@example.com",token:"123456",returnTo:path}))).rejects.toThrow("redirect:"+path);
});
