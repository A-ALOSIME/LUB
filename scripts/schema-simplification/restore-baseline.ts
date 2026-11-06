import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";
import { BASELINE_COMMIT, requireOutsideRepository, requireSandboxUrl, SANDBOX } from "./guards";

async function restore() {
  const destination = process.env.LUB_BASELINE_DIRECTORY;
  if (!destination) throw new Error("Private baseline directory required.");
  const directory = requireOutsideRepository(destination, process.cwd());
  const verification: { baseline: string; schemaSha256: string; applicationTables: number } = JSON.parse(readFileSync(join(directory, "verification.json"), "utf8"));
  const config: { baseline: string; databaseUrl: string } = JSON.parse(readFileSync(join(directory, "sandbox.json"), "utf8"));
  const url = requireSandboxUrl(config.databaseUrl);
  if (config.baseline !== BASELINE_COMMIT || verification.baseline !== BASELINE_COMMIT || createHash("sha256").update(readFileSync(join(directory, "schema-before.dump"))).digest("hex") !== verification.schemaSha256) throw new Error("Baseline integrity mismatch.");
  const label = execFileSync("docker", ["inspect", "--format", '{{index .Config.Labels "lub.schema-baseline"}}', SANDBOX.container], { encoding: "utf8", windowsHide: true }).trim();
  if (label !== BASELINE_COMMIT) throw new Error("Container ownership mismatch.");
  const db = postgres(url.toString(), { max: 1, ssl: false, onnotice: () => {} });
  try {
    const [existing] = await db<{ count: number }[]>`select count(*)::int as count from pg_tables where schemaname='lub'`;
    if (existing.count) {
      if (process.env.LUB_REPLACE_SANDBOX_SCHEMA !== "yes") throw new Error("Recovery requires an empty schema or explicit owned-sandbox replacement flag.");
      await db.begin(async tx => {
        const wrappers = await tx<{ statement: string }[]>`select format('drop function if exists %I.%I(%s) cascade',n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)) as statement from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosrc ~ 'lub[.]'`;
        for (const row of wrappers) await tx.unsafe(row.statement);
        await tx.unsafe("drop schema lub cascade");
      });
    }
    // Database-test scaffold only. It does not establish a browser session or replace Supabase token verification.
    await db.unsafe(`do $$begin
      if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
      if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
      if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
      if not exists(select 1 from pg_roles where rolname='dashboard_user') then create role dashboard_user nologin; end if;
      if not exists(select 1 from pg_roles where rolname='supabase_admin') then create role supabase_admin nologin; end if;
      if not exists(select 1 from pg_roles where rolname='lub_runtime') then create role lub_runtime nologin; end if;
      end$$;
      grant anon,authenticated to lub_runtime;
      create schema if not exists extensions;
      create schema if not exists auth; create table if not exists auth.users(id uuid primary key);
      create or replace function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to anon,authenticated,service_role;
      grant execute on function auth.uid() to anon,authenticated,service_role;
      create schema if not exists storage;
      create table if not exists storage.buckets(id text primary key,name text,public boolean default false,file_size_limit bigint,allowed_mime_types text[]);
      create table if not exists storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner_id text,updated_at timestamptz default now());
      create or replace function storage.allow_any_operation(expected_operations text[]) returns boolean language sql stable as $$
        select exists(select 1 from unnest(expected_operations) op where regexp_replace(current_setting('storage.operation',true),'^storage[.]','')=regexp_replace(op,'^storage[.]',''));
      $$;`);
    const listing = execFileSync("docker", ["run", "--rm", "--mount", `type=bind,source=${directory},target=/backup,readonly`, "postgres:17", "pg_restore", "--list", "/backup/schema-before.dump"], { encoding: "utf8", windowsHide: true });
    // These platform schemas exist already; clean only objects selected from the pinned archive.
    const listPath = join(directory, "restore.list");
    writeFileSync(listPath, listing.split("\n").filter(line => !/^\d+;\s+\d+\s+\d+\s+SCHEMA - (public|extensions)\s/.test(line)).join("\n"), { mode: 0o600 });
    execFileSync("docker", ["cp", join(directory, "schema-before.dump"), `${SANDBOX.container}:/tmp/schema-before.dump`], { stdio: "pipe", windowsHide: true });
    execFileSync("docker", ["cp", listPath, `${SANDBOX.container}:/tmp/restore.list`], { stdio: "pipe", windowsHide: true });
    execFileSync("docker", ["exec", SANDBOX.container, "pg_restore", "--clean", "--if-exists", "--exit-on-error", "--single-transaction", "--no-owner", "--username=postgres", `--dbname=${SANDBOX.database}`, "--use-list=/tmp/restore.list", "/tmp/schema-before.dump"], { stdio: "pipe", windowsHide: true });
    const [result] = await db<{ tables: number; functions: number; policies: number }[]>`select
      (select count(*)::int from pg_tables where schemaname='lub') as tables,
      (select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='lub') as functions,
      (select count(*)::int from pg_policies where schemaname='lub') as policies`;
    if (result.tables !== verification.applicationTables) throw new Error("Restored table count mismatch.");
    writeFileSync(join(directory, "recovery-verification.json"), JSON.stringify({ baseline: BASELINE_COMMIT, ...result, scope: "isolated database structure; not live auth/storage service verification" }, null, 2), { mode: 0o600 });
    console.log(JSON.stringify({ recovered: true, ...result, localOnly: true }));
  } finally { await db.end(); }
}
restore().catch(error => {
  const directory = process.env.LUB_BASELINE_DIRECTORY;
  if (directory) writeFileSync(join(requireOutsideRepository(directory, process.cwd()), "recovery-error.log"), String(error?.stderr ?? error?.message ?? "Unknown recovery error"), { mode: 0o600 });
  console.error("Isolated recovery failed; private diagnostics saved outside Git. No live database was modified."); process.exitCode = 1;
});
