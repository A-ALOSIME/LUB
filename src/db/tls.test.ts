import { expect, it } from "vitest";
import { databaseTLS } from "./tls";
it("requires certificate validation on remote databases even when the URL requests disabled SSL", () => {
  const tls = databaseTLS("postgresql://example.pooler.supabase.com/postgres?sslmode=disable");
  expect(tls).not.toBe(false);
  if (tls) { expect(tls.rejectUnauthorized).toBe(true); expect(tls.ca.some(ca => ca.includes("BEGIN CERTIFICATE"))).toBe(true); }
});
it("permits a local development database but treats hostname lookalikes as remote", () => {
  for (const host of ["localhost", "127.0.0.1", "[::1]"]) expect(databaseTLS(`postgresql://${host}/postgres`)).toBe(false);
  expect(databaseTLS("postgresql://localhost.example.com/postgres")).not.toBe(false);
});
it("rejects unrelated connection protocols with a sanitized error", () => {
  expect(() => databaseTLS("https://example.com")).toThrow("PostgreSQL connection required.");
});
