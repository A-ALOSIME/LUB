import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SignupProfileInput } from "@/lib/validation";

const deps = vi.hoisted(() => ({
  studentOperationError: vi.fn(),
  getAccountReadiness: vi.fn(),
  saveStudentProfile: vi.fn(),
  updateTag: vi.fn(),
  revalidatePath: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("./authorization", () => ({ studentOperationError: deps.studentOperationError }));
vi.mock("@/features/profile/repository", () => ({ getAccountReadiness: deps.getAccountReadiness, saveStudentProfile: deps.saveStudentProfile }));
vi.mock("next/cache", () => ({ updateTag: deps.updateTag, revalidatePath: deps.revalidatePath }));
import { completeSignup } from "./complete-signup";

const user = { id: "verified-user", email: "student@example.com", emailVerifiedAt: "2026-10-12T10:00:00Z" };
const profile: SignupProfileInput = { fullName: "أحمد محمد",nationalId:"1000000008", universityId: "202612345", major: "نظم معلومات", academicLevel: "5", phone: "" };

beforeEach(() => {
  vi.clearAllMocks();
  deps.studentOperationError.mockResolvedValue(undefined);
  deps.getAccountReadiness.mockResolvedValue({ status: "Active", onboarded: false });
  deps.saveStudentProfile.mockResolvedValue(undefined);
});

describe("complete signup", () => {
  it("persists a profile only for an eligible account and refreshes profile views", async () => {
    await expect(completeSignup(user, profile)).resolves.toBeUndefined();
    expect(deps.saveStudentProfile).toHaveBeenCalledWith(user, profile);
    expect(deps.updateTag).toHaveBeenCalledWith("public-organizations");
    expect(deps.revalidatePath).toHaveBeenCalledWith("/me");
  });

  it("keeps administrator, inactive, and already-onboarded accounts out of student registration", async () => {
    deps.studentOperationError.mockResolvedValue("system administrator");
    await expect(completeSignup(user, profile)).resolves.toBe("/manage");
    expect(deps.getAccountReadiness).not.toHaveBeenCalled();
    expect(deps.saveStudentProfile).not.toHaveBeenCalled();

    deps.studentOperationError.mockResolvedValue(undefined);
    deps.getAccountReadiness.mockResolvedValue({ status: "Inactive", onboarded: false });
    await expect(completeSignup(user, profile)).resolves.toBe("/account-unavailable");
    expect(deps.saveStudentProfile).not.toHaveBeenCalled();

    deps.getAccountReadiness.mockResolvedValue({ status: "Active", onboarded: true });
    await expect(completeSignup(user, profile)).resolves.toBeUndefined();
    expect(deps.saveStudentProfile).not.toHaveBeenCalled();
  });
});
