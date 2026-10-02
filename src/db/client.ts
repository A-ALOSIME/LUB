import "server-only";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import * as schema from "./schema";
import { databaseTLS } from "./tls";
import { getHyperdriveDatabaseUrl, getRuntimeDatabaseUrl } from "./runtime-url";

function connect() {
  const hyperdriveUrl = getHyperdriveDatabaseUrl();
  const url = getRuntimeDatabaseUrl();
  if (!url) throw new Error("Profile database is not configured.");
  return drizzle(postgres(url, {
    max: 1,
    prepare: Boolean(hyperdriveUrl),
    fetch_types: false,
    connect_timeout: 10,
    ...(!hyperdriveUrl && { ssl: databaseTLS(url) }),
  }), { schema });
}
export function getDb() { return connect(); }

export type Transaction = Parameters<Parameters<ReturnType<typeof connect>["transaction"]>[0]>[0];

// Only receive IDs from the verified Supabase user, never from form input.
export async function withUser<T>(userId: string, operation: (tx: Transaction) => Promise<T>) {
  return connect().transaction(async (tx) => {
    await tx.execute(sql`select set_config('request.jwt.claim.sub', ${userId}, true), set_config('role', 'authenticated', true)`);
    return operation(tx);
  });
}

export async function withVisitor<T>(operation: (tx: Transaction) => Promise<T>) {
  return connect().transaction(async (tx) => {
    await tx.execute(sql`select set_config('request.jwt.claim.sub', '', true), set_config('role', 'anon', true)`);
    return operation(tx);
  });
}
