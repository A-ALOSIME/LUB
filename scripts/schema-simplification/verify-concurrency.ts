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
  const [control, writer, remover] = connections, user = randomUUID(), skill = randomUUID();
  try {
    await control`insert into auth.users(id) values(${user})`;
    await control`insert into lub.users(id,email,email_verified_at) values(${user},${`concurrency-${user}@example.invalid`},now())`;
    await control`insert into lub.skills(id,canonical_key,name_ar) values(${skill},${`test:${skill}`},'اختبار التزامن')`;
    let releaseWriter: () => void = () => { throw new Error("Writer gate not initialized."); };
    let assignmentReady: () => void = () => { throw new Error("Assignment gate not initialized."); };
    const release = new Promise<void>(resolve => { releaseWriter = resolve; });
    const assigned = new Promise<void>(resolve => { assignmentReady = resolve; });
    let locked = false;
    const assignment = writer.begin(async tx => {
      await tx`set local statement_timeout='10s'`;
      await tx`update lub.users set skills=${tx.json([{ id: skill, isFeatured: false, sortOrder: 0 }])} where id=${user}`;
      locked = true;
      assignmentReady();
      await release;
    }).then(() => "committed", error => { assignmentReady(); return String(error.code); });
    await assigned;
    assert.equal(locked, true, "Skill assignment must succeed before testing its concurrent deletion.");
    const [{ pid }] = await remover<{ pid: number }[]>`select pg_backend_pid() as pid`;
    const deletion = remover.begin(async tx => {
      await tx`set local statement_timeout='10s'`;
      await tx`delete from lub.skills where id=${skill}`;
    }).then(() => "deleted", error => String(error.code));
    let waited = false;
    try {
      for (let n = 0; n < 40; n++) {
        const [state] = await control<{ waiting: boolean }[]>`select wait_event_type='Lock' as waiting from pg_stat_activity where pid=${pid}`;
        if (state?.waiting) { waited = true; break; }
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    } finally { releaseWriter(); }
    assert.equal(await assignment, "committed");
    const decision = await deletion;
    assert.equal(waited, true, "Concurrent delete must wait for the assignment's skill lock.");
    assert.equal(decision, "23503", "Referenced skill must survive concurrent assignment and delete.");
    assert.equal((await control`select id from lub.skills where id=${skill}`).length, 1);
    const result = { database: "owned local PostgreSQL", concurrentDeleteWaited: waited, deletionCode: decision, referencedSkillPreserved: true };
    writeFileSync(join(directory, "concurrency-verification.json"), JSON.stringify(result, null, 2), { mode: 0o600 });
    console.log(JSON.stringify(result));
  } finally {
    await control`update lub.users set skills='[]'::jsonb where id=${user}`;
    await control`delete from lub.users where id=${user}`;
    await control`delete from auth.users where id=${user}`;
    await control`delete from lub.skills where id=${skill}`;
    await Promise.all(connections.map(db => db.end()));
  }
}
verify().catch(() => { console.error("Local concurrency verification failed; no live connection was allowed."); process.exitCode = 1; });
