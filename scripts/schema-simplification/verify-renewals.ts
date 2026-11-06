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
  const leader = randomUUID(), student = randomUUID(), org = randomUUID(), term = randomUUID();
  const asLeader = <T>(operation: (tx: postgres.TransactionSql) => Promise<T>) => control.begin(async tx => {
    await tx`select set_config('request.jwt.claim.sub',${leader},true),set_config('role','authenticated',true)`;
    return operation(tx);
  });
  try {
    for (const account of [leader, student]) {
      await control`insert into auth.users(id) values(${account})`;
      await control`insert into lub.users(id,email,email_verified_at,full_name_ar,university_id_ciphertext,university_id_lookup_hash,major_name,academic_level,onboarded_at)
       values(${account},${`renewal-proof-${account}@example.invalid`},now(),'حساب اختبار','encrypted',${account.replaceAll("-", "").repeat(2)},'نظم معلومات','5',now())`;
    }
    await control`insert into lub.organizations(id,type_code,slug,name_ar) values(${org},'Club',${`renewal-proof-${org}`},'جهة اختبار')`;
    const [membership] = await control<{id: string}[]>`insert into lub.organization_memberships(organization_id,user_id) values(${org},${leader}) returning id`;
    await control`insert into lub.organization_memberships(organization_id,user_id) values(${org},${student})`;
    await control`insert into lub.access_assignments(user_id,organization_id,organization_membership_id,role_code,assigned_by_user_id) values(${leader},${org},${membership.id},'OL',${leader})`;
    await control`insert into lub.academic_terms(id,academic_year,term_code,name_ar,start_date,end_date) values(${term},'proof',${term.slice(0,8)},'فصل اختبار',lub.today_riyadh()-1,lub.today_riyadh()+1)`;
    const campaign = await asLeader(async tx => {
      const [row] = await tx<{id:string}[]>`select lub.create_renewal(${org},${term},now()-interval '1 hour',now()+interval '1 day',true) id`;
      await tx`select lub.transition_campaign('renewal',${row.id},'publish','Draft')`; return row.id;
    });
    const [invitation] = await control<{id:string}[]>`select id from lub.membership_cases where campaign_id=${campaign} and user_id=${student}`;
    let releaseWriter: () => void = () => { throw new Error("Gate not initialized"); };
    let writerReady: () => void = () => { throw new Error("Gate not initialized"); };
    const release = new Promise<void>(resolve => { releaseWriter = resolve; });
    const ready = new Promise<void>(resolve => { writerReady = resolve; });
    const writing = writer.begin(async tx => {
      await tx`set local statement_timeout='10s'`;
      await tx`select set_config('request.jwt.claim.sub',${student},true),set_config('role','authenticated',true)`;
      await tx`select lub.respond_renewal(${invitation.id},'Renewed')`; writerReady(); await release;
    }).then(() => true, () => { writerReady(); return false; });
    await ready;
    const [{pid}] = await follower<{pid:number}[]>`select pg_backend_pid() pid`;
    const following = follower.begin(async tx => {
      await tx`set local statement_timeout='10s'`;
      await tx`select set_config('request.jwt.claim.sub',${student},true),set_config('role','authenticated',true)`;
      await tx`select lub.respond_renewal(${invitation.id},'Declined')`;
    }).then(() => "committed", error => String(error.code));
    let waited = false;
    try {
      for (let n = 0; n < 40; n++) {
        const [state] = await control<{waiting:boolean}[]>`select wait_event_type='Lock' waiting from pg_stat_activity where pid=${pid}`;
        if (state?.waiting) { waited = true; break; } await new Promise(resolve => setTimeout(resolve,50));
      }
    } finally { releaseWriter(); }
    assert.equal(await writing,true); const duplicateCode = await following; assert.equal(waited,true); assert.equal(duplicateCode,"42501");
    const second = await asLeader(async tx => {
      await tx`select lub.transition_campaign('renewal',${campaign},'close','Open')`;
      await tx`select lub.transition_campaign('renewal',${campaign},'archive','Closed')`;
      const [row] = await tx<{id:string}[]>`select lub.create_renewal(${org},${term},now(),now()+interval '1 day',true) id`; return row.id;
    });
    assert.notEqual(second,campaign);
    const [state] = await control<{status_code:string; changes:number}[]>`select c.status_code,(select count(*)::int from lub.history_events h where h.membership_case_id=c.id and h.to_status_code='Renewed') changes from lub.membership_cases c where c.id=${invitation.id}`;
    assert.equal(state.status_code,"Renewed"); assert.equal(state.changes,1);
    const result = {database:"owned local PostgreSQL",concurrentReplyWaited:waited,duplicateCode,oneRecordedResponse:true,newCampaignInSameTerm:true,httpTested:false};
    writeFileSync(join(directory,"renewal-verification.json"),JSON.stringify(result,null,2),{mode:0o600}); console.log(JSON.stringify(result));
  } finally {
    await control`delete from lub.history_events where organization_id=${org}`;
    await control`delete from lub.membership_cases where organization_id=${org}`;
    await control`delete from lub.membership_campaigns where organization_id=${org}`;
    await control`delete from lub.access_assignments where organization_id=${org}`;
    await control`delete from lub.organization_memberships where organization_id=${org}`;
    await control`delete from lub.organizations where id=${org}`;
    await control`delete from lub.academic_terms where id=${term}`;
    await control`delete from lub.users where id in ${control([leader,student])}`;
    await control`delete from auth.users where id in ${control([leader,student])}`;
    await Promise.all(connections.map(db => db.end()));
  }
}
verify().catch(error => {console.error("Owned local renewal verification failed:",error.code??error.name);process.exitCode=1;});
