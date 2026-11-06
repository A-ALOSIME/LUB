import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";
import { BASELINE_COMMIT, requireOutsideRepository, requireSandboxUrl, SANDBOX } from "./guards";

async function apply() {
  if (process.env.LUB_REPLACE_SANDBOX_SCHEMA !== "yes") throw new Error("Explicit owned-sandbox replacement flag required.");
  const destination = process.env.LUB_BASELINE_DIRECTORY;
  if (!destination) throw new Error("Private baseline directory required.");
  const directory = requireOutsideRepository(destination, process.cwd());
  const config: { baseline: string; databaseUrl: string } = JSON.parse(readFileSync(join(directory, "sandbox.json"), "utf8"));
  const recovery: { baseline: string; tables: number } = JSON.parse(readFileSync(join(directory, "recovery-verification.json"), "utf8"));
  const url = requireSandboxUrl(config.databaseUrl);
  const label = execFileSync("docker", ["inspect", "--format", '{{index .Config.Labels "lub.schema-baseline"}}', SANDBOX.container], { encoding: "utf8", windowsHide: true }).trim();
  if ([label, config.baseline, recovery.baseline].some(value => value !== BASELINE_COMMIT) || recovery.tables !== 62) throw new Error("Sandbox ownership or recovery verification mismatch.");
  const db = postgres(url.toString(), { max: 1, ssl: false, onnotice: () => {} });
  try {
    await db.begin(async tx => {
      const [target] = await tx<{ name: string }[]>`select current_database() as name`;
      if (target.name !== SANDBOX.database) throw new Error("Wrong target database.");
      const wrappers = await tx<{ statement: string }[]>`select format('drop function if exists %I.%I(%s) cascade',n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)) as statement from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosrc ~ 'lub[.]'`;
      for (const row of wrappers) await tx.unsafe(row.statement);
      // Deliberately destructive only inside the owned local database validated above.
      await tx.unsafe("drop schema if exists lub cascade");
      await tx.unsafe(readFileSync("scripts/schema-simplification/schema18.sql", "utf8"));
      await tx.unsafe(readFileSync("scripts/schema-simplification/account18.sql", "utf8"));
      const [count] = await tx<{ tables: number }[]>`select count(*)::int as tables from pg_tables where schemaname='lub'`;
      if (count.tables !== 18) throw new Error("18-table contract failed.");
    });
    const [result] = await db<{ tables: number; secured: number; views: number }[]>`select
      (select count(*)::int from pg_tables where schemaname='lub') as tables,
      (select count(*)::int from pg_tables where schemaname='lub' and rowsecurity) as secured,
      (select count(*)::int from pg_views where schemaname='lub') as views`;
    const schemaSha256 = createHash("sha256").update(readFileSync("scripts/schema-simplification/schema18.sql")).digest("hex");
    writeFileSync(join(directory, "schema18-verification.json"), JSON.stringify({ ...result, schemaSha256, baseline: BASELINE_COMMIT, scope: "database contract only; application repositories not yet ported" }, null, 2), { mode: 0o600 });
    console.log(JSON.stringify({ ...result, localOnly: true, applicationReady: false }));
  } finally { await db.end(); }
}
apply().catch(() => { console.error("Sandbox contract application failed; transaction rolled back and live service was not targeted."); process.exitCode = 1; });
