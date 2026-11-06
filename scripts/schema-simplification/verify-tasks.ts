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
  const leader = randomUUID(), student = randomUUID(), organization = randomUUID(), membership = randomUUID(), term = randomUUID();
  const assets = [randomUUID(), randomUUID()];
  let task: string | undefined;
  try {
    for (const account of [leader, student]) {
      await control`insert into auth.users(id) values(${account})`;
      await control`insert into lub.users(id,email,email_verified_at,full_name_ar,university_id_ciphertext,university_id_lookup_hash,major_name,academic_level,onboarded_at)
       values(${account},${`task-proof-${account}@example.invalid`},now(),'حساب اختبار معزول','encrypted',${account.replaceAll("-", "").repeat(2)},'نظم معلومات','5',now())`;
    }
    await control`insert into lub.organizations(id,type_code,slug,name_ar) values(${organization},'Club',${`task-proof-${organization}`},'جهة اختبار المهام')`;
    const [manager] = await control<{ id: string }[]>`insert into lub.organization_memberships(organization_id,user_id) values(${organization},${leader}) returning id`;
    await control`insert into lub.organization_memberships(id,organization_id,user_id) values(${membership},${organization},${student})`;
    await control`insert into lub.access_assignments(user_id,organization_id,organization_membership_id,role_code,assigned_by_user_id) values(${leader},${organization},${manager.id},'OL',${leader})`;
    await control`insert into lub.academic_terms(id,academic_year,term_code,name_ar,start_date,end_date) values(${term},'proof',${term.slice(0, 8)},'فصل اختبار',lub.today_riyadh()-1,lub.today_riyadh()+1)`;
    for (const [n, asset] of assets.entries()) await control`insert into lub.assets(id,owner_user_id,object_key,file_name,mime_type,size_bytes)
     values(${asset},${student},${`${student}/${asset}.pdf`},${n ? "تصميم الفعالية.pdf" : "poster.pdf"},'application/pdf',100)`;
    task = await control.begin(async tx => {
      await tx`select set_config('request.jwt.claim.sub',${leader},true),set_config('role','authenticated',true)`;
      const [row] = await tx<{ id: string }[]>`select lub.save_task(null,${organization},null,'مهمة اختبار','مخرج اختبار',null,null,5,null) id`;
      await tx`select lub.change_task_status(${row.id},'Open',1)`; return row.id;
    });
    const participant = await control.begin(async tx => {
      await tx`select set_config('request.jwt.claim.sub',${student},true),set_config('role','authenticated',true)`;
      const [row] = await tx<{ id: string }[]>`select lub.join_task(${task!}) id`; return row.id;
    });
    let releaseWriter: () => void = () => { throw new Error("Uninitialized gate"); };
    let writerReady: () => void = () => { throw new Error("Uninitialized gate"); };
    const release = new Promise<void>(resolve => { releaseWriter = resolve; });
    const ready = new Promise<void>(resolve => { writerReady = resolve; });
    const writing = writer.begin(async tx => {
      await tx`set local statement_timeout='10s'`;
      await tx`select set_config('request.jwt.claim.sub',${student},true),set_config('role','authenticated',true)`;
      const [row] = await tx<{ id: string }[]>`select lub.submit_task(${participant},'',${[assets[0]]}::uuid[],0,2) id`;
      writerReady(); await release; return row.id;
    }).then(id => ({ id }), error => { writerReady(); return { error: String(error.code) }; });
    await ready;
    const [{ pid }] = await follower<{ pid: number }[]>`select pg_backend_pid() pid`;
    const following = follower.begin(async tx => {
      await tx`set local statement_timeout='10s'`;
      await tx`select set_config('request.jwt.claim.sub',${student},true),set_config('role','authenticated',true)`;
      await tx`select lub.submit_task(${participant},'طلب متزامن',array[]::uuid[],0,2)`;
    }).then(() => "committed", error => String(error.code));
    let waited = false;
    try {
      for (let n = 0; n < 40; n++) {
        const [state] = await control<{ waiting: boolean }[]>`select wait_event_type='Lock' waiting from pg_stat_activity where pid=${pid}`;
        if (state?.waiting) { waited = true; break; } await new Promise(resolve => setTimeout(resolve, 50));
      }
    } finally { releaseWriter(); }
    const first = await writing, duplicateCode = await following;
    assert.ok("id" in first); assert.equal(waited, true); assert.equal(duplicateCode, "P0001");
    const last = await control.begin(async tx => {
      await tx`select set_config('request.jwt.claim.sub',${student},true),set_config('role','authenticated',true)`;
      await tx`select lub.withdraw_task_submission(${first.id})`;
      const [arabic] = await tx<{ id: string }[]>`select lub.submit_task(${participant},'',${[assets[1]]}::uuid[],1,2) id`;
      await tx`select lub.withdraw_task_submission(${arabic.id})`;
      const [text] = await tx<{ id: string }[]>`select lub.submit_task(${participant},'مخرج نصي دون مرفق',array[]::uuid[],2,2) id`; return text.id;
    });
    await control.begin(async tx => {
      await tx`select set_config('request.jwt.claim.sub',${leader},true),set_config('role','authenticated',true)`;
      await tx`select lub.review_task_submission_decision(${last},'Approved','')`;
    });
    const [stored] = await control<{ count: number; hours: string }[]>`select (select jsonb_array_length(p.submissions) from lub.task_participants p where p.id=${participant}) count,
      (select sum((h->>'hours')::numeric)::text from lub.organization_memberships m cross join lateral jsonb_array_elements(m.hours) h where m.id=${membership}) hours`;
    assert.equal(stored.count, 3); assert.equal(Number(stored.hours), 5);
    const result = { database: "owned local PostgreSQL", englishDisplayNameSubmitted: true, arabicDisplayNameSubmitted: true, textOnlySubmitted: true, concurrentSubmitWaited: waited, duplicateCode, submissions: stored.count, awardedHours: Number(stored.hours), httpTested: false };
    writeFileSync(join(directory, "task-verification.json"), JSON.stringify(result, null, 2), { mode: 0o600 }); console.log(JSON.stringify(result));
  } finally {
    if (task) { await control`delete from lub.task_participants where task_id=${task}`; await control`delete from lub.tasks where id=${task}`; }
    await control`delete from lub.access_assignments where organization_id=${organization}`;
    await control`delete from lub.organization_memberships where organization_id=${organization}`;
    await control`delete from lub.organizations where id=${organization}`;
    await control`delete from lub.assets where id in ${control(assets)}`;
    await control`delete from lub.academic_terms where id=${term}`;
    await control`delete from lub.users where id in ${control([leader, student])}`;
    await control`delete from auth.users where id in ${control([leader, student])}`;
    await Promise.all(connections.map(db => db.end()));
  }
}
verify().catch(() => { console.error("Local task verification failed; no live connection was allowed."); process.exitCode = 1; });
