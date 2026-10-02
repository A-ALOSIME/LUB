import { existsSync, readFileSync } from "node:fs";
import postgres from "postgres";
import { databaseTLS } from "../src/db/tls";
import { launchConfiguration } from "../src/lib/launch";
import { migrationHashMatches } from "../src/lib/migration-hash";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const mode = process.argv.includes("--local") ? "local" : "production";
const checks = launchConfiguration(process.env, mode === "local");
// Keep privileged catalog and migration reads on the operator connection, outside Worker bindings.
const auditUrl = process.env.DATABASE_AUDIT_URL ?? process.env.DATABASE_URL;
const auditDatabaseUrl = launchConfiguration({ ...process.env, DATABASE_URL: auditUrl }, mode === "local").databaseUrl;
let databaseVerified = false;
let migrationsMatch = false;
let runtimeRoleLimited = false;
let migrationMismatches: string[] = [];
let migrationCounts = { local: 0, remote: 0 };
let audit: ReturnType<typeof postgres> | undefined;

try {
  if (checks.databaseUrl && auditDatabaseUrl && auditUrl) {
    audit = postgres(auditUrl, { max: 1, prepare: false, connect_timeout: 10, ssl: databaseTLS(auditUrl), onnotice: () => {} });

    const [security] = await audit`select (select count(*) from pg_tables where schemaname='lub')=(select count(*) from pg_tables where schemaname='lub' and rowsecurity) as rls,not has_table_privilege('anon','lub.users','SELECT') and not has_table_privilege('anon','lub.profile_links','SELECT') as private_tables,has_table_privilege('anon','lub.announcements','SELECT') and not has_table_privilege('anon','lub.announcements','INSERT') and not has_table_privilege('anon','lub.announcements','UPDATE') and not has_function_privilege('anon','lub.set_featured_event(uuid,boolean)','EXECUTE') and not has_function_privilege('anon','lub.set_event_public_content(uuid,text,text[])','EXECUTE') as public_content_access`;
    databaseVerified = Boolean(security.rls && security.private_tables && security.public_content_access);

    const [role] = await audit`select rolcanlogin and not rolsuper and not rolbypassrls and not rolcreaterole and not rolcreatedb and not rolreplication and not rolinherit as limited,pg_has_role('lub_runtime','anon','MEMBER') as can_anon,pg_has_role('lub_runtime','authenticated','MEMBER') as can_authenticated from pg_roles where rolname='lub_runtime'`;
    runtimeRoleLimited = Boolean(role?.limited && role.can_anon && role.can_authenticated);

    const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")) as { entries: Array<{ tag: string; when: number }> };
    const applied = await audit`select hash,created_at from drizzle.__drizzle_migrations order by created_at`;
    migrationCounts = { local: journal.entries.length, remote: applied.length };
    migrationMismatches = journal.entries.flatMap((entry, index) =>
      typeof applied[index]?.hash === "string" && migrationHashMatches(readFileSync(`drizzle/${entry.tag}.sql`, "utf8"), applied[index].hash)
        ? []
        : [entry.tag],
    );
    migrationsMatch = journal.entries.length === applied.length && migrationMismatches.length === 0;
  }
} catch {
  databaseVerified = false;
  runtimeRoleLimited = false;
} finally {
  if (audit) await audit.end();
}

const prepared = Object.values(checks).every(Boolean) && auditDatabaseUrl && databaseVerified && migrationsMatch && runtimeRoleLimited;
console.log(JSON.stringify({ mode, checks, auditDatabaseUrl, databaseVerified, migrationsMatch, migrationCounts, migrationMismatches, runtimeRoleLimited, prepared, limitations: ["No host deployment, provider generation, Storage transfer or recovery drill is implied."] }));
if (!prepared) process.exitCode = 1;
