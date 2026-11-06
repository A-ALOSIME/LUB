import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { sql, type SQL } from "drizzle-orm";
import { readFileSync } from "node:fs";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { storageFixture } from "./storage-fixture";
const mocks = vi.hoisted(() => ({ user: vi.fn(), download: vi.fn(), signed: vi.fn() }));
type Executor = { execute: (query: SQL) => Promise<Record<string, unknown>[]> };
let db: PGlite, database: PgliteDatabase;
vi.mock("server-only", () => ({}));
vi.mock("@/features/auth/session", () => ({ getVerifiedUser: mocks.user }));
vi.mock("@/db/client", () => ({ withUser: async <T>(user: string, operation: (tx: Executor) => Promise<T>) => database.transaction(async tx => {
  await tx.execute(sql`select set_config('request.jwt.claim.sub',${user},true),set_config('role','authenticated',true)`);
  return operation({ execute: async query => (await tx.execute(query)).rows as Record<string, unknown>[] });
}) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ storage: { from: () => ({ download: mocks.download, createSignedUrl: mocks.signed }) } }) }));
vi.mock("@/lib/env", () => ({ getAuthConfig: () => ({ url: "https://project.supabase.co" }) }));
import { GET as download } from "@/app/files/[id]/route";
import { GET as preview } from "@/app/files/[id]/preview/route";
const id = (n: number) => `60000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const request = (n: number, thumbnail = false) => new Request(`https://lub.community/files/${id(n)}${thumbnail ? "/preview?thumbnail=1" : ""}`);
const params = (n: number) => ({ params: Promise.resolve({ id: id(n) }) });
beforeAll(async () => {
  db = new PGlite(); database = drizzle(db);
  await db.exec("create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;");
  await storageFixture(db);
  for (const file of ["schema18.sql", "administration18.sql", "campaigns18.sql", "hours18.sql", "tasks18.sql", "assets18.sql"]) await db.exec(readFileSync(`scripts/schema-simplification/${file}`, "utf8"));
}, 30000);
beforeEach(async () => {
  vi.clearAllMocks();
  for (const n of [1, 2]) { await db.query("insert into auth.users values($1)", [id(n)]); await db.query("insert into lub.users(id,email,email_verified_at,full_name_ar) values($1,$2,now(),'طالب اختبار')", [id(n), `file18-${n}@example.invalid`]); }
  mocks.user.mockResolvedValue({ id: id(1) });
  const file = new Blob(["%PDF-1.4"], { type: "application/pdf" });
  mocks.download.mockResolvedValue({ data: file }); mocks.signed.mockResolvedValue({ data: { signedUrl: "https://project.supabase.co/storage/signed/ascii.pdf" } });
  await db.query("insert into lub.assets(id,owner_user_id,object_key,file_name,mime_type,size_bytes) values($1,$2,$3,'إخراج الطالب.pdf','application/pdf',$4)", [id(900), id(1), `${id(1)}/${id(900)}.pdf`, file.size]);
});
afterEach(async () => { await db.exec("reset role; truncate auth.users cascade"); }); afterAll(async () => { await db?.close(); });
it("downloads from the actual merged assets table with an ASCII header filename", async () => {
  const response = await download(request(900), params(900));
  expect(response.status).toBe(303); expect(mocks.signed).toHaveBeenCalledWith(`${id(1)}/${id(900)}.pdf`, 60, { download: `${id(900)}.pdf` });
  expect(response.headers.get("cache-control")).toContain("no-store");
});
it("rejects another account before contacting storage and denies unauthenticated downloads", async () => {
  mocks.user.mockResolvedValue({ id: id(2) }); expect((await download(request(900), params(900))).status).toBe(404);
  expect(mocks.download).not.toHaveBeenCalled(); mocks.user.mockResolvedValue(null);
  expect((await download(request(900), params(900))).status).toBe(401);
});
it("previews an authorized stored thumbnail without downloading the original", async () => {
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  await db.query("insert into lub.assets(id,owner_user_id,object_key,file_name,mime_type,size_bytes,thumbnail_png_base64) values($1,$2,$3,'صورة.png','image/png',8,$4)", [id(901), id(1), `${id(1)}/${id(901)}.png`, png.toString("base64")]);
  const response = await preview(request(901, true), params(901)); expect(response.status).toBe(200);
  expect(Buffer.from(await response.arrayBuffer())).toEqual(png); expect(mocks.download).not.toHaveBeenCalled();
  mocks.user.mockResolvedValue({ id: id(2) }); expect((await preview(request(901, true), params(901))).status).toBe(404);
});
