import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { migrationHashMatches } from "./migration-hash";

const hash = (source: string) => createHash("sha256").update(source).digest("hex");

describe("migrationHashMatches", () => {
  it("accepts a migration with identical SQL and different Windows line endings", () => {
    const linux = "select 1;\nselect 2;\n";
    expect(migrationHashMatches(linux, hash(linux.replace(/\n/g, "\r\n")))).toBe(true);
  });

  it("accepts a migration whose original line endings are mixed", () => {
    const mixed = "select 1;\r\nselect 2;\n";
    expect(migrationHashMatches(mixed, hash(mixed))).toBe(true);
  });

  it("still rejects changed SQL", () => {
    expect(migrationHashMatches("select 1;\n", hash("select 2;\n"))).toBe(false);
  });
});
