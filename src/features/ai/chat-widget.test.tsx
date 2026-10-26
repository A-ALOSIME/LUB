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
  await waitFor(() => expect(screen.getByRole("link", {name: /الفعاليات/}).getAttribute("href")).toBe("/events/discover"));
  expect(fetcher).toHaveBeenCalledWith("/api/chat", expect.objectContaining({method: "POST", body: JSON.stringify({message: "كيف أسجل؟"})}));
  expect(screen.getByText("التسجيل من صفحة الفعاليات.")).toBeTruthy();
  const answer = document.querySelector(".lub-chat-assistant")!;
  expect(answer.querySelector(".lub-chat-speaker")).toBeNull();
  const copyButton = screen.getByRole("button", {name: "نسخ الإجابة"});
  expect(answer.contains(copyButton)).toBe(true);
  expect(copyButton.querySelector("svg")).toBeTruthy();
  expect(copyButton.textContent).toBe("");
  fireEvent.click(copyButton);
  await waitFor(() => expect(copy).toHaveBeenCalledWith("التسجيل من صفحة الفعاليات."));
  await waitFor(() => expect(screen.getByRole("status").textContent).toContain("نُسخت"));
  expect(copyButton.querySelector("[data-copied=true]")).toBeTruthy();
});

it("copies the answer belonging to the selected message", async () => {
  const copy = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {configurable: true, value: {writeText: copy}});
  vi.stubGlobal("fetch", vi.fn()
    .mockResolvedValueOnce(streamResponse([{type: "delta", text: "الإجابة الأولى"}, {type: "done"}]))
    .mockResolvedValueOnce(streamResponse([{type: "delta", text: "الإجابة الثانية"}, {type: "done"}])));
  render(<ChatWidget locale="ar" inline/>);
  submit("السؤال الأول");
  await screen.findByText("الإجابة الأولى");
  submit("السؤال الثاني");
  await screen.findByText("الإجابة الثانية");

  const questions = document.querySelectorAll(".lub-chat-user");
  const answers = document.querySelectorAll(".lub-chat-assistant");
  const copyButtons = screen.getAllByRole("button", {name: "نسخ الإجابة"});
  expect(questions).toHaveLength(2);
  expect(answers).toHaveLength(2);
  expect(copyButtons).toHaveLength(2);
  expect(questions[0].querySelector(".lub-chat-speaker")).toBeNull();
  fireEvent.click(copyButtons[0]);
  await waitFor(() => expect(copy).toHaveBeenCalledWith("الإجابة الأولى"));
});

it("keeps the inline start screen free of introductory and footer copy", () => {
  render(<ChatWidget locale="ar" inline/>);
  expect(screen.queryByText("اسأل عن أندية لُبّ وفعالياته وخدماته.")).toBeNull();
  expect(screen.queryByText("اسأل عن محتوى لُبّ العام فقط، ولا تكتب معلوماتك الشخصية.")).toBeNull();
  expect(screen.getByPlaceholderText("اكتب سؤالك هنا...")).toBeTruthy();
});

it("keeps the question available for retry when the service is unavailable", async () => {
  const fetcher=vi.fn().mockResolvedValueOnce({ok:false}).mockResolvedValueOnce(streamResponse([{type:"delta",text:"Try this"},{type:"done"}]));
  vi.stubGlobal("fetch",fetcher);
  render(<ChatWidget locale="en" inline/>);
  submit("How do I join a club?");
  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("question is saved"));
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("");
  expect(document.activeElement).toBe(screen.getByRole("textbox"));
  fireEvent.click(screen.getByRole("button",{name:"Retry"}));
  await screen.findByText("Try this");
  expect(fetcher).toHaveBeenLastCalledWith("/api/chat",expect.objectContaining({body:JSON.stringify({message:"How do I join a club?"})}));
  expect(screen.getAllByRole("article",{name:"Your question"})).toHaveLength(1);
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
  expect(screen.getByRole("button", {name: "إيقاف الرد"}).hasAttribute("disabled")).toBe(false);
  await act(async () => {controller.enqueue(encoder.encode('data: {"type":"done"}\n\n')); controller.close();});
});


it("starts with the brand and greeting, removes the duplicate chat heading and resets the conversation", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(streamResponse([{type: "delta", text: "أهلًا بك"}, {type: "done"}])));
  render(<ChatWidget locale="ar" inline/>);
  expect(screen.getByRole("heading", {level:1,name:"كيف أقدر أساعدك؟"})).toBeTruthy();
  expect(screen.queryByRole("button",{name:"محادثة جديدة"})).toBeNull();
  expect(screen.queryByText("كيف أنضم لنادي؟")).toBeNull();
  expect(screen.getByText("قد يخطئ المساعد، تأكد من المعلومات المهمة")).toBeTruthy();
  expect(screen.getByRole("button",{name:"إرسال السؤال"}).hasAttribute("disabled")).toBe(true);
  submit("مرحبا"); await screen.findByText("أهلًا بك");
  expect(document.querySelector(".lub-chat-header h1,.lub-chat-header h2")).toBeNull();
  fireEvent.click(screen.getByRole("button",{name:"محادثة جديدة"}));
  expect(screen.queryByRole("article")).toBeNull();
  expect(document.querySelector(".lub-chat-welcome h1")).toBeTruthy();
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("");
});

it("sends with Enter, preserves Shift+Enter and makes feedback mutually exclusive",async()=>{
  const fetcher=vi.fn().mockResolvedValue(streamResponse([{type:"delta",text:"جواب واضح"},{type:"done"}]));
  vi.stubGlobal("fetch",fetcher);render(<ChatWidget locale="ar" inline/>);
  const field=screen.getByRole("textbox");fireEvent.change(field,{target:{value:"سؤالي"}});
  const newline=new KeyboardEvent("keydown",{key:"Enter",shiftKey:true,bubbles:true,cancelable:true});
  fireEvent(field,newline);expect(newline.defaultPrevented).toBe(false);expect(fetcher).not.toHaveBeenCalled();
  fireEvent.keyDown(field,{key:"Enter"});await screen.findByText("جواب واضح");
  const like=screen.getByRole("button",{name:"إعجاب بالإجابة"}),dislike=screen.getByRole("button",{name:"عدم إعجاب بالإجابة"});
  fireEvent.click(like);expect(like.getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(dislike);expect(like.getAttribute("aria-pressed")).toBe("false");expect(dislike.getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(dislike);expect(dislike.getAttribute("aria-pressed")).toBe("false");
});

it("stops a stream, keeps its partial answer and ignores late tokens",async()=>{
  let controller!:ReadableStreamDefaultController<Uint8Array>;
  const body=new ReadableStream<Uint8Array>({start(value){controller=value;}});
  const fetcher=vi.fn().mockResolvedValueOnce({ok:true,body}).mockResolvedValueOnce(streamResponse([{type:"delta",text:"إجابة جديدة"},{type:"done"}]));
  vi.stubGlobal("fetch",fetcher);render(<ChatWidget locale="ar" inline/>);submit("السؤال الأول");
  const encoder=new TextEncoder();await act(async()=>{controller.enqueue(encoder.encode('data: {"type":"delta","text":"جواب جزئي"}\n\n'));});
  fireEvent.click(screen.getByRole("button",{name:"إيقاف الرد"}));
  expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);expect(screen.getByText("جواب جزئي")).toBeTruthy();
  expect(screen.queryByRole("alert")).toBeNull();submit("السؤال الثاني");await screen.findByText("إجابة جديدة");
  await act(async()=>{controller.enqueue(encoder.encode('data: {"type":"delta","text":"متأخر"}\n\ndata: {"type":"done"}\n\n'));controller.close();});
  expect(screen.queryByText(/متأخر/)).toBeNull();expect(screen.getByText("إجابة جديدة")).toBeTruthy();
});

it("uses the original theme logos and preserves ordinary brand text when copying an answer",async()=>{
 const copy=vi.fn().mockResolvedValue(undefined);Object.defineProperty(navigator,"clipboard",{configurable:true,value:{writeText:copy}});
 const text="اسأل لُبّ عن النادي، لُب يساعدك. لب في قلب المجتمع.";vi.stubGlobal("fetch",vi.fn().mockResolvedValue(streamResponse([{type:"delta",text},{type:"done"}])));
 render(<ChatWidget locale="ar" inline/>);expect(screen.getByRole("img",{name:"لُبّ"})).toBeTruthy();
 submit("مرحبا");await waitFor(()=>expect(document.querySelectorAll('.lub-chat-assistant .lub-brand-name')).toHaveLength(3));
 const answer=screen.getByRole("article",{name:"الإجابة"});
 expect([...answer.querySelectorAll('.lub-brand-original')].map(node=>node.textContent)).toEqual(["لُبّ","لُب","لب"]);
 expect(answer.querySelector('.lub-chat-avatar svg')).toBeTruthy();expect(answer.querySelector('.lub-chat-avatar img')).toBeNull();
 expect(answer.querySelector('.lub-chat-avatar')?.getAttribute('aria-hidden')).toBe('true');
 expect(answer.textContent).toContain("قلب المجتمع.");
 fireEvent.click(screen.getByRole("button",{name:"نسخ الإجابة"}));await waitFor(()=>expect(copy).toHaveBeenCalledWith(text));
});

it("keeps the pending answer and its symbol in place when the first token arrives",async()=>{
 let controller!:ReadableStreamDefaultController<Uint8Array>;
 vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:true,body:new ReadableStream<Uint8Array>({start(value){controller=value;}})}));
 render(<ChatWidget locale="ar" inline/>);submit("عن لُبّ");
 const pending=screen.getByRole("article",{name:"الإجابة"}),symbol=pending.querySelector('.lub-chat-avatar svg');expect(symbol).toBeTruthy();expect(pending.textContent).toContain("يفكّر…");expect(pending.textContent).not.toContain("لُب");
 await act(async()=>{controller.enqueue(new TextEncoder().encode('data: {"type":"delta","text":"أهلاً"}\n\ndata: {"type":"done"}\n\n'));controller.close();});
 expect(screen.getByRole("article",{name:"الإجابة"})).toBe(pending);expect(pending.querySelector('.lub-chat-avatar svg')).toBe(symbol);expect(pending.textContent).toContain("أهلاً");
});
