import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { rootCertificates } from "node:tls";
import { parseEnv } from "node:util";
import postgres from "postgres";
import { BASELINE_COMMIT, requireOutsideRepository } from "./guards";

// Read-only capture. No password/session/token or secret value is exported.
async function capture() {
  const source = process.env.LUB_BASELINE_ENV_FILE, destination = process.env.LUB_BASELINE_DIRECTORY;
  if (!source || !destination) throw new Error("Explicit baseline environment and private destination are required.");
  const directory = requireOutsideRepository(destination, process.cwd());
  const accountsPath = join(directory, "accounts.json"), archivePath = join(directory, "schema-before.dump");
  if (existsSync(accountsPath) || existsSync(archivePath)) throw new Error("Baseline files already exist.");
  const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", windowsHide: true }).trim();
  if (head !== BASELINE_COMMIT) throw new Error("Capture must run against the pinned baseline commit.");
  mkdirSync(directory, { recursive: true });
  if (process.platform === "win32") {
    const owner = execFileSync("whoami", [], { encoding: "utf8", windowsHide: true }).trim();
    execFileSync("icacls", [directory, "/inheritance:r", "/grant:r", `${owner}:(OI)(CI)F`, "SYSTEM:(OI)(CI)F"], { stdio: "ignore", windowsHide: true });
  }
  const settings = parseEnv(readFileSync(resolve(source), "utf8"));
  const url = new URL(settings.DATABASE_URL ?? "");
  if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error("PostgreSQL source required.");
  const ca = [...rootCertificates, readFileSync("config/supabase-prod-ca-2021.crt", "utf8")].join("\n");
  const db = postgres(url.toString(), { max: 1, prepare: false, connect_timeout: 10, ssl: { rejectUnauthorized: true, ca }, onnotice: () => {} });
  try {
    const captured = await db.begin("read only", async tx => {
      await tx`set local statement_timeout='20s'`;
      return {
        users: await tx`select * from lub.users order by id`,
        profiles: await tx`select * from lub.student_profiles order by user_id`,
        settings: await tx`select * from lub.profile_settings order by user_id`,
        globalRoles: await tx`select * from lub.global_role_assignments order by id`,
        tables: await tx<{ name: string }[]>`select tablename as name from pg_tables where schemaname='lub' order by tablename`,
      };
    });
    writeFileSync(accountsPath, JSON.stringify({ baseline: head, ...captured }, null, 2), { encoding: "utf8", mode: 0o600 });
    writeFileSync(join(directory, "database-ca.pem"), ca, { mode: 0o600 });
    const env = { ...process.env, PGHOST: url.hostname, PGPORT: url.port || "5432", PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), PGDATABASE: url.pathname.slice(1), PGSSLMODE: "verify-full", PGSSLROOTCERT: "/backup/database-ca.pem" };
    const variables = ["PGHOST", "PGPORT", "PGUSER", "PGPASSWORD", "PGDATABASE", "PGSSLMODE", "PGSSLROOTCERT"].flatMap(name => ["--env", name]);
    execFileSync("docker", ["run", "--rm", "--mount", `type=bind,source=${directory},target=/backup`, ...variables, "postgres:17", "pg_dump", "--schema-only", "--format=custom", "--schema=lub", "--schema=public", "--schema=extensions", "--file=/backup/schema-before.dump"], { env, stdio: "pipe", timeout: 180000, windowsHide: true });
    const listing = execFileSync("docker", ["run", "--rm", "--mount", `type=bind,source=${directory},target=/backup,readonly`, "postgres:17", "pg_restore", "--list", "/backup/schema-before.dump"], { encoding: "utf8", windowsHide: true });
    const result = { baseline: head, schemaBytes: statSync(archivePath).size, schemaSha256: createHash("sha256").update(readFileSync(archivePath)).digest("hex"), archiveEntries: listing.split("\n").filter(line => line && !line.startsWith(";")).length, accountCount: captured.users.length, profileCount: captured.profiles.length, applicationTables: captured.tables.length };
    writeFileSync(join(directory, "verification.json"), JSON.stringify(result, null, 2), { mode: 0o600 });
    console.log(JSON.stringify(result));
  } finally { await db.end(); }
}
capture().catch(() => { console.error("Baseline capture failed; private files were not logged. Inspect the isolated capture before retrying."); process.exitCode = 1; });
