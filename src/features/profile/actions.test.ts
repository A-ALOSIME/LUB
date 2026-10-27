vi.mock("./avatar-storage",()=>({storeAccountAvatar:vi.fn()}));
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const dependencies = vi.hoisted(() => ({ requireUser: vi.fn(), studentOperationError: vi.fn(), saveStudentProfile: vi.fn(), revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock("@/features/auth/session", () => ({ requireUser: dependencies.requireUser }));
vi.mock("@/features/auth/authorization", () => ({ studentOperationError: dependencies.studentOperationError }));
vi.mock("./repository", () => ({ saveStudentProfile: dependencies.saveStudentProfile }));
vi.mock("next/cache", () => ({ revalidatePath: dependencies.revalidatePath, updateTag: dependencies.updateTag }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
import { saveProfile } from "./actions";
import { storeAccountAvatar } from "./avatar-storage";

const user = { id: "verified-user", email: "student@example.com", emailVerifiedAt: "2026-09-26T10:00:00Z" };
function input(overrides: Record<string, string> = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries({ fullName: "أحمد محمد",nationalId:"1000000008", universityId: "202612345", major: "نظم المعلومات", academicLevel: "5", phone: "", ...overrides })) form.set(key, value);
  return form;
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("DATABASE_URL", "test-only-url"); vi.stubEnv("IDENTIFIER_ENCRYPTION_KEY", "test-only-key"); vi.stubEnv("IDENTIFIER_LOOKUP_KEY", "test-only-lookup");
  dependencies.requireUser.mockResolvedValue(user);
  dependencies.studentOperationError.mockResolvedValue(undefined);
  dependencies.saveStudentProfile.mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllEnvs());
describe("profile action boundary", () => {
  it("rejects a forged avatar before saving profile or storage", async () => {
    const form = input({avatarAction:"replace"});
    form.set("avatar",new File(["not an image"],"avatar.webp",{type:"image/webp"}));
    const result = await saveProfile({},form);
    expect(result.fieldErrors?.avatar).toBeTruthy();
    expect(dependencies.saveStudentProfile).not.toHaveBeenCalled();
    expect(storeAccountAvatar).not.toHaveBeenCalled();
  });
  it("removes only the authenticated user's image", async () => {
    await expect(saveProfile({},input({avatarAction:"remove",userId:"another-student"}))).rejects.toThrow("redirect:/me?notice=profile-saved");
    expect(storeAccountAvatar).toHaveBeenCalledWith(user.id,"remove",undefined);
  });
  it("reports photo storage failures without claiming the photo was saved", async () => {
    vi.mocked(storeAccountAvatar).mockRejectedValueOnce(new Error("private storage details"));
    const result = await saveProfile({},input({avatarAction:"remove"}));
    expect(dependencies.saveStudentProfile).toHaveBeenCalled();
    expect(result.error).toContain("تم حفظ البيانات، لكن تعذّر حفظ الصورة");
    expect(JSON.stringify(result)).not.toContain("private storage details");
  });

  it("does not let a system administrator save student profile data", async () => {
    dependencies.studentOperationError.mockResolvedValue("هذا الحساب مخصص لإدارة النظام، وإجراءات الطلاب غير متاحة له.");
    const result = await saveProfile({}, input());
    expect(result.error).toContain("مخصص لإدارة النظام");
    expect(dependencies.saveStudentProfile).not.toHaveBeenCalled();
  });

  it("authenticates before touching the database and ignores a forged form owner", async () => {
    await expect(saveProfile({}, input({ userId: "another-student" }))).rejects.toThrow("redirect:/me?notice=profile-saved");
    expect(dependencies.saveStudentProfile).toHaveBeenCalledWith(user, expect.objectContaining({ fullName: "أحمد محمد",nationalId:"1000000008", universityId: "202612345" }));
    expect(dependencies.updateTag).toHaveBeenCalledWith("public-organizations");
    expect(dependencies.updateTag).toHaveBeenCalledWith("public-talent");
    dependencies.requireUser.mockRejectedValue(new Error("redirect:/login"));
    dependencies.saveStudentProfile.mockClear();
    await expect(saveProfile({}, input())).rejects.toThrow("redirect:/login");
    expect(dependencies.saveStudentProfile).not.toHaveBeenCalled();
  });
  it("does not save invalid identifiers or reflect the sensitive input in errors", async () => {
    const result = await saveProfile({}, input({ universityId: "sensitive-invalid-number" }));
    expect(result.fieldErrors?.universityId).toBeTruthy();
    expect(JSON.stringify(result)).not.toContain("sensitive-invalid-number");
    expect(dependencies.saveStudentProfile).not.toHaveBeenCalled();
  });
  it("does not save when setup is missing", async () => {
    vi.stubEnv("DATABASE_URL", "");
    expect((await saveProfile({}, input())).error).toBeTruthy();
    expect(dependencies.saveStudentProfile).not.toHaveBeenCalled();
  });
  it("does not expose raw database errors or invalidate views on failure", async () => {
    dependencies.saveStudentProfile.mockRejectedValue(new Error("internal ciphertext and database URL"));
    const result = await saveProfile({}, input());
    expect(result.error).toBeTruthy();
    expect(result.error).not.toContain("internal");
    expect(dependencies.revalidatePath).not.toHaveBeenCalled();
    expect(dependencies.updateTag).not.toHaveBeenCalled();
  });
});
