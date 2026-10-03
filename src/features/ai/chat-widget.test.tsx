// @vitest-environment jsdom
import {cleanup, fireEvent, render, screen, waitFor, act} from "@testing-library/react";
import {ReadableStream} from "node:stream/web";
import {afterEach, beforeEach, expect, it, vi} from "vitest";
import {ChatWidget} from "./chat-widget";

let pathname = "/ai";
vi.mock("next/navigation", () => ({usePathname: () => pathname}));

beforeEach(() => {Element.prototype.scrollIntoView = vi.fn();});
afterEach(() => {cleanup(); vi.unstubAllGlobals(); pathname = "/ai";});

function streamResponse(events: object[]) {
  const encoder = new TextEncoder();
  return {ok: true, body: new ReadableStream({start(controller) {
    for (const event of events) controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
    controller.close();
  }})};
}

function submit(question: string) {
  fireEvent.change(screen.getByRole("textbox"), {target: {value: question}});
  fireEvent.submit(screen.getByRole("button", {name: /إرسال السؤال|Send question/}).closest("form")!);
}

it("opens an accessible floating panel outside the dedicated AI page", () => {
  pathname = "/events";
  render(<ChatWidget locale="ar"/>);
  const launcher = screen.getByRole("button", {name: "فتح مساعد لُبّ"});
  fireEvent.click(launcher);
  expect(screen.getByRole("dialog")).toBeTruthy();
  expect(launcher.getAttribute("aria-controls")).toBe(screen.getByRole("dialog").id);
  fireEvent.keyDown(screen.getByRole("dialog"), {key: "Escape"});
  expect(document.activeElement).toBe(launcher);
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("shows the inline composer and streams a safe answer with source links and copy", async () => {
  const copy = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {configurable: true, value: {writeText: copy}});
  const fetcher = vi.fn().mockResolvedValue(streamResponse([
    {type: "status", status: "searching"},
    {type: "delta", text: "التسجيل من صفحة الفعاليات."},
    {type: "sources", sources: [{label: "الفعاليات", url: "/events"}]},
    {type: "done"},
  ]));
  vi.stubGlobal("fetch", fetcher);
  render(<ChatWidget locale="ar" inline/>);
  expect(screen.queryByRole("button", {name: "فتح مساعد لُبّ"})).toBeNull();
  submit("كيف أسجل؟");
  await waitFor(() => expect(screen.getByRole("link", {name: /الفعاليات/}).getAttribute("href")).toBe("/events"));
  expect(fetcher).toHaveBeenCalledWith("/api/chat", expect.objectContaining({method: "POST", body: JSON.stringify({message: "كيف أسجل؟"})}));
  expect(screen.getByText("التسجيل من صفحة الفعاليات.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", {name: "نسخ الإجابة"}));
  await waitFor(() => expect(copy).toHaveBeenCalledWith("التسجيل من صفحة الفعاليات."));
  expect(screen.getByRole("status").textContent).toContain("نُسخت");
});

it("keeps the question available for retry when the service is unavailable", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ok: false}));
  render(<ChatWidget locale="en" inline/>);
  submit("How do I join a club?");
  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("question is saved"));
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("How do I join a club?");
  expect(document.activeElement).toBe(screen.getByRole("textbox"));
});

it("renders streamed text before the answer finishes", async () => {
  let controller: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({start(value) {controller = value;}});
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ok: true, body}));
  render(<ChatWidget locale="ar" inline/>);
  submit("هلا");
  const encoder = new TextEncoder();
  await act(async () => {controller.enqueue(encoder.encode('data: {"type":"delta","text":"أهلًا"}\n\n'));});
  expect(screen.getByText("أهلًا")).toBeTruthy();
  expect(screen.getByRole("button", {name: "إرسال السؤال"}).hasAttribute("disabled")).toBe(true);
  await act(async () => {controller.enqueue(encoder.encode('data: {"type":"done"}\n\n')); controller.close();});
});
