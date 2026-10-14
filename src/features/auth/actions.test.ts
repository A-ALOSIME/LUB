import { beforeEach, describe, expect, it, vi } from "vitest";

const cookie=vi.hoisted(()=>{
  const values = new Map<string,string>();
  return {
    set: vi.fn((name:string,value:string)=>{values.set(name,value);}),
    delete: vi.fn((name:string)=>{values.delete(name);}),
    get: vi.fn((name:string)=>{const value=values.get(name);return value===undefined?undefined:{value};}),
    clearData: ()=>values.clear(),
  };
});
vi.mock("next/headers",()=>({cookies:async()=>cookie}));
const auth = vi.hoisted(() => ({ signInWithOtp: vi.fn(), verifyOtp: vi.fn(), signOut: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth }) }));
const signup = vi.hoisted(() => ({ completeSignup: vi.fn() }));
vi.mock("./complete-signup", () => signup);
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
import { decryptSignupDraft } from "@/lib/identifiers";
import { requestCode, verifyCode, signOut } from "./actions";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-publishable-key");
  vi.stubEnv("APP_URL", "http://127.0.0.1:3000");
  vi.stubEnv("DATABASE_URL", "test-database-url");
  vi.stubEnv("IDENTIFIER_ENCRYPTION_KEY", Buffer.alloc(32, 1).toString("base64"));
  vi.stubEnv("IDENTIFIER_LOOKUP_KEY", Buffer.alloc(32, 2).toString("base64"));
  auth.signInWithOtp.mockResolvedValue({ error: null });
  auth.verifyOtp.mockResolvedValue({ data: { user: { id: "verified-user", email: "student@example.com", email_confirmed_at: "2026-10-12T10:00:00Z" } }, error: null });
  auth.signOut.mockResolvedValue({ error: null });
  signup.completeSignup.mockResolvedValue(undefined);
  cookie.clearData();
});
function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}
function signupForm(overrides: Record<string, string> = {}) {
  return form({ email: "student@example.com", mode: "signup", fullName: "أحمد محمد", universityId: "202612345", major: "نظم المعلومات", academicLevel: "5", phone: "", ...overrides });
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
    await requestCode({}, signupForm());
    expect(auth.signInWithOtp).toHaveBeenLastCalledWith({ email: "student@example.com", options: { shouldCreateUser: true, emailRedirectTo: "http://127.0.0.1:3000/auth/callback" } });
    const encryptedDraft = cookie.get("lub-signup-draft")?.value;
    expect(encryptedDraft).toBeTruthy();
    expect(encryptedDraft).not.toContain("202612345");
    expect(JSON.parse(decryptSignupDraft(encryptedDraft!, "student@example.com")).universityId).toBe("202612345");
  });
  it("requires the complete student profile before sending a signup code", async () => {
    const result = await requestCode({}, form({ email: "student@example.com", mode: "signup" }));
    expect(result.fieldErrors?.fullName).toBeTruthy();
    expect(result.fieldErrors?.universityId).toBeTruthy();
    expect(auth.signInWithOtp).not.toHaveBeenCalled();
  });
  it("rejects an unknown mode", async () => {
    const result = await requestCode({}, form({ email: "student@example.com", mode: "admin" }));
    expect(result.error).toBeTruthy();
    expect(auth.signInWithOtp).not.toHaveBeenCalled();
  });
  it("fails closed when Supabase is not configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    const result = await requestCode({}, signupForm());
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
    const result = await requestCode({}, signupForm());
    expect(result.error).toContain("انتظر");
    expect(JSON.stringify(result)).not.toContain("internal");
  });
  it("fails closed for unsafe callback configuration", async () => {
    vi.stubEnv("APP_URL", "http://attacker.example");
    const result = await requestCode({}, signupForm());
    expect(result.error).toBeTruthy();
    expect(auth.signInWithOtp).not.toHaveBeenCalled();
  });
  it("reports sender restrictions without exposing provider details", async () => {
    auth.signInWithOtp.mockResolvedValue({ error: { status: 400, code: "email_address_not_authorized", message: "private project details" } });
    const result = await requestCode({}, signupForm());
    expect(result.error).toContain("مرسل البريد");
    expect(JSON.stringify(result)).not.toContain("private");
  });
  it("does not show the verification step when signup email delivery is rejected", async () => {
    auth.signInWithOtp.mockResolvedValue({ error: { status: 422, code: "unexpected_failure", message: "private SMTP details" } });
    const result = await requestCode({}, signupForm());
    expect(result.email).toBeUndefined();
    expect(result.error).toBe("تعذّر إرسال الرسالة الآن. حاول بعد قليل.");
    expect(JSON.stringify(result)).not.toContain("SMTP");
    expect(cookie.set).not.toHaveBeenCalledWith("lub-signup-draft", expect.any(String), expect.any(Object));
  });
  it("validates OTP before the provider and redirects only on successful verification", async () => {
    const invalid = await verifyCode({}, form({ email: "student@example.com", mode: "login", token: "123" }));
    expect(invalid.error).toBeTruthy();
    expect(auth.verifyOtp).not.toHaveBeenCalled();
    auth.verifyOtp.mockResolvedValue({ error: { message: "secret provider payload" } });
    const failure = await verifyCode({}, form({ email: "student@example.com", mode: "login", token: "123456" }));
    expect(failure.error).toBeTruthy();
    expect(failure.error).not.toContain("secret");
    auth.verifyOtp.mockResolvedValue({ error: null });
    await expect(verifyCode({}, form({ email: "student@example.com", mode: "login", token: "١٢٣٤٥٦" }))).rejects.toThrow("redirect:/me");
    expect(auth.verifyOtp).toHaveBeenLastCalledWith({ email: "student@example.com", token: "123456", type: "email" });
  });
  it("saves the complete signup profile only after verifying the same email", async () => {
    await requestCode({}, signupForm());
    await expect(verifyCode({}, signupForm({ token: "123456" }))).rejects.toThrow("redirect:/me");
    expect(auth.verifyOtp).toHaveBeenCalledWith({ email: "student@example.com", token: "123456", type: "email" });
    expect(signup.completeSignup).toHaveBeenCalledWith(
      { id: "verified-user", email: "student@example.com", emailVerifiedAt: "2026-10-12T10:00:00Z" },
      expect.objectContaining({ fullName: "أحمد محمد", universityId: "202612345", major: "نظم المعلومات", academicLevel: "5" }),
    );
    expect(cookie.delete).toHaveBeenCalledWith("lub-signup-draft");
  });
  it("binds a pending signup draft to its email before consuming the code", async () => {
    await requestCode({}, signupForm());
    const result = await verifyCode({}, signupForm({ email: "someone-else@example.com", token: "123456" }));
    expect(result.error).toBeTruthy();
    expect(auth.verifyOtp).not.toHaveBeenCalled();
    expect(signup.completeSignup).not.toHaveBeenCalled();
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
 await expect(verifyCode({},form({email:"student@example.com",mode:"login",token:"123456",returnTo:path}))).rejects.toThrow("redirect:"+path);
});
