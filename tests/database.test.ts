import { storageFixture } from "./storage-fixture";
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { beforeAll, beforeEach, afterAll, afterEach, describe, expect, it } from "vitest";

const alice = "00000000-0000-4000-8000-000000000001";
const bob = "00000000-0000-4000-8000-000000000002";
let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to authenticated;
    grant execute on function auth.uid() to authenticated;
    insert into auth.users values ('${alice}'), ('${bob}');
  `);
  await storageFixture(db);
  for (const file of readdirSync("drizzle").filter((name) => name.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(`drizzle/${file}`, "utf8"));
  }
}, 30000);
beforeEach(async () => { await db.exec("begin"); });
afterEach(async () => { await db.exec("rollback"); });
afterAll(async () => { await db.close(); });

async function asUser(userId: string) {
  await db.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
  await db.exec("set local role authenticated");
}
async function seed() {
  await db.exec(`insert into lub.users (id, email, email_verified_at) values
    ('${alice}', 'alice@example.com', now()), ('${bob}', 'bob@example.com', now());`);
}

describe("foundation migration security", () => {
  it("permits own profile and settings while hiding another student's data", async () => {
    await seed();
    await asUser(alice);
    await db.query("insert into lub.student_profiles (user_id, full_name_ar, university_id_ciphertext, university_id_lookup_hash, major_name, academic_level) values ($1, $2, $3, $4, $5, $6)", [alice, "أحمد محمد", "encrypted", "a".repeat(64), "نظم المعلومات", "5"]);
    await db.query("insert into lub.profile_settings (user_id) values ($1)", [alice]);
    expect((await db.query("select public_profile_enabled from lub.profile_settings")).rows).toEqual([{ public_profile_enabled: false }]);
    await db.exec("reset role");
    await asUser(bob);
    expect((await db.query("select full_name_ar from lub.student_profiles")).rows).toHaveLength(0);
  });
  it("rejects writing a different student's profile", async () => {
    await seed();
    await asUser(alice);
    await expect(db.query("insert into lub.profile_settings (user_id) values ($1)", [bob])).rejects.toThrow();
  });
  it("does not allow students to change account status", async () => {
    await seed();
    await asUser(alice);
    await expect(db.exec("update lub.users set status_code = 'Inactive'")).rejects.toThrow();
  });
  it("does not allow students to replace protected identifier columns", async () => {
    await seed();
    await asUser(alice);
    await expect(db.exec("update lub.student_profiles set university_id_ciphertext = 'forged'")).rejects.toThrow();
  });
  it("rejects duplicate university lookup values", async () => {
    await seed();
    await db.exec(`insert into lub.student_profiles (user_id, full_name_ar, university_id_ciphertext, university_id_lookup_hash, major_name, academic_level) values ('${alice}', 'أحمد محمد', 'cipher', '${"a".repeat(64)}', 'نظم المعلومات', '5');`);
    await expect(db.exec(`insert into lub.student_profiles (user_id, full_name_ar, university_id_ciphertext, university_id_lookup_hash, major_name, academic_level) values ('${bob}', 'ناصر محمد', 'cipher2', '${"a".repeat(64)}', 'نظم المعلومات', '5');`)).rejects.toThrow();
  });
  it("rejects identities absent from Supabase Auth", async () => {
    await expect(db.exec("insert into lub.users (id, email, email_verified_at) values ('00000000-0000-4000-8000-000000000003', 'unknown@example.com', now())")).rejects.toThrow();
  });
  it("blocks truncating the audit history", async () => {
    await expect(db.exec("truncate lub.audit_log")).rejects.toThrow("append-only");
  });
  it("blocks audit deletion even by the table owner", async () => {
    await seed();
    await db.exec(`insert into lub.audit_log (actor_user_id, action_code, entity_type, entity_id) values ('${alice}', 'PROFILE_CREATED', 'student_profiles', '${alice}');`);
    await expect(db.exec("delete from lub.audit_log")).rejects.toThrow("append-only");
  });
  it("blocks audit updates even by the table owner", async () => {
    await seed();
    await db.exec(`insert into lub.audit_log (actor_user_id, action_code, entity_type, entity_id) values ('${alice}', 'PROFILE_CREATED', 'student_profiles', '${alice}');`);
    await expect(db.exec("update lub.audit_log set action_code = 'CHANGED'")).rejects.toThrow("append-only");
  });
  it("allows an audit entry only for the verified actor", async () => {
    await seed();
    await asUser(alice);
    await db.query("insert into lub.audit_log (actor_user_id, action_code, entity_type, entity_id) values ($1, 'PROFILE_CREATED', 'student_profiles', $1)", [alice]);
    await expect(db.query("insert into lub.audit_log (actor_user_id, action_code, entity_type, entity_id) values ($1, 'PROFILE_CREATED', 'student_profiles', $1)", [bob])).rejects.toThrow();
  });
  it("denies anonymous access to private identity tables", async () => {
    await seed();
    await db.exec("set local role anon");
    await expect(db.exec("select * from lub.users")).rejects.toThrow();
  });
});
