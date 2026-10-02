import { existsSync } from "node:fs";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { databaseTLS } from "../src/db/tls";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const url = process.env.DATABASE_URL;
if (!url) { console.error("Set DATABASE_URL before running migrations."); process.exit(1); }
const client = postgres(url, { max: 1, prepare: false, connect_timeout: 10, ssl: databaseTLS(url), onnotice: () => {} });
try {
  await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  console.log("LUB migrations applied.");
} catch {
  console.error("Migration failed. Check database access and Supabase prerequisites; no connection details were logged.");
  process.exitCode = 1;
} finally { await client.end(); }
