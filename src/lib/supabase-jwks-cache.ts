import type { JWK } from "@supabase/auth-js";

type JsonWebKeySet = { keys: JWK[] };
type EdgeCache = Pick<Cache, "match" | "put">;
const publicKeyMemoryCache = new Map<string, { expiresAt: number; keys: JsonWebKeySet }>();
const publicKeyTtlMs = 60_000;

function getEdgeCache(): EdgeCache | undefined {
  const workerGlobal = globalThis as typeof globalThis & {
    caches?: CacheStorage & { default?: Cache };
  };
  return workerGlobal.caches?.default;
}

function isJsonWebKeySet(value: unknown): value is JsonWebKeySet {
  if (!value || typeof value !== "object" || !Array.isArray((value as { keys?: unknown }).keys)) return false;
  const keys = (value as { keys: unknown[] }).keys;
  return keys.length > 0 && keys.every(key => Boolean(key && typeof key === "object"
    && typeof (key as JWK).kid === "string" && typeof (key as JWK).kty === "string"));
}

export async function getCachedSupabaseJwks(
  supabaseUrl: string,
  cacheOrigin: string,
  options: { cache?: EdgeCache | null; fetcher?: typeof fetch } = {},
): Promise<JsonWebKeySet | undefined> {
  const cache = options.cache === undefined ? getEdgeCache() : options.cache;
  if (!cache) return undefined;

  const cacheOriginUrl = new URL(cacheOrigin);
  if (cacheOriginUrl.protocol !== "https:" || cacheOriginUrl.hostname !== "lub.community") {
    const jwks = await fetchJwks(supabaseUrl, options.fetcher ?? fetch);
    return isJsonWebKeySet(jwks) ? jwks : undefined;
  }
  const memoryKey = `${cacheOriginUrl.origin}:${new URL(supabaseUrl).origin}`;
  const now = Date.now();
  for (const [key, entry] of publicKeyMemoryCache) if (entry.expiresAt <= now) publicKeyMemoryCache.delete(key);
  const warmEntry = publicKeyMemoryCache.get(memoryKey);
  if (warmEntry) return warmEntry.keys;

  const cacheKeyUrl = new URL("/__edge-cache__/supabase-jwks", cacheOriginUrl);
  cacheKeyUrl.searchParams.set("project", new URL(supabaseUrl).origin);
  const cacheKey = new Request(cacheKeyUrl);
  try {
    const cached = await cache.match(cacheKey);
    if (cached) {
      const cachedKeys: unknown = await cached.json();
      if (isJsonWebKeySet(cachedKeys)) {
        publicKeyMemoryCache.set(memoryKey, { expiresAt: now + publicKeyTtlMs, keys: cachedKeys });
        return cachedKeys;
      }
    }
  } catch {
    // A broken edge entry should fall through to the trusted Auth endpoint.
  }

  const jwks = await fetchJwks(supabaseUrl, options.fetcher ?? fetch);
  if (!isJsonWebKeySet(jwks)) return undefined;
  if (publicKeyMemoryCache.size >= 8) {
    const oldest = publicKeyMemoryCache.keys().next().value;
    if (oldest) publicKeyMemoryCache.delete(oldest);
  }
  publicKeyMemoryCache.set(memoryKey, { expiresAt: now + publicKeyTtlMs, keys: jwks });

  const cachedResponse = new Response(JSON.stringify(jwks), {
    status: 200,
    headers: { "Cache-Control": `public, max-age=${publicKeyTtlMs / 1000}`, "Content-Type": "application/json" },
  });
  try {
    await cache.put(cacheKey, cachedResponse);
  } catch {
    // Verification can use the fetched keys even when the edge cache is unavailable.
  }
  return jwks;
}

async function fetchJwks(supabaseUrl: string, fetcher: typeof fetch): Promise<unknown> {
  try {
    const response = await fetcher(new Request(new URL("/auth/v1/.well-known/jwks.json", supabaseUrl)));
    if (!response.ok) return undefined;
    return await response.json();
  } catch {
    return undefined;
  }
}
