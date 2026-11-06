import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";
import { BASELINE_COMMIT, requireOutsideRepository, requireSandboxUrl, SANDBOX } from "./guards";

async function start() {
  const destination = process.env.LUB_BASELINE_DIRECTORY;
  if (!destination) throw new Error("Private baseline directory required.");
  const directory = requireOutsideRepository(destination, process.cwd()), configPath = join(directory, "sandbox.json");
  if (existsSync(configPath)) throw new Error("Sandbox configuration exists; inspect instead of replacing it.");
  if (!existsSync(join(directory, "verification.json"))) throw new Error("Verified baseline required before creating a sandbox.");
  const existing = execFileSync("docker", ["ps", "--all", "--filter", `name=^/${SANDBOX.container}$`, "--format", "{{.Names}}"], { encoding: "utf8", windowsHide: true }).trim();
  if (existing) throw new Error("Sandbox container name is already used.");
  const password = randomBytes(32).toString("hex"), url = `postgresql://postgres:${password}@127.0.0.1:${SANDBOX.port}/${SANDBOX.database}`;
  requireSandboxUrl(url);
  const env = { ...process.env, POSTGRES_PASSWORD: password, POSTGRES_DB: SANDBOX.database };
  execFileSync("docker", ["run", "--detach", "--name", SANDBOX.container, "--label", `lub.schema-baseline=${BASELINE_COMMIT}`, "--publish", `127.0.0.1:${SANDBOX.port}:5432`, "--env", "POSTGRES_PASSWORD", "--env", "POSTGRES_DB", "--volume", "lub-schema-simplification-pgdata:/var/lib/postgresql/data", "postgres:17"], { env, stdio: "pipe", windowsHide: true });
  writeFileSync(configPath, JSON.stringify({ baseline: BASELINE_COMMIT, container: SANDBOX.container, databaseUrl: url }, null, 2), { mode: 0o600 });
  const db = postgres(url, { max: 1, connect_timeout: 2, ssl: false, onnotice: () => {} });
  try {
    let ready = false;
    for (let attempt = 0; attempt < 25; attempt++) {
      try { await db`select 1`; ready = true; break; } catch { await new Promise(resolve => setTimeout(resolve, 500)); }
    }
    if (!ready) throw new Error("Sandbox did not become ready.");
    const [row] = await db<{ database: string }[]>`select current_database() as database`;
    if (row.database !== SANDBOX.database) throw new Error("Unexpected database.");
    console.log(JSON.stringify({ container: SANDBOX.container, port: SANDBOX.port, database: row.database, localOnly: true }));
  } finally { await db.end(); }
}
start().catch(() => { console.error("Sandbox setup failed; connection details were not logged. Inspect the owned sandbox before retrying."); process.exitCode = 1; });
