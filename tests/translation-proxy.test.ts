import { afterEach, expect, it, vi } from "vitest";
import { POST } from "../src/app/api/translations/route";

afterEach(() => vi.unstubAllGlobals());
it("retires the old automatic translation endpoint without contacting a provider", async () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  const response = await POST();
  expect(response.status).toBe(410);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(await response.json()).toEqual({ error: "Automatic translation retired" });
  expect(fetcher).not.toHaveBeenCalled();
});
