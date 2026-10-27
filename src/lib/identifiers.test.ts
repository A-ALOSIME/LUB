import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { encryptIdentifier, decryptIdentifier, encryptSignupDraft, decryptSignupDraft, identifierLookup } from "./identifiers";

beforeEach(() => {
  vi.stubEnv("IDENTIFIER_ENCRYPTION_KEY", Buffer.alloc(32, 1).toString("base64"));
  vi.stubEnv("IDENTIFIER_LOOKUP_KEY", Buffer.alloc(32, 2).toString("base64"));
});
afterEach(() => vi.unstubAllEnvs());

describe("sensitive identifiers", () => {
  it('separates national ID encryption and lookup from university identifiers',()=>{
    const encrypted=encryptIdentifier('1000000008','student-1','national-id');expect(decryptIdentifier(encrypted,'student-1','national-id')).toBe('1000000008');expect(()=>decryptIdentifier(encrypted,'student-1')).toThrow();expect(identifierLookup('1000000008','national-id')).not.toBe(identifierLookup('1000000008'));
  });
  it("encrypts without exposing the original and uses a fresh nonce", () => {
    const first = encryptIdentifier("202612345", "student-1");
    const second = encryptIdentifier("202612345", "student-1");
    expect(first).not.toContain("202612345");
    expect(first).not.toBe(second);
    expect(decryptIdentifier(first, "student-1")).toBe("202612345");
  });
  it("rejects a different owner, modified ciphertext and invalid envelopes", () => {
    const encrypted = encryptIdentifier("202612345", "student-1");
    expect(() => decryptIdentifier(encrypted, "student-2")).toThrow();
    const parts = encrypted.split(".");
    parts[2] = Buffer.alloc(16).toString("base64");
    expect(() => decryptIdentifier(parts.join("."), "student-1")).toThrow();
    expect(() => decryptIdentifier("invalid", "student-1")).toThrow();
  });
  it("finds the same number regardless of input digit alphabet", () => {
    expect(identifierLookup("٢٠٢٦١٢٣٤٥")).toBe(identifierLookup("202612345"));
    expect(identifierLookup("202612345")).not.toBe(identifierLookup("202612346"));
    expect(identifierLookup("202612345")).not.toContain("202612345");
  });
  it("encrypts a short-lived signup draft and binds it to the verified email", () => {
    const draft = JSON.stringify({ fullName: "أحمد محمد", universityId: "202612345" });
    const encrypted = encryptSignupDraft(draft, "Student@Example.com");
    expect(encrypted).not.toContain("202612345");
    expect(decryptSignupDraft(encrypted, "student@example.com")).toBe(draft);
    expect(() => decryptSignupDraft(encrypted, "other@example.com")).toThrow();
  });
  it("fails closed on missing, short or reused encryption keys", () => {
    vi.stubEnv("IDENTIFIER_ENCRYPTION_KEY", "");
    expect(() => encryptIdentifier("202612345", "student-1")).toThrow();
    vi.stubEnv("IDENTIFIER_ENCRYPTION_KEY", "c2hvcnQ=");
    expect(() => encryptIdentifier("202612345", "student-1")).toThrow();
    const same = Buffer.alloc(32, 2).toString("base64");
    vi.stubEnv("IDENTIFIER_ENCRYPTION_KEY", same);
    expect(() => encryptIdentifier("202612345", "student-1")).toThrow();
  });
});
