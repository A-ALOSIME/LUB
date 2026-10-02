import { existsSync, readFileSync } from "node:fs";
import postgres from "postgres";
import { databaseTLS } from "../src/db/tls";
import { parseOrganizationSource } from "./organization-source";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
if (!process.env.DATABASE_URL) {
  console.error("Configure DATABASE_URL before importing organizations.");
  process.exit(1);
}

const apply = process.argv.includes("--apply");
const source = parseOrganizationSource(readFileSync("الاندية والمجالس.md", "utf8"));
const client = postgres(process.env.DATABASE_URL, {
  max: 1, prepare: false, connect_timeout: 10,
  ssl: databaseTLS(process.env.DATABASE_URL), onnotice: () => {},
});

try {
  const result = await client.begin(async tx => {
    await tx`select pg_advisory_xact_lock(727028)`;
    const admins = await tx`select distinct u.id from lub.users u
      join lub.student_profiles p on p.user_id=u.id
      join auth.users a on a.id=u.id
      join lub.global_role_assignments r on r.user_id=u.id
      where u.status_code='Active' and a.email_confirmed_at is not null
        and lower(a.email)=lower(u.email) and r.role_code='SA'
        and r.start_at<=now() and (r.end_at is null or r.end_at>now())`;
    if (admins.length !== 1) throw new Error("Expected exactly one verified, onboarded Super Admin.");

    const existing = await tx`select slug,name_ar,type_code,summary,mission,status_code from lub.organizations`;
    const missing = source.filter(row => {
      const found = existing.find(org => org.slug === row.slug || org.name_ar === row.nameAr);
      if (!found) return true;
      if (found.slug !== row.slug || found.name_ar !== row.nameAr || found.type_code !== row.typeCode ||
          found.summary !== row.summary || found.mission !== row.mission || found.status_code !== "Active") {
        throw new Error(`Existing organization differs: ${row.nameAr}`);
      }
      return false;
    });

    if (apply && missing.length) {
      await tx`select set_config('request.jwt.claim.sub', ${admins[0].id}, true), set_config('role', 'authenticated', true)`;
      const [access] = await tx`select lub.is_super_admin() as allowed`;
      if (!access.allowed) throw new Error("Super Admin access was not confirmed.");
      for (const row of missing) {
        await tx`insert into lub.organizations (name_ar,slug,type_code,summary,mission)
          values (${row.nameAr},${row.slug},${row.typeCode},${row.summary},${row.mission})`;
      }
    }
    return { missing: missing.map(row => `${row.nameAr} → ${row.slug}`), existing: source.length - missing.length };
  });
  console.log(`${apply ? "Imported" : "Would import"}: ${result.missing.length}; already identical: ${result.existing}.`);
  for (const row of result.missing) console.log(row);
} catch (error) {
  const message = error instanceof Error ? error.message : "";
  console.error(message.startsWith("Existing organization differs:") || message.startsWith("Expected exactly one") ||
    message.startsWith("Super Admin access") ? message : "Organization import failed; no connection details were logged.");
  process.exitCode = 1;
} finally {
  await client.end();
}
