import type { PGlite } from "@electric-sql/pglite";
// Isolated test model of the Supabase Storage tables used by our policies.
export async function storageFixture(db: PGlite) {
  await db.exec(`create schema storage;
    create table storage.buckets(id text primary key,name text not null,public boolean default false,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,owner_id text,unique(bucket_id,name));
    alter table storage.objects enable row level security;
    grant usage on schema storage to authenticated; grant select,insert,delete on storage.objects to authenticated;`);
}
