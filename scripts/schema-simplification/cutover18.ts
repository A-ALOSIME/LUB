
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { rootCertificates } from "node:tls";
import { parseEnv } from "node:util";
import postgres from "postgres";
import { BASELINE_COMMIT, requireOutsideRepository, requireSandboxUrl, SANDBOX } from "./guards";
import { contractFiles } from "./contract-files";

const archive = "lub_before_simplification";
const archiveRpc = "lub_before_simplification_rpc";
const oldWrapperNames = ["consume_hours_export", "consume_member_export", "consume_registrant_export", "export_hours_rows",
  "prepare_hours_export", "prepare_member_export", "prepare_registrant_export", "translation_finish", "translation_lookup", "translation_reserve"];
const localBackup = "cutover-baseline-62.dump";
const storageBackup = "storage-policies-before.sql";
const hash = (contents: Buffer) => createHash("sha256").update(contents).digest("hex");
type Tx = postgres.TransactionSql;

function git(...args: string[]) {
  return execFileSync("git", args, { encoding: "utf8", windowsHide: true }).trim();
}

async function tableCount(tx: Tx, schema: string) {
  return (await tx<{ count: number }[]>`select count(*)::int as count from pg_tables where schemaname=${schema}`)[0].count;
}

async function policyNames(tx: Tx) {
  return (await tx<{ name: string }[]>`select policyname as name from pg_policies
    where schemaname='storage' and tablename='objects'
     and (concat(qual,with_check) like '%lub-%' or policyname like 'asset_object_%') order by policyname`).map(row => row.name);
}

async function dropPolicies(tx: Tx) {
  for (const name of await policyNames(tx)) {
    await tx`drop policy ${tx(name)} on storage.objects`;
  }
}

async function moveWrappers(tx: Tx, from: string, to: string) {
  const rows = await tx<{ name: string; ddl: string }[]>`select p.proname as name, format('alter function %I.%I(%s) set schema %I',
    n.nspname,p.proname,pg_get_function_identity_arguments(p.oid),${to}::text) as ddl
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname=${from} and p.prokind='f' and (${from}<> 'public' or p.prosrc ~ 'lub[.]') order by p.proname`;
  assert.deepEqual(rows.map(row => row.name), oldWrapperNames);
  for (const row of rows) await tx.unsafe(row.ddl);
}

async function lockTables(tx: Tx, schema: string) {
  const tables = await tx<{ name: string }[]>`select tablename as name from pg_tables where schemaname=${schema} order by tablename`;
  for (const table of tables) await tx`lock table ${tx(schema)}.${tx(table.name)} in access exclusive mode`;
}

async function assertPreserved(tx: Tx) {
  const [counts] = await tx`select
    (select count(*)::int from lub.users) accounts,
    (select count(*)::int from lub.organizations) organizations,
    (select count(*)::int from lub.organization_content where kind='Event') events,
    (select count(*)::int from lub.committees) committees,
    (select count(*)::int from lub.tasks) tasks,
    (select count(*)::int from lub.event_registrations) registrations,
    (select count(*)::int from lub.task_participants) participants,
    (select count(*)::int from lub.membership_cases where kind='Registration') applications,
    (select count(*)::int from lub.membership_cases where kind='Renewal') renewals,
    (select count(*)::int from lub.assets) assets,
    (select coalesce(sum(jsonb_array_length(hours)),0)::int from lub.organization_memberships) hours,
    (select coalesce(sum(jsonb_array_length(submissions)),0)::int from lub.task_participants) submissions`;
  const [legacy] = await tx`select
    (select count(*)::int from lub_before_simplification.users) accounts,
    (select count(*)::int from lub_before_simplification.organizations) organizations,
    (select count(*)::int from lub_before_simplification.events) events,
    (select count(*)::int from lub_before_simplification.committees) committees,
    (select count(*)::int from lub_before_simplification.tasks) tasks,
    (select count(*)::int from lub_before_simplification.event_registrations) registrations,
    (select count(*)::int from lub_before_simplification.task_participants) participants,
    (select count(*)::int from lub_before_simplification.membership_applications) applications,
    (select count(*)::int from lub_before_simplification.membership_renewals) renewals,
    (select count(*)::int from lub_before_simplification.application_assets) assets,
    (select count(*)::int from lub_before_simplification.hour_records) hours,
    (select count(*)::int from lub_before_simplification.task_submissions) submissions`;
  assert.deepEqual({ ...counts }, { ...legacy }, "Retained row counts must match the source");
  const [checks] = await tx`select
    (select count(*)::int from pg_tables where schemaname='lub' and rowsecurity) secured,
    not has_schema_privilege('anon',${archive},'USAGE') and not has_schema_privilege('authenticated',${archive},'USAGE')
      and not has_schema_privilege('lub_runtime',${archive},'USAGE') as archive_private,
    not exists(select 1 from pg_policy p join pg_depend d on d.classid='pg_policy'::regclass and d.objid=p.oid
      left join pg_proc f on d.refclassid='pg_proc'::regclass and d.refobjid=f.oid
      left join pg_class t on d.refclassid='pg_class'::regclass and d.refobjid=t.oid
      where p.polrelid='storage.objects'::regclass and coalesce(f.pronamespace,t.relnamespace)=${archive}::regnamespace) as policies_updated`;
  assert.deepEqual({ ...checks }, { secured: 18, archive_private: true, policies_updated: true });
  return counts;
}

async function cutover() {
  const mode = process.argv[2];
  if (mode !== "up" && mode !== "down" && mode !== "finalize") throw new Error("Expected up, down, or finalize.");
  const destination = process.env.LUB_BASELINE_DIRECTORY;
  if (!destination) throw new Error("Private baseline directory required.");
  const directory = requireOutsideRepository(destination, process.cwd());
  const oldStorage = readFileSync(join(directory, storageBackup));
  assert.equal(hash(oldStorage), "98b8901f014b65b61bcfe435a74dfdff49f15b2ec4333676daef1899b112f575", "Storage rollback snapshot mismatch");
  assert.equal(hash(readFileSync(join(directory, localBackup))), "17bf6bc816ddab2a14a1c7e4b27e648eb435594b03cba71a9e22215b2f28d8b4", "Application data rollback snapshot mismatch");
  const storageNames = [...oldStorage.toString("utf8").matchAll(/^create policy (\w+) on storage\.objects/gm)].map(match => match[1]).sort();

  const liveFile = process.env.LUB_RELEASE_ENV_FILE;
  let url: URL, ssl: false | { rejectUnauthorized: true; ca: string };
  if (liveFile) {
    assert.equal(process.env.LUB_EXECUTE_RELEASE, "lub.community");
    const env = parseEnv(readFileSync(requireOutsideRepository(liveFile, process.cwd()), "utf8"));
    const supabase = new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    url = new URL(env.DATABASE_URL ?? "");
    const ref = supabase.hostname.match(/^([a-z]{20})\.supabase\.co$/)?.[1];
    assert.ok(ref && (url.hostname === `db.${ref}.supabase.co` ||
      (/\.pooler\.supabase\.com$/.test(url.hostname) && url.username.endsWith(`.${ref}`))), "Supabase target mismatch");
    if (mode !== "down") {
      assert.equal(git("status", "--porcelain"), "", "Release worktree must be clean");
      const remoteMain = git("ls-remote", "--exit-code", "origin", "refs/heads/main").split(/\s/)[0];
      assert.equal(git("rev-parse", "HEAD"), remoteMain, "Publish the exact source to main first");
    }
    ssl = { rejectUnauthorized: true, ca: [...rootCertificates, readFileSync("config/supabase-prod-ca-2021.crt", "utf8")].join("\n") };
  } else {
    const config = JSON.parse(readFileSync(join(directory, "sandbox.json"), "utf8"));
    url = requireSandboxUrl(config.databaseUrl);
    const label = execFileSync("docker", ["inspect", "--format", '{{index .Config.Labels "lub.schema-baseline"}}', SANDBOX.container], { encoding: "utf8", windowsHide: true }).trim();
    assert.equal(label, BASELINE_COMMIT);
    ssl = false;
  }

  const db = postgres(url.toString(), { max: 1, prepare: false, ssl, connect_timeout: 10, onnotice: () => {} });
  try {
    const result = await db.begin(async tx => {
      await tx.unsafe("set local lock_timeout='8s'; set local statement_timeout='60s'");
      await tx`select pg_advisory_xact_lock(hashtext('lub-schema18-cutover'))`;
      const current = await tableCount(tx, "lub"), archived = await tableCount(tx, archive);
      if (mode === "up") {
        assert.equal(current, 62);
        assert.equal(archived, 0);
        assert.deepEqual(await policyNames(tx), storageNames, "Live Storage policies must match the rollback snapshot");
        await lockTables(tx, "lub");
        await dropPolicies(tx);
        await tx.unsafe("alter schema lub rename to lub_before_simplification");
        await tx.unsafe("revoke all on schema lub_before_simplification from public,anon,authenticated,lub_runtime,service_role");
        await tx.unsafe("create schema lub_before_simplification_rpc");
        await moveWrappers(tx, "public", archiveRpc);
        for (const file of [...contractFiles, "preserve-accounts18.sql", "preserve-content18.sql"]) {
          await tx.unsafe(readFileSync(`scripts/schema-simplification/${file}`, "utf8"));
        }
        const counts = await assertPreserved(tx);
        await tx.unsafe("notify pgrst, 'reload schema'");
        return { mode, tables: await tableCount(tx, "lub"), counts, rollbackReady: true };
      }
      assert.equal(current, 18);
      assert.equal(archived, 62);
      if (mode === "down") {
        await lockTables(tx, "lub");
        await dropPolicies(tx);
        const wrappers = await tx<{ ddl: string }[]>`select format('drop function %I.%I(%s)',
          n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)) as ddl
          from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosrc ~ 'lub[.]'`;
        for (const row of wrappers) await tx.unsafe(row.ddl);
        await tx.unsafe("drop schema lub cascade; alter schema lub_before_simplification rename to lub");
        await tx.unsafe("grant usage on schema lub to anon,authenticated,lub_runtime");
        await moveWrappers(tx, archiveRpc, "public");
        await tx.unsafe("drop schema lub_before_simplification_rpc");
        await tx.unsafe(oldStorage.toString("utf8"));
        assert.deepEqual(await policyNames(tx), storageNames);
      } else {
        assert.equal(process.env.LUB_VERIFY_RELEASE, "yes", "Verify the application before deleting the legacy schema.");
        await tx.unsafe("drop schema lub_before_simplification_rpc cascade; drop schema lub_before_simplification cascade");
      }
      await tx.unsafe("notify pgrst, 'reload schema'");
      return { mode, tables: await tableCount(tx, "lub"), archiveTables: await tableCount(tx, archive) };
    });
    console.log(JSON.stringify(result));
  } finally { await db.end(); }
}

cutover().catch(error => {
  const safe = error?.code === "ERR_ASSERTION" || (error?.code === "P0001" && !process.env.LUB_RELEASE_ENV_FILE)
    ? String(error.message).split("\n")[0] : error?.code ?? error?.name;
  console.error("Cutover transaction failed and was rolled back.", safe, error?.constraint_name ?? "", error?.position ?? "");
  process.exitCode = 1;
});
