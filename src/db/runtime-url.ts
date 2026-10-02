type RuntimeDatabaseGlobal = typeof globalThis & {
  __LUB_HYPERDRIVE_DATABASE_URL?: string;
};

const runtimeGlobal = globalThis as RuntimeDatabaseGlobal;

export function setHyperdriveDatabaseUrl(url: string) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Database binding is not configured.");
  }

  if (!(["postgres:", "postgresql:"].includes(parsed.protocol) && parsed.username && parsed.password)) {
    throw new Error("Database binding is not configured.");
  }

  if (runtimeGlobal.__LUB_HYPERDRIVE_DATABASE_URL && runtimeGlobal.__LUB_HYPERDRIVE_DATABASE_URL !== url) {
    throw new Error("Database binding changed during worker lifetime.");
  }

  runtimeGlobal.__LUB_HYPERDRIVE_DATABASE_URL = url;
}

export function getRuntimeDatabaseUrl() {
  return getHyperdriveDatabaseUrl() ?? process.env.DATABASE_URL;
}

export function getHyperdriveDatabaseUrl() {
  return runtimeGlobal.__LUB_HYPERDRIVE_DATABASE_URL;
}
