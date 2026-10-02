import { existsSync } from "node:fs";
import postgres from "postgres";
import { z } from "zod";
import { databaseTLS } from "../src/db/tls";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const email = z.email().safeParse(process.argv[process.argv.indexOf("--email") + 1]?.trim().toLowerCase());
if (!process.argv.includes("--email") || !email.success || !process.env.DATABASE_URL) {
  console.error("Supply --email for the explicitly selected verified account and configure DATABASE_URL.");
  process.exit(1);
}
const client = postgres(process.env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 10, ssl: databaseTLS(process.env.DATABASE_URL), onnotice: () => {} });
try {
  const initialized = await client.begin(async tx => {
    await tx`select pg_advisory_xact_lock(727026)`;
    const [candidate] = await tx`select u.id from lub.users u join lub.student_profiles p on p.user_id=u.id join auth.users a on a.id=u.id
      where u.email=${email.data} and u.status_code='Active' and a.email_confirmed_at is not null and lower(a.email)=${email.data}`;
    if (!candidate) throw new Error("ACCOUNT_NOT_READY");
    const roster = await tx`select user_id,end_at,start_at from lub.global_role_assignments`;
    if (roster.length) {
      if (roster.some(row => row.user_id === candidate.id && new Date(row.start_at) <= new Date() && (!row.end_at || new Date(row.end_at) > new Date()))) {
        return false;
      }
      throw new Error("ROSTER_ALREADY_INITIALIZED");
    }
    await tx`select set_config('request.jwt.claim.sub',${candidate.id},true)`;
    await tx`insert into lub.global_role_assignments(user_id,role_code,assigned_by_user_id) values(${candidate.id},'SA',${candidate.id})`;
    return true;
  });
  console.log(initialized ? "First Super Admin initialized with an audit entry." : "Selected account already has Super Admin.");
} catch (error) {
  if (error instanceof Error && error.message === "ACCOUNT_NOT_READY") console.error("Selected account must verify its email and complete LUB onboarding first. No role was granted.");
  else if (error instanceof Error && error.message === "ROSTER_ALREADY_INITIALIZED") console.error("The Super Admin roster is already initialized. Use the authorized management screen instead.");
  else console.error("Admin initialization failed; no connection details were logged.");
  process.exitCode = 1;
} finally { await client.end(); }
