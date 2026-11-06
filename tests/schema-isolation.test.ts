import { describe, expect, it } from "vitest";
import { requireOutsideRepository, requireSandboxUrl } from "../scripts/schema-simplification/guards";

describe("schema simplification isolation", () => {
  it("accepts only the explicitly allocated local database", () => {
    expect(requireSandboxUrl("postgresql://postgres:test@127.0.0.1:55418/lub_simplification").hostname).toBe("127.0.0.1");
  });
  it.each([
    "postgresql://postgres:secret@db.example.com:55418/lub_simplification",
    "postgresql://postgres:secret@127.0.0.1:5432/postgres",
    "postgresql://postgres:secret@127.0.0.1:55418/postgres",
    "postgresql://postgres@127.0.0.1:55418/lub_simplification",
    "https://postgres:secret@127.0.0.1:55418/lub_simplification",
    "not a URL",
  ])("refuses other databases without leaking the connection string", input => {
    expect(() => requireSandboxUrl(input)).toThrow(/isolated|outside/);
    try { requireSandboxUrl(input); } catch (error) { expect(String(error)).not.toContain("secret"); }
  });
  it("keeps private account exports out of the repository", () => {
    expect(() => requireOutsideRepository("/project/private/accounts.json", "/project")).toThrow();
    expect(() => requireOutsideRepository("/project", "/project")).toThrow();
    expect(() => requireOutsideRepository("/project/..private/accounts.json", "/project")).toThrow();
    expect(requireOutsideRepository("/backups/accounts.json", "/project")).toContain("accounts.json");
  });
});
