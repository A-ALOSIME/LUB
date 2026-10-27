import { applyMigrations, storageFixture } from "./storage-fixture";
import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import { profileSchema } from "@/lib/validation";

type TestTransaction = Parameters<Parameters<PgliteDatabase<typeof schema>["transaction"]>[0]>[0];
let database: PgliteDatabase<typeof schema>;
vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () => ({
  getDb:()=>({execute:async(query:Parameters<typeof database.execute>[0])=>(await database.execute(query)).rows}),
  withUser: async <T>(userId: string, operation: (tx: TestTransaction) => Promise<T>) => database.transaction(async (tx) => {
    await tx.execute(sql`select set_config('request.jwt.claim.sub', ${userId}, true)`);
    await tx.execute(sql`set local role authenticated`);
    return operation(tx);
  }),
}));
import { saveStudentProfile, getStudentProfile,getAccountProfile } from "@/features/profile/repository";

const alice = { id: "00000000-0000-4000-8000-000000000001", email: "alice@example.com", emailVerifiedAt: "2026-09-26T10:00:00Z" };
const bob = { id: "00000000-0000-4000-8000-000000000002", email: "bob@example.com", emailVerifiedAt: "2026-09-26T10:00:00Z" };
const profile = () => profileSchema.parse({ fullName: "أحمد محمد", universityId: "٢٠٢٦١٢٣٤٥",nationalId:"1000000008", major: "نظم المعلومات", academicLevel: "5", phone: "" });
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
  await applyMigrations(engine);
}, 30000);
// The repository creates its own transactions. Use a fresh database, not nested BEGIN/COMMIT.
afterEach(async () => { await engine.close(); vi.unstubAllEnvs(); });

describe("actual profile persistence", () => {
  it("atomically creates identity, a private default profile and a redacted audit event", async () => {
    await saveStudentProfile(alice, profile());
    const student = await getStudentProfile(alice.id);
    expect(student?.fullName).toBe("أحمد محمد");
    expect(student).not.toHaveProperty("publicProfileEnabled");
    expect((await engine.query("select public_profile_enabled from lub.profile_settings")).rows).toEqual([{ public_profile_enabled: false }]);
    expect(JSON.stringify(student)).not.toContain("202612345");
    expect(Object.keys(student ?? {})).not.toContain("universityIdCiphertext");
    const stored = (await engine.query<{ university_id_ciphertext: string }>("select university_id_ciphertext from lub.student_profiles")).rows[0];
    expect(stored.university_id_ciphertext).not.toContain("202612345");
    const audits = await engine.query("select action_code, metadata from lub.audit_log");
    expect(audits.rows).toEqual([{ action_code: "PROFILE_CREATED", metadata: {} }]);
  });
  it("edits the same profile and retains the original university number", async () => {
    await saveStudentProfile(alice, profile());
    const original = (await engine.query("select university_id_ciphertext from lub.student_profiles")).rows;
    await saveStudentProfile(alice, { ...profile(), universityId: undefined, major: "علوم حاسب" });
    expect((await getStudentProfile(alice.id))?.major).toBe("علوم حاسب");
    expect((await engine.query("select university_id_ciphertext from lub.student_profiles")).rows).toEqual(original);
    expect((await engine.query("select action_code from lub.audit_log order by created_at")).rows).toEqual([{ action_code: "PROFILE_CREATED" }, { action_code: "PROFILE_UPDATED" }]);
  });
  it("rolls back all changes on a duplicate normalized university number", async () => {
    await saveStudentProfile(alice, profile());
    await expect(saveStudentProfile(bob, { ...profile(), universityId: "202612345" })).rejects.toThrow();
    expect((await engine.query("select email from lub.users")).rows).toEqual([{ email: alice.email }]);
    expect((await engine.query("select id from lub.audit_log")).rows).toHaveLength(1);
  });
  it("requires onboarding identifiers and audits authorized university number corrections", async () => {
    await expect(saveStudentProfile(alice, { ...profile(), universityId: undefined })).rejects.toThrow();
    expect((await engine.query("select id from lub.users")).rows).toHaveLength(0);
    await saveStudentProfile(alice, profile());
    await saveStudentProfile(alice, { ...profile(), universityId: "202699999" });
    expect((await engine.query("select action_code from lub.audit_log where action_code='UNIVERSITY_ID_UPDATED'")).rows).toHaveLength(1);
  });
  it("blocks inactive accounts without changing their stored profile", async () => {
    await saveStudentProfile(alice, profile());
    await engine.exec(`update lub.users set status_code = 'Inactive' where id = '${alice.id}'`);
    expect(await getStudentProfile(alice.id)).toBeUndefined();
    await expect(saveStudentProfile(alice, { ...profile(), universityId: undefined })).rejects.toMatchObject({cause:{message:"Account inactive"}});
    expect((await engine.query("select id from lub.audit_log")).rows).toHaveLength(1);
  });
});

it('keeps national identifiers in a private table, exposes them only to the account owner, and audits reads without values',async()=>{
 await saveStudentProfile(alice,profile());
 expect(await getAccountProfile(alice)).toMatchObject({universityId:'202612345',nationalId:'1000000008'});
 expect(JSON.stringify(await getStudentProfile(alice.id))).not.toMatch(/1000000008|202612345|national|ciphertext/);
 const stored=(await engine.query<{national_id_ciphertext:string}>('select national_id_ciphertext from lub.private_student_identifiers')).rows[0];expect(stored.national_id_ciphertext).not.toContain('1000000008');
 await expect(database.transaction(async tx=>{await tx.execute(sql`select set_config('request.jwt.claim.sub',${alice.id},true)`);await tx.execute(sql`set local role authenticated`);await tx.execute(sql`select * from lub.private_student_identifiers`);})).rejects.toThrow();
 await saveStudentProfile(bob,{...profile(),universityId:'202699999',nationalId:'2000000006'});
 await expect(engine.query('select * from lub.read_student_identifiers($1,$2)',[bob.id,alice.id])).rejects.toThrow();
 const audit=(await engine.query("select metadata from lub.audit_log where action_code='STUDENT_IDENTIFIERS_VIEWED'")).rows;expect(audit).toEqual([{metadata:{}}]);
 await engine.query("insert into lub.global_role_assignments(user_id,role_code,assigned_by_user_id) values($1,'SA',$1)",[bob.id]);
 expect((await engine.query('select * from lub.read_student_identifiers($1,$2)',[bob.id,alice.id])).rows).toHaveLength(1);
 await expect(saveStudentProfile(bob,{...profile(),universityId:undefined,nationalId:'2000000006'})).rejects.toThrow();
});

it('does not allow an authenticated RPC caller to supply an arbitrary verified owner or email',async()=>{
 await saveStudentProfile(alice,profile());
 await expect(database.transaction(async tx=>{await tx.execute(sql`select set_config('request.jwt.claim.sub',${alice.id},true)`);await tx.execute(sql`set local role authenticated`);await tx.execute(sql`select lub.sync_verified_account_email(${bob.id},'forged@example.invalid',now())`);})).rejects.toThrow();
 await expect(database.transaction(async tx=>{await tx.execute(sql`select set_config('request.jwt.claim.sub',${alice.id},true)`);await tx.execute(sql`set local role authenticated`);await tx.execute(sql`select * from lub.read_student_identifiers(${alice.id},${alice.id})`);})).rejects.toThrow();
 expect((await engine.query('select email from lub.users where id=$1',[alice.id])).rows[0]).toEqual({email:alice.email});
});

it('shows a non-blocking completion notice once for legacy missing data and keeps unknown majors unselected',async()=>{
 await saveStudentProfile(alice,profile());
 await engine.query('insert into lub.users(id,email,email_verified_at) values($1,$2,now())',[bob.id,bob.email]);await engine.query("insert into lub.student_profiles(user_id,full_name_ar,university_id_ciphertext,university_id_lookup_hash,major_name,academic_level) values($1,'طالب قديم','private',$2,'هندسة كهربائية','5')",[bob.id,'c'.repeat(64)]);await engine.query('insert into lub.profile_settings(user_id) values($1)',[bob.id]);
 const claim=(id:string)=>database.transaction(async tx=>{await tx.execute(sql`select set_config('request.jwt.claim.sub',${id},true)`);await tx.execute(sql`set local role authenticated`);return (await tx.execute(sql`select lub.claim_profile_completion_notice() as show`)).rows;});
 expect(await claim(bob.id)).toEqual([{show:true}]);expect(await claim(bob.id)).toEqual([{show:false}]);expect(await claim(alice.id)).toEqual([{show:false}]);
 expect((await engine.query("select lub.canonical_student_major('نظم المعلومات') as major,lub.canonical_student_major('هندسة كهربائية') as unknown")).rows[0]).toEqual({major:'نظم معلومات',unknown:null});
});

it("keeps account avatars private, fixed to one own path and unavailable to inactive accounts",async()=>{
 await saveStudentProfile(alice,profile());await saveStudentProfile(bob,{...profile(),universityId:"202699999",nationalId:"2000000006"});
 const own=async(user:string,query:string)=>database.transaction(async tx=>{await tx.execute(sql`select set_config('request.jwt.claim.sub',${user},true)`);await tx.execute(sql`set local role authenticated`);return (await tx.execute(sql.raw(query.replaceAll("USER_ID",user)))).rows;});
 await own(alice.id,"insert into storage.objects(bucket_id,name) values('lub-avatars','USER_ID/avatar.webp')");
 expect(await own(bob.id,"select name from storage.objects where bucket_id='lub-avatars'")).toHaveLength(0);
 await expect(own(bob.id,`insert into storage.objects(bucket_id,name) values('lub-avatars','${alice.id}/other.webp')`)).rejects.toThrow();
 await expect(own(alice.id,"insert into storage.objects(bucket_id,name) values('lub-avatars','USER_ID/extra.webp')")).rejects.toThrow();
 await own(alice.id,"update storage.objects set owner_id='USER_ID' where bucket_id='lub-avatars'");
 expect(await own(alice.id,"select name from storage.objects where bucket_id='lub-avatars'")).toHaveLength(1);
 await engine.query("update lub.users set status_code='Inactive' where id=$1",[alice.id]);
 expect(await own(alice.id,"select name from storage.objects where bucket_id='lub-avatars'")).toHaveLength(0);
 const bucket=(await engine.query("select public,file_size_limit,allowed_mime_types from storage.buckets where id='lub-avatars'")).rows[0];expect(bucket).toEqual({public:false,file_size_limit:65536,allowed_mime_types:['image/webp']});
});
