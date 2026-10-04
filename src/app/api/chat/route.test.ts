import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {POST} from "./route";

function request(body: string, options: {origin?: string; contentType?: string; url?: string; clientIp?: string} = {}) {
  const url = options.url ?? "https://lub.test/api/chat";
  return new Request(url, {method: "POST", headers: {
    origin: options.origin ?? "https://lub.test",
    "content-type": options.contentType ?? "application/json",
    ...(options.clientIp ? {"cf-connecting-ip": options.clientIp} : {}),
  }, body});
}

beforeEach(() => vi.stubEnv("APP_URL", "https://lub.test"));
afterEach(() => {vi.unstubAllEnvs(); vi.unstubAllGlobals();});

describe("RAG chat proxy", () => {
  it("rejects cross-origin, non-JSON, and malformed requests", async () => {
    expect((await POST(request('{"message":"hello"}', {origin: "https://evil.test"}))).status).toBe(403);
    expect((await POST(request('{"message":"hello"}', {contentType: "text/plain"}))).status).toBe(415);
    expect((await POST(request("{"))).status).toBe(400);
  });

  it("uses the loopback request origin only outside production", async () => {
    vi.stubEnv("APP_URL", "https://lub.community");
    const local = () => request('{"message":"events"}', {origin: "http://127.0.0.1:3000", url: "http://127.0.0.1:3000/api/chat"});
    expect((await POST(local())).status).toBe(503);
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("LUB_LOCAL_PREVIEW", "1");
    expect((await POST(local())).status).toBe(503);
    vi.stubEnv("LUB_LOCAL_PREVIEW", "0");
    expect((await POST(local())).status).toBe(403);
  });

  it("fails without an API endpoint and token", async () => {
    vi.stubEnv("RAG_API_URL", "");
    expect((await POST(request('{"message":"hello"}'))).status).toBe(503);
  });

  it("forwards the question with a server-only token and sanitizes streamed links", async () => {
    const token = "a".repeat(40);
    vi.stubEnv("APP_URL", "https://lub.test");
    vi.stubEnv("RAG_API_URL", "https://test.ngrok-free.app");
    vi.stubEnv("RAG_API_TOKEN", token);
    const upstream = vi.fn().mockResolvedValue(new Response([
      'data: {"type":"delta","text":"مرحبا"}',
      'data: {"type":"sources","sources":[{"label":"الفعاليات","url":"/events"},{"label":"الحساب","url":"/account"}]}',
      'data: {"type":"done"}',
      "",
    ].join("\n\n"), {headers: {"content-type": "text/event-stream"}}));
    vi.stubGlobal("fetch", upstream);
    const response = await POST(request('{"message":"متى الفعاليات؟"}'));
    const output = await response.text();
    expect(response.status).toBe(200);
    expect(output).toContain("مرحبا");
    expect(output).toContain("/events");
    expect(output).not.toContain("/account");
    expect(output).not.toContain(token);
    expect(upstream.mock.calls[0][0].toString()).toBe("https://test.ngrok-free.app/api/v1/nlp/chat/stream/lub");
    expect(upstream.mock.calls[0][1].redirect).toBe("manual");
    expect(upstream.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${token}`);
    expect(JSON.parse(upstream.mock.calls[0][1].body)).toEqual({message: "متى الفعاليات؟", limit: 5});
  });

  it("logs only upstream response metadata when the RAG service rejects a request", async () => {
    const token = "a".repeat(40);
    vi.stubEnv("RAG_API_URL", "https://test.ngrok-free.app");
    vi.stubEnv("RAG_API_TOKEN", token);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("unauthorized", {
      status: 401,
      headers: {"content-type": "application/json"},
    })));
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const response = await POST(request('{"message":"hello"}'));

    expect(response.status).toBe(503);
    expect(warning).toHaveBeenCalledWith("Ask LUB upstream response rejected", {status: 401, contentType: "application/json"});
    expect(JSON.stringify(warning.mock.calls)).not.toContain(token);
  });

  it("redacts the configured token from network failure details", async () => {
    const token = "a".repeat(40);
    vi.stubEnv("RAG_API_URL", "https://test.ngrok-free.app");
    vi.stubEnv("RAG_API_TOKEN", token);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError(`connection failed for ${token}`)));
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const response = await POST(request('{"message":"hello"}'));

    expect(response.status).toBe(503);
    expect(warning).toHaveBeenCalledWith("Ask LUB upstream request failed", {name: "TypeError", message: "connection failed for [REDACTED]"});
    expect(JSON.stringify(warning.mock.calls)).not.toContain(token);
  });

  it("limits a Cloudflare client to ten questions per minute", async () => {
    vi.stubEnv("RAG_API_URL", "");
    for (let count = 0; count < 10; count++) {
      expect((await POST(request('{"message":"hello"}', {clientIp: "203.0.113.7"}))).status).toBe(503);
    }
    expect((await POST(request('{"message":"hello"}', {clientIp: "203.0.113.7"}))).status).toBe(429);
  });
});
