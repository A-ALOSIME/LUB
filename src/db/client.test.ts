import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
let database: PgliteDatabase;
let engine: PGlite;
const mocks = vi.hoisted(() => ({ postgres: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("postgres", () => ({ default: (...args: unknown[]) => { mocks.postgres(...args); return {}; } }));
vi.mock("drizzle-orm/postgres-js", () => ({ drizzle: () => database }));
import { withUser, withVisitor } from "./client";
import { setHyperdriveDatabaseUrl } from "./runtime-url";
const owner = "00000000-0000-4000-8000-000000000001";
beforeAll(async () => {
  vi.stubEnv("DATABASE_URL", "postgres://test@127.0.0.1/test");
  engine = new PGlite(); database = drizzle(engine);
  await engine.exec(`create role anon; create role authenticated; create table private_values(owner_id uuid primary key);
    insert into private_values values('${owner}'); alter table private_values enable row level security;
    grant select on private_values to authenticated;
    create policy own_values on private_values to authenticated using(owner_id=nullif(current_setting('request.jwt.claim.sub',true),'')::uuid);`);
});
afterAll(async () => { await engine.close(); vi.unstubAllEnvs(); });
it("sets the real role and subject together, enforcing ownership and restoring the connection on commit", async () => {
  const read = () => withUser(owner, tx => tx.select({ owner: sql<string>`owner_id` }).from(sql`private_values`));
  expect(await read()).toHaveLength(1);
  expect(await withUser("00000000-0000-4000-8000-000000000002", tx => tx.select({ owner: sql<string>`owner_id` }).from(sql`private_values`))).toHaveLength(0);
  const result = await engine.query<{ role: string; subject: string }>("select current_user as role,current_setting('request.jwt.claim.sub',true) as subject");
  expect(result.rows[0].role).not.toBe("authenticated");
  expect(result.rows[0].subject).toBe("");
});
it("restores scope after rollback and gives visitors no private read access", async () => {
  await expect(withUser(owner, async () => { throw new Error("rollback"); })).rejects.toThrow("rollback");
  const role = await engine.query<{ role: string }>("select current_user as role");
  expect(role.rows[0].role).not.toBe("authenticated");
  await expect(withVisitor(tx => tx.execute(sql`select * from private_values`))).rejects.toThrow();
  const visitor = await withVisitor(tx => tx.select({ role: sql<string>`current_user`, subject: sql<string>`current_setting('request.jwt.claim.sub',true)` }).from(sql`(select 1) as probe`));
  expect(visitor[0]).toMatchObject({ role: "anon", subject: "" });
});
it("creates a fresh single-connection client for each request transaction", async () => {
  mocks.postgres.mockClear();
  await withVisitor(tx => tx.execute(sql`select 1`));
  await withVisitor(tx => tx.execute(sql`select 1`));
  expect(mocks.postgres).toHaveBeenCalledTimes(2);
  for (const [, options] of mocks.postgres.mock.calls) {
    expect(options.max).toBe(1);
    expect(options.fetch_types).toBe(false);
  }
});
it("keeps the direct TLS setup for local database connections", async () => {
  mocks.postgres.mockClear();
  await withVisitor(tx => tx.execute(sql`select 1`));
  expect(mocks.postgres.mock.calls[0][1]).toMatchObject({ max: 1, prepare: false, ssl: false });
});
it("uses the Worker Hyperdrive binding in production while local runs keep their configured URL", async () => {
  setHyperdriveDatabaseUrl("postgres://worker:secret@hyperdrive.invalid/postgres");
  mocks.postgres.mockClear();
  await withVisitor(tx => tx.execute(sql`select 1`));
  expect(mocks.postgres.mock.calls[0][0]).toBe("postgres://worker:secret@hyperdrive.invalid/postgres");
  expect(mocks.postgres.mock.calls[0][1]).toMatchObject({ max: 1, prepare: true, fetch_types: false });
  expect(mocks.postgres.mock.calls[0][1]).not.toHaveProperty("ssl");
});
