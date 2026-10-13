import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  isSuperAdminUser: vi.fn(),
  execute: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("@/features/auth/session", () => ({ getVerifiedUser: mocks.user }));
vi.mock("@/features/auth/authorization", () => ({ isSuperAdminUser: mocks.isSuperAdminUser }));
vi.mock("@/db/client", () => ({
  withUser: async (_userId: string, operation: (tx: { execute: typeof mocks.execute }) => Promise<unknown>) => operation({ execute: mocks.execute }),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ storage: { from: () => ({ upload: mocks.upload, remove: mocks.remove }) } }) }));

import { POST } from "./route";

const org = "00000000-0000-4000-8000-000000000001";
const userId = "00000000-0000-4000-8000-000000000002";

function posterRequest(organization = org) {
  const form = new FormData();
  form.set("organization", organization);
  form.set("file", new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], "poster.png", { type: "image/png" }));
  return new NextRequest("http://127.0.0.1:3000/files/upload?purpose=event-poster", {
    method: "POST",
    headers: { origin: "http://127.0.0.1:3000" },
    body: form,
  });
}

beforeEach(() => {
  vi.stubEnv("APP_URL", "http://127.0.0.1:3000");
  mocks.user.mockReset().mockResolvedValue({ id: userId });
  mocks.isSuperAdminUser.mockReset().mockResolvedValue(false);
  mocks.execute.mockReset();
  mocks.upload.mockReset().mockResolvedValue({ error: null });
  mocks.remove.mockReset().mockResolvedValue({ error: null });
});

afterEach(() => vi.unstubAllEnvs());

it("rejects an event poster when the user cannot manage that organization", async () => {
  mocks.execute.mockResolvedValueOnce([{ allowed: false }]);

  const response = await POST(posterRequest());

  expect(response.status).toBe(403);
  expect(mocks.upload).not.toHaveBeenCalled();
});

it("stores an authorized poster as a private image asset", async () => {
  mocks.execute.mockResolvedValueOnce([{ allowed: true }]).mockResolvedValueOnce([]);

  const response = await POST(posterRequest());

  expect(response.status).toBe(200);
  expect(mocks.upload).toHaveBeenCalledOnce();
  expect(mocks.upload.mock.calls[0][0]).toMatch(new RegExp(`^${userId}/[0-9a-f-]{36}$`));
  expect(mocks.upload.mock.calls[0][2]).toEqual({ contentType: "image/png", upsert: false });
  expect(mocks.execute).toHaveBeenCalledTimes(2);
  expect(response.headers.get("cache-control")).toContain("no-store");
});

it("rejects an invalid organization before checking access", async () => {
  const response = await POST(posterRequest("not-an-id"));

  expect(response.status).toBe(400);
  expect(mocks.execute).not.toHaveBeenCalled();
  expect(mocks.upload).not.toHaveBeenCalled();
});
