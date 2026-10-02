import { storageFixture } from "./storage-fixture";
import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { readdirSync, readFileSync } from "node:fs";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import { profileSchema } from "@/lib/validation";

type TestTransaction = Parameters<Parameters<PgliteDatabase<typeof schema>["transaction"]>[0]>[0];
let database: PgliteDatabase<typeof schema>;
vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () => ({
  withUser: async <T>(userId: string, operation: (tx: TestTransaction) => Promise<T>) => database.transaction(async (tx) => {
    await tx.execute(sql`select set_config('request.jwt.claim.sub', ${userId}, true)`);
    await tx.execute(sql`set local role authenticated`);
    return operation(tx);
  }),
}));
import { saveStudentProfile, getStudentProfile } from "@/features/profile/repository";

const alice = { id: "00000000-0000-4000-8000-000000000001", email: "alice@example.com", emailVerifiedAt: "2026-09-26T10:00:00Z" };
const bob = { id: "00000000-0000-4000-8000-000000000002", email: "bob@example.com", emailVerifiedAt: "2026-09-26T10:00:00Z" };
const profile = () => profileSchema.parse({ fullName: "أحمد محمد", universityId: "٢٠٢٦١٢٣٤٥", major: "نظم المعلومات", academicLevel: "5", phone: "" });
let engine: PGlite;
beforeEach(async () => {
  vi.stubEnv("IDENTIFIER_ENCRYPTION_KEY", Buffer.alloc(32, 1).toString("base64"));
  vi.stubEnv("IDENTIFIER_LOOKUP_KEY", Buffer.alloc(32, 2).toString("base64"));
  engine = new PGlite();
  database = drizzle(engine, { schema });
  await engine.exec(`create role anon; create role authenticated; create schema auth; create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
    insert into auth.users values ('${alice.id}'), ('${bob.id}');`);
  await storageFixture(engine);
  for (const file of readdirSync("drizzle").filter((name) => name.endsWith(".sql")).sort()) await engine.exec(readFileSync(`drizzle/${file}`, "utf8"));
}, 30000);
// The repository creates its own transactions. Use a fresh database, not nested BEGIN/COMMIT.
afterEach(async () => { await engine.close(); vi.unstubAllEnvs(); });

describe("actual profile persistence", () => {
  it("atomically creates identity, encrypted profile, opt-in settings and a redacted audit event", async () => {
    await saveStudentProfile(alice, profile());
    const student = await getStudentProfile(alice.id);
    expect(student?.fullName).toBe("أحمد محمد");
    expect(student?.publicProfileEnabled).toBe(false);
    expect(JSON.stringify(student)).not.toContain("202612345");
    expect(Object.keys(student ?? {})).not.toContain("universityIdCiphertext");
    const stored = (await engine.query<{ university_id_ciphertext: string }>("select university_id_ciphertext from lub.student_profiles")).rows[0];
    expect(stored.university_id_ciphertext).not.toContain("202612345");
    const audits = await engine.query("select action_code, metadata from lub.audit_log");
    expect(audits.rows).toEqual([{ action_code: "PROFILE_CREATED", metadata: { publicProfileEnabled: false, showTotalHours: true } }]);
  });
  it("edits the same profile and retains the original university number", async () => {
    await saveStudentProfile(alice, profile());
    const original = (await engine.query("select university_id_ciphertext from lub.student_profiles")).rows;
    await saveStudentProfile(alice, { ...profile(), universityId: undefined, major: "علوم الحاسب", publicProfileEnabled: true });
    expect((await getStudentProfile(alice.id))?.major).toBe("علوم الحاسب");
    expect((await engine.query("select university_id_ciphertext from lub.student_profiles")).rows).toEqual(original);
    expect((await engine.query("select action_code from lub.audit_log order by created_at")).rows).toEqual([{ action_code: "PROFILE_CREATED" }, { action_code: "PROFILE_UPDATED" }]);
  });
  it("rolls back all changes on a duplicate normalized university number", async () => {
    await saveStudentProfile(alice, profile());
    await expect(saveStudentProfile(bob, { ...profile(), universityId: "202612345" })).rejects.toThrow();
    expect((await engine.query("select email from lub.users")).rows).toEqual([{ email: alice.email }]);
    expect((await engine.query("select id from lub.audit_log")).rows).toHaveLength(1);
  });
  it("rejects onboarding without a university number and rejects arbitrary number replacement", async () => {
    await expect(saveStudentProfile(alice, { ...profile(), universityId: undefined })).rejects.toThrow();
    expect((await engine.query("select id from lub.users")).rows).toHaveLength(0);
    await saveStudentProfile(alice, profile());
    await expect(saveStudentProfile(alice, { ...profile(), universityId: "202699999" })).rejects.toThrow();
    expect((await engine.query("select id from lub.audit_log")).rows).toHaveLength(1);
  });
  it("blocks inactive accounts without changing their stored profile", async () => {
    await saveStudentProfile(alice, profile());
    await engine.exec(`update lub.users set status_code = 'Inactive' where id = '${alice.id}'`);
    expect(await getStudentProfile(alice.id)).toBeUndefined();
    await expect(saveStudentProfile(alice, { ...profile(), universityId: undefined })).rejects.toThrow("inactive");
    expect((await engine.query("select id from lub.audit_log")).rows).toHaveLength(1);
  });
});
