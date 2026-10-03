import {describe, expect, it, vi} from "vitest";
import {parseChatEvent, publicChatPath, readChatStream} from "./chat-stream";

describe("public RAG chat stream", () => {
  it("accepts only local public source paths", () => {
    expect(publicChatPath("/events/52c1b3a0-1122-3344-5566-778899aabbcc?period=all")).toBe("/events/52c1b3a0-1122-3344-5566-778899aabbcc?period=all");
    for (const path of ["https://evil.test/", "//evil.test/events", "/account", "/events/mine", "/\\evil", "/talent/%2f%2fevil.test"]) {
      expect(publicChatPath(path)).toBeNull();
    }
  });

  it("parses streamed events and drops private or external source links", () => {
    expect(parseChatEvent(JSON.stringify({type: "sources", sources: [
      {label: "Events", url: "/events"},
      {label: "Private", url: "/account"},
      {label: "External", url: "https://evil.test"},
    ]}))).toEqual({type: "sources", sources: [{label: "Events", url: "/events"}]});
    expect(parseChatEvent(JSON.stringify({type: "delta", text: "مرحبا"}))).toEqual({type: "delta", text: "مرحبا"});
    expect(parseChatEvent(JSON.stringify({type: "sources", sources: [{label: "LUB", url: "https://lub.community/events"}]}))).toEqual({type: "sources", sources: [{label: "LUB", url: "/events"}]});
    expect(() => parseChatEvent(JSON.stringify({type: "delta", text: "x".repeat(16001)}))).toThrow();
  });

  it("handles fragmented CRLF events and stops after done", async () => {
    const received: string[] = [];
    const body = new ReadableStream<Uint8Array>({start(controller) {
      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode('data: {"type":"delta","text":"هلا"}\r'));
      controller.enqueue(encoder.encode('\n\r\ndata: {"type":"done"}\r\n\r\ndata: {"type":"delta","text":"ignored"}\r\n\r\n'));
      controller.close();
    }});
    await readChatStream(body, event => {if (event.type === "delta") received.push(event.text);});
    expect(received).toEqual(["هلا"]);
  });

  it("rejects incomplete streams and cancels an oversized stream", async () => {
    await expect(readChatStream(new ReadableStream({start(controller) {controller.close();}}), vi.fn())).rejects.toThrow("Interrupted stream");
    const body = new ReadableStream<Uint8Array>({start(controller) {controller.enqueue(new Uint8Array(128001));}});
    await expect(readChatStream(body, vi.fn())).rejects.toThrow("Stream too large");
  });
});
