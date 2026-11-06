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
  const user = randomUUID(), org = randomUUID(), content = randomUUID(), asset = randomUUID();
  const key = `${user}/${asset}.pdf`;
  try {
    await control`insert into auth.users(id) values(${user})`;
    await control`insert into lub.users(id,email,email_verified_at,full_name_ar) values(${user},${`asset-proof-${user}@example.invalid`},now(),'حساب اختبار')`;
    await control`insert into lub.organizations(id,type_code,slug,name_ar) values(${org},'Club',${`asset-proof-${org}`},'جهة اختبار')`;
    await control`insert into lub.organization_content(id,organization_id,kind,title) values(${content},${org},'Announcement','اختبار المرفق')`;
    await control.begin(async tx => {
      await tx`select set_config('request.jwt.claim.sub',${user},true),set_config('role','authenticated',true)`;
      await tx`insert into storage.objects(bucket_id,name) values('lub-application-files',${key})`;
      await tx`select lub.register_application_asset(${asset},${key},'ملف اختبار.pdf','application/pdf',100)`;
    });
    const results: Array<{ operation: string; waited: boolean; code: string }> = [];
    for (const operation of ["metadata", "storage-object"] as const) {
      let releaseWriter: () => void = () => { throw new Error("Gate not initialized"); };
      let writerReady: () => void = () => { throw new Error("Gate not initialized"); };
      const release = new Promise<void>(resolve => { releaseWriter = resolve; });
      const ready = new Promise<void>(resolve => { writerReady = resolve; });
      const writing = writer.begin(async tx => {
        await tx`set local statement_timeout='10s'`;
        await tx`update lub.organization_content set attachments=${tx.json([{ id: randomUUID(), assetId: asset }])} where id=${content}`;
        writerReady(); await release;
      }).then(() => true, () => { writerReady(); return false; });
      await ready;
      const [{ pid }] = await follower<{ pid: number }[]>`select pg_backend_pid() pid`;
      const deleting = follower.begin(async tx => {
        await tx`set local statement_timeout='10s'`;
        if (operation === "metadata") await tx`delete from lub.assets where id=${asset}`;
        else {
          await tx`select set_config('request.jwt.claim.sub',${user},true),set_config('role','authenticated',true)`;
          await tx`delete from storage.objects where bucket_id='lub-application-files' and name=${key}`;
        }
      }).then(() => "committed", error => String(error.code));
      let waited = false;
      try {
        for (let n = 0; n < 40; n++) {
          const [state] = await control<{ waiting: boolean }[]>`select wait_event_type='Lock' waiting from pg_stat_activity where pid=${pid}`;
          if (state?.waiting) { waited = true; break; } await new Promise(resolve => setTimeout(resolve, 50));
        }
      } finally { releaseWriter(); }
      const committed = await writing, code = await deleting;
      assert.equal(committed, true); assert.equal(waited, true); assert.equal(code, "23503");
      results.push({ operation, waited, code });
      await control`update lub.organization_content set attachments='[]' where id=${content}`;
    }
    const result = { database: "owned local PostgreSQL", deletionRaces: results, httpStorageTested: false };
    writeFileSync(join(directory, "asset-verification.json"), JSON.stringify(result, null, 2), { mode: 0o600 });
    console.log(JSON.stringify(result));
  } finally {
    await control`delete from lub.organization_content where id=${content}`;
    await control`delete from storage.objects where bucket_id='lub-application-files' and name=${key}`;
    await control`delete from lub.assets where id=${asset}`;
    await control`delete from lub.organizations where id=${org}`;
    await control`delete from lub.users where id=${user}`;
    await control`delete from auth.users where id=${user}`;
    await Promise.all(connections.map(db => db.end()));
  }
}
verify().catch(error => { console.error("Owned local asset verification failed:", error.code ?? error.name); process.exitCode = 1; });
