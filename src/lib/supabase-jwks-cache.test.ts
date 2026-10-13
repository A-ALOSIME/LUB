import { describe, expect, it, vi } from "vitest";
import { getCachedSupabaseJwks } from "./supabase-jwks-cache";

const jwks = { keys: [{ kty: "EC", key_ops: ["verify"], alg: "ES256", kid: "key-1", crv: "P-256", x: "x", y: "y" }] };

describe("Supabase JWKS edge cache", () => {
  it("uses cached public keys without fetching the auth server", async () => {
    const cache = { match: vi.fn(async (key: RequestInfo | URL) => {
      expect(key).toMatchObject({ url: "https://lub.community/__edge-cache__/supabase-jwks?project=https%3A%2F%2Fcached-project.supabase.co" });
      return new Response(JSON.stringify(jwks));
    }), put: vi.fn() };
    const fetcher = vi.fn();

    await expect(getCachedSupabaseJwks("https://cached-project.supabase.co", "https://lub.community", { cache, fetcher }))
      .resolves.toEqual(jwks);

    expect(fetcher).not.toHaveBeenCalled();
  });

  it("fetches public keys on a cache miss and stores them briefly", async () => {
    const cache = {
      match: vi.fn(async (key: RequestInfo | URL) => { expect(key).toBeInstanceOf(Request); return undefined; }),
      put: vi.fn(async (key: RequestInfo | URL, value: Response) => {
        expect(key).toBeInstanceOf(Request);
        expect(value).toBeInstanceOf(Response);
      }),
    };
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      expect(input).toBeInstanceOf(Request);
      return new Response(JSON.stringify(jwks), { status: 200 });
    });

    const project = "https://miss-project.supabase.co";
    await expect(getCachedSupabaseJwks(project, "https://lub.community", { cache, fetcher }))
      .resolves.toEqual(jwks);
    await expect(getCachedSupabaseJwks(project, "https://lub.community", { cache, fetcher }))
      .resolves.toEqual(jwks);

    expect(fetcher).toHaveBeenCalledOnce();
    expect(cache.match).toHaveBeenCalledOnce();
    const input = fetcher.mock.calls[0]?.[0];
    expect(input instanceof Request ? input.url : input?.toString()).toBe(`${project}/auth/v1/.well-known/jwks.json`);
    expect(cache.put).toHaveBeenCalledOnce();
    const cacheKey = cache.put.mock.calls[0]?.[0];
    expect(cacheKey instanceof Request ? cacheKey.url : cacheKey?.toString()).toBe(`https://lub.community/__edge-cache__/supabase-jwks?project=${encodeURIComponent(project)}`);
    const cachedResponse = cache.put.mock.calls[0][1] as Response;
    expect(cachedResponse.headers.get("cache-control")).toBe("public, max-age=60");
  });

  it("does not cache malformed or unavailable key sets", async () => {
    const cache = { match: vi.fn(async () => undefined), put: vi.fn() };
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ keys: [] }), { status: 200 }));

    await expect(getCachedSupabaseJwks("https://malformed-project.supabase.co", "https://lub.community", { cache, fetcher })).resolves.toBeUndefined();
    expect(cache.put).not.toHaveBeenCalled();
  });

  it("bypasses the edge cache when the cache key is not on the current site", async () => {
    const cache = { match: vi.fn(), put: vi.fn() };
    const fetcher = vi.fn(async () => new Response(JSON.stringify(jwks), { status: 200 }));

    await expect(getCachedSupabaseJwks("https://dev-project.supabase.co", "http://localhost:3000", { cache, fetcher }))
      .resolves.toEqual(jwks);

    expect(cache.match).not.toHaveBeenCalled();
    expect(cache.put).not.toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
