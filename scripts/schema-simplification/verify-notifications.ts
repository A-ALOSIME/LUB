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
  const user = randomUUID();
  try {
    await control`insert into auth.users(id) values(${user})`;
    await control`insert into lub.users(id,email,email_verified_at,full_name_ar) values(${user},${`notification-proof-${user}@example.invalid`},now(),'حساب اختبار')`;
    await control`select lub.workflow_notify(${user},'FIRST','/activity')`;
    let releaseWriter: () => void = () => { throw new Error("Gate not initialized"); };
    let writerReady: () => void = () => { throw new Error("Gate not initialized"); };
    const release = new Promise<void>(resolve => { releaseWriter = resolve; });
    const ready = new Promise<void>(resolve => { writerReady = resolve; });
    const writing = writer.begin(async tx => {
      await tx`set local statement_timeout='10s'`;
      await tx`select set_config('request.jwt.claim.sub',${user},true),set_config('role','authenticated',true)`;
      await tx`select lub.read_all_task_notifications()`; writerReady(); await release;
    }).then(() => true, () => { writerReady(); return false; });
    await ready;
    const [{pid}] = await follower<{pid:number}[]>`select pg_backend_pid() pid`;
    const appending = follower.begin(async tx => {
      await tx`set local statement_timeout='10s'`;
      await tx`select lub.workflow_notify(${user},'SECOND','/activity')`;
    }).then(() => true, () => false);
    let waited = false;
    try {
      for (let n=0;n<40;n++) {
        const [state] = await control<{waiting:boolean}[]>`select wait_event_type='Lock' waiting from pg_stat_activity where pid=${pid}`;
        if (state?.waiting) {waited=true;break;} await new Promise(resolve=>setTimeout(resolve,50));
      }
    } finally { releaseWriter(); }
    assert.equal(await writing,true); assert.equal(await appending,true); assert.equal(waited,true);
    const counts = await control.begin(async tx => {
      await tx`select set_config('request.jwt.claim.sub',${user},true),set_config('role','authenticated',true)`;
      const [row] = await tx<{all:number;unread:number}[]>`select * from lub.notification_counts()`; return row;
    });
    assert.deepEqual(counts,{all:2,unread:1});
    const result={database:"owned local PostgreSQL",concurrentAppendWaited:waited,existingReadReceiptPreserved:true,newMessageUnread:true,count:counts.all,httpTested:false};
    writeFileSync(join(directory,"notification-verification.json"),JSON.stringify(result,null,2),{mode:0o600});console.log(JSON.stringify(result));
  } finally {
    await control`delete from lub.users where id=${user}`;await control`delete from auth.users where id=${user}`;
    await Promise.all(connections.map(db=>db.end()));
  }
}
verify().catch(error=>{console.error("Owned local notification verification failed:",error.code??error.name);process.exitCode=1;});
