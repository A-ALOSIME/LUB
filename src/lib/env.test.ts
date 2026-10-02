import { afterEach, expect, it, vi } from "vitest";
import { getAppOrigin } from "./env";
afterEach(() => vi.unstubAllEnvs());
it("accepts HTTPS and exact local HTTP origins for sign-in redirects", () => {
  for (const origin of ["https://lub.example", "http://localhost:3000", "http://127.0.0.1:3000"]) {
    vi.stubEnv("APP_URL", origin);
    expect(getAppOrigin()).toBe(origin);
  }
});
it("rejects missing, insecure remote, credentialed and non-origin URLs", () => {
  for (const origin of ["", "http://remote.example", "http://localhost.attacker.example", "https://user:pass@lub.example", "https://lub.example/path", "https://lub.example/?next=evil", "https://lub.example/#secret"]) {
    vi.stubEnv("APP_URL", origin);
    expect(() => getAppOrigin()).toThrow("Application origin is not configured.");
  }
});
