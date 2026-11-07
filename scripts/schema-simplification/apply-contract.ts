import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";
import { BASELINE_COMMIT, requireOutsideRepository, requireSandboxUrl, SANDBOX } from "./guards";

const contractFiles = ["schema18.sql", "account18.sql", "administration18.sql", "opening18.sql", "forms18.sql", "form-library18.sql", "campaigns18.sql", "renewals18.sql", "campaign-reads18.sql", "application-reads18.sql", "hours18.sql", "tasks18.sql", "assets18.sql", "announcements18.sql", "notifications18.sql", "events18.sql", "event-registration18.sql", "skill-catalog18.sql", "skills18.sql", "event-reads18.sql", "task-reads18.sql", "organization-public18.sql", "organization-editor18.sql", "members18.sql", "own-workspace18.sql", "talent18.sql", "exports18.sql"];
const rollbackRehearsal = new Error("Roll back the completed account migration rehearsal.");

async function seedLegacyAccounts(tx: postgres.TransactionSql) {
  const administrator = randomUUID(), student = randomUUID(), incomplete = randomUUID(), publicSlug = randomUUID();
  for (const user of [administrator, student, incomplete]) {
    await tx`insert into auth.users(id) values (${user})`;
    await tx`insert into lub.users(id,email,email_verified_at) values (${user},${`cutover-${user}@example.invalid`},now())`;
  }
  await tx`insert into lub.student_profiles(user_id,full_name_ar,university_id_ciphertext,university_id_lookup_hash,major_name,academic_level,bio)
    values (${student},'طالب الاختبار','synthetic-university',repeat('a',64),'نظم معلومات','graduate','نبذة اختبار')`;
  await tx`insert into lub.private_student_identifiers(user_id,national_id_ciphertext,national_id_lookup_hash)
    values (${student},'synthetic-national-envelope',repeat('b',64))`;
  await tx`insert into lub.profile_settings(user_id,public_slug,public_profile_enabled,allow_indexing)
    values (${student},${publicSlug},true,false)
    on conflict (user_id) do update set public_slug=excluded.public_slug,public_profile_enabled=true,allow_indexing=false`;
  await tx`insert into lub.global_role_assignments(user_id,role_code,assigned_by_user_id) values (${administrator},'SA',${administrator})`;
  return { administrator, student, incomplete, publicSlug };
}

async function apply() {
  if (process.env.LUB_REPLACE_SANDBOX_SCHEMA !== "yes") throw new Error("Explicit owned-sandbox replacement flag required.");
  const destination = process.env.LUB_BASELINE_DIRECTORY;
  if (!destination) throw new Error("Private baseline directory required.");
  const directory = requireOutsideRepository(destination, process.cwd());
  const config: { baseline: string; databaseUrl: string } = JSON.parse(readFileSync(join(directory, "sandbox.json"), "utf8"));
  const recovery: { baseline: string; tables: number } = JSON.parse(readFileSync(join(directory, "recovery-verification.json"), "utf8"));
  const rehearseAccounts = process.env.LUB_REHEARSE_ACCOUNT_CUTOVER === "yes";
  const url = requireSandboxUrl(config.databaseUrl);
  const label = execFileSync("docker", ["inspect", "--format", '{{index .Config.Labels "lub.schema-baseline"}}', SANDBOX.container], { encoding: "utf8", windowsHide: true }).trim();
  if ([label, config.baseline, recovery.baseline].some(value => value !== BASELINE_COMMIT) || recovery.tables !== 62) throw new Error("Sandbox ownership or recovery verification mismatch.");
  const db = postgres(url.toString(), { max: 1, ssl: false, onnotice: () => {} });
  try {
    await db.begin(async tx => {
      const [target] = await tx<{ name: string }[]>`select current_database() as name`;
      if (target.name !== SANDBOX.database) throw new Error("Wrong target database.");
      let fixture: Awaited<ReturnType<typeof seedLegacyAccounts>> | undefined;
      if (rehearseAccounts) {
        const [baseline] = await tx<{ tables: number; archiveExists: boolean }[]>`select
          (select count(*)::int from pg_tables where schemaname='lub') as tables,
          to_regnamespace('lub_before_simplification') is not null as "archiveExists"`;
        if (baseline.tables !== 62 || baseline.archiveExists) throw new Error("Restore the pinned legacy baseline first.");
        fixture = await seedLegacyAccounts(tx);
        await tx.unsafe("alter schema lub rename to lub_before_simplification");
      }
      const wrappers = await tx<{ statement: string }[]>`select format('drop function if exists %I.%I(%s) cascade',n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)) as statement from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosrc ~ 'lub[.]'`;
      for (const row of wrappers) await tx.unsafe(row.statement);
      // Deliberately destructive only inside the owned local database validated above.
      await tx.unsafe("drop schema if exists lub cascade");
      for (const file of contractFiles) {
        await tx.unsafe(readFileSync(`scripts/schema-simplification/${file}`, "utf8"));
      }
      const [count] = await tx<{ tables: number }[]>`select count(*)::int as tables from pg_tables where schemaname='lub'`;
      if (count.tables !== 18) throw new Error("18-table contract failed.");
      if (fixture) {
        await tx.unsafe(readFileSync("scripts/schema-simplification/preserve-accounts18.sql", "utf8"));
        const [proof] = await tx`select u.public_slug,u.allow_indexing,u.full_name_ar,u.academic_level,u.university_id_ciphertext,i.national_id_ciphertext,
          lub.is_super_admin(${fixture.administrator}) as administrator,
          (select onboarded_at is null from lub.users where id=${fixture.incomplete}) as incomplete
          from lub.users u join lub.private_student_identifiers i on i.user_id=u.id where u.id=${fixture.student}`;
        assert.deepEqual({ ...proof }, {
          public_slug: fixture.publicSlug, allow_indexing: false, full_name_ar: "طالب الاختبار", academic_level: "graduate",
          university_id_ciphertext: "synthetic-university", national_id_ciphertext: "synthetic-national-envelope", administrator: true, incomplete: true,
        });
        throw rollbackRehearsal;
      }
    }).catch(error => {
      if (error !== rollbackRehearsal) throw error;
    });
    if (rehearseAccounts) {
      const [proof] = await db<{ restoredTables: number; archiveExists: boolean }[]>`select
        (select count(*)::int from pg_tables where schemaname='lub') as "restoredTables",
        to_regnamespace('lub_before_simplification') is not null as "archiveExists"`;
      assert.deepEqual({ ...proof }, { restoredTables: 62, archiveExists: false });
      console.log(JSON.stringify({ migratedTables: 18, accountsChecked: 3, restoredTables: 62, committed: false, localOnly: true }));
      return;
    }
    const [result] = await db<{ tables: number; secured: number; views: number }[]>`select
      (select count(*)::int from pg_tables where schemaname='lub') as tables,
      (select count(*)::int from pg_tables where schemaname='lub' and rowsecurity) as secured,
      (select count(*)::int from pg_views where schemaname='lub') as views`;
    const sourceHashes = Object.fromEntries(contractFiles.map(file => [file, createHash("sha256").update(readFileSync(`scripts/schema-simplification/${file}`)).digest("hex")]));
    writeFileSync(join(directory, "schema18-verification.json"), JSON.stringify({ ...result, sourceHashes, baseline: BASELINE_COMMIT, scope: "account and administrative slices; remaining application repositories not yet ported" }, null, 2), { mode: 0o600 });
    console.log(JSON.stringify({ ...result, localOnly: true, applicationReady: false }));
  } finally { await db.end(); }
}
apply().catch(error => {
  console.error("Sandbox contract application failed; transaction rolled back and live service was not targeted.", error?.code ?? error?.name, error?.constraint_name ?? "");
  process.exitCode = 1;
});
