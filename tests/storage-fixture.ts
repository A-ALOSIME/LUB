import type { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
// Isolated test model of the Supabase Storage tables used by our policies.
export async function storageFixture(db: PGlite) {
  await db.exec(`create schema storage;
    create function storage.allow_any_operation(expected_operations text[]) returns boolean language sql stable as $$
      select exists(select 1 from unnest(expected_operations) op where regexp_replace(current_setting('storage.operation',true),'^storage[.]','')=regexp_replace(op,'^storage[.]',''));
    $$;
    create table storage.buckets(id text primary key,name text not null,public boolean default false,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,owner_id text,updated_at timestamptz not null default now(),unique(bucket_id,name));
    alter table storage.objects enable row level security;
    grant usage on schema storage to authenticated; grant select,insert,delete on storage.objects to authenticated;`);
}

// Supabase Storage buckets are removed through its dashboard/API rather than SQL.
// Mirror the already-confirmed production deletion before applying migration 0038.
export async function applyMigrations(db: PGlite) {
  for (const file of readdirSync("drizzle").filter(name => name.endsWith(".sql")).sort()) {
    if (file === "0038_direct_hours_export.sql") {
      await db.exec("delete from storage.objects where bucket_id='lub-generated-documents'; delete from storage.buckets where id='lub-generated-documents'");
    }
    await db.exec(readFileSync(`drizzle/${file}`, "utf8"));
  }
}
