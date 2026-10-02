import { describe, expect, it } from "vitest";
import { emailSchema, otpSchema, profileSchema, normalizeDigits } from "./validation";

describe("student input", () => {
  it("normalizes Arabic and Persian digits consistently", () => {
    expect(normalizeDigits("٢٠٢٦۱۲۳۴۵")).toBe("202612345");
  });
  it("trims and normalizes email without accepting malformed addresses", () => {
    expect(emailSchema.parse("  Student@Example.com  ")).toBe("student@example.com");
    expect(emailSchema.safeParse("x@example").success).toBe(false);
  });
  it("accepts exactly eight OTP digits, including Arabic digits", () => {
    expect(otpSchema.parse("١٢٣٤٥٦٧٨")).toBe("12345678");
    expect(otpSchema.safeParse("123456").success).toBe(false);
    expect(otpSchema.safeParse("123456789").success).toBe(false);
  });
  it("normalizes identifiers and rejects text and oversized profile input", () => {
    const profile = { fullName: "أحمد محمد", universityId: "٢٠٢٦١٢٣٤٥", major: "نظم المعلومات", academicLevel: "5", phone: "" };
    expect(profileSchema.parse(profile).universityId).toBe("202612345");
    expect(profileSchema.safeParse({ ...profile, universityId: "2026x345" }).success).toBe(false);
    expect(profileSchema.safeParse({ ...profile, fullName: "أ".repeat(121) }).success).toBe(false);
    expect(profileSchema.safeParse({ ...profile, academicLevel: "99" }).success).toBe(false);
  });
  it("allows editing without re-entering a previously saved university number", () => {
    expect(profileSchema.parse({ fullName: "أحمد محمد", major: "نظم المعلومات", academicLevel: "5", phone: "" }).universityId).toBeUndefined();
  });
});
