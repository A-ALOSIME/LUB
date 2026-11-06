import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";
import { requireOutsideRepository, requireSandboxUrl } from "./guards";

async function verify() {
  const destination = process.env.LUB_BASELINE_DIRECTORY;
  if (!destination) throw new Error("Private sandbox configuration required.");
  const directory = requireOutsideRepository(destination, process.cwd());
  const config: { databaseUrl: string } = JSON.parse(readFileSync(join(directory, "sandbox.json"), "utf8"));
  const url = requireSandboxUrl(config.databaseUrl).toString();
  const connections = Array.from({ length: 3 }, () => postgres(url, { max: 1, ssl: false, onnotice: () => {} }));
  const [control, writer, follower] = connections;
  const accounts = [randomUUID(), randomUUID(), randomUUID()], [admin, first, second] = accounts;
  let organization: string | undefined;
  async function waitForLock(pid: number) {
    for (let n = 0; n < 40; n++) {
      const [state] = await control<{ waiting: boolean }[]>`select wait_event_type='Lock' as waiting from pg_stat_activity where pid=${pid}`;
      if (state?.waiting) return true;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    return false;
  }
  try {
    for (const account of accounts) {
      await control`insert into auth.users(id) values(${account})`;
      await control`insert into lub.users(id,email,email_verified_at,full_name_ar,university_id_ciphertext,university_id_lookup_hash,major_name,academic_level,onboarded_at)
        values(${account},${`admin-proof-${account}@example.invalid`},now(),'حساب اختبار معزول','encrypted',${account.replaceAll("-", "").repeat(2)},'نظم معلومات','5',now())`;
    }
    await control`insert into lub.access_assignments(user_id,role_code,assigned_by_user_id) values(${admin},'SA',${admin})`;
    organization = await control.begin(async tx => {
      await tx`select set_config('request.jwt.claim.sub',${admin},true),set_config('role','authenticated',true)`;
      const [row] = await tx<{ id: string }[]>`select lub.admin_create_organization(${`جهة التحقق ${randomUUID()}`},'Club',${`proof-${randomUUID()}`},'','',null) id`;
      return row.id;
    });
    const [{ pid }] = await follower<{ pid: number }[]>`select pg_backend_pid() pid`;
    // Each phase holds a genuine row lock while the second authenticated operation starts.
    async function race(promote: boolean) {
      let releaseWriter: () => void = () => { throw new Error("Uninitialized gate"); };
      let writerReady: () => void = () => { throw new Error("Uninitialized gate"); };
      const release = new Promise<void>(resolve => { releaseWriter = resolve; });
      const ready = new Promise<void>(resolve => { writerReady = resolve; });
      let wrote = false;
      const writing = writer.begin(async tx => {
        await tx`set local statement_timeout='10s'`;
        await tx`select set_config('request.jwt.claim.sub',${admin},true),set_config('role','authenticated',true)`;
        if (promote) await tx`select lub.grant_super_admin(${`admin-proof-${second}@example.invalid`})`;
        else await tx`select lub.set_primary_leader(${organization!},${`admin-proof-${first}@example.invalid`})`;
        wrote = true; writerReady(); await release;
      }).then(() => "committed", error => { writerReady(); return String(error.code); });
      await ready;
      const following = follower.begin(async tx => {
        await tx`set local statement_timeout='10s'`;
        await tx`select set_config('request.jwt.claim.sub',${admin},true),set_config('role','authenticated',true)`;
        await tx`select lub.set_primary_leader(${organization!},${`admin-proof-${second}@example.invalid`})`;
      }).then(() => "committed", error => String(error.code));
      let waited: boolean;
      try { waited = await waitForLock(pid); } finally { releaseWriter(); }
      assert.equal(wrote, true); assert.equal(await writing, "committed"); assert.equal(waited, true);
      return following;
    }
    assert.equal(await race(false), "committed");
    const [leaders] = await control<{ total: number; selected: boolean }[]>`select count(*)::int total,bool_and(user_id=${second}::uuid) selected from lub.access_assignments where organization_id=${organization} and role_code='OL' and end_at is null`;
    assert.equal(leaders.total, 1); assert.equal(leaders.selected, true);
    assert.equal(await race(true), "P0001", "Concurrent promotion must disqualify the candidate after its account lock is acquired.");
    const result = { database: "owned local PostgreSQL", serializedLeaderReplacement: true, oneActivePresident: true, concurrentAdministratorPromotionRejected: true, noLiveMutation: true };
    writeFileSync(join(directory, "administration-verification.json"), JSON.stringify(result, null, 2), { mode: 0o600 });
    console.log(JSON.stringify(result));
  } finally {
    await control`delete from lub.access_assignments where user_id in ${control(accounts)} or assigned_by_user_id in ${control(accounts)}`;
    if (organization) {
      await control`delete from lub.organization_memberships where organization_id=${organization}`;
      await control`delete from lub.organizations where id=${organization}`;
    }
    await control`delete from lub.users where id in ${control(accounts)}`;
    await control`delete from auth.users where id in ${control(accounts)}`;
    await Promise.all(connections.map(db => db.end()));
  }
}
verify().catch(() => { console.error("Local administrative verification failed; no live connection was allowed."); process.exitCode = 1; });
