import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { POST as members } from "@/app/api/organizations/[id]/members/export/route";
import { POST as registrants } from "@/app/api/organizations/[id]/registrants/export/route";

const mocks = vi.hoisted(() => ({ user: vi.fn(), session: vi.fn(), fetcher: vi.fn() }));
vi.mock("@/features/auth/session", () => ({ getVerifiedUser: mocks.user }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getSession: mocks.session } }) }));

const canonical = "https://app.example.invalid";
const internal = "http://localhost:4198";
const organization = "00000000-0000-4000-8000-000000000001";
const filters = { q: "", committee: null, locale: "ar" };
const request = (origin: string, body: unknown) => new Request(internal, {
  method: "POST", headers: { origin }, body: JSON.stringify(body),
});
const context = { params: Promise.resolve({ id: organization }) };
const routes = [
  { handler: members, body: { ...filters, status: "all" }, name: "export-members-v2" },
  { handler: registrants, body: { ...filters, state: "Accepted", event: organization }, name: "export-registrants-v2" },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("APP_URL", canonical);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://supabase.example.invalid");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "public-key");
  vi.stubGlobal("fetch", mocks.fetcher);
  mocks.user.mockResolvedValue({ id: "verified" });
  mocks.session.mockResolvedValue({ data: { session: { user: { id: "verified" }, access_token: "caller-token" } } });
  mocks.fetcher.mockImplementation(async () => new Response("xlsx"));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it.each(routes)("checks the configured browser origin for $name behind an internal host", async ({ handler, body, name }) => {
  expect((await handler(request(internal, body), context)).status).toBe(403);
  expect(mocks.user).not.toHaveBeenCalled();
  expect(mocks.fetcher).not.toHaveBeenCalled();
  const response = await handler(request(canonical, body), context);
  expect(response.status).toBe(200);
  expect(mocks.fetcher).toHaveBeenCalledWith("https://supabase.example.invalid/functions/v1/" + name,
    expect.objectContaining({ headers: expect.objectContaining({ authorization: "Bearer caller-token" }) }));
  expect(response.headers.get("cache-control")).toBe("private, no-store");
});